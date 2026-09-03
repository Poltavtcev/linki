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
// These are the only functions that write to run_profile_tracks rows.

export function trAdvance(db: ReturnType<typeof getDb>, tr: TrackRun, steps: WorkflowStep[]) {
  const nextIndex = tr.current_step + 1;
  if (nextIndex >= steps.length) {
    db.prepare(
      "UPDATE run_profile_tracks SET state = 'completed', current_step = ?, last_step_at = datetime('now'), next_step_at = NULL WHERE id = ?"
    ).run(nextIndex, tr.id);
  } else {
    const nextStep = steps[nextIndex];
    const nextAt = nextStep.delay_seconds > 0 ? new Date(Date.now() + nextStep.delay_seconds * 1000).toISOString() : null;
    db.prepare(
      "UPDATE run_profile_tracks SET current_step = ?, last_step_at = datetime('now'), next_step_at = ? WHERE id = ?"
    ).run(nextIndex, nextAt, tr.id);
  }
}

function trWait(db: ReturnType<typeof getDb>, tr: TrackRun, hours: number) {
  db.prepare("UPDATE run_profile_tracks SET next_step_at = ? WHERE id = ?").run(addHours(hours), tr.id);
}

function trReschedule(db: ReturnType<typeof getDb>, tr: TrackRun, isoTimestamp: string) {
  db.prepare("UPDATE run_profile_tracks SET next_step_at = ? WHERE id = ?").run(isoTimestamp, tr.id);
}

function trSkip(db: ReturnType<typeof getDb>, tr: TrackRun, reason: string) {
  db.prepare("UPDATE run_profile_tracks SET state = 'skipped', error_message = ? WHERE id = ?").run(reason, tr.id);
}

function trFail(db: ReturnType<typeof getDb>, tr: TrackRun, reason: string) {
  db.prepare("UPDATE run_profile_tracks SET state = 'failed', error_message = ? WHERE id = ?").run(reason, tr.id);
}

function trRecordContext(db: ReturnType<typeof getDb>, tr: TrackRun, ctx: { linkedinMessage?: string; emailSubject?: string; emailBody?: string; emailMessageId?: string }) {
  if (ctx.linkedinMessage !== undefined) {
    db.prepare("UPDATE run_profile_tracks SET last_linkedin_message = ? WHERE id = ?").run(ctx.linkedinMessage, tr.id);
  }
  if (ctx.emailSubject !== undefined || ctx.emailBody !== undefined || ctx.emailMessageId !== undefined) {
    db.prepare("UPDATE run_profile_tracks SET last_email_subject = COALESCE(?, last_email_subject), last_email_body = COALESCE(?, last_email_body), last_email_message_id = COALESCE(?, last_email_message_id) WHERE id = ?")
      .run(ctx.emailSubject ?? null, ctx.emailBody ?? null, ctx.emailMessageId ?? null, tr.id);
  }
}

// ─── enforceSchedule helper ──────────────────────────────────────────────────
// Returns true if the step may proceed. Returns false and reschedules if outside the window.

function enforceSchedule(
  db: ReturnType<typeof getDb>,
  tr: TrackRun,
  runId: string,
  targetId: string,
  name: string,
  schedule: ScheduleConfig
): boolean {
  if (isWithinSchedule(schedule)) return true;
  const nextSlot = nextScheduledSlot(schedule);
  log(db, runId, targetId, "info", `Outside working schedule — rescheduling ${name} to ${nextSlot}`);
  trReschedule(db, tr, nextSlot);
  return false;
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
  tr: TrackRun,
  target: Target,
  steps: WorkflowStep[],
  accountId: string,
  accountLimits: AccountLimits,
  emailAccountId?: string | null,
  emailAccountLimits?: EmailAccountLimits | null,
  campaignPrompt?: string | null
): Promise<void> {
  const stepIndex = tr.current_step;
  if (stepIndex >= steps.length) {
    db.prepare("UPDATE run_profile_tracks SET state = 'completed', last_step_at = datetime('now') WHERE id = ?").run(tr.id);
    return;
  }

  // Auto-unenroll if lead has replied on either channel — mark ALL track-runs for this profile skipped
  const replyCheck = db.prepare("SELECT last_replied_at, email_replied_at FROM targets WHERE id = ?").get(target.id) as { last_replied_at: string | null; email_replied_at: string | null };
  if (replyCheck?.last_replied_at || replyCheck?.email_replied_at) {
    const channel = replyCheck.email_replied_at ? "email" : "LinkedIn";
    log(db, runId, target.id, "info", `${target.full_name ?? target.linkedin_url} replied via ${channel} — unenrolling from workflow`);
    db.prepare(
      "UPDATE run_profile_tracks SET state = 'skipped', error_message = 'Lead replied' WHERE run_profile_id = ? AND state NOT IN ('completed', 'failed', 'skipped')"
    ).run(tr.run_profile_id);
    return;
  }

  const step = steps[stepIndex];
  const name = target.full_name ?? target.linkedin_url;

  try {
    if (step.step_type === "delay") {
      trAdvance(db, tr, steps);
      log(db, runId, target.id, "info", `Delay step passed for ${name}`);
      return;
    }

    if (step.step_type === "linkedin_enrich") {
      db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
      const fresh = db.prepare("SELECT enriched_profile_at FROM targets WHERE id = ?").get(target.id) as { enriched_profile_at: string | null } | undefined;
      if (fresh?.enriched_profile_at) {
        log(db, runId, target.id, "info", `${name} is already enriched — skipping scrape`);
      } else {
        log(db, runId, target.id, "info", `Enriching Sales Navigator profile for ${name}`);
        await ensureSalesNavEnriched(db, target, accountId);
      }
      trAdvance(db, tr, steps);
      return;
    }

    if (step.step_type === "visit") {
      db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
      log(db, runId, target.id, "info", `Visiting ${name}`);
      const linkedinUrl = await getLinkedinUrl(db, target, accountId);
      const page = await getSessionPage(accountId);
      let visitResult: { isFirstDegree: boolean; messagingUrn: string | null };
      try { visitResult = await visitProfile(page, linkedinUrl); recordSuccess('visit'); log(db, runId, target.id, 'info', `Profile visited: ${target.full_name ?? linkedinUrl}`); } catch(e) { recordFailure('visit', (e as Error).message); throw e; } finally { await page.close(); }
      await saveSessionState(accountId);
      if (visitResult.isFirstDegree && target.degree !== 1) {
        db.prepare("UPDATE targets SET degree = 1, connected_at = COALESCE(connected_at, ?) WHERE id = ?").run(nowIso(), target.id);
        log(db, runId, target.id, "info", `${name} already 1st-degree — backfilled connection status`);
      }
      if (visitResult.messagingUrn) {
        db.prepare("UPDATE targets SET messaging_urn = COALESCE(messaging_urn, ?) WHERE id = ?").run(visitResult.messagingUrn, target.id);
      }
      trAdvance(db, tr, steps);
      log(db, runId, target.id, "info", `Visited ${name}`);

    } else if (step.step_type === "connect") {
      if (!enforceSchedule(db, tr, runId, target.id, name, accountLimits)) return;

      const freshTarget = db.prepare("SELECT * FROM targets WHERE id = ?").get(target.id) as Target;
      if (freshTarget.degree === 1) {
        if (!freshTarget.connected_at) db.prepare("UPDATE targets SET connected_at = ? WHERE id = ?").run(nowIso(), target.id);
        log(db, runId, target.id, "info", `${name} already connected — skipping connect step`);
        trAdvance(db, tr, steps);
        return;
      }

      if (freshTarget.connection_requested_at) {
        const hoursSinceRequest = hoursSince(freshTarget.connection_requested_at);
        if (hoursSinceRequest / 24 > CONNECTION_MAX_WAIT_DAYS) {
          log(db, runId, target.id, "warn", `${name} did not accept after ${CONNECTION_MAX_WAIT_DAYS} days — skipping`);
          trSkip(db, tr, `Did not accept connection after ${CONNECTION_MAX_WAIT_DAYS} days`);
          return;
        }
        // Acceptance is detected by the daily sync-accepted job (scrolls invitation manager).
        // Runner just re-checks degree from DB — no per-profile page visits needed.
        log(db, runId, target.id, "info", `${name} not yet accepted — rechecking in ${CONNECTION_RECHECK_HOURS}h`);
        trWait(db, tr, CONNECTION_RECHECK_HOURS);
        return;
      }

      db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
      log(db, runId, target.id, "info", `Sending connection request to ${name}`);
      const linkedinUrl = await getLinkedinUrl(db, target, accountId);
      const page = await getSessionPage(accountId);
      try { await sendConnectionRequest(page, linkedinUrl); recordSuccess('connect'); } catch(e) { recordFailure('connect', (e as Error).message); throw e; } finally { await page.close(); }
      await saveSessionState(accountId);
      db.prepare("UPDATE targets SET connection_requested_at = ? WHERE id = ?").run(nowIso(), target.id);
      trWait(db, tr, CONNECTION_RECHECK_HOURS);
      log(db, runId, target.id, "info", `Connection request sent to ${name} — will recheck in ${CONNECTION_RECHECK_HOURS}h`);

    } else if (step.step_type === "message") {
      await ensureSalesNavEnriched(db, target, accountId);
      if (!enforceSchedule(db, tr, runId, target.id, name, accountLimits)) return;

      const freshTarget = db.prepare("SELECT * FROM targets WHERE id = ?").get(target.id) as Target;
      if (freshTarget.degree !== 1) {
        const requested = freshTarget.connection_requested_at;
        if (requested && hoursSince(requested) / 24 > CONNECTION_MAX_WAIT_DAYS) {
          log(db, runId, target.id, "warn", `${name} never accepted — skipping message step`);
          trSkip(db, tr, "Never accepted connection");
          return;
        }
        log(db, runId, target.id, "info", `${name} not yet connected — rescheduling message in ${CONNECTION_RECHECK_HOURS}h`);
        trWait(db, tr, CONNECTION_RECHECK_HOURS);
        return;
      }

      let messageText = "";
      if (step.ai_enabled) {
        if (!premium?.ai) {
          log(db, runId, target.id, "warn", `AI writer is a premium feature — not available in this build. Skipping ${name}`);
          trAdvance(db, tr, steps);
          return;
        }
        const openaiInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openai'").get() as { api_key: string } | undefined;
        const openrouterInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openrouter'").get() as { api_key: string } | undefined;
        const apiKey = process.env.OPENAI_API_KEY || (openaiInt?.api_key ? decryptSecret(openaiInt.api_key) : null) || (openrouterInt?.api_key ? decryptSecret(openrouterInt.api_key) : null);
        const agentCfgForMsg = premium.ai.getAgentConfig();
        const resolvedMsgModel = step.ai_model || agentCfgForMsg.default_model || "gpt-4o-mini";
        if (!apiKey || !resolvedMsgModel) {
          log(db, runId, target.id, "warn", `AI enabled on message step but API key or model missing — skipping ${name}`);
          trAdvance(db, tr, steps);
          return;
        }
        const contactData = premium.ai.getContactWithCompany(target.id);
        if (!contactData) {
          log(db, runId, target.id, "warn", `Could not load contact data for AI message — skipping ${name}`);
          trAdvance(db, tr, steps);
          return;
        }
        log(db, runId, target.id, "info", `Generating AI message for ${name} with ${resolvedMsgModel}`);
        const msgPosition = step.message_position ?? 1;
        let previousMessageContext: { followupNumber: number; previousMessage: string } | undefined;
        if (msgPosition > 1 && tr.last_linkedin_message) {
          previousMessageContext = { followupNumber: msgPosition - 1, previousMessage: tr.last_linkedin_message };
        }
        const result = await premium.ai.writeLinkedInMessage({
          apiKey: apiKey,
          model: resolvedMsgModel,
          stepType: "message",
          stepPrompt: step.ai_prompt ?? "",
          maxWords: step.ai_max_words ?? undefined,
          language: step.ai_language ?? undefined,
          campaignPrompt: campaignPrompt ?? undefined,
          contact: contactData.contact,
          company: contactData.company,
          agentConfig: agentCfgForMsg,
          previousMessageContext,
          runId,
          targetId: target.id,
          stepId: step.id,
        });
        messageText = result.body;
      } else {
        const multiTemplateIds = (db.prepare("SELECT template_id FROM workflow_step_templates WHERE step_id = ?").all(step.id) as Array<{ template_id: string }>).map(r => r.template_id);
        if (multiTemplateIds.length > 0) {
          const randomId = multiTemplateIds[Math.floor(Math.random() * multiTemplateIds.length)];
          const tmpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(randomId) as Template | undefined;
          if (tmpl) messageText = renderTemplate(tmpl.body, freshTarget);
        } else if (step.template_id) {
          const tmpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(step.template_id) as Template | undefined;
          if (tmpl) messageText = renderTemplate(tmpl.body, freshTarget);
        }
        if (!messageText && step.message_body) messageText = renderTemplate(step.message_body, freshTarget);
      }
      if (!messageText) {
        log(db, runId, target.id, "warn", `No message body for message step — skipping ${name}`);
        trAdvance(db, tr, steps);
        return;
      }

      db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
      log(db, runId, target.id, "info", `Sending message to ${name}`);
      const messageLinkedinUrl = await getLinkedinUrl(db, target, accountId);
      const page = await getSessionPage(accountId);
      try {
        if (!target.full_name) throw new Error(`Target ${target.id} has no full_name — cannot search messaging`);
        const result = await sendMessage(page, target.full_name, messageText, messageLinkedinUrl, freshTarget.messaging_urn);
        recordSuccess('message');
        if (result.messagingUrn) {
          db.prepare("UPDATE targets SET messaging_urn = COALESCE(messaging_urn, ?) WHERE id = ?").run(result.messagingUrn, target.id);
        }
      } catch (err) {
        recordFailure('message', (err as Error).message);
        if (err instanceof NotConnectedError) {
          await saveSessionState(accountId);
          db.prepare("UPDATE targets SET degree = NULL, connected_at = NULL WHERE id = ?").run(target.id);
          log(db, runId, target.id, "warn", `${name} no longer appears 1st-degree — resetting connection status and rescheduling`);
          trWait(db, tr, CONNECTION_RECHECK_HOURS);
          return;
        }
        throw err;
      } finally {
        await page.close();
      }
      await saveSessionState(accountId);
      db.prepare("UPDATE targets SET message_sent_at = ? WHERE id = ?").run(nowIso(), target.id);
      trRecordContext(db, tr, { linkedinMessage: messageText });
      trAdvance(db, tr, steps);
      log(db, runId, target.id, "info", `Message sent to ${name}`);

    } else if (step.step_type === "sales_inmail") {
      // Sales Navigator InMail — reaches NON-connections (no degree gate), needs a
      // subject + body, costs one InMail credit. Body config mirrors the message
      // step (AI writer OR templates OR raw body); subject comes from email_subject.
      if (!premium?.inmail) {
        log(db, runId, target.id, "warn", `Sales Nav InMail is a premium feature — not available in this build. Skipping ${name}`);
        trAdvance(db, tr, steps);
        return;
      }
      await ensureSalesNavEnriched(db, target, accountId);
      if (!enforceSchedule(db, tr, runId, target.id, name, accountLimits)) return;

      const freshTarget = db.prepare("SELECT * FROM targets WHERE id = ?").get(target.id) as Target;
      if (!freshTarget.sales_nav_url) {
        log(db, runId, target.id, "warn", `${name} has no Sales Nav URL — cannot send InMail, skipping`);
        trSkip(db, tr, "No Sales Nav URL for InMail");
        return;
      }

      let inmailBody = "";
      let inmailSubject = "";
      if (step.ai_enabled) {
        if (!premium?.ai) {
          log(db, runId, target.id, "warn", `AI writer is a premium feature — not available in this build. Skipping ${name}`);
          trAdvance(db, tr, steps);
          return;
        }
        const openaiInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openai'").get() as { api_key: string } | undefined;
        const openrouterInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openrouter'").get() as { api_key: string } | undefined;
        const apiKey = process.env.OPENAI_API_KEY || (openaiInt?.api_key ? decryptSecret(openaiInt.api_key) : null) || (openrouterInt?.api_key ? decryptSecret(openrouterInt.api_key) : null);
        const agentCfgForMsg = premium.ai.getAgentConfig();
        const resolvedMsgModel = step.ai_model || agentCfgForMsg.default_model || "gpt-4o-mini";
        if (!apiKey || !resolvedMsgModel) {
          log(db, runId, target.id, "warn", `AI enabled on InMail step but API key or model missing — skipping ${name}`);
          trAdvance(db, tr, steps);
          return;
        }
        const contactData = premium.ai.getContactWithCompany(target.id);
        if (!contactData) {
          log(db, runId, target.id, "warn", `Could not load contact data for AI InMail — skipping ${name}`);
          trAdvance(db, tr, steps);
          return;
        }
        log(db, runId, target.id, "info", `Generating AI InMail for ${name} with ${resolvedMsgModel}`);
        const msgPosition = step.message_position ?? 1;
        let previousMessageContext: { followupNumber: number; previousMessage: string } | undefined;
        if (msgPosition > 1 && tr.last_linkedin_message) {
          previousMessageContext = { followupNumber: msgPosition - 1, previousMessage: tr.last_linkedin_message };
        }
        const result = await premium.ai.writeSalesInMail({
          apiKey: apiKey,
          model: resolvedMsgModel,
          stepType: "sales_inmail",
          stepPrompt: step.ai_prompt ?? "",
          maxWords: step.ai_max_words ?? undefined,
          language: step.ai_language ?? undefined,
          campaignPrompt: campaignPrompt ?? undefined,
          contact: contactData.contact,
          company: contactData.company,
          agentConfig: agentCfgForMsg,
          previousMessageContext,
          runId,
          targetId: target.id,
          stepId: step.id,
        });
        inmailBody = result.body;
        inmailSubject = result.subject;
      } else {
        const multiTemplateIds = (db.prepare("SELECT template_id FROM workflow_step_templates WHERE step_id = ?").all(step.id) as Array<{ template_id: string }>).map(r => r.template_id);
        if (multiTemplateIds.length > 0) {
          const randomId = multiTemplateIds[Math.floor(Math.random() * multiTemplateIds.length)];
          const tmpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(randomId) as Template | undefined;
          if (tmpl) inmailBody = renderTemplate(tmpl.body, freshTarget);
        } else if (step.template_id) {
          const tmpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(step.template_id) as Template | undefined;
          if (tmpl) inmailBody = renderTemplate(tmpl.body, freshTarget);
        }
        if (!inmailBody && step.message_body) inmailBody = renderTemplate(step.message_body, freshTarget);
        inmailSubject = renderTemplate(step.email_subject ?? "", freshTarget).trim();
      }
      if (!inmailBody) {
        log(db, runId, target.id, "warn", `No body for InMail step — skipping ${name}`);
        trAdvance(db, tr, steps);
        return;
      }
      if (!inmailSubject) {
        log(db, runId, target.id, "warn", `No subject for InMail step (required) — skipping ${name}`);
        trAdvance(db, tr, steps);
        return;
      }

      db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
      log(db, runId, target.id, "info", `Sending InMail to ${name}`);
      const page = await getSessionPage(accountId);
      try {
        await premium.inmail.sendInMail(page, freshTarget.sales_nav_url, inmailSubject, inmailBody);
      } finally {
        await page.close();
      }
      await saveSessionState(accountId);
      db.prepare("UPDATE targets SET inmail_sent_at = ?, message_sent_at = COALESCE(message_sent_at, ?) WHERE id = ?").run(nowIso(), nowIso(), target.id);
      trRecordContext(db, tr, { linkedinMessage: inmailBody });
      trAdvance(db, tr, steps);
      log(db, runId, target.id, "info", `InMail sent to ${name}`);

    } else if (step.step_type === "email") {
      await ensureApolloEnriched(db, target, runId);

      if (!emailAccountId || !emailAccountLimits) {
        log(db, runId, target.id, "warn", `Email step skipped — no email account configured on this run`);
        trAdvance(db, tr, steps);
        return;
      }

      if (!enforceSchedule(db, tr, runId, target.id, name, emailAccountLimits)) return;

      const freshTarget = db.prepare("SELECT * FROM targets WHERE id = ?").get(target.id) as Target;
      if (!freshTarget.email) {
        // No email even after Apollo enrichment — skip only this email track
        log(db, runId, target.id, "warn", `${name} has no email address — skipping email track`);
        trSkip(db, tr, "No email address found");
        return;
      }
      if (freshTarget.email_status === "invalid") {
        log(db, runId, target.id, "warn", `${name} has an invalid email address — unenrolling email track`);
        trSkip(db, tr, "Email bounced — invalid address");
        return;
      }
      if (freshTarget.company_id) {
        const company = db.prepare("SELECT email_domain_invalid FROM companies WHERE id = ?").get(freshTarget.company_id) as { email_domain_invalid: number } | undefined;
        if (company?.email_domain_invalid) {
          log(db, runId, target.id, "warn", `${name}'s company email domain is flagged invalid — unenrolling email track`);
          trSkip(db, tr, "Email domain invalid — company flagged");
          return;
        }
      }

      let emailSubject = "";
      let emailBody = "";
      if (step.ai_enabled) {
        if (!premium?.ai) {
          log(db, runId, target.id, "warn", `AI writer is a premium feature — not available in this build. Skipping ${name}`);
          trAdvance(db, tr, steps);
          return;
        }
        const openaiInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openai'").get() as { api_key: string } | undefined;
        const openrouterInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openrouter'").get() as { api_key: string } | undefined;
        const apiKey = process.env.OPENAI_API_KEY || (openaiInt?.api_key ? decryptSecret(openaiInt.api_key) : null) || (openrouterInt?.api_key ? decryptSecret(openrouterInt.api_key) : null);
        const agentCfgForEmail = premium.ai.getAgentConfig();
        const resolvedEmailModel = step.ai_model || agentCfgForEmail.default_model || "gpt-4o-mini";
        if (!apiKey || !resolvedEmailModel) {
          log(db, runId, target.id, "warn", `AI enabled on email step but API key or model missing — skipping ${name}`);
          trAdvance(db, tr, steps);
          return;
        }
        const contactData = premium.ai.getContactWithCompany(target.id);
        if (!contactData) {
          log(db, runId, target.id, "warn", `Could not load contact data for AI email — skipping ${name}`);
          trAdvance(db, tr, steps);
          return;
        }
        log(db, runId, target.id, "info", `Generating AI email for ${name} with ${resolvedEmailModel}`);
        const emailPosition = step.email_position ?? 1;
        let followupContext: { followupNumber: number; previousSubject: string; previousBody: string } | undefined;
        if (emailPosition > 1 && (tr.last_email_subject || tr.last_email_body)) {
          followupContext = {
            followupNumber: emailPosition - 1,
            previousSubject: tr.last_email_subject ?? "",
            previousBody: tr.last_email_body ?? "",
          };
        }
        const result = await premium.ai.writeEmail({
          apiKey: apiKey,
          model: resolvedEmailModel,
          stepType: "email",
          stepPrompt: step.ai_prompt ?? "",
          maxWords: step.ai_max_words ?? undefined,
          language: step.ai_language ?? undefined,
          campaignPrompt: campaignPrompt ?? undefined,
          contact: contactData.contact,
          company: contactData.company,
          agentConfig: agentCfgForEmail,
          followupContext,
          replyContext: tr.pending_reply_context ?? undefined,
          runId,
          targetId: target.id,
          stepId: step.id,
        });
        emailSubject = result.subject;
        emailBody = result.body;
        // One-shot: consume the OOO reply context so later follow-ups don't re-acknowledge it
        if (tr.pending_reply_context) {
          db.prepare("UPDATE run_profile_tracks SET pending_reply_context = NULL WHERE id = ?").run(tr.id);
        }
      } else {
        emailSubject = renderTemplate(step.email_subject ?? "", freshTarget);
        emailBody = renderTemplate(step.email_body ?? "", freshTarget);
      }

      if (!emailBody) {
        log(db, runId, target.id, "warn", `No email body for email step — skipping ${name}`);
        trAdvance(db, tr, steps);
        return;
      }

      const emailAccount = db.prepare("SELECT * FROM email_accounts WHERE id = ?").get(emailAccountId) as {
        id: string; from_email: string; from_name: string | null; reply_to: string | null;
        smtp_host: string; smtp_port: number; smtp_secure: number;
        username: string; password: string; signature: string | null;
      } | undefined;

      if (!emailAccount) {
        log(db, runId, target.id, "error", `Email account ${emailAccountId} not found`);
        trFail(db, tr, "Email account missing");
        return;
      }

      // Last-line-of-defense: re-check the daily limit for this email account against ground-truth
      // (matched by run_profiles.email_account_id, the actual sender). If any prior gate is buggy,
      // this catches the overshoot and reschedules instead of sending.
      const sentTodayActual = (db.prepare(
        `SELECT COUNT(*) as c FROM logs l
         WHERE l.message LIKE 'Email sent%'
         AND date(l.created_at) = date('now')
         AND EXISTS (
           SELECT 1 FROM run_profiles rp
           WHERE rp.run_id = l.run_id AND rp.target_id = l.target_id
           AND rp.email_account_id = ?
         )`
      ).get(emailAccountId) as { c: number }).c;
      const hardLimit = effectiveEmailLimit(emailAccountLimits);
      if (sentTodayActual >= hardLimit) {
        log(db, runId, target.id, "warn", `Daily limit guard tripped for ${emailAccountId} (${sentTodayActual}/${hardLimit}) — rescheduling ${name} to tomorrow`);
        trReschedule(db, tr, rescheduleToTomorrow(emailAccountLimits));
        return;
      }

      // Step-level signature takes precedence; null means fall back to email account default
      const sig = (step.email_signature !== null ? step.email_signature : emailAccount.signature)?.trim();
      const finalEmailBody = sig ? `${emailBody}\n\n--\n${sig}` : emailBody;
      db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
      log(db, runId, target.id, "info", `Sending email to ${name} <${freshTarget.email}>`);
      const messageId = await sendEmail({ ...emailAccount, password: decryptSecret(emailAccount.password)! }, freshTarget.email, emailSubject, finalEmailBody);
      trRecordContext(db, tr, { emailSubject, emailBody, emailMessageId: messageId });
      trAdvance(db, tr, steps);
      log(db, runId, target.id, "info", `Email sent to ${name}`);
    } else if (step.step_type === "integration") {
      await executeIntegrationStep(db, runId, tr, target, step, steps);
    } else if (step.step_type === "change_status") {
      let statusId = "lead";
      try {
        if (step.config) {
          const cfg = JSON.parse(step.config);
          if (cfg && cfg.status_id) statusId = cfg.status_id;
        }
      } catch(e) {}
      
      db.prepare("UPDATE targets SET lead_status = ? WHERE id = ?").run(statusId, target.id);
      log(db, runId, target.id, "info", `Updated CRM status to ${statusId}`);
      trAdvance(db, tr, steps);
    }

  } catch (err) {
        recordFailure('message', (err as Error).message);
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof WeeklyLimitError) {
      log(db, runId, target.id, "error", `Weekly connection limit reached — pausing run`);
      db.prepare("UPDATE runs SET status = 'paused' WHERE id = ?").run(runId);
      return;
    }
    if (err instanceof AlreadyConnectedError) {
      log(db, runId, target.id, "info", `${name} already connected — advancing`);
      db.prepare("UPDATE targets SET degree = 1, connected_at = COALESCE(connected_at, ?) WHERE id = ?").run(nowIso(), target.id);
      trAdvance(db, tr, steps);
      return;
    }
    if (err instanceof PendingInviteError) {
      log(db, runId, target.id, "info", `${name} invite already pending — will recheck`);
      if (!target.connection_requested_at) db.prepare("UPDATE targets SET connection_requested_at = ? WHERE id = ?").run(nowIso(), target.id);
      trWait(db, tr, CONNECTION_RECHECK_HOURS);
      return;
    }
    if (msg.includes("No InMail credits left")) {
      inmailCreditsExhaustedOn[accountId] = todayLocalDate();
      const slot = rescheduleToTomorrow(accountLimits);
      log(db, runId, target.id, "warn", `No InMail credits left on this account — pausing InMail sends until tomorrow, rescheduled ${name} to ${slot}`);
      trReschedule(db, tr, slot);
      return;
    }
    log(db, runId, target.id, "error", `Error on ${name}: ${msg}`);
    trFail(db, tr, msg);
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
    
    // In Phase 2, we simulate execution or route to existing executeStep if adaptable
    // For now, this is a skeleton representing the exact architecture defined in the blueprint.
    // Real implementation of Playwright/Email actions will hook here.
    
    // Check if it's a delay waiter node
    if (step.delay_seconds && step.delay_seconds > 0 && state.state === 'pending') {
      db.prepare(`
        UPDATE run_profile_states 
        SET state = 'running', next_eval_at = datetime('now', '+${step.delay_seconds} seconds') 
        WHERE id = ?
      `).run(state.id);
      continue;
    }

    const returnState = 'SUCCESS'; // Replace with actual return state from action executor
    
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

    const nextStepId = edges['on_success'];
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
