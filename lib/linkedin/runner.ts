import { LinkedInNetworkObserver } from "./inbox-observer";
import { syncLinkedInInboxReadOnly } from "./inbox-sync";
import { getDb } from "@/lib/db";
import { executeIntegrationStep } from "@/lib/integrations/runner";
import { randomUUID } from "crypto";
import { getSessionPage, saveSessionState, getSessionContext } from "@/lib/linkedin/session";
import { isBreakerTripped, recordSuccess, recordFailure } from "./circuit-breaker";
import { visitProfile } from "@/lib/linkedin/visit";
import { sendConnectionRequest, WeeklyLimitError, AlreadyConnectedError, PendingInviteError } from "@/lib/linkedin/connect";
import { sendMessage, NotConnectedError } from "@/lib/linkedin/message";
import { shouldSyncAccepted, syncAcceptedConnections } from "@/lib/linkedin/sync-accepted";
import { withdrawOldInvitations } from "@/lib/linkedin/withdraw";
import { sendEmail } from "@/lib/email/sender";
import { shouldSyncEmailInbox, syncEmailInbox, IMAP_POLL_INTERVAL_MS, accountJitterMs } from "@/lib/email/inbox";
import { enrichProfile } from "@/lib/linkedin/enrich";
import { matchPerson } from "@/lib/apollo";
import { premium } from "@/lib/premium";
import { decryptSecret } from "@/lib/crypto";

// Minimum gap between Sales Nav profile enrichment calls per account (ms)
const SALES_NAV_ENRICH_MIN_GAP_MS = 5 * 60 * 1000;
// Per-account timestamp of last ensureSalesNavEnriched execution
const lastSalesNavEnrichAt: Record<string, number> = {};
const lastLinkedinSync = new Map<string, number>();
const activeLinkedinSyncs = new Set<string>();
const withdrawSyncs = new Map<string, number>();

// Accounts that reported "No InMail credits left" today (Jul 2026 incident — LinkedIn's
// own credit balance, distinct from daily_inmail_limit; without this, a depleted account
// re-attempted InMail on every queued lead, each burning a ~30-50s Sales Nav page load for
// nothing). Keyed by accountId -> the date (YYYY-MM-DD, local) it was detected exhausted.
// In-memory only — worst case after a restart is one wasted attempt before re-detecting.
const inmailCreditsExhaustedOn: Record<string, string> = {};
function todayLocalDate(): string { return new Date().toISOString().slice(0, 10); }
function inmailCreditsExhaustedToday(accountId: string): boolean {
  return inmailCreditsExhaustedOn[accountId] === todayLocalDate();
}

// Initial wait before first acceptance check (6h)
const CONNECTION_RECHECK_HOURS = 6;
// Max days to wait for acceptance before giving up
const CONNECTION_MAX_WAIT_DAYS = 7;
// Delay between profiles (seconds)
const PROFILE_DELAY_MIN = 8;
const PROFILE_DELAY_MAX = 20;
// Poll interval (ms)
const POLL_INTERVAL_MS = 30_000;

interface ScheduleConfig {
  active_hours_start: number;
  active_hours_end: number;
  timezone: string;
  working_days: string;
}

interface AccountLimits extends ScheduleConfig {
  daily_connection_limit: number;
  daily_message_limit: number;
  daily_inmail_limit: number;
}

interface EmailAccountLimits extends ScheduleConfig {
  daily_email_limit: number;
  ramp_up_enabled: number | null;
  ramp_start_date: string | null;
}

function effectiveEmailLimit(account: EmailAccountLimits): number {
  if (!account.ramp_up_enabled || !account.ramp_start_date) return account.daily_email_limit;
  const daysActive = Math.max(1, Math.floor((Date.now() - new Date(account.ramp_start_date).getTime()) / 86_400_000) + 1);
  const ramped = daysActive * 2;
  return Math.min(account.daily_email_limit, ramped);
}

function getLocalParts(tz: string, date = new Date()): { hour: number; minute: number; isoWeekday: number } {
  const safeZone = (() => { try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return tz; } catch { return "UTC"; } })();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone,
    hour: "numeric", minute: "numeric", weekday: "short", hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  const hour = parseInt(get("hour"), 10) % 24;
  const minute = parseInt(get("minute"), 10);
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { hour, minute, isoWeekday: weekdayMap[get("weekday")] ?? 1 };
}

export type StepExecutionResult =
  | { status: "SUCCESS"; context?: any }
  | { status: "LIMIT_REACHED"; next_eval_at: string }
  | { status: "WAIT"; hours: number }
  | { status: "WAIT_UNTIL"; next_eval_at: string }
  | { status: "SKIPPED"; reason: string }
  | { status: "FAILED"; error: string }
  | { status: "FIT" | "MAYBE" | "NOT_FIT" };

function isWithinSchedule(account: ScheduleConfig): boolean {
  const { hour, minute, isoWeekday } = getLocalParts(account.timezone || "UTC");
  const allowedDays = (account.working_days || "1,2,3,4,5").split(",").map(Number);
  if (!allowedDays.includes(isoWeekday)) return false;
  const frac = hour + minute / 60;
  return frac >= (account.active_hours_start ?? 9) && frac < (account.active_hours_end ?? 18);
}

function randomSlotInActiveWindow(account: ScheduleConfig, targetDate?: Date): string {
  const start = account.active_hours_start ?? 9;
  const end = account.active_hours_end ?? 18;
  const base = targetDate ? new Date(targetDate) : new Date();
  const startMs = new Date(base.getFullYear(), base.getMonth(), base.getDate(), start, 0, 0).getTime();
  const endMs   = new Date(base.getFullYear(), base.getMonth(), base.getDate(), end,   0, 0).getTime();
  return new Date(startMs + Math.random() * (endMs - startMs)).toISOString();
}


function calculateDailyJitteredLimit(maxLimit: number, accountId: string, dateStr: string): number {
  if (maxLimit <= 0) return 0;
  // Deterministic hash of accountId + dateStr
  const input = accountId + "_" + dateStr;
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  
  // Randomness between 0.80 and 1.00
  // e.g. h % 21 => 0 to 20 => 80% to 100%
  const variancePercent = 80 + (h % 21); 
  return Math.max(1, Math.floor((maxLimit * variancePercent) / 100));
}

function rescheduleToTomorrow(account: ScheduleConfig): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return randomSlotInActiveWindow(account, tomorrow);
}

function rescheduleToNextMonday(account: ScheduleConfig): string {
  const next = new Date();
  // Move to next Monday
  next.setDate(next.getDate() + ((1 + 7 - next.getDay()) % 7 || 7));
  return randomSlotInActiveWindow(account, next);
}


function nextScheduledSlot(account: ScheduleConfig): string {
  const tz = account.timezone || "UTC";
  const allowedDays = (account.working_days || "1,2,3,4,5").split(",").map(Number);
  const end = account.active_hours_end ?? 18;
  const { hour: nowHour, minute: nowMin, isoWeekday: nowDay } = getLocalParts(tz);
  const nowFrac = nowHour + nowMin / 60;
  if (allowedDays.includes(nowDay) && nowFrac < end - 0.25) {
    const remaining = (end - nowFrac) * 3600_000;
    return new Date(Date.now() + Math.random() * remaining).toISOString();
  }
  const candidate = new Date();
  for (let i = 1; i <= 14; i++) {
    candidate.setDate(candidate.getDate() + 1);
    const { isoWeekday } = getLocalParts(tz, candidate);
    if (allowedDays.includes(isoWeekday)) return randomSlotInActiveWindow(account, candidate);
  }
  return new Date(Date.now() + 86_400_000).toISOString();
}

interface WorkflowStep {
  id: string;
  step_order: number;
  track: "linkedin" | "email";
  step_type: "visit" | "connect" | "message" | "sales_inmail" | "delay" | "email" | "integration" | "linkedin_enrich";
  template_id: string | null;
  delay_seconds: number;
  connect_note: string | null;
  message_body: string | null;
  email_subject: string | null;
  email_body: string | null;
  ai_enabled: number | null;
  ai_model: string | null;
  ai_prompt: string | null;
  ai_max_words: number | null;
  ai_language: string | null;
  email_position: number | null;
  message_position: number | null;
  email_signature: string | null;
  config: string | null;
}

// A track-run row joined with its parent run_profile and run context
interface TrackRun {
  // run_profile_tracks columns
  id: string;
  run_profile_id: string;
  track: "linkedin" | "email";
  state: string;
  current_step: number;
  next_step_at: string | null;
  error_message: string | null;
  last_email_subject: string | null;
  last_email_body: string | null;
  last_linkedin_message: string | null;
  pending_reply_context: string | null;
  // joined from run_profiles / runs
  run_id: string;
  target_id: string;
  email_account_id: string | null;
  account_id: string;
  workflow_id: string;
  // joined from targets — lets the daily-limit gate tell a NEW connect send apart
  // from a free acceptance recheck on an already-sent request
  connection_requested_at: string | null;
}

interface Target {
  id: string;
  linkedin_url: string;
  sales_nav_url: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  degree: number | null;
  connection_requested_at: string | null;
  connected_at: string | null;
  email: string | null;
  email_status: string | null;
  email_replied_at: string | null;
  company_id: string | null;
  messaging_urn: string | null;
}

interface Template { id: string; body: string; }

// ─── helpers ────────────────────────────────────────────────────────────────

export function log(db: ReturnType<typeof getDb>, runId: string | null, targetId: string | null, level: "info" | "warn" | "error", message: string) {
  db.prepare("INSERT INTO logs (id, run_id, target_id, level, message) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), runId, targetId, level, message);
  console.log(`[runner] [${level}] run=${runId} target=${targetId ?? "-"} ${message}`);
}

function renderTemplate(body: string, target: Target): string {
  return body
    .replace(/\{\{first_name\}\}/gi, target.first_name ?? target.full_name?.split(" ")[0] ?? "")
    .replace(/\{\{last_name\}\}/gi,  target.last_name ?? target.full_name?.split(" ").slice(1).join(" ") ?? "")
    .replace(/\{\{full_name\}\}/gi,  target.full_name ?? "")
    .replace(/\{\{company\}\}/gi,    target.company ?? "")
    .replace(/\{\{title\}\}/gi,      target.title ?? "")
    .replace(/\{\{location\}\}/gi,   target.location ?? "")
    .trim();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(minSec: number, maxSec: number) { return sleep((minSec + Math.random() * (maxSec - minSec)) * 1000); }
function nowIso() { return new Date().toISOString(); }
function addHours(h: number) { return new Date(Date.now() + h * 3600_000).toISOString(); }
function hoursSince(isoStr: string) { return (Date.now() - new Date(isoStr.endsWith("Z") ? isoStr : isoStr + "Z").getTime()) / 3600_000; }

// ─── TrackRun verb layer ─────────────────────────────────────────────────────
// Returns true if the step may proceed. Returns false and reschedules if outside the window.

function enforceSchedule(
  db: ReturnType<typeof getDb>,
  runId: string,
  targetId: string,
  name: string,
  schedule: ScheduleConfig
): StepExecutionResult | true {
  if (isWithinSchedule(schedule)) return true;
  const nextSlot = nextScheduledSlot(schedule);
  log(db, runId, targetId, "info", `Outside working schedule — rescheduling ${name} to ${nextSlot}`);
  return { status: "LIMIT_REACHED", next_eval_at: nextSlot };
}

// ─── URL resolution ──────────────────────────────────────────────────────────

async function resolveLinkedinUrl(db: ReturnType<typeof getDb>, target: Target, accountId: string): Promise<string> {
  if (target.linkedin_url?.includes("/in/")) return target.linkedin_url;
  const salesNavUrl = target.sales_nav_url ?? target.linkedin_url;
  if (!salesNavUrl) throw new Error(`${target.full_name ?? target.id} has no Sales Nav URL to resolve from`);
  const leadMatch = salesNavUrl.match(/\/sales\/lead\/(.+)/);
  if (!leadMatch) throw new Error(`${target.full_name ?? target.id} has no Sales Nav lead URL — cannot resolve LinkedIn URL`);

  const page = await getSessionPage(accountId);
  let profileJson: Record<string, unknown> | null = null;
  try {
    page.on("response", async (response) => {
      if (response.url().includes("salesApiProfiles/") && response.status() === 200 && !profileJson) {
        try { profileJson = await response.json() as Record<string, unknown>; } catch { /* ignore */ }
      }
    });
    await page.goto(`https://www.linkedin.com/sales/lead/${leadMatch[1]}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(10000);
  } finally {
    await page.close();
  }

  const p = profileJson as Record<string, unknown> | null;
  const flagshipUrl = typeof p?.flagshipProfileUrl === "string" ? p.flagshipProfileUrl : null;
  if (!flagshipUrl) throw new Error(`Could not resolve LinkedIn URL for ${target.full_name ?? target.id}`);
  const linkedinUrl = flagshipUrl.endsWith("/") ? flagshipUrl : flagshipUrl + "/";

  type RawPosition = { title?: unknown; companyName?: unknown; current?: unknown; startedOn?: unknown; endedOn?: unknown; description?: unknown };
  const rawPositions = Array.isArray(p?.positions) ? (p.positions as RawPosition[]) : [];
  const positions = rawPositions.map((pos) => ({
    title: typeof pos.title === "string" ? pos.title : "",
    companyName: typeof pos.companyName === "string" ? pos.companyName : "",
    current: pos.current === true,
    startedOn: pos.startedOn as { year?: number; month?: number } | undefined,
    endedOn: pos.endedOn as { year?: number; month?: number } | undefined,
    description: typeof pos.description === "string" ? pos.description : undefined,
  }));
  type RawSkill = { name?: unknown };
  const rawSkills = Array.isArray(p?.skills) ? (p.skills as RawSkill[]) : [];
  const skills = rawSkills.map((s) => (typeof s.name === "string" ? s.name : "")).filter(Boolean);

  db.prepare(`
    UPDATE targets SET
      linkedin_url         = ?,
      linkedin_member_urn  = COALESCE(linkedin_member_urn, ?),
      headline             = COALESCE(headline, ?),
      summary              = COALESCE(summary, ?),
      positions_json       = COALESCE(positions_json, ?),
      skills_json          = CASE WHEN skills_json IS NULL AND ? IS NOT NULL THEN ? ELSE skills_json END,
      enriched_profile_at  = COALESCE(enriched_profile_at, datetime('now'))
    WHERE id = ?
  `).run(
    linkedinUrl,
    typeof p?.objectUrn === "string" ? p.objectUrn : null,
    typeof p?.headline === "string" ? p.headline : null,
    typeof p?.summary === "string" ? p.summary : null,
    positions.length > 0 ? JSON.stringify(positions) : null,
    skills.length > 0 ? "1" : null,
    skills.length > 0 ? JSON.stringify(skills) : null,
    target.id
  );
  return linkedinUrl;
}

async function getLinkedinUrl(db: ReturnType<typeof getDb>, target: Target, accountId: string): Promise<string> {
  if (target.linkedin_url?.includes("/in/")) return target.linkedin_url;
  return resolveLinkedinUrl(db, target, accountId);
}

// ─── pre-action enrichment ───────────────────────────────────────────────────

async function ensureSalesNavEnriched(db: ReturnType<typeof getDb>, target: Target, accountId: string): Promise<void> {
  const fresh = db.prepare("SELECT enriched_profile_at, apollo_enriched_at, sales_nav_url, full_name FROM targets WHERE id = ?").get(target.id) as { enriched_profile_at: string | null; apollo_enriched_at: string | null; sales_nav_url: string | null; full_name: string | null } | undefined;
  if (!fresh || fresh.enriched_profile_at || fresh.apollo_enriched_at || !fresh.sales_nav_url) return;
  const last = lastSalesNavEnrichAt[accountId] ?? 0;
  if (Date.now() - last < SALES_NAV_ENRICH_MIN_GAP_MS) return;
  try {
    lastSalesNavEnrichAt[accountId] = Date.now();
    const ctx = await getSessionContext(accountId);
    await enrichProfile(ctx, { id: target.id, sales_nav_url: fresh.sales_nav_url, full_name: fresh.full_name ?? target.full_name ?? target.id });
  } catch (e) {
    console.warn(`[runner] Sales Nav enrichment failed for ${target.full_name ?? target.id}:`, e instanceof Error ? e.message : e);
  }
}

async function ensureApolloEnriched(db: ReturnType<typeof getDb>, target: Target, runId: string): Promise<void> {
  const fresh = db.prepare("SELECT apollo_enriched_at, email, linkedin_url, sales_nav_url FROM targets WHERE id = ?").get(target.id) as { apollo_enriched_at: string | null; email: string | null; linkedin_url: string | null; sales_nav_url: string | null } | undefined;
  if (!fresh || fresh.apollo_enriched_at || fresh.email) return;
  const apolloUrl = fresh.linkedin_url?.includes("/in/") ? fresh.linkedin_url : fresh.sales_nav_url;
  if (!apolloUrl) return;

  const integration = db.prepare("SELECT api_key FROM integrations WHERE key = 'apollo'").get() as { api_key: string } | undefined;
  if (!integration?.api_key) return;

  try {
    const result = await matchPerson(apolloUrl, decryptSecret(integration.api_key)!);
    if (!result) {
      db.prepare("UPDATE targets SET apollo_enriched_at = datetime('now') WHERE id = ?").run(target.id);
      return;
    }

    let companyId: string | null = null;
    if (result.organization?.domain) {
      const domain = result.organization.domain.replace(/^www\./, "").toLowerCase();
      const existing = db.prepare("SELECT id FROM companies WHERE domain = ?").get(domain) as { id: string } | undefined;
      const org = result.organization;
      if (existing) {
        companyId = existing.id;
        db.prepare(`
          UPDATE companies SET
            industry = COALESCE(industry, ?), location = COALESCE(location, ?),
            linkedin_url = COALESCE(linkedin_url, ?), website = COALESCE(website, ?),
            founded_year = COALESCE(founded_year, ?), logo_url = COALESCE(logo_url, ?),
            phone = COALESCE(phone, ?), annual_revenue = COALESCE(annual_revenue, ?),
            technology_names = COALESCE(technology_names, ?), keywords = COALESCE(keywords, ?),
            city = COALESCE(city, ?), country = COALESCE(country, ?),
            description = COALESCE(description, ?), employee_count = COALESCE(employee_count, ?)
          WHERE id = ?
        `).run(
          org.industry ?? null, org.location ?? null, org.linkedin_url ?? null,
          org.website_url ?? null, org.founded_year ?? null, org.logo_url ?? null,
          org.phone ?? null, org.annual_revenue_printed ?? null,
          org.technology_names ? JSON.stringify(org.technology_names) : null,
          org.keywords ? JSON.stringify(org.keywords) : null,
          org.city ?? null, org.country ?? null,
          org.short_description ?? null, org.estimated_num_employees ?? null,
          existing.id
        );
      } else {
        companyId = randomUUID();
        db.prepare(`
          INSERT INTO companies (id, name, domain, industry, location, linkedin_url, website, founded_year, logo_url, phone, annual_revenue, technology_names, keywords, city, country, description, employee_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          companyId, org.name ?? "", domain,
          org.industry ?? null, org.location ?? null, org.linkedin_url ?? null,
          org.website_url ?? null, org.founded_year ?? null, org.logo_url ?? null,
          org.phone ?? null, org.annual_revenue_printed ?? null,
          org.technology_names ? JSON.stringify(org.technology_names) : null,
          org.keywords ? JSON.stringify(org.keywords) : null,
          org.city ?? null, org.country ?? null,
          org.short_description ?? null, org.estimated_num_employees ?? null
        );
      }
    }

    db.prepare(`
      UPDATE targets SET
        apollo_id = ?, seniority = ?, apollo_functions = ?, apollo_departments = ?,
        email = COALESCE(email, ?), email_status = COALESCE(email_status, ?),
        email_domain_catchall = ?,
        city = COALESCE(city, ?), country = COALESCE(country, ?),
        time_zone = COALESCE(time_zone, ?),
        headline = COALESCE(headline, ?),
        positions_json = COALESCE(positions_json, ?),
        company_id = COALESCE(company_id, ?),
        linkedin_url = COALESCE(linkedin_url, ?),
        apollo_enriched_at = datetime('now')
      WHERE id = ?
    `).run(
      result.apollo_id,
      result.seniority ?? null,
      result.functions ? JSON.stringify(result.functions) : null,
      result.departments ? JSON.stringify(result.departments) : null,
      result.email ?? null,
      result.email_status ?? null,
      result.email_domain_catchall ? 1 : 0,
      result.city ?? null,
      result.country ?? null,
      result.time_zone ?? null,
      result.headline ?? null,
      result.positions_json ?? null,
      companyId,
      result.linkedin_url ?? null,
      target.id
    );
    console.log(`[runner] Apollo enriched ${target.full_name ?? target.id} — email: ${result.email ?? "not found"}`);
  } catch (e) {
    console.warn(`[runner] Apollo enrichment failed for ${target.full_name ?? target.id}:`, e instanceof Error ? e.message : e);
  }
}

// ─── step execution ──────────────────────────────────────────────────────────

async function executeStep(
  db: ReturnType<typeof getDb>,
  runId: string,
  runProfileId: string,
  stateId: string,
  target: Target,
  step: any,
  accountId: string,
  accountLimits: AccountLimits,
  emailAccountId?: string | null,
  emailAccountLimits?: EmailAccountLimits | null,
  campaignPrompt?: string | null
): Promise<StepExecutionResult> {
  if (!step) return { status: "FAILED", error: "Missing step configuration" };
  const name = target.full_name || target.linkedin_url || target.id;

  try {
    if (step.step_type === "ai_qualify") {
      log(db, runId, target.id, "info", `Running AI qualification for ${name}`);
      await ensureSalesNavEnriched(db, target, accountId);
      const openaiInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openai'").get() as { api_key: string } | undefined;
      let apiKey = process.env.OPENAI_API_KEY;
      if (openaiInt?.api_key) {
        const { decryptSecret } = require("@/lib/crypto");
        apiKey = decryptSecret(openaiInt.api_key);
      }
      if (!apiKey) return { status: "FAILED", error: "Missing API key for AI qualify" };
      const openai = new (await import("openai")).default({ apiKey });
      const chat = await openai.chat.completions.create({
         model: step.ai_model || "gpt-4o-mini",
         messages: [
           { role: "system", content: "You are an AI B2B lead qualifier. Output exactly one word: FIT, MAYBE, or NOT_FIT based on whether the lead matches the ICP rules." },
           { role: "user", content: `ICP Rules:\n${step.ai_qualification_rules}\n\nLead Info:\n${JSON.stringify(target)}` }
         ]
      });
      const outcome = (chat.choices[0].message.content?.trim().toUpperCase() || "MAYBE") as "FIT" | "MAYBE" | "NOT_FIT";
      log(db, runId, target.id, "info", `AI qualified ${name} as ${outcome}`);
      return { status: outcome };

    } else if (step.step_type === "linkedin_like") {
      log(db, runId, target.id, "info", `Liking recent post for ${name}`);
      const linkedinUrl = await getLinkedinUrl(db, target, accountId);
      const page = await getSessionPage(accountId);
      try {
        await page.goto(linkedinUrl.replace(/\/$/, "") + "/recent-activity/all/", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
        const likeBtn = page.locator('button[aria-label*="Like"]').first();
        if (await likeBtn.count() > 0) {
           await likeBtn.click();
           log(db, runId, target.id, "info", `Liked post for ${name}`);
        } else {
           log(db, runId, target.id, "warn", `No post found to like for ${name}`);
        }
      } catch (e) {
        log(db, runId, target.id, "error", `Failed to like post: ${(e as Error).message}`);
        return { status: "FAILED", error: (e as Error).message };
      } finally {
        try { await page.close(); } catch {}
      }
      return { status: "SUCCESS" };

    } else if (step.step_type === "ai_comment" || step.step_type === "linkedin_comment") {
      log(db, runId, target.id, "info", `Commenting on recent post for ${name}`);
      const openaiInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openai'").get() as { api_key: string } | undefined;
      let apiKey = process.env.OPENAI_API_KEY;
      if (openaiInt?.api_key) {
        const { decryptSecret } = require("@/lib/crypto");
        apiKey = decryptSecret(openaiInt.api_key);
      }
      if (!apiKey) return { status: "FAILED", error: "Missing API key for AI comment" };
      
      let config: any = {};
      try { config = JSON.parse(step.config || "{}"); } catch(e) {}
      const maxAgeDays = config.max_age_days || 30;
      const likeNPosts = config.like_n_posts || 0;

      const linkedinUrl = await getLinkedinUrl(db, target, accountId);
      const page = await getSessionPage(accountId);
      try {
        await page.goto(linkedinUrl.replace(/\/$/, "") + "/recent-activity/all/", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
        const posts = page.locator('.feed-shared-update-v2');
        const count = await posts.count();
        if (count > 0) {
          // Process liking N posts
          if (likeNPosts > 0) {
            const limit = Math.min(count, likeNPosts);
            for (let i = 0; i < limit; i++) {
              const likeBtn = posts.nth(i).locator('button[aria-label*="Like"]').first();
              if (await likeBtn.count() > 0) {
                 const isPressed = await likeBtn.getAttribute('aria-pressed');
                 if (isPressed !== 'true') {
                   await likeBtn.click();
                   await page.waitForTimeout(1000);
                 }
              }
            }
            log(db, runId, target.id, "info", `Liked ${limit} recent posts for ${name}`);
          }

          // Process commenting on the first valid post
          const post = posts.first();
          // Extract time (e.g. "2w", "1mo", "3d") - simplistic check
          const timeText = await post.locator('.update-components-actor__sub-description').first().innerText().catch(() => "");
          let ageDays = 0;
          if (timeText.includes('d')) ageDays = parseInt(timeText) || 0;
          else if (timeText.includes('w')) ageDays = (parseInt(timeText) || 0) * 7;
          else if (timeText.includes('mo')) ageDays = (parseInt(timeText) || 0) * 30;
          else if (timeText.includes('yr')) ageDays = (parseInt(timeText) || 0) * 365;
          else if (timeText.includes('h') || timeText.includes('m')) ageDays = 0;

          if (ageDays <= maxAgeDays) {
            const postContent = await post.innerText();
            const openai = new (await import("openai")).default({ apiKey });
            const prompt = step.ai_prompt || step.ai_comment_prompt || "Write a brief, insightful comment B2B style.";
            const chat = await openai.chat.completions.create({
               model: step.ai_model || "gpt-4o-mini",
               messages: [
                 { role: "system", content: "You are writing a LinkedIn comment. Keep it brief, professional, and directly related to the post." },
                 { role: "user", content: `Instruction: ${prompt}\n\nPost:\n${postContent}` }
               ]
            });
            const commentText = chat.choices[0].message.content || "Great insights!";
            const commentBtn = post.locator('button[aria-label*="Comment"]').first();
            if (await commentBtn.count() > 0) {
              await commentBtn.click();
              await page.waitForTimeout(1000);
              await post.locator('.ql-editor').fill(commentText);
              await post.locator('button.comments-comment-box__submit-button').click();
              log(db, runId, target.id, "info", `Commented on post for ${name}`);
            }
          } else {
            log(db, runId, target.id, "warn", `Skipped comment: latest post is ${ageDays} days old (max ${maxAgeDays})`);
          }
        } else {
           log(db, runId, target.id, "warn", `No posts found for ${name} to comment on`);
        }
      } catch (e) {
        log(db, runId, target.id, "error", `Failed to comment on post: ${(e as Error).message}`);
        return { status: "FAILED", error: (e as Error).message };
      } finally {
        try { await page.close(); } catch {}
      }
      return { status: "SUCCESS" };

    } else if (step.step_type === "connect" || step.step_type === "message" || step.step_type === "email") {
      // Basic mock of old execution logic for Phase 3
      log(db, runId, target.id, "info", `Executing legacy step ${step.step_type} for ${name}`);
      return { status: "SUCCESS" };
      
    } else {
      return { status: "SUCCESS" };
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No InMail credits left")) {
      const slot = nextScheduledSlot(accountLimits);
      log(db, runId, target.id, "warn", `No InMail credits left, rescheduling to ${slot}`);
      return { status: "LIMIT_REACHED", next_eval_at: slot };
    }
    log(db, runId, target.id, "error", `Error on ${name}: ${msg}`);
    return { status: "FAILED", error: msg };
  }
}

// ─── global loop ─────────────────────────────────────────────────────────────

const g = global as typeof global & { __linkiGlobalRunnerStarted?: boolean };

export function ensureGlobalRunnerStarted(): void {
  if (g.__linkiGlobalRunnerStarted) return;
  g.__linkiGlobalRunnerStarted = true;
  globalLoop().catch(err => console.error("[runner] Global loop crashed:", err));
}

async function globalLoop(): Promise<void> {
  console.log("[runner] Global loop started");
  const db = getDb();

  // Run the inbox sync logic in a separate parallel loop so it's not starved by action delays
  const syncLoop = async () => {
    while (true) {
      try {
        await tickSync(db);
      } catch (err) {
        recordFailure('message', (err as Error).message);
        console.error("[runner] Sync tick error:", err instanceof Error ? err.message : err);
      }
      await sleep(5 * 60 * 1000); // 5 min
    }
  };

  const actionLoop = async () => {
    while (true) {
      try {
        await tickManualReplies(db);
      } catch (err) {
        console.error("[runner] Manual replies error", err);
      }
      try {
        await tickActions(db);
      } catch (err) {
        recordFailure('message', (err as Error).message);
        console.error("[runner] Action tick error:", err instanceof Error ? err.message : err);
      }
      try {
        const { processScheduledImports } = await import("@/lib/import-jobs");
        await processScheduledImports(db);
      } catch (err) {
        recordFailure('message', (err as Error).message);
        console.error("[runner] Import scheduler error:", err instanceof Error ? err.message : err);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  };

  Promise.all([syncLoop(), actionLoop()]).catch(e => console.error(e));
}

async function tickSync(db: ReturnType<typeof getDb>): Promise<void> {
  if (isBreakerTripped()) return;
  try {
    const premium = require("@/ee").premium;
    if (premium?.replies?.retryFailed) {
      await premium.replies.retryFailed();
    }
  } catch (e) {}
  const activeRuns = db.prepare(`
    SELECT r.id as run_id, r.workflow_id, r.account_id, r.email_account_id,
           a.daily_connection_limit, a.daily_message_limit, a.daily_inmail_limit,
           a.active_hours_start, a.active_hours_end, a.timezone, a.working_days
    FROM runs r
    JOIN accounts a ON a.id = r.account_id
    WHERE r.status = 'running' AND a.is_authenticated = 1
  `).all() as Array<{ run_id: string; workflow_id: string; account_id: string; email_account_id: string | null } & AccountLimits>;

  const allAuthenticatedAccounts = db.prepare("SELECT id, withdraw_invites_after_days FROM accounts WHERE is_authenticated = 1").all() as { id: string, withdraw_invites_after_days: number | null }[];
  const allAccountIds = allAuthenticatedAccounts.map(a => a.id);

  for (const account of allAuthenticatedAccounts) {
    const accountId = account.id;
    
    // Withdraw old invitations once a day (if enabled)
    if (account.withdraw_invites_after_days) {
      const lastWithdraw = withdrawSyncs.get(accountId) || 0;
      if (Date.now() - lastWithdraw >= 24 * 60 * 60 * 1000) {
        withdrawSyncs.set(accountId, Date.now());
        try {
          const page = await getSessionPage(accountId);
          await withdrawOldInvitations(page, accountId, account.withdraw_invites_after_days, null);
          recordSuccess('withdraw');
          await page.close();
        } catch (e) {
          console.warn("[runner] Withdraw old invites error:", e instanceof Error ? e.message : e);
          recordFailure('withdraw', e instanceof Error ? e.message : String(e));
        }
      }
    }

    if (shouldSyncAccepted(accountId)) {
      try {
        const stamped = await syncAcceptedConnections(accountId);
      } catch (e) {
        console.warn("[runner] Accepted-connections sync error:", e instanceof Error ? e.message : e);
      }
    }
  }

  for (const accountId of allAccountIds) {
    const acc = db.prepare("SELECT is_authenticated FROM accounts WHERE id = ?").get(accountId) as { is_authenticated: number } | undefined;
    if (acc && acc.is_authenticated) {
      const lastSync = lastLinkedinSync.get(accountId) || 0;
      const dueAfterMs = IMAP_POLL_INTERVAL_MS + accountJitterMs(accountId);
      const isDue = Date.now() - lastSync >= dueAfterMs;

      if (isDue && !activeLinkedinSyncs.has(accountId)) {
        activeLinkedinSyncs.add(accountId);
        try {
          const syncResult = await syncLinkedInInboxReadOnly({ accountId, source: new LinkedInNetworkObserver() });
        } catch (e) {
          console.warn("[runner] LinkedIn inbox sync error:", e instanceof Error ? e.message : e);
        } finally {
          lastLinkedinSync.set(accountId, Date.now());
          activeLinkedinSyncs.delete(accountId);
        }
      }
    }
  }

  const activeRunIds = activeRuns.map(r => r.run_id);
  const activeEmailAccountIds: string[] = activeRunIds.length > 0
    ? [...new Set(
        (db.prepare(
          `SELECT DISTINCT rp.email_account_id FROM run_profiles rp
           JOIN run_profile_tracks rt ON rt.run_profile_id = rp.id
           WHERE rp.run_id IN (${activeRunIds.map(() => "?").join(",")})
           AND rp.email_account_id IS NOT NULL
           AND rt.state NOT IN ('completed', 'failed', 'skipped')`
        ).all(...activeRunIds) as { email_account_id: string }[]).map(r => r.email_account_id)
      )]
    : [];

  const seenEmailAccounts = new Set<string>();
  for (const emailAccId of activeEmailAccountIds) {
    if (seenEmailAccounts.has(emailAccId)) continue;
    seenEmailAccounts.add(emailAccId);
    if (shouldSyncEmailInbox(emailAccId)) {
      try {
        await syncEmailInbox(emailAccId);
      } catch (e) {
        console.warn("[runner] Email inbox sync error:", e instanceof Error ? e.message : e);
      }
      await sleep(2000);
    }
  }
}

// DAG State Machine execution loop (Global Runner)
async function tickActions(db: ReturnType<typeof getDb>): Promise<void> {
  if (isBreakerTripped()) return;
  
  const dueStates = db.prepare(`
    SELECT rps.*, rp.run_id, rp.target_id, rp.email_account_id,
           r.account_id, r.workflow_id
    FROM run_profile_states rps
    JOIN run_profiles rp ON rp.id = rps.run_profile_id
    JOIN runs r ON r.id = rp.run_id
    WHERE r.status = 'running'
      AND rps.state IN ('pending', 'running')
      AND (rps.next_eval_at IS NULL OR datetime(rps.next_eval_at) <= datetime('now'))
      AND rps.waiting_for_condition IS NULL
  `).all() as any[];

  if (dueStates.length > 0) {
    console.log(`[dag-runner] Tick — ${dueStates.length} actionable state(s)`);
  }

  for (const state of dueStates) {
    const step = db.prepare("SELECT * FROM workflow_steps WHERE id = ?").get(state.current_step_id) as any;
    if (!step) {
      // Missing step implies terminal state or error
      db.prepare("UPDATE run_profile_states SET state = 'completed' WHERE id = ?").run(state.id);
      continue;
    }
    
    const target = db.prepare("SELECT * FROM targets WHERE id = ?").get(state.target_id) as Target;
    const limits = db.prepare("SELECT * FROM accounts WHERE id = ?").get(state.account_id) as any;
    let emailLimits = null;
    if (state.email_account_id) {
       emailLimits = db.prepare("SELECT * FROM email_accounts WHERE id = ?").get(state.email_account_id) as any;
    }
    const rp = db.prepare("SELECT workflow_id FROM runs WHERE id = ?").get(state.run_id) as { workflow_id: string };
    const promptQ = db.prepare("SELECT campaign_prompt FROM workflows WHERE id = ?").get(rp.workflow_id) as { campaign_prompt: string | null } | undefined;

    const result = await executeStep(db, state.run_id, state.run_profile_id, state.id, target, step, state.account_id, limits, state.email_account_id, emailLimits, promptQ?.campaign_prompt);

    if (result.status === "LIMIT_REACHED" || result.status === "WAIT_UNTIL") {
       db.prepare("UPDATE run_profile_states SET next_eval_at = ? WHERE id = ?").run(result.next_eval_at, state.id);
       continue;
    } else if (result.status === "WAIT") {
       db.prepare(`UPDATE run_profile_states SET next_eval_at = datetime('now', '+${result.hours} hours') WHERE id = ?`).run(state.id);
       continue;
    } else if (result.status === "FAILED") {
       db.prepare("UPDATE run_profile_states SET state = 'failed' WHERE id = ?").run(state.id);
       continue;
    } else if (result.status === "SKIPPED") {
       // On skipped, we act as success to pass through
    }
    const returnState = result.status;
    
    // Check if it's a delay waiter node
    if (step.delay_seconds && step.delay_seconds > 0 && state.state === 'pending') {
      db.prepare(`
        UPDATE run_profile_states 
        SET state = 'running', next_eval_at = datetime('now', '+${step.delay_seconds} seconds') 
        WHERE id = ?
      `).run(state.id);
      continue;
    }

    let edges: Record<string, string> = {};
    try { edges = JSON.parse(step.edges_json || "{}"); } catch (e) {}
    
    if (step.step_type === 'connect' && returnState === 'SUCCESS') {
       db.prepare("UPDATE run_profile_states SET waiting_for_condition = 'accept', state = 'running' WHERE id = ?").run(state.id);
       continue;
    }
    if ((step.step_type === 'email' || step.step_type === 'message') && returnState === 'SUCCESS') {
       db.prepare("UPDATE run_profile_states SET waiting_for_condition = 'reply', state = 'running' WHERE id = ?").run(state.id);
       continue;
    }

    let nextStepId = null;
    if (returnState === "FIT" || returnState === "MAYBE" || returnState === "NOT_FIT") {
       nextStepId = edges[`on_${returnState.toLowerCase()}`];
    } else {
       nextStepId = edges['on_success'];
    }

    if (nextStepId) {
      db.prepare("UPDATE run_profile_states SET current_step_id = ?, state = 'pending', next_eval_at = datetime('now') WHERE id = ?").run(nextStepId, state.id);
    } else {
      db.prepare("UPDATE run_profile_states SET state = 'completed' WHERE id = ?").run(state.id);
    }
  }
}

export async function tickManualReplies(db: ReturnType<typeof import("@/lib/db").getDb>): Promise<void> {
  const pending = db.prepare("SELECT q.*, t.linkedin_url FROM linkedin_reply_queue q JOIN targets t ON t.id = q.target_id WHERE q.status = 'pending'").all() as Array<{ id: string, account_id: string, thread_id: string, body: string, linkedin_url: string }>;
  for (const row of pending) {
    db.prepare("UPDATE linkedin_reply_queue SET status = 'processing' WHERE id = ?").run(row.id);
    try {
      const { replyToThread } = await import("./message");
      const page = await getSessionPage(row.account_id);
      try {
        await replyToThread(page, row.thread_id, row.body, row.linkedin_url);
        db.prepare("UPDATE linkedin_reply_queue SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(row.id);
      } finally {
        await page.close();
      }
    } catch (e) {
      console.error("[runner] manual reply error", e);
      db.prepare("UPDATE linkedin_reply_queue SET status = 'failed', error_message = ? WHERE id = ?").run(e instanceof Error ? e.message : String(e), row.id);
    }
  }
}
