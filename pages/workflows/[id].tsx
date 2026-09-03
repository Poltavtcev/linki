import Head from "next/head";
import { useState, useEffect, useCallback, useMemo } from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { toast } from "sonner";
import { OrModel } from "@/components/ui/ModelPicker";
import FilterBar, { ActiveFilter, filtersToParams, FILTER_FIELDS } from "@/components/ui/FilterBar";
import {
  RiArrowLeftLine,
  RiAddLine, RiPlugLine,
  RiDeleteBinLine,
  RiPlayLine,
  RiPauseLine,
  RiStopLine,
  RiEyeLine,
  RiLinkedinBoxLine,
  RiMessage2Line,
  RiSendPlaneLine,
  RiTimeLine,
  RiArrowRightLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiMailSendLine,
  RiMailLine,
  RiEditLine,
  RiRobot2Line, RiThumbUpLine,
  RiSearchLine, RiSearchEyeLine,
  RiLoader4Line,
  RiUser3Line,
  RiArrowDownSLine,
  RiRefreshLine,
  RiErrorWarningLine,
  RiGroupLine, RiRouteLine, RiGitBranchLine, RiCloseLine,
RiCheckLine, RiArrowDownLine } from "react-icons/ri";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepType = "visit" | "connect" | "message" | "sales_inmail" | "delay" | "email" | "integration" | "change_status" | "linkedin_enrich" | "ai_qualify" | "ai_comment" | "linkedin_like";
type Track = "linkedin" | "email" | "integration" | "playbook";

interface Step {
  id: string;
  step_order: number;
  track: Track;
  step_type: StepType;
  template_id: string | null;
  template_name: string | null;
  template_ids: string[];
  template_names: string[];
  delay_seconds: number;
  connect_note: string | null;
  message_body: string | null;
  email_subject: string | null;
  email_body: string | null;
  config: string | null;
  edges_json?: string | null;
}

interface WorkflowData {
  id: string;
  name: string;
  description: string | null;
  prompt: string | null;
  allow_cross_campaign_overlap: number;
  steps: Step[];
  active_run: {
    id: string;
    status: string;
    list_id?: string;
    list_name: string;
    account_name: string;
  } | null;
}

interface Stats {
  total_prospects: number;
  active_prospects: number;
  completed_prospects: number;
  failed_prospects: number;
  connections_sent: number;
  connections_accepted: number;
  acceptance_rate: number;
  messages_sent: number;
  inmails_sent: number;
  emails_sent: number;
  profiles_visited: number;
  emails_enriched: number;
  linkedin_enriched: number;
  hubspot_pushes: number;
  active_run: {
    id: string;
    status: string;
    list_id?: string;
    list_name: string;
    account_name: string;
  } | null;
}

interface Prospect {
  id: string;
  run_id: string;
  target_id: string;
  full_name: string | null;
  title: string | null;
  company: string | null;
  linkedin_url: string;
  state: string;
  current_step: number;
  step_type: string | null;
  step_track: string | null;
  li_step_type: string | null;
  em_step_type: string | null;
  in_step_type: string | null;
  next_step_at: string | null;
  error_message: string | null;
  degree: number | null;
  connection_requested_at: string | null;
  connected_at: string | null;
  message_sent_at: string | null;
}

interface List {
  id: string;
  name: string;
  target_count?: number;
}

interface Account {
  id: string;
  name: string;
  is_authenticated: number;
  daily_connection_limit: number;
  daily_message_limit: number;
  daily_inmail_limit: number;
  connections_today: number;
  messages_today: number;
  inmails_today: number;
}

interface Template {
  id: string;
  name: string;
}

interface EmailAccount {
  id: string;
  name: string;
  from_email: string;
  is_verified: number;
  signature?: string | null;
  active_run_count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, React.ReactNode> = {
  linkedin_enrich: <RiSearchEyeLine size={15} />,
  visit: <RiEyeLine size={15} />,
  connect: <RiLinkedinBoxLine size={15} />,
  message: <RiMessage2Line size={15} />,
  sales_inmail: <RiSendPlaneLine size={15} />,
  delay: <RiTimeLine size={15} />,
  email: <RiMailLine size={15} />,
  integration: <RiPlugLine size={15} />,
  change_status: <RiGroupLine size={15} />,
  ai_qualify: <RiRobot2Line size={15} />,
  ai_comment: <RiMessage2Line size={15} />,
  linkedin_like: <RiThumbUpLine size={15} />,
};

// Static base labels — email steps use getEmailStepLabel() for dynamic numbering
const STEP_LABELS: Record<string, string> = {
  visit: "Visit Profile",
  linkedin_enrich: "Enrich Profile",
  connect: "LinkedIn Connect",
  message: "LinkedIn Message",
  sales_inmail: "Sales Nav InMail",
  email: "Cold Email",
  integration: "Integration",
  change_status: "Change CRM Status",
  ai_qualify: "AI Qualify",
  ai_comment: "AI Comment",
  linkedin_like: "Like Recent Posts",
};

// Returns dynamic label for an email step based on its position among all email steps
function getEmailStepLabel(wizardSteps: Array<{ type: string }>, idx: number): string {
  const emailIndices = wizardSteps.map((s, i) => s.type === "email" ? i : -1).filter(i => i !== -1);
  const emailPos = emailIndices.indexOf(idx);
  if (emailPos === 0) return "Cold Email";
  const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
  return `Follow-up ${ordinals[emailPos] ?? `#${emailPos + 1}`}`;
}

// Returns dynamic label for a message step based on its position among all message steps
function getMessageStepLabel(wizardSteps: Array<{ type: string }>, idx: number): string {
  const msgIndices = wizardSteps.map((s, i) => s.type === "message" ? i : -1).filter(i => i !== -1);
  const msgPos = msgIndices.indexOf(idx);
  if (msgPos === 0) return "LinkedIn Message";
  const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
  return `LinkedIn Follow-up ${ordinals[msgPos] ?? `#${msgPos + 1}`}`;
}

function getStepLabel(type: string, configStr?: string | null): string {
  if (type === "integration") {
    try {
      if (configStr && configStr !== "null") {
        const p = JSON.parse(configStr);
        if (p.action_type === "push_to_hubspot") return "HubSpot Sync";
        if (p.action_type === "enrich_email") return "Email Enrichment";
      }
    } catch(e) {}
    return "Integration";
  }
  return STEP_LABELS[type] ?? type;
}

function getDynamicStepLabel(ws: any, wizardSteps: Array<any>, idx: number): string {
  if (ws.type === "email") return getEmailStepLabel(wizardSteps, idx);
  if (ws.type === "message") return getMessageStepLabel(wizardSteps, idx);
  return getStepLabel(ws.type, ws.config);
}

const AI_LANGUAGES = [
  "English", "Agent decides", "German", "French", "Spanish", "Italian",
  "Portuguese", "Dutch", "Polish", "Swedish", "Danish", "Norwegian",
  "Finnish", "Arabic", "Japanese", "Chinese", "Korean",
];

const STEP_COLORS: Record<string, string> = {
  linkedin_like: "bg-primary/10 text-primary border-primary/20",
  linkedin_enrich: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  visit: "bg-info/10 text-info border-info/20",
  connect: "bg-primary/10 text-primary border-primary/20",
  message: "bg-success/10 text-success border-success/20",
  sales_inmail: "bg-primary/10 text-primary border-primary/20",
  email: "bg-warning/10 text-warning border-warning/20",
  integration: "bg-accent/10 text-accent border-accent/20",
};


const VARIABLES = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{title}}"];

const STATE_PILL: Record<string, string> = {
  pending: "bg-base-300 text-base-content/50",
  in_progress: "bg-info/15 text-info",
  completed: "bg-success/15 text-success",
  failed: "bg-error/15 text-error",
  skipped: "bg-base-300/60 text-base-content/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNextAction(next_step_at: string | null, state: string): string {
  if (state === "completed" || state === "failed" || state === "skipped") return "—";
  if (!next_step_at) return "Soon";
  const diff = new Date(next_step_at).getTime() - Date.now();
  if (diff <= 0) return "Now";
  const hours = diff / 3600_000;
  if (hours < 24) return `in ${Math.round(hours)}h`;
  return `in ${Math.round(hours / 24)}d`;
}

// ─── Server-side ──────────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps = async ({ params, query }) => {
  const db = getDb();
  const id = params?.id as string;
  const workflow = db.prepare("SELECT * FROM workflows WHERE id = ?").get(id);
  if (!workflow) return { notFound: true };

  const rawSteps = db
    .prepare(
      `SELECT ws.*, t.name as template_name
       FROM workflow_steps ws
       LEFT JOIN templates t ON t.id = ws.template_id
       WHERE ws.workflow_id = ? ORDER BY ws.track, ws.step_order`
    )
    .all(id);

  const getStepTemplates = db.prepare(
    `SELECT wst.template_id, t.name FROM workflow_step_templates wst JOIN templates t ON t.id = wst.template_id WHERE wst.step_id = ?`
  );
  const steps = (rawSteps as Array<Record<string, unknown>>).map((s) => {
    const rows = getStepTemplates.all(s.id) as Array<{ template_id: string; name: string }>;
    return { ...s, template_ids: rows.map((r) => r.template_id), template_names: rows.map((r) => r.name) };
  });

  const activeRun = db
    .prepare(
      `SELECT r.id, r.status, r.list_id, l.name as list_name, a.name as account_name
       FROM runs r
       LEFT JOIN lists l ON l.id = r.list_id
       LEFT JOIN accounts a ON a.id = r.account_id
       WHERE r.workflow_id = ? AND r.status IN ('running','paused')
       LIMIT 1`
    )
    .get(id) as { id: string; status: string; list_id: string; list_name: string; account_name: string } | undefined;

  const lists = db
    .prepare(
      `SELECT l.id, l.name, COUNT(lt.target_id) as target_count
       FROM lists l LEFT JOIN list_targets lt ON lt.list_id = l.id
       GROUP BY l.id ORDER BY l.name`
    )
    .all();
  const accounts = db
    .prepare(
      `SELECT a.id, a.name, a.is_authenticated, a.daily_connection_limit, a.daily_message_limit, a.daily_inmail_limit,
         (SELECT COUNT(*) FROM logs l JOIN runs r ON r.id = l.run_id
          WHERE r.account_id = a.id AND l.message LIKE 'Connection request sent%' AND date(l.created_at) = date('now')) as connections_today,
         (SELECT COUNT(*) FROM logs l JOIN runs r ON r.id = l.run_id
          WHERE r.account_id = a.id AND l.message LIKE 'Message sent%' AND date(l.created_at) = date('now')) as messages_today,
         (SELECT COUNT(*) FROM logs l JOIN runs r ON r.id = l.run_id
          WHERE r.account_id = a.id AND l.message LIKE 'InMail sent%' AND date(l.created_at) = date('now')) as inmails_today
       FROM accounts a ORDER BY a.name`
    )
    .all();

  const templates = db.prepare("SELECT id, name FROM templates ORDER BY name").all();
  const emailAccounts = db.prepare(`
    SELECT ea.id, ea.name, ea.from_email, ea.is_verified, ea.signature,
           (SELECT COUNT(DISTINCT rp.run_id) FROM run_profiles rp
            JOIN runs r ON rp.run_id = r.id
            WHERE rp.email_account_id = ea.id
            AND r.status IN ('running', 'paused')) AS active_run_count
    FROM email_accounts ea ORDER BY ea.name
  `).all();

  // Email accounts currently assigned to the active run's profiles (locked during edit)
  const activeRunEmailAccountIds: string[] = activeRun
    ? (db.prepare(
        `SELECT DISTINCT email_account_id FROM run_profiles WHERE run_id = ? AND email_account_id IS NOT NULL`
      ).all(activeRun.id) as Array<{ email_account_id: string }>).map((r) => r.email_account_id)
    : [];

  return {
    props: {
      workflow: { ...(workflow as object), steps, active_run: activeRun ?? null },
      lists,
      accounts,
      templates,
      emailAccounts,
      activeRunEmailAccountIds,
      // auto-open wizard if ?setup=1 (redirected from create)
      autoSetup: query.setup === "1",
    },
  };
};

// ─── Wizard ───────────────────────────────────────────────────────────────────
const ENRICHERS = ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"];
const PROVIDER_NAMES: Record<string, string> = {
  prospeo: "Prospeo",
  apollo: "Apollo",
  snov: "Snov.io",
  skrapp: "Skrapp.io",
  hunter: "Hunter",
  lusha: "Lusha",
  contactout: "ContactOut"
};

type WizardPage = "prospects" | "prompt" | "sequence" | "ai_replies" | "account" | "summary";

interface WizardStep {
  id?: string;
  track: Track;
  type: StepType;
  delayDaysBefore: number;
  connectNote: string;
  messageBody: string;
  templateId: string | null;
  templateIds: string[];
  emailSubject: string;
  emailBody: string;
  emailSignature: string | null;
  aiEnabled: boolean;
  aiModel: string;
  aiPrompt: string;
  aiMaxWordsEnabled: boolean;
  aiMaxWords: number;
  aiLanguage: string;
  config: string | null;
  branches?: Record<string, WizardStep[]>;
  emailPosition?: number;
  messagePosition?: number;
}

function buildWizardSteps(steps: Step[]): WizardStep[] {
  const result: WizardStep[] = [];
  // Track pending delays per track independently
  const pendingDelay: Record<string, number> = { linkedin: 0, email: 0 };
  for (const s of steps) {
    const track: Track = s.track ?? (s.step_type === "email" ? "email" : "linkedin");
    if (s.step_type === "delay") {
      pendingDelay[track] = Math.round(s.delay_seconds / 86400);
    } else {
      const raw = s as unknown as Record<string, unknown>;
      result.push({
        track,
        type: s.step_type as "visit" | "connect" | "message" | "sales_inmail" | "email" | "integration" | "change_status" | "linkedin_enrich",
        delayDaysBefore: pendingDelay[track] ?? 0,
        connectNote: s.connect_note ?? "",
        messageBody: s.message_body ?? "",
        templateId: s.template_id ?? null,
        templateIds: s.template_ids ?? [],
        emailSubject: s.email_subject ?? "",
        emailBody: s.email_body ?? "",
        emailSignature: raw.email_signature != null ? (raw.email_signature as string) : null,
        aiEnabled: raw.ai_enabled === 1,
        aiModel: raw.ai_model != null ? String(raw.ai_model) : "gpt-4o",
        aiPrompt: raw.ai_prompt != null ? String(raw.ai_prompt) : "",
        aiMaxWordsEnabled: raw.ai_max_words != null,
        aiMaxWords: raw.ai_max_words != null ? Number(raw.ai_max_words) : 100,
        aiLanguage: raw.ai_language != null ? String(raw.ai_language) : "English",
        config: raw.config != null ? String(raw.config) : null,
      });
      pendingDelay[track] = 0;
    }
  }
  return result;
}

interface ListTarget {
  id: string;
  full_name: string | null;
  title: string | null;
  company: string | null;
  linkedin_url: string;
  email?: string | null;
  degree?: number | null;
  connection_requested_at?: string | null;
  connected_at?: string | null;
  message_sent_at?: string | null;
  last_replied_at?: string | null;
  seniority?: string | null;
  country?: string | null;
  lead_status?: string | null;
  email_status?: string | null;
  company_size?: number | null;
  tenure_months?: number | null;
  open_link?: number | null;
  email_domain_catchall?: number | null;
  hubspot_contact_id?: string | null;
  apollo_contact_id?: string | null;
}

// ─── ModelPicker (wizard-local, controlled open state for single-dropdown behavior) ──

interface ModelPickerProps {
  models: OrModel[];
  value: string;
  open: boolean;
  search: string;
  collapsedProviders: Set<string>;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  onSearch: (q: string) => void;
  onToggleProvider: (provider: string) => void;
}

const PROVIDER_DISPLAY: Record<string, string> = {
  google: "Google",
  anthropic: "Anthropic",
  openai: "OpenAI",
  mistral: "Mistral",
  qwen: "Qwen (Alibaba)",
  alibaba: "Alibaba",
};

function ModelPicker({ models, value, open, search, collapsedProviders, onOpen, onClose, onSelect, onSearch, onToggleProvider }: ModelPickerProps) {
  const isSearching = search.trim().length > 0;

  const filtered = models.filter(m =>
    !isSearching || m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase())
  );

  const byProvider: Record<string, OrModel[]> = {};
  for (const m of filtered) {
    (byProvider[m.provider] ??= []).push(m);
  }

  const providerOrder = [
    "google", "anthropic", "openai", "mistral", "qwen", "alibaba",
    ...Object.keys(byProvider).filter(p => !["google","anthropic","openai","mistral","qwen","alibaba"].includes(p)).sort(),
  ].filter(p => byProvider[p]);

  const selectedModel = models.find(m => m.id === value);

  return (
    <div className="relative">
      <label className="text-xs text-base-content/40 mb-1 block">Model</label>
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-base-300/50 border border-base-300/50 text-sm text-left hover:border-base-300 transition-colors"
      >
        <span className={value ? "text-base-content" : "text-base-content/30"}>
          {selectedModel ? (
            <span className="flex items-center gap-2">
              <span className="text-base-content/40 text-xs">{PROVIDER_DISPLAY[selectedModel.provider] ?? selectedModel.provider}</span>
              <span>{selectedModel.name}</span>
            </span>
          ) : "Select a model…"}
        </span>
        <RiSearchLine size={13} className="text-base-content/30 shrink-0" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-base-300 border border-base-300/80 rounded-xl shadow-xl overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-base-300/50">
              <input
                autoFocus
                type="text"
                placeholder="Search models…"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="w-full bg-base-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none placeholder:text-base-content/30"
              />
            </div>

            <div className="max-h-72 overflow-y-auto">
              {models.length === 0 ? (
                <p className="px-3 py-4 text-sm text-base-content/30 text-center">No OpenRouter key configured</p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-base-content/30 text-center">No models match</p>
              ) : (
                providerOrder.map(provider => {
                  const providerModels = byProvider[provider];
                  const isCollapsed = !isSearching && collapsedProviders.has(provider);
                  const displayName = PROVIDER_DISPLAY[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
                  return (
                    <div key={provider}>
                      {/* Provider header — clickable to collapse (only when not searching) */}
                      <button
                        type="button"
                        onClick={() => !isSearching && onToggleProvider(provider)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 sticky top-0 bg-base-300/90 backdrop-blur-sm border-b border-base-300/30 ${isSearching ? "cursor-default" : "hover:bg-base-300 cursor-pointer"}`}
                      >
                        <span className="text-[10px] uppercase tracking-wider text-base-content/40 font-semibold">{displayName}</span>
                        {!isSearching && (
                          <span className="text-base-content/30">
                            {isCollapsed ? <RiArrowRightSLine size={13} /> : <RiArrowDownSLine size={13} />}
                          </span>
                        )}
                        {isSearching && (
                          <span className="text-[10px] text-base-content/25">{providerModels.length}</span>
                        )}
                      </button>

                      {/* Models — hidden when collapsed */}
                      {!isCollapsed && providerModels.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelect(m.id)}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-base-200 ${value === m.id ? "text-primary font-medium" : "text-base-content/80"}`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

// mode: "launch" = full new run wizard, "edit" = edit steps+account (no prospects), "steps" = steps only,
// "add-contacts" = prospect-selection only, enroll into existing active run
type WizardMode = "launch" | "edit" | "steps" | "add-contacts";

function Wizard({
  workflowId,
  workflowName: initialWorkflowName,
  initialPrompt,
  allowCrossCampaignOverlap = false,
  initialSteps,
  lists,
  accounts,
  emailAccounts,
  templates,
  editOnly = false,
  mode = "launch",
  activeRunId,
  activeRunListId,
  activeRunEmailAccountIds = [],
  onClose,
  onLaunched,
  onRenamed,
}: {
  workflowId: string;
  workflowName: string;
  initialPrompt: string;
  allowCrossCampaignOverlap: boolean;
  initialSteps: Step[];
  lists: List[];
  accounts: Account[];
  emailAccounts: EmailAccount[];
  templates: Template[];
  editOnly?: boolean;
  mode?: WizardMode;
  activeRunId?: string | null;
  activeRunListId?: string | null;
  activeRunEmailAccountIds?: string[];
  onClose: () => void;
  onLaunched: () => void;
  onRenamed: (name: string) => void;
}) {
  const isEditMode = mode === "edit" || editOnly;
  const isStepsOnly = mode === "steps" || (editOnly && mode === "launch");
  const isAddContacts = mode === "add-contacts";
  const [page, setPage] = useState<WizardPage>(isEditMode ? "sequence" : "prospects");
  const [campaignPrompt, setCampaignPrompt] = useState(initialPrompt);
  const [arActive, setArActive] = useState(false);
  const [arSender, setArSender] = useState("");
  const [arCompany, setArCompany] = useState("");
  const [arOffers, setArOffers] = useState("");
  const [arVoice, setArVoice] = useState("");
  const [crossOverlap, setCrossOverlap] = useState(allowCrossCampaignOverlap);
  const [listId, setListId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [emailAccountIds, setEmailAccountIds] = useState<Set<string>>(new Set(activeRunEmailAccountIds));
  const [conflicts, setConflicts] = useState<{ total: number; blocked: number } | null>(null);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [wizardSteps, setWizardSteps] = useState<WizardStep[]>(() => buildWizardSteps(initialSteps));
  const [integrations, setIntegrations] = useState<{ key: string; configured: boolean }[]>([]);
  const [crmStatuses, setCrmStatuses] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/settings/crm-statuses").then(r => r.json()).then(setCrmStatuses).catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((rows) => setIntegrations(rows))
      .catch(() => {});
  }, []);
  const [configPath, setConfigPath] = useState<(number | string)[] | null>(null);
  const [drawerPath, setDrawerPath] = useState<(number | string)[] | null>(null); // which step is being configured
                function StepCard({ ws, prevWs, path, isFirst }: { ws: WizardStep; prevWs?: WizardStep; path: (number | string)[]; isFirst: boolean }) {
                  return (
                    <div className="relative">
                      {(!isFirst || ws.delayDaysBefore > 0) && (
                        <div className="flex flex-col items-center justify-center -my-1 z-10 relative">
                          <div className="w-[2px] h-5 bg-base-content/10" />
                          
                          {prevWs?.type === 'ai_qualify' && path.length === 1 ? (
                            <div className="flex gap-1.5 z-10">
                              {(() => {
                                let mainOutcomes = ["FIT"];
                                try {
                                  const cfg = JSON.parse(prevWs.config || '{}');
                                  if (Array.isArray(cfg.continue_main_on)) mainOutcomes = cfg.continue_main_on;
                                  else if (typeof cfg.continue_main_on === 'string') mainOutcomes = [cfg.continue_main_on];
                                } catch {}
                                return mainOutcomes.map(out => (
                                  <span key={out} className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shadow-sm ${
                                      out === 'FIT' ? 'bg-success/10 border-success/30 text-success' : 
                                      out === 'MAYBE' ? 'bg-warning/10 border-warning/30 text-warning' : 
                                      'bg-error/10 border-error/30 text-error'
                                  }`}>
                                    ✓ {out}
                                  </span>
                                ));
                              })()}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 z-10">
                              {path.length === 1 && prevWs && ["message", "email", "sales_inmail", "connect"].includes(prevWs.type) && (
                                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-sm ${
                                  prevWs.type === "connect" 
                                    ? "bg-info/10 border-info/30 text-info" 
                                    : "bg-warning/10 border-warning/30 text-warning"
                                }`}>
                                  {prevWs.type === "connect" ? "If not accepted" : "If no reply"}
                                </span>
                              )}
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-200/90 border border-base-content/10 backdrop-blur-sm shadow-sm">
                                <RiTimeLine size={13} className="text-base-content/40" />
                                <span className="text-[10.5px] text-base-content/60 font-medium tracking-wide">
                                  {path.length === 1 && prevWs && !["message", "email", "sales_inmail", "ai_qualify", "connect"].includes(prevWs.type) ? 'Default ' : ''}
                                  {path.length === 1 && prevWs && prevWs.type === "connect" ? 'If not accepted ' : ''}
                                  {ws.delayDaysBefore > 0 ? `(Wait ${ws.delayDaysBefore} day${ws.delayDaysBefore > 1 ? 's' : ''})` : "(Immediately)"}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="w-[2px] h-4 bg-base-content/10" />
                          <svg className="w-4 h-4 text-base-content/20 -mt-1 z-10" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 21l-12-18h24z" />
                          </svg>
                        </div>
                      )}
                      <div
                        className="flex flex-col border rounded-xl bg-base-200 border-base-300/50 hover:border-primary/30 transition-colors group mx-auto w-full max-w-2xl"
                      >
                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setConfigPath(path)}>
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${STEP_COLORS[ws.type] || 'bg-base-300 text-base-content border-base-300'}`}>
                            {STEP_ICONS[ws.type]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-base-content/90">
                              {getDynamicStepLabel(ws, wizardSteps, path[path.length - 1] as number)}
                            </p>
                            {ws.type === "connect" && ws.connectNote && (
                              <p className="text-xs text-base-content/50 truncate">Note: {ws.connectNote}</p>
                            )}
                          </div>
                          <button
                            className="inline-flex items-center p-1.5 rounded-md bg-error/5 text-error/60 border border-error/10 hover:bg-error/20 hover:text-error hover:border-error/30 transition-colors shrink-0"
                            onClick={(e) => { e.stopPropagation(); removeWizardStep(path); }}
                          >
                            <RiDeleteBinLine size={14} />
                          </button>
                        </div>

                        {Object.keys(ws.branches || {}).length > 0 && (
                          <div className="flex flex-wrap gap-2 px-4 py-3 bg-base-300/50 border-t border-base-300/50">
                            {Object.entries(ws.branches!)
                                                          .filter(([bName]) => {
                                                             if (ws.type === 'ai_qualify') {
                                                                try { 
                                                                  const cfg = JSON.parse(ws.config || '{}'); 
                                                                  let mainOutcomes = ["FIT"];
                                                                  if (Array.isArray(cfg.continue_main_on)) mainOutcomes = cfg.continue_main_on;
                                                                  else if (typeof cfg.continue_main_on === 'string') mainOutcomes = [cfg.continue_main_on];
                                                                  if (mainOutcomes.includes(bName)) return false; 
                                                                } catch {}
                                                             }
                                                             if (ws.type === 'connect' && bName === 'IF NOT ACCEPTED (Timeout)') return false;
                                                             if (['message', 'email', 'sales_inmail'].includes(ws.type) && bName === 'IF NO REPLY') return false;
                                                             return true;
                                                          })
                                                          .map(([bName, bSteps]) => (
                              <button 
                                key={bName}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDrawerPath([...path, "branches", bName]); }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-base-100 border border-base-300 hover:border-primary/50 transition-colors shadow-sm"
                              >
                                <RiGitBranchLine size={13} className="text-primary" />
                                {bName}
                                <span className="text-[10px] text-base-content/50 bg-base-200 px-1.5 rounded-full">{bSteps.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      

                    </div>
                  );
                }
  const [launching, setLaunching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Email preview modal
  const [emailPreviewIdx, setEmailPreviewIdx] = useState<(number | string)[] | null>(null);

  // Test email modal
  const [testEmailIdx, setTestEmailIdx] = useState<(number | string)[] | null>(null);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailAccountId, setTestEmailAccountId] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);

  const [listTargets, setListTargets] = useState<ListTarget[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [prospectMode, setProspectMode] = useState<"all" | "manual">("all");
  const [listSearch, setListSearch] = useState("");
  const [wizardFilters, setWizardFilters] = useState<ActiveFilter[]>([]);

  // Workflow name editing
  const [workflowName, setWorkflowName] = useState(initialWorkflowName);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(initialWorkflowName);
  const [nameSaving, setNameSaving] = useState(false);

  // AI / OpenRouter models
  const [orModels, setOrModels] = useState<OrModel[]>([]);
  const [orModelSearch, setOrModelSearch] = useState("");
  const [orModelOpen, setOrModelOpen] = useState<string | null>(null); // step idx with open picker
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(new Set()); // collapsed when not searching

  // AI preview modal
  const [previewIdx, setPreviewIdx] = useState<(number | string)[] | null>(null);
  const [previewListId, setPreviewListId] = useState("");
  const [previewTargetId, setPreviewTargetId] = useState("");
  const [previewListTargets, setPreviewListTargets] = useState<ListTarget[]>([]);
  const [previewResult, setPreviewResult] = useState<{ subject?: string; body: string; input_tokens: number; output_tokens: number; cost_usd: number | null } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Stores last preview cost per wizard step index (for summary cost estimation)
  const [stepPreviewCosts, setStepPreviewCosts] = useState<Record<number, { input_tokens: number; output_tokens: number; cost_usd: number }>>({});

  // Open-core: is the AI writer (a premium/ee feature) available in this build?
  const [hasPremium, setHasPremium] = useState(true);
  useEffect(() => {
    fetch("/api/premium-status")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setHasPremium(!!d.hasPremium); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasPremium) return; // /api/openrouter/models is premium-only
    fetch("/api/openrouter/models")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.models) setOrModels(d.models); })
      .catch(() => {});
  }, [hasPremium]);

  // In add-contacts mode, auto-select the active run's list so the user only picks contacts.
  useEffect(() => {
    if (isAddContacts && activeRunListId && !listId) {
      selectList(activeRunListId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddContacts, activeRunListId]);

  async function loadPreviewTargets(lId: string) {
    setPreviewListTargets([]);
    setPreviewTargetId("");
    if (!lId) return;
    const r = await fetch(`/api/lists/${lId}`);
    if (r.ok) {
      const d = await r.json();
      setPreviewListTargets(d.targets ?? []);
    }
  }

  async function runPreview() {
    if (previewIdx === null || !previewTargetId) return;
    const ws = getStepByPath(wizardSteps, previewIdx); if (!ws) return;
    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const r = await fetch("/api/agent/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step_type: ws.type,
          ai_model: ws.aiModel,
          ai_prompt: ws.aiPrompt,
          ai_max_words: ws.aiMaxWordsEnabled ? ws.aiMaxWords : null,
          ai_language: ws.aiLanguage ?? null,
          target_id: previewTargetId,
          campaign_prompt: campaignPrompt || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? "Preview failed"); return; }
      setPreviewResult(d);
      if (d.cost_usd != null && previewIdx !== null) {
        setStepPreviewCosts((prev) => ({
          ...prev,
          [JSON.stringify(previewIdx)]: { input_tokens: d.input_tokens ?? 0, output_tokens: d.output_tokens ?? 0, cost_usd: d.cost_usd },
        }));
      }
    } catch {
      toast.error("Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  const selectedList = lists.find((l) => l.id === listId);
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedEmailAccounts = emailAccounts.filter((e) => emailAccountIds.has(e.id));
  // In add-contacts mode every contact in the list is "active" already (this run) — dedup happens server-side.
  const allBlocked = !isAddContacts && conflicts !== null && conflicts.blocked > 0 && conflicts.blocked >= conflicts.total;
  const hasEmailStep = wizardSteps.some((s) => s.type === "email");
  
  const filteredListTargets = useMemo(() => {
    let result = listTargets;
    if (wizardFilters.length > 0) {
      result = result.filter((t: ListTarget) => {
        for (const f of wizardFilters) {
          let fieldKey = f.field;
          if (fieldKey === "hubspot") fieldKey = "hubspot_contact_id";
          if (fieldKey === "enriched") fieldKey = "apollo_enriched_at";
          if (fieldKey === "industry") fieldKey = "company_industry";
          
          const val = (t as any)[fieldKey];
          const query = f.value ? f.value.toLowerCase() : "";
          
          switch (f.op) {
            case "is_true":
              if (Number(val) !== 1) return false;
              break;
            case "is_false":
              if (Number(val) === 1) return false;
              break;
            case "is_set":
              if (val === null || val === undefined || val === "") return false;
              break;
            case "is_not_set":
              if (val !== null && val !== undefined && val !== "") return false;
              break;
            case "is":
              if (String(val || "").toLowerCase() !== query) return false;
              break;
            case "is_not":
              if (String(val || "").toLowerCase() === query) return false;
              break;
            case "contains":
              if (!String(val || "").toLowerCase().includes(query)) return false;
              break;
            case "gt":
              if (Number(val || 0) <= Number(f.value || 0)) return false;
              break;
            case "lt":
              if (Number(val || 0) >= Number(f.value || 0)) return false;
              break;
          }
        }
        return true;
      });
    }
    return result;
  }, [listTargets, wizardFilters]);

  
  useEffect(() => {
    if (prospectMode === "all" && listTargets.length > 0) {
      setSelectedTargetIds(new Set(filteredListTargets.map((t: ListTarget) => t.id)));
    }
  }, [filteredListTargets, prospectMode, listTargets.length]);

  const hasLinkedInStep = wizardSteps.some((s) => s.type === "visit" || s.type === "connect" || s.type === "message" || s.type === "sales_inmail");

  async function selectList(id: string) {
    setListId(id);
    setConflicts(null);
    setListTargets([]);
    setSelectedTargetIds(new Set());
    setProspectMode("all");
    setWizardFilters([]);
    if (!id) return;
    setConflictsLoading(true);
    const [conflictsRes, targetsRes] = await Promise.all([
      fetch(`/api/lists/${id}/conflicts`),
      fetch(`/api/lists/${id}`),
    ]);
    if (conflictsRes.ok) setConflicts(await conflictsRes.json());
    if (targetsRes.ok) {
      const data = await targetsRes.json();
      const ts: ListTarget[] = data.targets ?? [];
      setListTargets(ts);
      setSelectedTargetIds(new Set(ts.map((t) => t.id)));
    }
    setConflictsLoading(false);
  }

  async function saveWorkflowName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === workflowName) { setEditingName(false); return; }
    setNameSaving(true);
    const res = await fetch(`/api/workflows/${workflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setWorkflowName(trimmed);
      onRenamed(trimmed);
      toast.success("Renamed");
    }
    setNameSaving(false);
    setEditingName(false);
  }

  function toggleTarget(id: string) {
    setSelectedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllTargets() {
    if (selectedTargetIds.size === filteredListTargets.length) {
      setSelectedTargetIds(new Set());
    } else {
      setSelectedTargetIds(new Set(listTargets.map((t) => t.id)));
    }
  }

  const hasConnect = wizardSteps.some((s) => s.type === "connect" || (s.branches && Object.values(s.branches).some(b => b.some(x => x.type === "connect"))));


  function getStepByPath(steps: WizardStep[], path: (number | string)[]): WizardStep | undefined {
    let curr: any = steps;
    for (const p of path) {
      if (!curr) return undefined;
      curr = curr[p];
    }
    return curr as WizardStep;
  }

  function addWizardStep(type: StepType, path?: (number | string)[]) {
    const newStep: WizardStep = {
      track: type === "email" ? "email" : "playbook",
      type,
      delayDaysBefore: wizardSteps.length === 0 ? 0 : 1,
      connectNote: "", messageBody: "", templateId: null, templateIds: [], emailSubject: "", emailBody: "", emailSignature: null,
      aiEnabled: false, aiModel: "gpt-4o", aiPrompt: "", aiMaxWordsEnabled: false, aiMaxWords: 100, aiLanguage: "English",
      config: type === "integration" ? JSON.stringify({ action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] }) : type === "change_status" ? JSON.stringify({ status_id: "lead" }) : type === "ai_qualify" ? JSON.stringify({ rules: "Determine if prospect is a fit." }) : (type === "linkedin_like" ? JSON.stringify({ like_n_posts: 1 }) : (type === "ai_comment" ? JSON.stringify({ max_age_days: 30, like_n_posts: 0 }) : null)),
      branches: type === "ai_qualify" ? { FIT: [], MAYBE: [], NOT_FIT: [] } : (type === "connect" ? { "IF ACCEPTED": [], "IF NOT ACCEPTED (Timeout)": [] } : (type === "message" || type === "sales_inmail" || type === "email" ? { "IF REPLIED": [] } : undefined))
    };

    setWizardSteps((prev) => {
      const clone = structuredClone(prev);
      if (!path) {
        if (type === "connect") {
          const firstMsgIdx = clone.findIndex((s: WizardStep) => s.type === "message" || s.type === "sales_inmail");
          if (firstMsgIdx !== -1) {
            clone.splice(firstMsgIdx, 0, newStep);
            return clone;
          }
        }
        clone.push(newStep);
      } else {
        let curr: any = clone;
        for (const p of path) curr = curr[p];
        curr.push(newStep);
      }
      return clone;
    });
  }

  function removeWizardStep(path: (number | string)[]) {
    setWizardSteps((prev) => {
      const clone = structuredClone(prev);
      let curr: any = clone;
      for (let i = 0; i < path.length - 1; i++) curr = curr[path[i]];
      curr.splice(path[path.length - 1] as number, 1);
      return clone;
    });
    setConfigPath(null);
  }

  function updateStep(path: (number | string)[], patch: Partial<WizardStep>) {
    setWizardSteps((prev) => {
      const clone = structuredClone(prev);
      let curr: any = clone;
      for (let i = 0; i < path.length - 1; i++) curr = curr[path[i]];
      const last = path[path.length - 1];
      curr[last] = { ...curr[last], ...patch };
      return clone;
    });
  }

    async function saveStepsToDB() {
    setSaving(true);
    await fetch(`/api/workflows/${workflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: campaignPrompt }),
    });
    
    await fetch(`/api/workflows/${workflowId}/reply-context`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_active: arActive,
        sender_profile: arSender,
        company_product: arCompany,
        offers_playbook: arOffers,
        voice_rules: arVoice
      }),
    });

    const existing = await fetch(`/api/workflows/${workflowId}/steps`);
    const existingSteps: Step[] = existing.ok ? await existing.json() : [];
    await Promise.all(existingSteps.map((s) => fetch(`/api/workflows/${workflowId}/steps/${s.id}`, { method: "DELETE" })));

    let totalEmails = 0;
    let totalMessages = 0;
    function assignPositions(steps: WizardStep[]) {
      for (const ws of steps) {
        if (ws.type === "email") ws.emailPosition = ++totalEmails;
        if (ws.type === "message" || ws.type === "sales_inmail") ws.messagePosition = ++totalMessages;
        if (ws.branches) Object.values(ws.branches).forEach(b => assignPositions(b));
      }
    }
    assignPositions(wizardSteps);

    async function saveSequenceBackward(steps: WizardStep[], nextId: string | null) {
      let currentNextId = nextId;
      for (let i = steps.length - 1; i >= 0; i--) {
        const ws = steps[i];
        let edges: Record<string, string> = {};
        if (currentNextId) edges["next"] = currentNextId;

        if (ws.branches) {
          for (const [bName, bSteps] of Object.entries(ws.branches)) {
            const bFirstId = await saveSequenceBackward(bSteps, currentNextId);
            if (bFirstId) {
               // map internal branch names to edge names
               if (bName === "IF ACCEPTED" || bName === "ACCEPTED") edges["on_accepted"] = bFirstId;
               else if (bName === "IF REPLIED" || bName === "REPLIED") edges["on_replied"] = bFirstId;
               else if (bName === "FIT") edges["on_fit"] = bFirstId;
               else if (bName === "MAYBE") edges["on_maybe"] = bFirstId;
               else if (bName === "NOT_FIT") edges["on_not_fit"] = bFirstId;
               else if (bName === "IF NOT ACCEPTED (Timeout)") edges["on_timeout"] = bFirstId; else edges[bName] = bFirstId;
            } else if (bName === "IF ACCEPTED" || bName === "IF REPLIED" || bName === "ACCEPTED" || bName === "REPLIED") {
               // fallback to main sequence
               if (currentNextId) {
                  if (bName === "IF ACCEPTED" || bName === "ACCEPTED") edges["on_accepted"] = currentNextId;
                  if (bName === "IF REPLIED" || bName === "REPLIED") edges["on_replied"] = currentNextId;
               }
            }
          }
        }

        const isEmail = ws.type === "email";
        const isInMail = ws.type === "sales_inmail";
        const isMessage = ws.type === "message" || isInMail;
        const hasAI = isMessage || isEmail || ws.type === "ai_comment" || ws.type === "ai_qualify";

        const res = await fetch(`/api/workflows/${workflowId}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step_type: ws.type,
            track: "playbook",
            connect_note: ws.type === "connect" ? (ws.connectNote || null) : null,
            message_body: isMessage ? (ws.messageBody || null) : null,
            template_id: isMessage && ws.templateIds.length === 0 ? (ws.templateId ?? null) : null,
            template_ids: isMessage ? ws.templateIds : [],
            email_subject: isEmail || isInMail ? (ws.emailSubject || null) : null,
            email_body: isEmail ? (ws.emailBody || null) : null,
            email_signature: isEmail ? ws.emailSignature : null,
            email_position: ws.emailPosition || null,
            message_position: ws.messagePosition || null,
            ai_enabled: hasAI ? (ws.aiEnabled ? 1 : 0) : 0,
            ai_model: hasAI ? (ws.aiModel || null) : null,
            ai_prompt: hasAI ? (ws.aiPrompt || null) : null,
            ai_max_words: hasAI && ws.aiEnabled && ws.aiMaxWordsEnabled ? ws.aiMaxWords : null,
            ai_language: hasAI ? (ws.aiLanguage || "English") : null,
            config: ws.config || null,
            edges_json: Object.keys(edges).length > 0 ? JSON.stringify(edges) : null,
          }),
        });
        const data = await res.json();
        currentNextId = data.id;

        if (ws.delayDaysBefore > 0) {
           const dRes = await fetch(`/api/workflows/${workflowId}/steps`, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
               step_type: "delay",
               track: "playbook",
               delay_seconds: ws.delayDaysBefore * 86400,
               edges_json: JSON.stringify({ next: currentNextId })
             })
           });
           const dData = await dRes.json();
           currentNextId = dData.id;
        }
      }
      return currentNextId;
    }

    await saveSequenceBackward(wizardSteps, null);
    
    // Save AI Context
    try {
      await fetch(`/api/workflows/${workflowId}/reply-context`, {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            is_active: arActive,
            sender_profile: arSender,
            company_product: arCompany,
            offers_playbook: arOffers,
            voice_rules: arVoice
         })
      });
    } catch (e) {}
    
    setSaving(false);
  }

  async function enrollContacts() {
    if (!activeRunId) { toast.error("No active run"); return; }
    if (selectedTargetIds.size === 0) { toast.error("Select at least one prospect"); return; }
    setLaunching(true);
    const res = await fetch(`/api/runs/${activeRunId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_ids: Array.from(selectedTargetIds) }),
    });
    setLaunching(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? err.error ?? "Failed to enroll");
      return;
    }
    const data = await res.json();
    if (data.enrolled === 0) {
      toast.message("Nothing to enroll", {
        description: `All selected contacts are already enrolled or active elsewhere.`,
      });
    } else {
      const skipped = (data.skipped_already_enrolled ?? 0) + (data.skipped_active_elsewhere ?? 0);
      toast.success(
        skipped > 0
          ? `Enrolled ${data.enrolled} — ${skipped} skipped`
          : `Enrolled ${data.enrolled} contact${data.enrolled !== 1 ? "s" : ""}`
      );
    }
    onLaunched();
  }

  async function launch() {
    if (wizardSteps.length === 0) { toast.error("Add at least one step"); return; }
    if (selectedTargetIds.size === 0) { toast.error("Select at least one prospect"); return; }
    await saveStepsToDB();
    setLaunching(true);
    const body: Record<string, unknown> = {
      workflow_id: workflowId,
      list_id: listId,
      account_id: accountId,
      email_account_ids: Array.from(emailAccountIds),
    };
    body.target_ids = Array.from(selectedTargetIds);
    const runRes = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!runRes.ok) {
      setLaunching(false);
      const err = await runRes.json();
      toast.error(err.message ?? "Failed to start");
      return;
    }
    const { id: runId } = await runRes.json();
    await fetch(`/api/runs/${runId}/start`, { method: "POST" });
    setLaunching(false);
    toast.success("Campaign launched!");
    onLaunched();
  }

  async function saveAndClose() {
    await saveStepsToDB();
    toast.success("Steps saved");
    onClose();
  }

  async function sendTestEmail() {
    const ws = testEmailIdx !== null ? getStepByPath(wizardSteps, testEmailIdx) : null;
    if (!ws || !testEmailAccountId || !testEmailTo) return;
    setTestEmailSending(true);
    const res = await fetch(`/api/email-accounts/${testEmailAccountId}/send-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: testEmailTo,
        subject: ws.emailSubject
          .replace(/\{\{first_name\}\}/g, "Alex")
          .replace(/\{\{last_name\}\}/g, "Johnson")
          .replace(/\{\{company\}\}/g, "Acme Corp")
          .replace(/\{\{title\}\}/g, "Head of Growth"),
        body: ws.emailBody
          .replace(/\{\{first_name\}\}/g, "Alex")
          .replace(/\{\{last_name\}\}/g, "Johnson")
          .replace(/\{\{company\}\}/g, "Acme Corp")
          .replace(/\{\{title\}\}/g, "Head of Growth"),
      }),
    });
    setTestEmailSending(false);
    if (!res.ok) {
      const err = await res.json();
      toast.error(`Failed to send: ${err.error}`);
    } else {
      toast.success(`Test email sent to ${testEmailTo}`);
      setTestEmailIdx(null);
      setTestEmailTo("");
    }
  }

  const basePages: WizardPage[] = isStepsOnly
    ? ["prompt", "sequence"]
    : isEditMode
    ? ["prompt", "sequence", "ai_replies", "account"]
    : isAddContacts
    ? ["prospects"]
    : ["prospects", "prompt", "sequence", "ai_replies", "account", "summary"];
  // Open-core: "Campaign Context" is AI-only (feeds the AI writer). Hide it entirely
  // in the free build — no page, no nav entry, no upgrade stub.
  const pages = hasPremium ? basePages : basePages.filter((p) => p !== "prompt");
  const pageIdx = pages.indexOf(page);

  const prospectsReady = !!listId && !allBlocked && selectedTargetIds.size > 0;
  const stepsReady = wizardSteps.length > 0;

  function canGoTo(p: WizardPage) {
    if (p === "prompt" && !hasPremium) return false; // AI-only page, hidden in free build
    if (isStepsOnly) return p === "prompt" || p === "sequence";
    if (isEditMode) {
      if (p === "prompt" || p === "sequence") return true;
      if (p === "account") return stepsReady;
      return false;
    }
    if (p === "prospects") return true;
    if (p === "prompt") return prospectsReady;
    if (p === "sequence") return prospectsReady;
    if (p === "account") return prospectsReady && stepsReady;
    if (p === "summary") return prospectsReady && stepsReady && !!accountId;
    return false;
  }

  const PAGE_LABELS: Record<WizardPage, string> = {
    prospects: "Choose Prospects",
    prompt: "Campaign Context",
    sequence: "Sequence",
    account: "Choose Account",
    summary: "Summary",
    ai_replies: "AI Auto-Reply",
  };

  const PAGE_ICONS: Record<WizardPage, React.ReactNode> = {
    prospects: <RiAddLine size={14} />,
    prompt: <RiRobot2Line size={14} />,
    sequence: <RiRouteLine size={14} />,
    account: <RiUser3Line size={14} />,
    summary: "✓",
    ai_replies: <RiRobot2Line size={14} />,
  };

  return (
    <div className="fixed inset-0 z-50 bg-base-100 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-300/50 shrink-0">
        <div className="flex items-center gap-3">
          {editingName ? (
            <input
              autoFocus
              className="input input-xs input-bordered bg-base-300/50 font-semibold text-sm w-52"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveWorkflowName}
              onKeyDown={(e) => { if (e.key === "Enter") saveWorkflowName(); if (e.key === "Escape") { setEditingName(false); setNameValue(workflowName); } }}
              disabled={nameSaving}
            />
          ) : (
            <button
              className="font-semibold text-sm hover:text-primary transition-colors cursor-pointer"
              onClick={() => { setNameValue(workflowName); setEditingName(true); }}
              title="Click to rename"
            >
              {workflowName}
            </button>
          )}
          <span className="text-base-content/30">·</span>
          <span className="text-sm text-base-content/50">{PAGE_LABELS[page]}</span>
        </div>
        <button
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-base-content/50 hover:text-base-content hover:bg-base-300/50 transition-colors"
          onClick={onClose}
          disabled={launching || saving}
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <div className="w-56 shrink-0 border-r border-base-300/50 p-4 flex flex-col gap-1 overflow-y-auto">
          {pages.map((p) => {
            const active = page === p;
            const canNav = canGoTo(p);
            return (
              <button
                key={p}
                onClick={() => canNav && setPage(p)}
                className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                  active
                    ? "bg-primary/10 border border-primary/30"
                    : canNav
                    ? "hover:bg-base-200"
                    : "opacity-30 cursor-not-allowed"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                    active ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/50"
                  }`}
                >
                  {PAGE_ICONS[p]}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${active ? "text-primary" : "text-base-content"}`}>
                    {PAGE_LABELS[p]}
                  </p>
                  {p === "prospects" && selectedList && (
                    <p className="text-xs text-base-content/40 truncate">{selectedList.name}</p>
                  )}
                  {p === "sequence" && wizardSteps.length > 0 && (
                    <p className="text-xs text-base-content/40">{wizardSteps.length} step{wizardSteps.length !== 1 ? "s" : ""}</p>
                  )}
                  {p === "prompt" && campaignPrompt.trim() && (
                    <p className="text-xs text-base-content/40 truncate">{campaignPrompt.trim().slice(0, 24)}{campaignPrompt.trim().length > 24 ? "…" : ""}</p>
                  )}
                  {p === "account" && selectedAccount && (
                    <p className="text-xs text-base-content/40 truncate">{selectedAccount.name}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto pt-10 px-10 pb-6">
            <div className={`w-full mx-auto ${(page === "prospects" || page === "summary") ? "max-w-5xl" : page === "sequence" ? "max-w-7xl" : "max-w-2xl"}`}>

              {/* ── Page: Prospects ── */}
              {page === "prospects" && (() => {
                const filteredLists = lists.filter((l) =>
                  listSearch.trim() === ""
                    ? true
                    : l.name.toLowerCase().includes(listSearch.toLowerCase())
                );
                return (
                  <div className="flex flex-col" style={{ minHeight: "calc(100vh - 220px)" }}>
                    <h2 className="text-xl font-semibold mb-1">{isAddContacts ? "Add contacts to campaign" : "Choose your prospects"}</h2>
                    <p className="text-base-content/50 text-sm mb-4">
                      {isAddContacts
                        ? "Pick contacts from any list to enroll into the running campaign. Already-enrolled contacts are skipped."
                        : "Pick a list, then choose all contacts or a manual subset."}
                    </p>
                    
                    <div className="mb-4 bg-base-200/50 p-3 rounded-xl border border-base-300 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Cross-campaign Enrollment</p>
                        <p className="text-xs text-base-content/50 mt-0.5">Allow enrolling contacts who have already participated in other campaigns</p>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-xs w-12 text-[10px] ${crossOverlap ? "btn-success" : "btn-outline border-base-300"}`}
                        onClick={async () => {
                          const checked = !crossOverlap;
                          setCrossOverlap(checked);
                          await fetch(`/api/workflows/${workflowId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ allow_cross_campaign_overlap: checked ? 1 : 0 })
                          });
                        }}
                      >
                        {crossOverlap ? "ON" : "OFF"}
                      </button>
                    </div>

                    <div className="flex gap-6 flex-1 min-h-0">
                      {/* ── Left: Lists picker ── */}
                      <div className="w-72 shrink-0 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-base-content/40 uppercase tracking-wide">Lists</p>
                          <span className="text-xs text-base-content/30">{lists.length}</span>
                        </div>
                        <div className="relative mb-2">
                          <RiSearchLine size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30" />
                          <input
                            type="text"
                            value={listSearch}
                            onChange={(e) => setListSearch(e.target.value)}
                            placeholder="Search lists…"
                            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg bg-base-200 border border-base-300/50 focus:border-primary/40 focus:outline-none placeholder:text-base-content/30"
                          />
                        </div>
                        <div className="flex-1 overflow-y-auto rounded-lg border border-base-300/30 bg-base-200/30">
                          {lists.length === 0 ? (
                            <p className="text-xs text-base-content/40 p-4">
                              No lists yet.{" "}
                              <Link href="/lists" className="text-primary underline">Create one</Link>
                            </p>
                          ) : filteredLists.length === 0 ? (
                            <p className="text-xs text-base-content/30 p-4">No lists match.</p>
                          ) : (
                            filteredLists.map((l) => {
                              const active = listId === String(l.id);
                              return (
                                <button
                                  key={l.id}
                                  onClick={() => selectList(String(l.id))}
                                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm border-b border-base-300/20 last:border-0 transition-colors ${
                                    active
                                      ? "bg-primary/10 text-primary"
                                      : "hover:bg-base-200/60 text-base-content/80"
                                  }`}
                                >
                                  <span className="truncate">{l.name}</span>
                                  <span className={`text-xs shrink-0 ${active ? "text-primary/70" : "text-base-content/30"}`}>
                                    {l.target_count ?? 0}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* ── Right: Mode toggle + content ── */}
                      <div className="flex-1 min-w-0 flex flex-col min-h-0">
                        {!listId ? (
                          <div className="flex-1 flex items-center justify-center">
                            <p className="text-sm text-base-content/40">Select a list to choose contacts.</p>
                          </div>
                        ) : (
                          <>
                            {/* Mode toggle — always at top of right column */}
                            <div className="flex gap-2 mb-3">
                              <button
                                onClick={() => { setProspectMode("all"); setSelectedTargetIds(new Set(filteredListTargets.map((t: ListTarget) => t.id))); }}
                                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${prospectMode === "all" ? "bg-primary/10 border-primary/40 text-primary" : "bg-base-200 border-base-300/50 hover:border-base-300 text-base-content/60"}`}
                              >
                                {wizardFilters.length > 0 ? "Matching segment" : "All contacts"}
                                <span className="ml-1 text-xs opacity-60">({filteredListTargets.length})</span>
                              </button>
                              <button
                                onClick={() => setProspectMode("manual")}
                                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${prospectMode === "manual" ? "bg-primary/10 border-primary/40 text-primary" : "bg-base-200 border-base-300/50 hover:border-base-300 text-base-content/60"}`}
                              >
                                Manual selection
                                {prospectMode === "manual" && (
                                  <span className="ml-1 text-xs opacity-60">({selectedTargetIds.size} selected)</span>
                                )}
                              </button>
                            </div>

                            {/* Status / banner */}
                            {conflictsLoading && <p className="text-xs text-base-content/40 mb-2">Checking for conflicts...</p>}
                            {isAddContacts && (
                              <div className="px-3 py-2 rounded-lg text-xs mb-3 bg-base-200/50 border border-base-300/40 text-base-content/50">
                                Already-enrolled contacts are skipped automatically.
                              </div>
                            )}
                            {!isAddContacts && !conflictsLoading && conflicts && conflicts.blocked > 0 && (
                              <div className={`px-3 py-2 rounded-lg text-xs mb-3 ${allBlocked ? "bg-error/10 text-error" : "bg-warning/10 text-warning"}`}>
                                {allBlocked
                                  ? `All ${conflicts.total} prospects are already active in another campaign. Choose a different list.`
                                  : `${conflicts.blocked} of ${conflicts.total} prospects are already active elsewhere and will be excluded.`}
                              </div>
                            )}
                            {!isAddContacts && !conflictsLoading && conflicts && conflicts.blocked === 0 && listId && (
                              <p className="text-xs text-success mb-3">All {conflicts.total} prospects are available.</p>
                            )}

                            {/* Content */}
                            <div className="mb-3">
                              <FilterBar
                                filters={wizardFilters}
                                onChange={(f) => {
                                  setWizardFilters(f);
                                  // Auto-select if in 'all' mode
                                  if (prospectMode === "all") {
                                    // The effect of useMemo will run, but we can't synchronously get filteredListTargets here easily.
                                    // Let's rely on a useEffect to sync selectedTargetIds when in "all" mode.
                                  }
                                }}
                                />
                            </div>
                            
                            {prospectMode === "all" ? (
                              <div className="flex-1 flex items-center justify-center rounded-xl border border-base-300/30 bg-base-200/20">
                                <div className="text-center">
                                  <p className="text-3xl font-semibold text-base-content/80">
                                    {selectedTargetIds.size}
                                  </p>
                                  <p className="text-xs text-base-content/40 mt-1">
                                    contact{selectedTargetIds.size !== 1 ? "s" : ""} will be enrolled
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 min-h-0 border border-base-300/50 rounded-xl overflow-hidden flex flex-col">
                                <div className="px-4 py-2.5 bg-base-200 border-b border-base-300/50 flex items-center gap-3 shrink-0">
                                  <input
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded border border-base-300 bg-base-300/50 accent-primary cursor-pointer"
                                    checked={selectedTargetIds.size === filteredListTargets.length && filteredListTargets.length > 0}
                                    onChange={toggleAllTargets}
                                  />
                                  <span className="text-xs text-base-content/50">
                                    {selectedTargetIds.size === filteredListTargets.length
                                      ? `All ${listTargets.length} selected`
                                      : `${selectedTargetIds.size} of ${filteredListTargets.length} selected`}
                                  </span>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                  {filteredListTargets.map((t: ListTarget) => (
                                    <label
                                      key={t.id}
                                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-base-200/60 cursor-pointer border-b border-base-300/30 last:border-0"
                                    >
                                      <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 rounded border border-base-300 bg-base-300/50 accent-primary cursor-pointer shrink-0"
                                        checked={selectedTargetIds.has(t.id)}
                                        onChange={() => toggleTarget(t.id)}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{t.full_name ?? "—"}</p>
                                        {(t.title || t.company) && (
                                          <p className="text-xs text-base-content/40 truncate">{[t.title, t.company].filter(Boolean).join(" · ")}</p>
                                        )}
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Page: Campaign Prompt ── */}
              {page === "prompt" && (
                <div>
                  <h2 className="text-xl font-semibold mb-1">Campaign context</h2>
                  <p className="text-base-content/50 text-sm mb-6">
                    What&apos;s unique about this campaign? The AI reads this for every message it writes — use it to set the angle, persona, USP, or tone. Optional but recommended when using AI-generated steps.
                  </p>
                  <textarea
                    value={campaignPrompt}
                    onChange={(e) => setCampaignPrompt(e.target.value)}
                    rows={10}
                    placeholder={"This campaign targets CTOs at Series B startups in fintech. Lead with the compliance angle — our product helps them pass SOC2 without hiring a dedicated security team. Keep the tone direct and peer-to-peer, not vendor-y."}
                    className="w-full bg-base-300/40 border border-base-300/50 rounded-xl px-4 py-3 text-sm text-base-content placeholder:text-base-content/20 focus:outline-none focus:border-primary/40 resize-y leading-relaxed"
                  />
                  <p className="text-xs text-base-content/30 mt-2">{campaignPrompt.length} chars</p>
                </div>
              )}

              {/* ── Page: Sequence ── */}
              {page === "sequence" && (() => {

                return (
                  <div className="max-w-3xl mx-auto pb-20">
                    <h2 className="text-2xl font-bold mb-2">Playbook Sequence</h2>
                    <p className="text-base-content/60 text-sm mb-8">
                      Build your outreach timeline. Steps execute sequentially as a unified flow.
                    </p>
                    
                    <div className="space-y-0 mb-8">
                      {wizardSteps.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-base-300/40 rounded-2xl bg-base-200/20 text-base-content/40 text-sm">
                          No steps yet. Add one below to start your sequence.
                        </div>
                      ) : (
                        wizardSteps.map((ws, idx) => <StepCard key={idx} ws={ws} prevWs={idx > 0 ? wizardSteps[idx - 1] : undefined} path={[idx]} isFirst={idx === 0} />)
                      )}
                    </div>
                    
                    <div className="flex justify-center">
                      <div className="dropdown dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-primary shadow-lg shadow-primary/20 gap-2 rounded-full px-6">
                          <RiAddLine size={18} /> Add Step
                        </label>
                        <ul tabIndex={0} className="dropdown-content z-[10] menu p-2 shadow-xl bg-base-100 rounded-xl w-64 mb-4 border border-base-300/50">
                          <li className="menu-title"><span className="text-xs font-bold text-base-content/40 uppercase tracking-wider">LinkedIn</span></li>
                          <li><a onClick={() => addWizardStep("visit")} className="gap-3"><RiEyeLine size={14} className="text-info"/> Visit Profile</a></li>
                          <li><a onClick={() => addWizardStep("linkedin_enrich")} className="gap-3"><RiSearchEyeLine size={14} className="text-info"/> Enrich Profile</a></li>
                          <li><a onClick={() => addWizardStep("connect")} className="gap-3"><RiLinkedinBoxLine size={14} className="text-primary"/> Connect</a></li>
                          <li><a onClick={() => addWizardStep("message")} className="gap-3"><RiMessage2Line size={14} className="text-success"/> Message</a></li>
                          {hasPremium && <li><a onClick={() => addWizardStep("sales_inmail")} className="gap-3"><RiSendPlaneLine size={14} className="text-primary"/> Sales Nav InMail</a></li>}
                          <li><a onClick={() => addWizardStep("linkedin_like")} className="gap-3"><RiThumbUpLine size={14} className="text-primary"/> Like Recent Posts</a></li>
                          
                          <li className="menu-title mt-2"><span className="text-xs font-bold text-base-content/40 uppercase tracking-wider">Email</span></li>
                          <li><a onClick={() => addWizardStep("email")} className="gap-3"><RiMailLine size={14} className="text-warning"/> Cold Email</a></li>
                          
                          <li className="menu-title mt-2"><span className="text-xs font-bold text-base-content/40 uppercase tracking-wider">Integrations</span></li>
                          <li><a onClick={() => addWizardStep("integration")} className="gap-3"><RiPlugLine size={14} className="text-accent"/> Integration</a></li>
                          <li><a onClick={() => addWizardStep("change_status")} className="gap-3"><RiGroupLine size={14} className="text-secondary"/> CRM Status</a></li>
                          
                          <li className="menu-title mt-2"><span className="text-xs font-bold text-base-content/40 uppercase tracking-wider">AI Agents</span></li>
                          <li><a onClick={() => addWizardStep("ai_qualify")} className="gap-3"><RiRobot2Line size={14} className="text-secondary"/> AI Qualify</a></li>
                          <li><a onClick={() => addWizardStep("ai_comment")} className="gap-3"><RiMessage2Line size={14} className="text-secondary"/> AI Comment</a></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              
              {/* ── Page: AI Auto-Replies ── */}
              {page === "ai_replies" && (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">AI Auto-Responder</h2>
                    <p className="text-base-content/50 text-sm">Automatically draft and send replies when prospects respond to this playbook.</p>
                  </div>
                  
                  <div onClick={() => setArActive(!arActive)} className="flex items-center gap-4 p-5 rounded-2xl bg-base-200 border border-base-300 cursor-pointer hover:border-primary/40 transition-colors select-none">
                    <div className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ease-in-out cursor-pointer shrink-0 ${arActive ? 'bg-primary' : 'bg-base-300'}`}>
                      <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${arActive ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-base text-base-content/90 mb-0.5">Enable AI Auto-Replies</p>
                      <p className="text-sm text-base-content/50">GPT-4o will automatically draft and handle incoming LinkedIn and Email messages.</p>
                    </div>
                  </div>
                  {arActive && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-base-content/70 block mb-1">Sender Profile (Who are you?)</label>
                        <textarea rows={3} placeholder="e.g. I am John, the CEO. I speak directly and professionally." value={arSender} onChange={(e) => setArSender(e.target.value)} className="w-full bg-base-200/50 border border-base-300/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 resize-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-base-content/70 block mb-1">Company & Product</label>
                        <textarea rows={3} placeholder="What do you do? What problem do you solve?" value={arCompany} onChange={(e) => setArCompany(e.target.value)} className="w-full bg-base-200/50 border border-base-300/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 resize-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-base-content/70 block mb-1">Offers & Playbook</label>
                        <textarea rows={3} placeholder="e.g. If they ask for pricing, say X. If they ask for a demo, say Y." value={arOffers} onChange={(e) => setArOffers(e.target.value)} className="w-full bg-base-200/50 border border-base-300/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 resize-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-base-content/70 block mb-1">Voice & Reply Rules</label>
                        <textarea rows={3} placeholder="e.g. Never use emojis. Keep it under 50 words. Ask a clarifying question." value={arVoice} onChange={(e) => setArVoice(e.target.value)} className="w-full bg-base-200/50 border border-base-300/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 resize-none" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Page: Account ── */}
              {page === "account" && (
                <div>
                  <h2 className="text-xl font-semibold mb-1">Choose your accounts</h2>
                  <p className="text-base-content/50 text-sm mb-6">
                    Select the account{hasLinkedInStep && hasEmailStep ? "s" : ""} that will execute this campaign.
                  </p>

                  <div className="mb-8">
                      <div className="mb-3">
                        <h3 className="text-base font-semibold">LinkedIn account</h3>
                        {!hasLinkedInStep && (
                          <p className="text-xs text-base-content/40 mt-0.5">Required for automation even on email-only workflows.</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {accounts.filter((a) => a.is_authenticated).length === 0 ? (
                          <p className="text-sm text-warning">
                            No authenticated accounts.{" "}
                            <Link href="/settings?tab=linkedin" className="underline">Authenticate one first.</Link>
                          </p>
                        ) : accounts.filter((a) => a.is_authenticated).map((a) => {
                          const connLeft = a.daily_connection_limit - a.connections_today;
                          const msgLeft = a.daily_message_limit - a.messages_today;
                          const inmailLeft = a.daily_inmail_limit - a.inmails_today;
                          return (
                            <button
                              key={a.id}
                              onClick={() => setAccountId(String(a.id))}
                              className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors text-left ${
                                accountId === String(a.id)
                                  ? "bg-primary/10 border-primary/40"
                                  : "bg-base-200 border-base-300/50 hover:border-base-300"
                              }`}
                            >
                              <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${accountId === String(a.id) ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/60"}`}>
                                {a.name.charAt(0).toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${accountId === String(a.id) ? "text-primary" : ""}`}>{a.name}</p>
                                <p className="text-xs text-base-content/40">{connLeft} connections left today · {msgLeft} messages left today · {inmailLeft} InMails left today</p>
                              </div>
                              {accountId === String(a.id) && <span className="ml-auto text-primary text-xs font-semibold shrink-0">Selected</span>}
                            </button>
                          );
                        })}
                      </div>
                  </div>

                  {hasEmailStep && (
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold">Email accounts</h3>
                        <p className="text-xs text-base-content/40 mt-0.5">Select one or more. Contacts are distributed by company — all contacts at the same company get one sender.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {emailAccounts.filter((e) => e.is_verified).length === 0 ? (
                          <p className="text-sm text-warning">
                            No verified email accounts.{" "}
                            <Link href="/settings" className="underline">Add one in Settings.</Link>
                          </p>
                        ) : emailAccounts.filter((e) => e.is_verified).map((e) => {
                          const selected = emailAccountIds.has(e.id);
                          const inUse = e.active_run_count > 0;
                          const locked = activeRunEmailAccountIds.includes(e.id);
                          return (
                            <button
                              key={e.id}
                              onClick={() => {
                                if (locked) return;
                                setEmailAccountIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                                  return next;
                                });
                              }}
                              className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors text-left ${
                                locked
                                  ? "bg-warning/10 border-warning/30 cursor-not-allowed"
                                  : selected
                                  ? "bg-warning/10 border-warning/30"
                                  : "bg-base-200 border-base-300/50 hover:border-base-300"
                              }`}
                            >
                              <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${selected || locked ? "bg-warning/20 text-warning" : "bg-base-300 text-base-content/60"}`}>
                                {e.name.charAt(0).toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${selected || locked ? "text-warning" : ""}`}>{e.name}</p>
                                <p className="text-xs text-base-content/40">{e.from_email}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {locked ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-warning/20 text-warning border border-warning/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-warning" /> In use · locked
                                  </span>
                                ) : inUse ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-warning/15 text-warning">
                                    <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" /> In use
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-base-300/50 text-base-content/30">
                                    Free
                                  </span>
                                )}
                                {selected && !locked && <span className="text-warning text-xs font-semibold">Selected</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Page: Summary ── */}
              {page === "summary" && (() => {
                const contactCount = selectedTargetIds.size;
                // Collect AI steps with their preview costs
                const aiSteps = wizardSteps.map((ws, i) => ({ ws, i })).filter(({ ws }) => ws.aiEnabled && (ws.type === "email" || ws.type === "message" || ws.type === "sales_inmail"));
                const hasCostData = aiSteps.some(({ i }) => stepPreviewCosts[i] != null);
                const totalAiCost = aiSteps.reduce((sum, { i }) => sum + (stepPreviewCosts[i]?.cost_usd ?? 0), 0) * contactCount;
                const totalTokens = aiSteps.reduce((sum, { i }) => {
                  const c = stepPreviewCosts[i];
                  return sum + (c ? c.input_tokens + c.output_tokens : 0);
                }, 0) * contactCount;

                return (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-xl font-semibold mb-0.5">Ready to launch</h2>
                      <p className="text-base-content/50 text-sm">Review your campaign before starting.</p>
                    </div>

                    {/* Campaign overview card */}
                    <div className="bg-base-200 border border-base-300/50 rounded-xl overflow-hidden">
                      {/* Header strip */}
                      <div className="bg-primary/10 border-b border-base-300/50 px-5 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                          <RiRobot2Line size={15} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{workflowName}</p>
                          <p className="text-xs text-base-content/40">{wizardSteps.filter(s => (s.type as string) !== "delay").length} steps · {contactCount} contact{contactCount !== 1 ? "s" : ""}</p>
                        </div>
                      </div>

                      {/* Details grid */}
                      <div className="divide-y divide-base-300/40">
                        <div className="grid grid-cols-2 px-5 py-3 text-sm">
                          <span className="text-base-content/50">List</span>
                          <div className="text-right">
                            <span className="font-medium">{selectedList?.name}</span>
                            <p className="text-xs text-base-content/35 mt-0.5">
                              {selectedTargetIds.size === filteredListTargets.length
                                ? `${contactCount} contacts`
                                : `${contactCount} of ${filteredListTargets.length} selected`}
                            </p>
                          </div>
                        </div>
                        {selectedAccount && (
                          <div className="grid grid-cols-2 px-5 py-3 text-sm">
                            <span className="text-base-content/50">LinkedIn</span>
                            <span className="font-medium text-right">{selectedAccount.name}</span>
                          </div>
                        )}
                        {hasEmailStep && (
                          <div className="grid grid-cols-2 px-5 py-3 text-sm">
                            <span className="text-base-content/50">Email from</span>
                            {selectedEmailAccounts.length > 0 ? (
                              <div className="text-right space-y-1">
                                {selectedEmailAccounts.map(e => (
                                  <div key={e.id}>
                                    <span className="font-medium">{e.name}</span>
                                    <p className="text-xs text-base-content/35">{e.from_email}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-warning text-xs text-right">Not selected — email steps skipped</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step sequence */}
                    {(() => {
                      const summaryLiSteps = wizardSteps.map((ws, i) => ({ ws, i })).filter(({ ws }) => ws.track === "linkedin");
                      const summaryEmSteps = wizardSteps.map((ws, i) => ({ ws, i })).filter(({ ws }) => ws.track === "email");
                      const summaryInSteps = wizardSteps.map((ws, i) => ({ ws, i })).filter(({ ws }) => ws.track === "integration");
                      const isDualSummary = [summaryLiSteps, summaryEmSteps, summaryInSteps].filter(s => s.length > 0).length > 1;

                      function SummaryTrack({ steps, trackLabel, trackColor }: { steps: { ws: WizardStep; i: number }[]; trackLabel: string; trackColor: string }) {
                        return (
                          <div>
                            <div className={`px-4 py-2 border-b border-base-300/30 text-xs font-semibold ${trackColor}`}>{trackLabel}</div>
                            <div className="divide-y divide-base-300/20">
                              {steps.map(({ ws, i }) => {
                                const label = getDynamicStepLabel(ws, wizardSteps, i);
                                const cost = stepPreviewCosts[i];
                                const colorClass = STEP_COLORS[ws.type] ?? "bg-base-300/30 text-base-content/50 border-base-300/30";
                                return (
                                  <div key={i}>
                                    {ws.delayDaysBefore > 0 && (
                                      <div className="flex items-center gap-1.5 text-xs text-base-content/25 px-5 py-1.5 bg-base-300/20">
                                        <RiTimeLine size={10} /> Wait {ws.delayDaysBefore}d
                                      </div>
                                    )}
                                    <div className="px-5 py-2.5 flex items-center gap-3">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border font-medium ${colorClass}`}>
                                        {STEP_ICONS[ws.type]} {label}
                                      </span>
                                      <div className="flex-1" />
                                      {ws.aiEnabled && (
                                        <span className="inline-flex items-center gap-1.5 text-xs">
                                          <RiRobot2Line size={11} className="text-primary/50" />
                                          {cost ? <span className="text-base-content/40">${cost.cost_usd.toFixed(5)}</span> : <span className="text-base-content/25 italic">preview to estimate</span>}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="bg-base-200 border border-base-300/50 rounded-xl overflow-hidden">
                          <div className="px-5 py-3 border-b border-base-300/40 flex items-center justify-between">
                            <p className="text-xs font-medium text-base-content/40 uppercase tracking-widest">Sequence</p>
                            {isDualSummary && (
                              <span className="inline-flex items-center gap-1 text-xs text-primary/60 bg-primary/8 px-2 py-0.5 rounded-full border border-primary/15">
                                <RiArrowRightLine size={10} /> Parallel tracks
                              </span>
                            )}
                          </div>
                          {isDualSummary ? (
                            <div className={`grid ${[summaryLiSteps, summaryEmSteps, summaryInSteps].filter(s => s.length > 0).length === 3 ? 'grid-cols-3' : 'grid-cols-2'} divide-x divide-base-300/30`}>
                              {summaryLiSteps.length > 0 && <SummaryTrack steps={summaryLiSteps} trackLabel="LinkedIn" trackColor="text-primary/60" />}
                              {summaryEmSteps.length > 0 && <SummaryTrack steps={summaryEmSteps} trackLabel="Email" trackColor="text-warning/60" />}
                              {summaryInSteps.length > 0 && <SummaryTrack steps={summaryInSteps} trackLabel="Integrations" trackColor="text-secondary/60" />}
                            </div>
                          ) : (
                            <div className="divide-y divide-base-300/30">
                              {wizardSteps.map((ws, i) => {
                                const label = getDynamicStepLabel(ws, wizardSteps, i);
                                const cost = stepPreviewCosts[i];
                                const colorClass = STEP_COLORS[ws.type] ?? "bg-base-300/30 text-base-content/50 border-base-300/30";
                                return (
                                  <div key={i}>
                                    {ws.delayDaysBefore > 0 && (
                                      <div className="flex items-center gap-1.5 text-xs text-base-content/25 px-5 py-2 bg-base-300/20">
                                        <RiTimeLine size={10} /> Wait {ws.delayDaysBefore}d
                                      </div>
                                    )}
                                    <div className="px-5 py-3 flex items-center gap-3">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border font-medium ${colorClass}`}>
                                        {STEP_ICONS[ws.type]} {label}
                                      </span>
                                      <div className="flex-1" />
                                      {ws.aiEnabled && (
                                        <span className="inline-flex items-center gap-1.5 text-xs">
                                          <RiRobot2Line size={11} className="text-primary/50" />
                                          {cost ? <span className="text-base-content/40">${cost.cost_usd.toFixed(5)} · {(cost.input_tokens + cost.output_tokens).toLocaleString()} tok</span> : <span className="text-base-content/25 italic">preview to estimate</span>}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* AI Cost estimate */}
                    {aiSteps.length > 0 && (
                      <div className={`rounded-xl border overflow-hidden ${hasCostData ? "border-primary/20 bg-primary/5" : "border-base-300/50 bg-base-200"}`}>
                        <div className="px-5 py-3 border-b border-base-300/30 flex items-center gap-2">
                          <RiRobot2Line size={13} className={hasCostData ? "text-primary" : "text-base-content/30"} />
                          <p className="text-xs font-medium text-base-content/40 uppercase tracking-widest">AI Cost Estimate</p>
                        </div>
                        {!hasCostData ? (
                          <div className="px-5 py-4 text-xs text-base-content/40">
                            Run an AI preview on your steps to get a cost estimate for this campaign.
                          </div>
                        ) : (
                          <div className="divide-y divide-base-300/30">
                            {aiSteps.map(({ ws, i }) => {
                              const cost = stepPreviewCosts[i];
                              const label = getDynamicStepLabel(ws, wizardSteps, i);
                              if (!cost) return (
                                <div key={i} className="grid grid-cols-[1fr_auto] px-5 py-2.5 text-xs items-center gap-4">
                                  <span className="text-base-content/40">{label}</span>
                                  <span className="text-base-content/25 italic">no preview</span>
                                </div>
                              );
                              const stepTotal = cost.cost_usd * contactCount;
                              return (
                                <div key={i} className="grid grid-cols-[1fr_auto_auto] px-5 py-2.5 text-xs items-center gap-4">
                                  <span className="text-base-content/60 font-medium">{label}</span>
                                  <span className="text-base-content/35">${cost.cost_usd.toFixed(5)} × {contactCount}</span>
                                  <span className="font-semibold text-base-content tabular-nums">${stepTotal.toFixed(4)}</span>
                                </div>
                              );
                            })}
                            {aiSteps.filter(({ i }) => stepPreviewCosts[i]).length > 0 && (
                              <div className="grid grid-cols-[1fr_auto] px-5 py-3 text-sm items-center bg-primary/5">
                                <div>
                                  <span className="font-semibold text-base-content">Total estimated cost</span>
                                  <p className="text-xs text-base-content/35 mt-0.5">{totalTokens.toLocaleString()} tokens across {contactCount} contacts</p>
                                </div>
                                <span className="text-lg font-bold text-primary tabular-nums">${totalAiCost.toFixed(4)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Warnings */}
                    {conflicts && conflicts.blocked > 0 && (
                      <p className="text-xs text-warning flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-warning inline-block" />
                        {conflicts.blocked} prospect{conflicts.blocked !== 1 ? "s" : ""} active elsewhere will be excluded.
                      </p>
                    )}
                    <p className="text-xs text-base-content/35">The campaign starts immediately after you click Launch.</p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Bottom nav */}
          <div className="border-t border-base-300/50 px-10 py-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm text-base-content/60 hover:text-base-content hover:bg-base-300/50 transition-colors disabled:opacity-40"
                onClick={pageIdx === 0 ? onClose : () => setPage(pages[pageIdx - 1])}
                disabled={launching || saving}
              >
                {pageIdx === 0 ? "Cancel" : "← Back"}
              </button>
              {!isStepsOnly && !isEditMode && page === "sequence" && wizardSteps.length > 0 && (
                <button
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm text-base-content/40 hover:text-base-content/60 hover:bg-base-300/50 transition-colors disabled:opacity-40"
                  onClick={saveAndClose}
                  disabled={saving}
                >
                  {saving ? <span className="loading loading-spinner loading-xs" /> : "Save steps only"}
                </button>
              )}
            </div>

            {isStepsOnly ? (
              <button
                className="inline-flex items-center px-6 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 transition-colors disabled:opacity-40"
                onClick={saveAndClose}
                disabled={saving || wizardSteps.length === 0}
              >
                {saving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
              </button>
            ) : isAddContacts ? (
              <button
                className="inline-flex items-center gap-1.5 px-6 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 transition-colors disabled:opacity-40"
                onClick={enrollContacts}
                disabled={launching || !prospectsReady || selectedTargetIds.size === 0}
              >
                {launching
                  ? <><span className="loading loading-spinner loading-xs" /> Enrolling…</>
                  : `Enroll ${selectedTargetIds.size} contact${selectedTargetIds.size !== 1 ? "s" : ""}`}
              </button>
            ) : isEditMode && page === "account" ? (
              <button
                className="inline-flex items-center px-6 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 transition-colors disabled:opacity-40"
                onClick={saveAndClose}
                disabled={saving || wizardSteps.length === 0}
              >
                {saving ? <span className="loading loading-spinner loading-xs" /> : "Save changes"}
              </button>
            ) : page !== "summary" ? (
              <button
                className="inline-flex items-center px-6 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 transition-colors disabled:opacity-40"
                disabled={
                  (page === "prospects" && (!prospectsReady || conflictsLoading)) ||
                  (page === "sequence" && wizardSteps.length === 0) ||
                  (page === "account" && !accountId)
                }
                onClick={() => setPage(pages[pageIdx + 1])}
              >
                Next →
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-1.5 px-8 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 transition-colors disabled:opacity-40"
                onClick={launch}
                disabled={launching}
              >
                {launching
                  ? <><span className="loading loading-spinner loading-xs" /> Launching...</>
                  : "Launch Campaign"}
              </button>
            )}
          </div>
        </div>
      </div>

      
      {/* ── Fixed Right Drawer for Branch Editing ── */}
      {drawerPath && (() => {
           let arr: any = wizardSteps;
           let parentName = "";
           for (let i = 0; i < drawerPath.length; i++) {
             arr = arr[drawerPath[i]];
             if (i === drawerPath.length - 1) parentName = String(drawerPath[i]);
           }
           const branchSteps = (arr || []) as WizardStep[];
           const close = () => setDrawerPath(null);
           
           return (
             <>
               <div className="fixed inset-0 bg-base-300/20 backdrop-blur-[1px] z-[40]" onClick={close}></div>
               <div className="fixed inset-y-0 right-0 w-[450px] bg-base-100 border-l border-base-300 shadow-2xl z-[45] transform transition-transform duration-300 overflow-y-auto translate-x-0">
                 <div className="flex flex-col min-h-full">
                   <div className="flex items-center justify-between p-5 border-b border-base-300 bg-base-200/80 sticky top-0 z-10 backdrop-blur-md">
                     <div>
                       <h3 className="text-lg font-bold">{parentName}</h3>
                       <p className="text-xs text-base-content/50 mt-0.5">Editing branch sequence</p>
                     </div>
                     <button onClick={close} className="p-2 rounded-full hover:bg-base-300 transition-colors">
                       <RiCloseLine size={20} />
                     </button>
                   </div>
                   <div className="p-6 space-y-0 flex-1">
                     {branchSteps.length === 0 ? (
                        <div className="text-[11px] text-base-content/40 italic px-4 py-3 bg-base-200/50 rounded-xl text-center border border-base-300/50 mb-8">
                          {parentName === "IF REPLIED" ? "Sequence marks as Responded and stops here." : 
                           parentName === "IF ACCEPTED" ? "Sequence continues to next step in main trunk." : 
                           parentName === "IF NOT ACCEPTED (Timeout)" ? "Sequence skips to here if invite expires." : 
                           parentName === "FIT" || parentName === "NOT_FIT" || parentName === "MAYBE" ? "Sequence ends." : 
                           "Flow rejoins main sequence."}
                        </div>
                     ) : (
                        branchSteps.map((bWs, bIdx) => <StepCard key={bIdx} ws={bWs} prevWs={bIdx > 0 ? branchSteps[bIdx - 1] : undefined} path={[...drawerPath, bIdx]} isFirst={bIdx === 0} />)
                     )}
                     
                     <div className="mt-8 flex justify-center pb-64">
                       <div className="dropdown dropdown-end dropdown-bottom">
                          <label tabIndex={0} className="btn btn-sm btn-outline shadow-sm gap-1.5 rounded-full px-4 text-xs font-semibold">
                            <RiAddLine size={14} /> Add Step
                          </label>
                          <ul tabIndex={0} className="dropdown-content z-[50] menu p-2 shadow-xl bg-base-100 rounded-xl w-60 mb-4 border border-base-300/50">
                                                        {parentName !== "IF REPLIED" && (
                              <>
                                <li className="menu-title"><span className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">LinkedIn</span></li>
                                <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("visit", drawerPath); }} className="gap-3 text-xs"><RiEyeLine size={12} className="text-info"/> Visit Profile</a></li>
                                <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("linkedin_enrich", drawerPath); }} className="gap-3 text-xs"><RiSearchEyeLine size={12} className="text-info"/> Enrich Profile</a></li>
                                <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("connect", drawerPath); }} className="gap-3 text-xs"><RiLinkedinBoxLine size={12} className="text-primary"/> Connect</a></li>
                                <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("message", drawerPath); }} className="gap-3 text-xs"><RiMessage2Line size={12} className="text-success"/> Message</a></li>
                                {hasPremium && <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("sales_inmail", drawerPath); }} className="gap-3 text-xs"><RiSendPlaneLine size={12} className="text-primary"/> Sales Nav InMail</a></li>}
                                <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("linkedin_like", drawerPath); }} className="gap-3 text-xs"><RiThumbUpLine size={12} className="text-primary"/> Like Recent Posts</a></li>
                                <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("ai_comment", drawerPath); }} className="gap-3 text-xs"><RiRobot2Line size={12} className="text-info"/> AI Comment</a></li>
                                
                                <li className="menu-title mt-1"><span className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Email</span></li>
                                <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("email", drawerPath); }} className="gap-3 text-xs"><RiMailLine size={12} className="text-warning"/> Cold Email</a></li>
                              </>
                            )}
                            <li className="menu-title mt-1"><span className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Integrations</span></li>
                            <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("integration", drawerPath); }} className="gap-3 text-xs"><RiPlugLine size={12} className="text-accent"/> Integration</a></li>
                            <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("change_status", drawerPath); }} className="gap-3 text-xs"><RiGroupLine size={12} className="text-secondary"/> CRM Status</a></li>
                            
                            <li className="menu-title mt-1"><span className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">AI Agents</span></li>
                            <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("ai_qualify", drawerPath); }} className="gap-3 text-xs"><RiRobot2Line size={12} className="text-secondary"/> AI Qualify</a></li>
                            <li><a onClick={(e) => { e.stopPropagation(); addWizardStep("ai_comment", drawerPath); }} className="gap-3 text-xs"><RiMessage2Line size={12} className="text-secondary"/> AI Comment</a></li>
                          </ul>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             </>
           );
      })()}

      {/* ── Step Config Modal ── */}
      {configPath !== null && (() => {
        const ws = getStepByPath(wizardSteps, configPath); if (!ws) return null;
        const path = configPath;
        const stepLabel = getDynamicStepLabel(ws, wizardSteps, path[path.length - 1] as number);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfigPath(null)}>
            <div
              className="bg-base-200 border border-base-300/50 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
              style={{ maxHeight: "85vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-base-300/50 shrink-0">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center border ${STEP_COLORS[ws.type]}`}>
                  {STEP_ICONS[ws.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{stepLabel}</p>
                  <p className="text-xs text-base-content/40 capitalize">{ws.track} track</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigPath(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-300/50 transition-colors text-base"
                >✕</button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

                {/* Delay field */}
                <div className="flex items-center gap-3 pb-4 border-b border-base-300/30">
                  <RiTimeLine size={14} className="text-base-content/30 shrink-0" />
                  <span className="text-sm text-base-content/50">Wait before this step</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="number"
                      min={0}
                      className="input input-xs input-bordered w-16 bg-base-300/50 text-xs text-center"
                      value={ws.delayDaysBefore}
                      onChange={(e) => updateStep(path, { delayDaysBefore: Number(e.target.value) })}
                    />
                    <span className="text-xs text-base-content/40">days</span>
                  </div>
                </div>

                {ws.type === "visit" && (
                  <p className="text-sm text-base-content/50">
                    Visits the profile. They&apos;ll see you in &quot;Who viewed my profile&quot;. No further configuration needed.
                  </p>
                )}

                {ws.type === "connect" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`note-modal-${path.join("-")}`}
                        className="w-4 h-4 rounded border border-base-300 bg-base-300/50 accent-primary cursor-pointer"
                        checked={!!ws.connectNote}
                        onChange={(e) => updateStep(path, { connectNote: e.target.checked ? " " : "" })}
                      />
                      <label htmlFor={`note-modal-${path.join("-")}`} className="text-sm cursor-pointer">
                        Include a connection note
                      </label>
                    </div>
                    {!!ws.connectNote && (
                      <div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {VARIABLES.map(v => (
                            <button key={v} type="button" onClick={() => updateStep(path, { connectNote: ws.connectNote + v })} className="px-2 py-0.5 rounded bg-base-300/60 text-xs text-base-content/50 hover:text-base-content hover:bg-base-300 transition-colors font-mono">{v}</button>
                          ))}
                        </div>
                        <textarea
                          className="textarea textarea-bordered w-full bg-base-300/50 text-sm h-28 resize-none"
                          placeholder="Hi {{first_name}}, I'd love to connect..."
                          value={ws.connectNote.trimStart()}
                          onChange={(e) => updateStep(path, { connectNote: e.target.value })}
                          maxLength={300}
                          autoFocus
                        />
                        <p className="text-xs text-base-content/30 mt-1">{ws.connectNote.length}/300 chars</p>
                      </div>
                    )}
                  </div>
                )}
                
                {ws.type === "ai_qualify" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-base-content/40 mb-1.5 block">ICP Definition / Qualification Rules</label>
                      <p className="text-[10px] text-base-content/30 mb-2 leading-relaxed">
                        Describe your Ideal Customer Profile. The AI will output FIT, MAYBE, or NOT_FIT based on these rules. You can use standard text or specific instructions.
                      </p>
                      <textarea rows={6} placeholder="e.g. FIT if title contains 'CEO' and company is in IT..." value={(() => { try { return (JSON.parse(ws.config || '{}') as any).rules || ""; } catch { return ""; } })()} onChange={(e) => {
                          let c: any = {}; try { c = JSON.parse(ws.config || '{}'); } catch {}
                          c.rules = e.target.value;
                          updateStep(path, { config: JSON.stringify(c) });
                      }} className="w-full bg-base-300/50 border border-base-300/50 rounded-xl px-3 py-2.5 text-sm text-base-content placeholder:text-base-content/20 focus:outline-none focus:border-secondary/40 resize-none font-mono" />
                    </div>
                    <div className="bg-secondary/5 border border-secondary/20 p-3 rounded-xl flex items-start gap-2">
                       <RiRobot2Line size={16} className="text-secondary/70 mt-0.5 shrink-0" />
                       <div>
                          <p className="text-xs font-semibold text-secondary/90">DAG Execution Branches</p>
                          <p className="text-[10px] text-base-content/50 mt-1">This step automatically creates 3 branches: FIT, MAYBE, and NOT_FIT. Add steps under them in the sequence view.</p>
                       </div>
                    </div>
                  </div>
                )}
                
                                {ws.type === "ai_qualify" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-base-content/40 mb-1.5 block">Continue outreach for (Main Sequence)</label>
                      <div className="flex flex-wrap gap-2">
                        {["FIT", "MAYBE", "NOT_FIT"].map(opt => {
                           let selectedArr: string[] = ["FIT"];
                           try { 
                             const cfg = JSON.parse(ws.config || '{}'); 
                             if (Array.isArray(cfg.continue_main_on)) selectedArr = cfg.continue_main_on;
                             else if (typeof cfg.continue_main_on === 'string') selectedArr = [cfg.continue_main_on];
                           } catch {}
                           const isSelected = selectedArr.includes(opt);
                           
                           return (
                             <button
                               key={opt}
                               type="button"
                               onClick={(e) => {
                                 let c: any = {}; try { c = JSON.parse(ws.config || '{}'); } catch {}
                                 let newArr = [...selectedArr];
                                 if (isSelected) newArr = newArr.filter(x => x !== opt);
                                 else newArr.push(opt);
                                 if (newArr.length === 0) newArr = ["FIT"]; // prevent empty
                                 c.continue_main_on = newArr;
                                 updateStep(path, { config: JSON.stringify(c) });
                               }}
                               className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                 isSelected 
                                   ? opt === 'FIT' ? 'border-success/40 bg-success/10 text-success' : opt === 'MAYBE' ? 'border-warning/40 bg-warning/10 text-warning' : 'border-error/40 bg-error/10 text-error'
                                   : 'border-base-300 bg-transparent text-base-content/40 hover:bg-base-200'
                               }`}
                             >
                               {isSelected && <RiCheckLine size={12} />}
                               {opt}
                             </button>
                           );
                        })}
                      </div>
                      <p className="text-[10px] text-base-content/30 mt-2 leading-relaxed">
                        The selected outcome will continue down the main sequence trunk. The other outcomes will become isolated side-panel branches.
                      </p>
                    </div>
                  </div>
                )}

                {ws.type === "ai_comment" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-base-content/40 mb-1.5 block">Comment Guidance</label>
                      <p className="text-[10px] text-base-content/30 mb-2 leading-relaxed">
                        Instructions for the AI on how to write the comment (tone, length, specific angles).
                      </p>
                      <textarea rows={4} placeholder="e.g. Write a brief, professional comment agreeing with the main point." value={ws.aiPrompt} onChange={(e) => updateStep(path, { aiPrompt: e.target.value })} className="w-full bg-base-300/50 border border-base-300/50 rounded-xl px-3 py-2.5 text-sm text-base-content placeholder:text-base-content/20 focus:outline-none focus:border-secondary/40 resize-none" />
                    </div>
                    <div className="flex gap-4">
                       <div className="flex-1">
                         <label className="text-xs text-base-content/40 mb-1.5 block">Maximum Post Age (Days)</label>
                         <input type="number" value={(() => { try { return (JSON.parse(ws.config || '{}') as any).max_age_days || 30; } catch { return 30; } })()} onChange={(e) => {
                            let c: any = {}; try { c = JSON.parse(ws.config || '{}'); } catch {}
                            c.max_age_days = Number(e.target.value);
                            updateStep(path, { config: JSON.stringify(c) });
                         }} className="w-full bg-base-300/50 border border-base-300/50 rounded-xl px-3 py-2 text-sm text-base-content focus:outline-none focus:border-secondary/40" />
                       </div>
                       
                    </div>
                  </div>
                )}

                {ws.type === "linkedin_like" && (
                  <div className="space-y-4">
                     <div>
                       <label className="text-xs text-base-content/40 mb-1.5 block">Like N Recent Posts</label>
                       <p className="text-[10px] text-base-content/30 mb-2 leading-relaxed">
                         How many of the prospect's most recent posts should be liked? (Default is 1).
                       </p>
                       <input type="number" min="1" max="10" value={(() => { try { return (JSON.parse(ws.config || '{}') as any).like_n_posts || 1; } catch { return 1; } })()} onChange={(e) => {
                          let c: any = {}; try { c = JSON.parse(ws.config || '{}'); } catch {}
                          c.like_n_posts = Number(e.target.value);
                          updateStep(path, { config: JSON.stringify(c) });
                       }} className="w-full max-w-[200px] bg-base-300/50 border border-base-300/50 rounded-xl px-3 py-2 text-sm text-base-content focus:outline-none focus:border-secondary/40" />
                     </div>
                  </div>
                )}

                {(ws.type === "message" || ws.type === "sales_inmail") && (
                  <div className="space-y-4">
                    {ws.type === "sales_inmail" && !(hasPremium && ws.aiEnabled) && (
                      <div>
                        <label className="text-xs text-base-content/40 mb-1.5 block">Subject <span className="text-error/70">(required for InMail)</span></label>
                        <input type="text" placeholder="e.g. Quick question about {{company}}" value={ws.emailSubject} onChange={(e) => updateStep(path, { emailSubject: e.target.value })} className="w-full bg-base-300/50 border border-base-300/50 rounded-xl px-3 py-2.5 text-sm text-base-content placeholder:text-base-content/20 focus:outline-none focus:border-primary/40" />
                      </div>
                    )}
                    {ws.type === "sales_inmail" && hasPremium && ws.aiEnabled && (
                      <p className="text-xs text-base-content/30 -mt-1">The AI writer generates both the subject and body for each InMail.</p>
                    )}
                    {hasPremium ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-base-300/40 border border-base-300/50">
                      <RiRobot2Line size={15} className="text-base-content/40 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-base-content/70">AI writes this {ws.type === "sales_inmail" ? "InMail" : "message"}</p>
                        <p className="text-xs text-base-content/30 mt-0.5">Uses lead context to personalise each {ws.type === "sales_inmail" ? "InMail" : "message"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateStep(path, { aiEnabled: !ws.aiEnabled })}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${ws.aiEnabled ? "bg-primary" : "bg-base-300"}`}
                      >
                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${ws.aiEnabled ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                    ) : (
                      <a href="https://opsily.com?utm_source=linki&utm_medium=app&utm_campaign=ai-writer" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors">
                        <RiRobot2Line size={15} className="text-primary/70 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-base-content/80">AI message writer <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary align-middle">Premium</span></p>
                          <p className="text-xs text-base-content/40 mt-0.5">Auto-personalise every message from lead context. Upgrade to enable.</p>
                        </div>
                        <span className="text-xs font-medium text-primary shrink-0">Upgrade →</span>
                      </a>
                    )}
                    {hasPremium && ws.aiEnabled ? (
                      <div className="space-y-4">
                        <ModelPicker models={orModels} value={ws.aiModel} open={orModelOpen === JSON.stringify(path)} search={orModelSearch} collapsedProviders={collapsedProviders}
                          onOpen={() => { setOrModelOpen(orModelOpen === JSON.stringify(path) ? null : JSON.stringify(path)); setOrModelSearch(""); }}
                          onClose={() => { setOrModelOpen(null); setOrModelSearch(""); }}
                          onSelect={(id: string) => { updateStep(path, { aiModel: id }); setOrModelOpen(null); setOrModelSearch(""); }}
                          onSearch={setOrModelSearch}
                          onToggleProvider={(p) => setCollapsedProviders(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; })}
                        />
                        <div>
                          <label className="text-xs text-base-content/40 mb-1.5 block">Step instruction</label>
                          <textarea rows={3} placeholder="e.g. Reference their recent role change." value={ws.aiPrompt} onChange={(e) => updateStep(path, { aiPrompt: e.target.value })} className="w-full bg-base-300/50 border border-base-300/50 rounded-xl px-3 py-2.5 text-sm text-base-content placeholder:text-base-content/20 focus:outline-none focus:border-primary/40 resize-none" />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="checkbox checkbox-xs" checked={ws.aiMaxWordsEnabled} onChange={(e) => updateStep(path, { aiMaxWordsEnabled: e.target.checked })} />
                            <span className="text-xs text-base-content/50">Max words</span>
                          </label>
                          {ws.aiMaxWordsEnabled && <input type="number" min={10} max={500} value={ws.aiMaxWords} onChange={(e) => updateStep(path, { aiMaxWords: Number(e.target.value) })} className="w-20 bg-base-300/50 border border-base-300/50 rounded-lg px-2 py-1.5 text-sm text-base-content focus:outline-none focus:border-primary/40" />}
                          <select value={ws.aiLanguage} onChange={(e) => updateStep(path, { aiLanguage: e.target.value })} className="flex-1 bg-base-300/50 border border-base-300/50 rounded-lg px-3 py-1.5 text-sm text-base-content focus:outline-none focus:border-primary/40">
                            {AI_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <button type="button" onClick={() => { setPreviewIdx(path); setPreviewResult(null); setPreviewListId(""); setPreviewListTargets([]); setPreviewTargetId(""); setConfigPath(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                          <RiRobot2Line size={13} /> Preview AI output
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {templates.length > 0 && (
                          <div>
                            <p className="text-xs text-base-content/40 mb-2">Templates <span className="text-base-content/25">(random per send)</span></p>
                            {ws.templateIds.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {ws.templateIds.map((tid: string) => {
                                  const t = templates.find((t) => t.id === tid);
                                  return (
                                    <span key={tid} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-md text-xs font-medium bg-success/10 text-success border border-success/20">
                                      {t?.name ?? tid}
                                      <button type="button" onClick={() => updateStep(path, { templateIds: ws.templateIds.filter((id: string) => id !== tid) })} className="ml-0.5 hover:text-error transition-colors">×</button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {templates.filter((t) => !ws.templateIds.includes(t.id)).length > 0 && (
                              <select className="select select-bordered select-sm bg-base-300/50 text-sm" value="" onChange={(e) => { const tid = e.target.value; if (tid && !ws.templateIds.includes(tid)) updateStep(path, { templateIds: [...ws.templateIds, tid], messageBody: "" }); }}>
                                <option value="">+ Add template</option>
                                {templates.filter((t) => !ws.templateIds.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            )}
                          </div>
                        )}
                        <div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {VARIABLES.map(v => (
                              <button key={v} type="button" onClick={() => updateStep(path, { messageBody: ws.messageBody + v })} className="px-2 py-0.5 rounded bg-base-300/60 text-xs text-base-content/50 hover:text-base-content hover:bg-base-300 transition-colors font-mono">{v}</button>
                            ))}
                          </div>
                          <textarea className={`textarea textarea-bordered w-full bg-base-300/50 text-sm h-32 resize-none font-mono ${ws.templateIds.length > 0 ? "opacity-40 pointer-events-none" : ""}`} placeholder="Hi {{first_name}}, I noticed..." value={ws.messageBody} onChange={(e) => updateStep(path, { messageBody: e.target.value })} disabled={ws.templateIds.length > 0} />
                          <p className="text-xs text-base-content/30 mt-1">{ws.messageBody.length} chars</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                                {ws.type === "change_status" && (() => {
                  let parsedConfig = { status_id: "lead" };
                  try {
                    if (ws.config && ws.config !== "null") {
                      const p = JSON.parse(ws.config);
                      if (p && typeof p === "object") parsedConfig = { ...parsedConfig, ...p };
                    }
                  } catch (e) {}

                  return (
                    <div className="p-6">
                      <div className="mb-6">
                        <label className="block text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2">New Status</label>
                        <select
                          className="select select-bordered bg-base-300 w-full"
                          value={parsedConfig.status_id}
                          onChange={(e) => {
                            const newConfig = { ...parsedConfig, status_id: e.target.value };
                            updateStep(path, { config: JSON.stringify(newConfig) });
                          }}
                        >
                          {crmStatuses.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-base-content/50 mt-2">When this step is reached, the contact's CRM status will be updated to this value.</p>
                      </div>
                    </div>
                  );
                })()}
                
                {ws.type === "integration" && (() => {
                  let parsedConfig = { action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] };
                  try {
                    if (ws.config && ws.config !== "null") {
                      const p = JSON.parse(ws.config);
                      if (p && typeof p === "object") parsedConfig = p;
                    }
                  } catch (e) {}
                  
                  return (
                    <div className="space-y-4">
                      <div className="bg-base-300/40 border border-base-300/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                            <RiPlugLine size={16} />
                          </span>
                          <div>
                            <h4 className="text-sm font-medium">Configure Integration</h4>
                            <p className="text-[10px] text-base-content/40">Select what this step should do</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="text-xs text-base-content/50 font-medium block mb-2">Action Type</label>
                            <select 
                              className="select select-bordered w-full text-sm"
                              value={parsedConfig.action_type || "enrich_email"}
                              onChange={(e) => {
                                const newConf = { ...parsedConfig, action_type: e.target.value };
                                updateStep(path, { config: JSON.stringify(newConf) });
                              }}
                            >
                              <option value="enrich_email">Enrich Email (Waterfall)</option>
                              <option value="push_to_hubspot">Sync to HubSpot CRM</option>
                            </select>
                          </div>

                          {parsedConfig.action_type === "enrich_email" && (
                            <div className="pt-2 border-t border-base-300/50">
                              <label className="text-xs text-base-content/50 font-medium block mb-1">Waterfall Priority Array</label>
                              <p className="text-[10px] text-base-content/40 mb-3">Define the priority of API providers. The system tries them in order.</p>
                              
                              <div className="space-y-2">
                                {(() => {
                                  const configured = integrations.filter((i) => i.configured && ENRICHERS.includes(i.key)).map((i) => i.key);
                                  if (configured.length === 0) {
                                    return (
                                      <div className="p-3 bg-warning/10 text-warning text-xs rounded-lg border border-warning/20">
                                        No email enrichers configured. Go to Settings &gt; Integrations to add API keys.
                                      </div>
                                    );
                                  }

                                  const chain: string[] = Array.isArray(parsedConfig.provider_chain) ? parsedConfig.provider_chain : [];
                                  
                                  // Find the active providers in order, then append inactive ones at the bottom
                                  const active = chain.filter((k) => configured.includes(k));
                                  const inactive = configured.filter((k) => !active.includes(k));
                                  const all = [...active, ...inactive];

                                  return (
                                    <div className="flex flex-col gap-1.5">
                                      {all.map((key, i) => {
                                        const isEnabled = active.includes(key);
                                        return (
                                          <div key={key} className={`flex items-center justify-between p-2 rounded-lg border ${isEnabled ? 'bg-base-200/50 border-base-300' : 'bg-base-100 border-base-200/50 opacity-60'}`}>
                                            <div className="flex items-center gap-3">
                                              <input
                                                type="checkbox"
                                                className="toggle toggle-sm toggle-primary"
                                                checked={isEnabled}
                                                onChange={(e) => {
                                                  let newChain = [...active];
                                                  if (e.target.checked) newChain.push(key);
                                                  else newChain = newChain.filter((k) => k !== key);
                                                  updateStep(path, { config: JSON.stringify({ ...parsedConfig, provider_chain: newChain }) });
                                                }}
                                              />
                                              <span className="text-sm font-medium">{PROVIDER_NAMES[key] || key}</span>
                                            </div>
                                            {isEnabled && (
                                              <div className="flex items-center gap-1">
                                                <button
                                                  className="p-1 hover:bg-base-300 rounded text-base-content/50 disabled:opacity-30 disabled:hover:bg-transparent"
                                                  disabled={i === 0 || !active.includes(all[i - 1])}
                                                  onClick={() => {
                                                    const newChain = [...active];
                                                    const activeIdx = newChain.indexOf(key);
                                                    if (activeIdx > 0) {
                                                      [newChain[activeIdx - 1], newChain[activeIdx]] = [newChain[activeIdx], newChain[activeIdx - 1]];
                                                      updateStep(path, { config: JSON.stringify({ ...parsedConfig, provider_chain: newChain }) });
                                                    }
                                                  }}
                                                >
                                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                                                </button>
                                                <button
                                                  className="p-1 hover:bg-base-300 rounded text-base-content/50 disabled:opacity-30 disabled:hover:bg-transparent"
                                                  disabled={i === active.length - 1 || !active.includes(all[i + 1])}
                                                  onClick={() => {
                                                    const newChain = [...active];
                                                    const activeIdx = newChain.indexOf(key);
                                                    if (activeIdx < active.length - 1) {
                                                      [newChain[activeIdx], newChain[activeIdx + 1]] = [newChain[activeIdx + 1], newChain[activeIdx]];
                                                      updateStep(path, { config: JSON.stringify({ ...parsedConfig, provider_chain: newChain }) });
                                                    }
                                                  }}
                                                >
                                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {parsedConfig.action_type === "push_to_hubspot" && (
                            <div className="pt-2 border-t border-base-300/50">
                              <p className="text-xs text-base-content/60 leading-relaxed bg-primary/5 border border-primary/20 p-3 rounded-lg flex gap-2">
                                <span className="mt-0.5 text-primary"><RiPlugLine size={14} /></span>
                                This step will automatically push the contact's name, title, company, LinkedIn URL, and enriched Email to your connected HubSpot CRM account. Make sure HubSpot is configured in Settings.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {ws.type === "email" && (
                  <div className="space-y-4">
                    {hasPremium ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-base-300/40 border border-base-300/50">
                      <RiRobot2Line size={15} className="text-base-content/40 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-base-content/70">AI writes this email</p>
                        <p className="text-xs text-base-content/30 mt-0.5">Subject + body generated per lead</p>
                      </div>
                      <button type="button" onClick={() => updateStep(path, { aiEnabled: !ws.aiEnabled })} className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${ws.aiEnabled ? "bg-primary" : "bg-base-300"}`}>
                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${ws.aiEnabled ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                    ) : (
                      <a href="https://opsily.com?utm_source=linki&utm_medium=app&utm_campaign=ai-writer" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors">
                        <RiRobot2Line size={15} className="text-primary/70 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-base-content/80">AI email writer <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary align-middle">Premium</span></p>
                          <p className="text-xs text-base-content/40 mt-0.5">Auto-generate subject + body from lead context. Upgrade to enable.</p>
                        </div>
                        <span className="text-xs font-medium text-primary shrink-0">Upgrade →</span>
                      </a>
                    )}
                    {hasPremium && ws.aiEnabled ? (
                      <div className="space-y-4">
                        <ModelPicker models={orModels} value={ws.aiModel} open={orModelOpen === JSON.stringify(path)} search={orModelSearch} collapsedProviders={collapsedProviders}
                          onOpen={() => { setOrModelOpen(orModelOpen === JSON.stringify(path) ? null : JSON.stringify(path)); setOrModelSearch(""); }}
                          onClose={() => { setOrModelOpen(null); setOrModelSearch(""); }}
                          onSelect={(id: string) => { updateStep(path, { aiModel: id }); setOrModelOpen(null); setOrModelSearch(""); }}
                          onSearch={setOrModelSearch}
                          onToggleProvider={(p) => setCollapsedProviders(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; })}
                        />
                        <div>
                          <label className="text-xs text-base-content/40 mb-1.5 block">Step instruction</label>
                          <textarea rows={3} placeholder="e.g. Focus on their company's growth." value={ws.aiPrompt} onChange={(e) => updateStep(path, { aiPrompt: e.target.value })} className="w-full bg-base-300/50 border border-base-300/50 rounded-xl px-3 py-2.5 text-sm text-base-content placeholder:text-base-content/20 focus:outline-none focus:border-primary/40 resize-none" />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="checkbox checkbox-xs" checked={ws.aiMaxWordsEnabled} onChange={(e) => updateStep(path, { aiMaxWordsEnabled: e.target.checked })} />
                            <span className="text-xs text-base-content/50">Max words</span>
                          </label>
                          {ws.aiMaxWordsEnabled && <input type="number" min={10} max={1000} value={ws.aiMaxWords} onChange={(e) => updateStep(path, { aiMaxWords: Number(e.target.value) })} className="w-20 bg-base-300/50 border border-base-300/50 rounded-lg px-2 py-1.5 text-sm text-base-content focus:outline-none focus:border-primary/40" />}
                          <select value={ws.aiLanguage} onChange={(e) => updateStep(path, { aiLanguage: e.target.value })} className="flex-1 bg-base-300/50 border border-base-300/50 rounded-lg px-3 py-1.5 text-sm text-base-content focus:outline-none focus:border-primary/40">
                            {AI_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <button type="button" onClick={() => { setPreviewIdx(path); setPreviewResult(null); setPreviewListId(""); setPreviewListTargets([]); setPreviewTargetId(""); setConfigPath(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                          <RiRobot2Line size={13} /> Preview AI output
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm text-base-content/50 block mb-1.5">Subject</label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {VARIABLES.map(v => (
                              <button key={v} type="button" onClick={() => updateStep(path, { emailSubject: ws.emailSubject + v })} className="px-2 py-0.5 rounded bg-base-300/60 text-xs text-base-content/50 hover:text-base-content hover:bg-base-300 transition-colors font-mono">{v}</button>
                            ))}
                          </div>
                          <input className="input input-bordered w-full bg-base-300/50 font-mono text-sm" placeholder="Hi {{first_name}}, quick question" value={ws.emailSubject} onChange={(e) => updateStep(path, { emailSubject: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-sm text-base-content/50 block mb-1.5">Body</label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {VARIABLES.map(v => (
                              <button key={v} type="button" onClick={() => updateStep(path, { emailBody: ws.emailBody + v })} className="px-2 py-0.5 rounded bg-base-300/60 text-xs text-base-content/50 hover:text-base-content hover:bg-base-300 transition-colors font-mono">{v}</button>
                            ))}
                          </div>
                          <textarea className="textarea textarea-bordered w-full bg-base-300/50 text-sm resize-none font-mono" rows={7} placeholder={"Hi {{first_name}},\n\nI came across your profile..."} value={ws.emailBody} onChange={(e) => updateStep(path, { emailBody: e.target.value })} />
                          <p className="text-xs text-base-content/30 mt-1">{ws.emailBody.length} chars</p>
                        </div>
                      </div>
                    )}

                    {/* Signature — always visible for email steps regardless of AI mode */}
                    <div className="border-t border-base-300/30 pt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm text-base-content/50">Signature</label>
                        <button
                          type="button"
                          onClick={() => updateStep(path, { emailSignature: ws.emailSignature === null ? "" : null })}
                          className="text-xs text-base-content/40 hover:text-base-content/70 transition-colors"
                        >
                          {ws.emailSignature === null ? "Override account default" : "Use account default"}
                        </button>
                      </div>
                      {ws.emailSignature === null ? (
                        <p className="text-xs text-base-content/30 italic px-1">Using email account signature (if set)</p>
                      ) : (
                        <textarea
                          className="textarea textarea-bordered w-full bg-base-300/50 text-sm resize-none font-mono h-20"
                          placeholder={"John Smith\nHead of Sales · Acme Corp\njohn@acme.com"}
                          value={ws.emailSignature}
                          onChange={(e) => updateStep(path, { emailSignature: e.target.value })}
                        />
                      )}
                    </div>

                    {/* Preview / Send-test — only meaningful for manual (non-AI) mode */}
                    {!ws.aiEnabled && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { setEmailPreviewIdx(path); setConfigPath(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-base-300/60 text-base-content/70 hover:bg-base-300 transition-colors border border-base-300/50">
                          <RiEyeLine size={14} /> Preview
                        </button>
                        <button type="button" onClick={() => { setTestEmailIdx(path); setTestEmailAccountId(emailAccounts.find((e) => e.is_verified)?.id ?? ""); setConfigPath(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition-colors">
                          <RiMailSendLine size={14} /> Send test
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-base-300/50 shrink-0">
                <button
                  type="button"
                  onClick={() => { removeWizardStep(path); setConfigPath(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors"
                >
                  <RiDeleteBinLine size={13} /> Remove step
                </button>
                <button
                  type="button"
                  onClick={() => setConfigPath(null)}
                  className="inline-flex items-center px-5 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Email Preview Modal ── */}
      {emailPreviewIdx !== null && (() => {
        const ws = getStepByPath(wizardSteps, emailPreviewIdx); if (!ws) return null;
        const previewSubject = ws.emailSubject
          .replace(/\{\{first_name\}\}/g, "Alex")
          .replace(/\{\{last_name\}\}/g, "Johnson")
          .replace(/\{\{company\}\}/g, "Acme Corp")
          .replace(/\{\{title\}\}/g, "Head of Growth");
        const previewBody = ws.emailBody
          .replace(/\{\{first_name\}\}/g, "Alex")
          .replace(/\{\{last_name\}\}/g, "Johnson")
          .replace(/\{\{company\}\}/g, "Acme Corp")
          .replace(/\{\{title\}\}/g, "Head of Growth");
        const senderAccount = emailAccounts.find((e) => e.is_verified);
        const fromName = senderAccount?.name ?? "You";
        const fromEmail = senderAccount?.from_email ?? "you@example.com";
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Email client chrome */}
              <div className="bg-[#f5f5f5] border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <p className="text-xs text-gray-500 font-medium">Email Preview — sample data</p>
                <button
                  onClick={() => setEmailPreviewIdx(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors w-6 h-6 flex items-center justify-center rounded"
                >✕</button>
              </div>
              {/* Email header */}
              <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{previewSubject || <span className="text-gray-300 italic">(no subject)</span>}</h2>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-600 shrink-0">
                    {fromName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{fromName}</span>
                      <span className="text-xs text-gray-400">&lt;{fromEmail}&gt;</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      To: <span className="text-gray-600">Alex Johnson &lt;alex@acmecorp.com&gt;</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">Just now</span>
                </div>
              </div>
              {/* Email body */}
              <div className="flex-1 overflow-y-auto bg-white px-8 py-6">
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-[Georgia,serif] max-w-none">
                  {previewBody || <span className="text-gray-300 italic">No body yet...</span>}
                </div>
                {(() => {
                  const sig = ws.emailSignature !== null
                    ? ws.emailSignature.trim()
                    : senderAccount?.signature?.trim() ?? "";
                  return sig ? (
                    <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400 whitespace-pre-wrap font-mono">
                      --{"\n"}
                      {sig}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── AI Preview Modal ── */}
      {previewIdx !== null && (() => {
        const ws = getStepByPath(wizardSteps, previewIdx);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-base-200 border border-base-300/50 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RiRobot2Line size={16} className="text-primary" />
                  <h3 className="font-semibold text-base">Preview AI output</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewIdx(null)}
                  className="text-base-content/40 hover:text-base-content transition-colors text-lg leading-none"
                >×</button>
              </div>

              <p className="text-xs text-base-content/40">
                Select a list and a lead to generate a preview using the current model and step instruction.
              </p>

              {/* List selector */}
              <div>
                <label className="text-xs text-base-content/50 block mb-1">List</label>
                <select
                  className="select select-sm w-full"
                  value={previewListId}
                  onChange={(e) => { setPreviewListId(e.target.value); loadPreviewTargets(e.target.value); }}
                >
                  <option value="">Choose a list…</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Lead selector */}
              {previewListTargets.length > 0 && (
                <div>
                  <label className="text-xs text-base-content/50 block mb-1">Lead</label>
                  <select
                    className="select select-sm w-full"
                    value={previewTargetId}
                    onChange={(e) => setPreviewTargetId(e.target.value)}
                  >
                    <option value="">Choose a lead…</option>
                    {previewListTargets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name ?? t.linkedin_url}{t.title ? ` — ${t.title}` : ""}{t.company ? ` @ ${t.company}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Generate button */}
              <button
                type="button"
                onClick={runPreview}
                disabled={previewLoading || !previewTargetId || !(ws?.aiModel)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                {previewLoading
                  ? <><RiLoader4Line size={14} className="animate-spin" /> Generating…</>
                  : <><RiRobot2Line size={14} /> Generate</>}
              </button>

              {!(ws?.aiModel) && (
                <p className="text-xs text-warning">No model selected for this step.</p>
              )}

              {/* Result */}
              {previewResult && (
                <div className="space-y-3">
                  {previewResult.subject && (
                    <div>
                      <p className="text-xs text-base-content/40 mb-1">Subject</p>
                      <div className="bg-base-300/50 rounded-lg px-3 py-2 text-sm font-medium">{previewResult.subject}</div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-base-content/40 mb-1">
                      Body
                      <span className="ml-2 text-base-content/25">{previewResult.body.trim().split(/\s+/).filter(Boolean).length} words</span>
                    </p>
                    <div className="bg-base-300/50 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{previewResult.body}</div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-base-content/30 pt-1">
                    {(previewResult.input_tokens || previewResult.output_tokens) ? (
                      <span>{(previewResult.input_tokens ?? 0) + (previewResult.output_tokens ?? 0)} tokens ({previewResult.input_tokens ?? 0} in / {previewResult.output_tokens ?? 0} out)</span>
                    ) : null}
                    {previewResult.cost_usd != null && previewResult.cost_usd > 0 && (
                      <span>${previewResult.cost_usd.toFixed(5)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Test Email Modal ── */}
      {testEmailIdx !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-base-200 border border-base-300/50 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-base mb-1">Send test email</h3>
            <p className="text-xs text-base-content/50 mb-5">
              Variables are filled with sample data (Alex Johnson, Acme Corp). Your email account&apos;s signature will be appended.
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-base-content/50 block mb-1">Send from</label>
                {emailAccounts.filter((e) => e.is_verified).length === 0 ? (
                  <p className="text-xs text-warning">No verified email accounts. <Link href="/settings?tab=email" className="underline">Add one first.</Link></p>
                ) : (
                  <select
                    className="select select-bordered select-sm w-full bg-base-300/50 text-sm"
                    value={testEmailAccountId}
                    onChange={(e) => setTestEmailAccountId(e.target.value)}
                  >
                    <option value="">Choose account...</option>
                    {emailAccounts.filter((e) => e.is_verified).map((e) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.from_email})</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs text-base-content/50 block mb-1">Send to</label>
                <input
                  type="email"
                  className="input input-bordered input-sm w-full bg-base-300/50"
                  placeholder="your@email.com"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => { setTestEmailIdx(null); setTestEmailTo(""); }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm text-base-content/60 hover:text-base-content hover:bg-base-300/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendTestEmail}
                disabled={testEmailSending || !testEmailAccountId || !testEmailTo}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-warning text-warning-content hover:bg-warning/90 transition-colors disabled:opacity-40"
              >
                {testEmailSending ? <span className="loading loading-spinner loading-xs" /> : <RiMailSendLine size={14} />}
                Send test
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────

interface AnalyticsData {
  funnel: {
    total: number; connections_sent: number; connected: number;
    messages_sent: number; inmails_sent: number; li_replies: number;
    emails_sent: number; email_replies: number; completed: number;
    profiles_visited: number; emails_enriched: number; linkedin_enriched: number; hubspot_pushes: number;
  };
  activity: { day: string; visits: number; connections: number; messages: number; inmails: number; emails: number }[];
  aiDaily: { day: string; cost_usd: number; input_tokens: number; output_tokens: number }[];
  aiByStep: { step_order: number; step_type: string; call_count: number; input_tokens: number; output_tokens: number; cost_usd: number; models: string }[];
}

const ANALYTICS_SERIES = [
  { key: "connections" as const, color: "#32d583", label: "Connects" },
  { key: "messages" as const,    color: "#f4b740", label: "Messages" },
  { key: "inmails" as const,     color: "#e879f9", label: "InMails" },
  { key: "emails" as const,      color: "#fb923c", label: "Emails" },
];

const DAY_OPTS = [7, 14, 30, 90];

const STEP_TYPE_LABEL: Record<string, string> = {
  linkedin_enrich: "Enrich Profile",
  visit: "Visit", connect: "Connect", message: "LI Message", sales_inmail: "InMail", email: "Email",
  integration: "Integration",
};

function AnalyticsPanel({ workflowId, days: initialDays }: { workflowId: string; days: number }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/workflows/${workflowId}/analytics?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workflowId, days]);

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-base-content/40 text-sm py-16 justify-center">
        <span className="loading loading-spinner loading-xs" /> Loading analytics…
      </div>
    );
  }

  const { funnel, activity, aiDaily, aiByStep } = data;
  const maxFunnel = funnel.total || 1;
  const maxActivity = Math.max(...activity.flatMap(d => ANALYTICS_SERIES.map(s => d[s.key])), 1);
  const maxAiCost = Math.max(...aiDaily.map(d => d.cost_usd ?? 0), 0.000001);
  const totalAiCost = aiDaily.reduce((s, d) => s + (d.cost_usd ?? 0), 0);
  const totalAiTokens = aiDaily.reduce((s, d) => s + (d.input_tokens ?? 0) + (d.output_tokens ?? 0), 0);
  const hasAiData = totalAiCost > 0;
  const labelEvery = days <= 7 ? 1 : days <= 14 ? 2 : days <= 30 ? 5 : 15;

  function FunnelBar({ label, value, color }: { label: string; value: number; color: string }) {
    const pct = Math.max(2, (value / maxFunnel) * 100);
    const rate = funnel.total > 0 ? Math.round((value / funnel.total) * 100) : 0;
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="text-xs text-base-content/50 w-28 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-base-300/30 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-sm font-semibold tabular-nums w-12 text-right" style={{ color }}>{value.toLocaleString()}</span>
        <span className="text-xs text-base-content/30 w-8 text-right">{rate}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Day picker */}
      <div className="flex items-center justify-between pl-11">
        <p className="text-sm text-base-content/40">Campaign performance over time</p>
        <div className="flex items-center gap-0.5 bg-base-300/50 rounded-lg p-0.5">
          {DAY_OPTS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${days === d ? "bg-base-100 text-base-content shadow-sm" : "text-base-content/35 hover:text-base-content/60"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Rate cards row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Acceptance rate", value: funnel.connections_sent > 0 ? Math.round((funnel.connected / funnel.connections_sent) * 100) : 0, color: "#32d583" },
          { label: "LI reply rate",   value: (funnel.messages_sent + funnel.inmails_sent) > 0 ? Math.round((funnel.li_replies / (funnel.messages_sent + funnel.inmails_sent)) * 100) : 0, color: "#c084fc" },
          { label: "Email reply rate",value: funnel.emails_sent > 0     ? Math.round((funnel.email_replies / funnel.emails_sent) * 100)   : 0, color: "#fb923c" },
          { label: "Completion rate", value: funnel.total > 0           ? Math.round((funnel.completed / funnel.total) * 100)             : 0, color: "#5aa2ff" },
        ].map(card => (
          <div key={card.label} className="bg-base-200 border border-base-300/50 rounded-xl p-3">
            <div className="text-xl font-bold tabular-nums" style={{ color: card.color }}>{card.value}%</div>
            <div className="text-[10px] text-base-content/40 mt-1 leading-tight">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 280px" }}>
        {/* Left: activity chart + AI cost */}
        <div className="space-y-4">
          {/* Activity chart */}
          <div className="bg-base-200 border border-base-300/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-base-content">Daily activity</span>
              <div className="flex items-center gap-3">
                {ANALYTICS_SERIES.map(s => (
                  <span key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: s.color }}>
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative" style={{ height: 120 }}>
              {[0.25, 0.5, 0.75, 1].map(g => (
                <div key={g} className="absolute left-0 right-0 border-t border-base-300/20" style={{ bottom: `${g * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end gap-0.5">
                {activity.map((d, i) => {
                  const showLabel = i % labelEvery === 0;
                  return (
                    <div key={d.day} className="flex flex-col items-center flex-1 group relative h-full justify-end">
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-base-300 border border-base-300 rounded-lg px-2.5 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-xl">
                        <div className="text-base-content/40 mb-1 font-medium">{d.day}</div>
                        {ANALYTICS_SERIES.map(s => (
                          <div key={s.key} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                            <span style={{ color: s.color }}>{d[s.key]} {s.label.toLowerCase()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-end gap-px w-full">
                        {ANALYTICS_SERIES.map(s => (
                          <div
                            key={s.key}
                            className="flex-1 rounded-t-sm transition-all"
                            style={{
                              height: `${Math.max(2, (d[s.key] / maxActivity) * 100)}px`,
                              background: s.color,
                              opacity: d[s.key] === 0 ? 0.08 : 0.75,
                            }}
                          />
                        ))}
                      </div>
                      {showLabel && (
                        <span className="text-[9px] text-base-content/20 mt-1 leading-none shrink-0">{d.day.slice(5)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI cost card */}
          <div className="bg-base-200 border border-base-300/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RiRobot2Line size={13} className="text-base-content/30" />
                <span className="text-sm font-medium text-base-content">AI cost</span>
              </div>
              {hasAiData && (
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-base-content/30 tabular-nums">{totalAiTokens.toLocaleString()} tokens</span>
                  <span className="font-semibold tabular-nums" style={{ color: "#a78bfa" }}>${totalAiCost.toFixed(4)}</span>
                </div>
              )}
            </div>

            {!hasAiData ? (
              <p className="text-xs text-base-content/20 py-2">No AI usage for this campaign.</p>
            ) : (
              <>
                {/* Daily bar chart */}
                <div className="flex items-end gap-0.5 mb-5" style={{ height: 56 }}>
                  {aiDaily.map((d, i) => {
                    const showLabel = i % labelEvery === 0;
                    const height = Math.max(2, ((d.cost_usd ?? 0) / maxAiCost) * 48);
                    return (
                      <div key={d.day} className="flex flex-col items-center flex-1 group relative justify-end" style={{ height: "100%" }}>
                        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-base-300 border border-base-300 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-xl">
                          <div className="text-base-content/40 mb-1">{d.day}</div>
                          <div style={{ color: "#a78bfa" }}>${(d.cost_usd ?? 0).toFixed(5)}</div>
                          <div className="text-base-content/40">{((d.input_tokens ?? 0) + (d.output_tokens ?? 0)).toLocaleString()} tok</div>
                        </div>
                        <div className="w-full rounded-t-sm" style={{ height, background: "#a78bfa", opacity: (d.cost_usd ?? 0) === 0 ? 0.08 : 0.65 }} />
                        {showLabel && (
                          <span className="text-[9px] text-base-content/20 mt-1 leading-none">{d.day.slice(5)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Per-step breakdown */}
                {aiByStep.length > 0 && (
                  <div className="border-t border-base-300/30 pt-4">
                    <p className="text-xs text-base-content/30 uppercase tracking-widest mb-3">By step</p>
                    <div className="space-y-2">
                      {aiByStep.map(step => {
                        const stepPct = totalAiCost > 0 ? (step.cost_usd / totalAiCost) * 100 : 0;
                        const stepLabel = `Step ${step.step_order} — ${STEP_TYPE_LABEL[step.step_type] ?? step.step_type}`;
                        const model = step.models?.split(",")[0] ?? "";
                        const shortModel = model.includes("/") ? model.split("/").pop() ?? model : model;
                        return (
                          <div key={step.step_order} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-medium text-base-content/70 truncate">{stepLabel}</span>
                                {shortModel && (
                                  <span className="text-[10px] text-base-content/25 truncate hidden group-hover:inline">{shortModel}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-3">
                                <span className="text-[10px] text-base-content/30 tabular-nums">{step.call_count} calls</span>
                                <span className="text-[10px] text-base-content/30 tabular-nums">{(step.input_tokens + step.output_tokens).toLocaleString()} tok</span>
                                <span className="text-xs font-semibold tabular-nums" style={{ color: "#a78bfa" }}>${step.cost_usd.toFixed(4)}</span>
                              </div>
                            </div>
                            <div className="h-1 bg-base-300/30 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${stepPct}%`, background: "#a78bfa", opacity: 0.6 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: funnel + rate cards */}
        <div className="space-y-3">
          <div className="bg-base-200 border border-base-300/50 rounded-xl p-4">
            <div className="mb-4">
              <span className="text-xs font-medium text-base-content/30 uppercase tracking-widest">Funnel</span>
            </div>
            <div className="space-y-0.5">
              <FunnelBar label="Prospects" value={funnel.total} color="#808080" />
              <FunnelBar label="Visited" value={funnel.profiles_visited} color="#5aa2ff" />
              <FunnelBar label="Connections sent" value={funnel.connections_sent} color="#32d583" />
              <FunnelBar label="Connected" value={funnel.connected} color="#32d583" />
              <FunnelBar label="LI Messages" value={funnel.messages_sent} color="#f4b740" />
              <FunnelBar label="InMails sent" value={funnel.inmails_sent} color="#e879f9" />
              <FunnelBar label="LI Replies" value={funnel.li_replies} color="#c084fc" />
              <FunnelBar label="Emails sent" value={funnel.emails_sent} color="#fb923c" />
              <FunnelBar label="Email replies" value={funnel.email_replies} color="#32d583" />
              <FunnelBar label="LI Enriched" value={funnel.linkedin_enriched} color="#3b82f6" />
              <FunnelBar label="Email Enriched" value={funnel.emails_enriched} color="#f4b740" />
              <FunnelBar label="Pushed CRM" value={funnel.hubspot_pushes} color="#20c997" />
              <div className="pt-2 border-t border-base-300/30 mt-2">
                <FunnelBar label="Completed" value={funnel.completed} color="#5aa2ff" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkflowDetailPage({
  workflow: initial,
  lists,
  accounts,
  emailAccounts,
  templates,
  activeRunEmailAccountIds,
  autoSetup,
}: {
  workflow: WorkflowData;
  lists: List[];
  accounts: Account[];
  emailAccounts: EmailAccount[];
  templates: Template[];
  activeRunEmailAccountIds: string[];
  autoSetup: boolean;
}) {
  const [workflowName, setWorkflowName] = useState(initial.name);
  const [steps, setSteps] = useState<Step[]>(initial.steps);
  const [stats, setStats] = useState<Stats | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectsTotal, setProspectsTotal] = useState(0);
  const [prospectsPage, setProspectsPage] = useState(0);
  const PROSPECTS_PAGE_SIZE = 25;
  // selectedStep: { track, step_order } for a specific step, or a string sentinel for outcome filters
  const [selectedStep, setSelectedStep] = useState<{ track: string; step_order: number } | "completed" | "failed" | null>(null);
  const [showWizard, setShowWizard] = useState(autoSetup || initial.steps.length === 0);
  const [wizardMode, setWizardMode] = useState<WizardMode>("launch");
  const [showStop, setShowStop] = useState(false);
  const [activeTab, setActiveTab] = useState<"prospects" | "analytics">("prospects");
  const [days] = useState(30);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [prospectFilters, setProspectFilters] = useState<ActiveFilter[]>([]);
  const router = useRouter();

  // Strip ?setup=1 from URL so refreshing doesn't re-open the wizard
  useEffect(() => {
    if (autoSetup) router.replace(`/workflows/${initial.id}`, undefined, { shallow: true });
  }, []);

  const activeRun = stats?.active_run ?? initial.active_run;
  const isRunning = activeRun?.status === "running";
  const isPaused = activeRun?.status === "paused";
  const isCompleted = activeRun?.status === "completed";
  const isActive = isRunning || isPaused;

  const actionSteps = steps.filter((s) => s.step_type !== "delay");

  const refreshStats = useCallback(async () => {
    const res = await fetch(`/api/workflows/${initial.id}/stats`);
    if (res.ok) setStats(await res.json());
  }, [initial.id]);

  const refreshProspects = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedStep !== null && selectedStep !== "completed" && selectedStep !== "failed") {
      params.set("step", String(selectedStep.step_order));
      params.set("track", selectedStep.track);
    }
    if (selectedStep === "completed") params.set("state", "completed");
    if (selectedStep === "failed") params.set("state", "failed,skipped");
    params.set("page", String(prospectsPage));
    if (search.trim()) params.set("search", search.trim());
    filtersToParams(prospectFilters).forEach((v, k) => params.set(k, v));
    const res = await fetch(`/api/workflows/${initial.id}/prospects?${params}`);
    if (res.ok) {
      const data = await res.json();
      setProspects(data.prospects);
      setProspectsTotal(data.total);
    }
  }, [initial.id, selectedStep, prospectsPage, search, prospectFilters]);

  const refreshSteps = useCallback(async () => {
    const res = await fetch(`/api/workflows/${initial.id}/steps`);
    if (res.ok) setSteps(await res.json());
  }, [initial.id]);

  // Reset to page 0 when filter/search changes
  useEffect(() => { setProspectsPage(0); }, [selectedStep, search, prospectFilters]);

  useEffect(() => {
    refreshStats();
    refreshProspects();
  }, [refreshStats, refreshProspects]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      refreshStats();
      refreshProspects();
    }, 5000);
    return () => clearInterval(interval);
  }, [isActive, refreshStats, refreshProspects]);

  async function pauseRun() {
    if (!activeRun) return;
    await fetch(`/api/runs/${activeRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    toast.success("Paused");
    refreshStats();
  }

  async function resumeRun() {
    if (!activeRun) return;
    await fetch(`/api/runs/${activeRun.id}/start`, { method: "POST" });
    toast.success("Resumed");
    refreshStats();
  }

  async function stopRun() {
    if (!activeRun) return;
    await fetch(`/api/runs/${activeRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    toast.success("Campaign stopped");
    setShowStop(false);
    refreshStats();
    refreshProspects();
  }

  async function unenrollProspect(runId: string, targetId: string) {
    const res = await fetch(`/api/runs/${runId}/unenroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId }),
    });
    if (res.ok) {
      toast.success("Unenrolled");
      setProspects((prev) => prev.filter((p) => p.target_id !== targetId));
      setProspectsTotal((prev) => prev - 1);
      refreshStats();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Failed to unenroll");
    }
  }

  async function retryProspect(runId: string, targetId: string) {
    const res = await fetch(`/api/runs/${runId}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_ids: [targetId] }),
    });
    if (res.ok) {
      toast.success("Retrying");
      setProspects((prev) =>
        prev.map((p) => p.target_id === targetId ? { ...p, state: "in_progress", error_message: null } : p)
      );
      refreshStats();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Failed to retry");
    }
  }

  async function removeProspect(runId: string, targetId: string) {
    const res = await fetch(`/api/runs/${runId}/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_ids: [targetId] }),
    });
    if (res.ok) {
      toast.success("Removed from campaign");
      setProspects((prev) => prev.filter((p) => p.target_id !== targetId));
      setProspectsTotal((prev) => prev - 1);
      refreshStats();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Failed to remove");
    }
  }

  // Group target_ids by run_id, then fire one request per run
  async function bulkAction(action: "retry" | "remove" | "unenroll", targetIds: string[]) {
    const grouped: Record<string, string[]> = {};
    for (const tid of targetIds) {
      const p = prospects.find((x) => x.target_id === tid);
      if (!p) continue;
      if (!grouped[p.run_id]) grouped[p.run_id] = [];
      grouped[p.run_id].push(tid);
    }
    let results: Response[];
    if (action === "unenroll") {
      // unenroll API takes one target_id at a time
      results = await Promise.all(
        Object.entries(grouped).flatMap(([runId, ids]) =>
          ids.map((tid) =>
            fetch(`/api/runs/${runId}/unenroll`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ target_id: tid }),
            })
          )
        )
      );
    } else {
      results = await Promise.all(
        Object.entries(grouped).map(([runId, ids]) =>
          fetch(`/api/runs/${runId}/${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target_ids: ids }),
          })
        )
      );
    }
    if (!results.every((r) => r.ok)) { toast.error("Some actions failed"); return; }
    if (action === "retry") {
      toast.success(`Retried ${targetIds.length} prospect${targetIds.length !== 1 ? "s" : ""}`);
      setProspects((prev) => prev.map((p) => targetIds.includes(p.target_id) ? { ...p, state: "in_progress", error_message: null } : p));
    } else {
      toast.success(`${action === "remove" ? "Removed" : "Unenrolled"} ${targetIds.length} prospect${targetIds.length !== 1 ? "s" : ""}`);
      setProspects((prev) => prev.filter((p) => !targetIds.includes(p.target_id)));
      setProspectsTotal((prev) => prev - targetIds.length);
    }
    setSelected(new Set());
    refreshStats();
  }

  const displayStats = stats ?? {
    total_prospects: 0,
    active_prospects: 0,
    completed_prospects: 0,
    failed_prospects: 0,
    connections_sent: 0,
    connections_accepted: 0,
    acceptance_rate: 0,
    messages_sent: 0,
    inmails_sent: 0,
    emails_sent: 0,
    profiles_visited: 0,
    emails_enriched: 0,
    linkedin_enriched: 0,
    hubspot_pushes: 0,
    active_run: initial.active_run,
  };

  return (
    <>
    <Head>
      <title>{workflowName} — Campaigns — Linki</title>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Link href="/workflows" className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/50 hover:bg-base-200 hover:text-base-content transition-colors shrink-0">
          <RiArrowLeftLine size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold">{workflowName}</h1>
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-primary/15 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                Running
              </span>
            )}
            {isPaused && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-warning/15 text-warning">
                Paused
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-success/10 border border-success/20 text-success">
                Completed
              </span>
            )}
            {!isActive && !isCompleted && displayStats.total_prospects > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-base-300 text-base-content/40">
                Idle
              </span>
            )}
            {/* Inline stats — shown only when there's data */}
            {displayStats.total_prospects > 0 && (
              <div className="flex items-center gap-3 ml-1">
                <span className="text-base-content/30 text-xs">·</span>
                <span className="text-xs text-base-content/50">
                  <span className="font-semibold text-base-content/80">{displayStats.total_prospects}</span> prospects
                </span>
                {displayStats.completed_prospects > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-success">{displayStats.completed_prospects}</span> done
                  </span>
                )}
                {displayStats.connections_sent > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-primary">{displayStats.connections_sent}</span> reqs sent
                  </span>
                )}
                {displayStats.connections_accepted > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-success">{displayStats.connections_accepted}</span> connected
                  </span>
                )}
                {displayStats.messages_sent > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-info">{displayStats.messages_sent}</span> messaged
                  </span>
                )}
                {displayStats.inmails_sent > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-info">{displayStats.inmails_sent}</span> inmailed
                  </span>
                )}
                {displayStats.profiles_visited > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-info">{displayStats.profiles_visited}</span> visited
                  </span>
                )}
                {displayStats.linkedin_enriched > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-info">{displayStats.linkedin_enriched}</span> LI enriched
                  </span>
                )}
                {displayStats.emails_enriched > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-success">{displayStats.emails_enriched}</span> enriched
                  </span>
                )}
                {displayStats.hubspot_pushes > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-success">{displayStats.hubspot_pushes}</span> to CRM
                  </span>
                )}
                {displayStats.connections_sent > 0 && displayStats.acceptance_rate > 0 && (
                  <span className="text-xs text-base-content/40">{displayStats.acceptance_rate}% accepted</span>
                )}
              </div>
            )}
          </div>
          {activeRun && (
            <p className="text-xs text-base-content/40 mt-0.5 pl-0">
              {activeRun.list_name} · {activeRun.account_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-warning/15 text-warning border border-warning/25 hover:bg-warning/25 transition-colors"
                onClick={pauseRun}
              >
                <RiPauseLine size={14} /> Pause
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors"
                onClick={() => setShowStop(true)}
              >
                <RiStopLine size={14} /> Stop
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-base-200 text-base-content/70 border border-base-300/60 hover:border-base-300 hover:text-base-content transition-colors"
                onClick={() => { setWizardMode("add-contacts"); setShowWizard(true); }}
              >
                <RiAddLine size={14} /> Add contacts
              </button>
            </>
          )}
          {isPaused && (
            <>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition-colors"
                onClick={resumeRun}
              >
                <RiPlayLine size={14} /> Resume
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors"
                onClick={() => setShowStop(true)}
              >
                <RiStopLine size={14} /> Stop
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-base-200 text-base-content/70 border border-base-300/60 hover:border-base-300 hover:text-base-content transition-colors"
                onClick={() => { setWizardMode("add-contacts"); setShowWizard(true); }}
              >
                <RiAddLine size={14} /> Add contacts
              </button>
            </>
          )}
          {steps.length > 0 && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-base-200 text-base-content/70 border border-base-300/60 hover:border-base-300 hover:text-base-content transition-colors"
              onClick={() => { setWizardMode("edit"); setShowWizard(true); }}
            >
              <RiEditLine size={14} /> Edit
            </button>
          )}
          {!isActive && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-content hover:bg-primary/90 transition-colors"
              onClick={() => { setWizardMode("launch"); setShowWizard(true); }}
            >
              <RiAddLine size={14} /> Add Prospects
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-base-300/30 mb-0 -mb-px pl-11">
        {(["prospects", "analytics"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-base-content/40 hover:text-base-content/70"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main layout */}
      {activeTab === "prospects" && <div className="flex gap-8" style={{ height: "calc(100vh - 148px)" }}>
        {/* Sidebar */}
        <div className="w-52 shrink-0 overflow-y-auto">
          {/* All prospects */}
          <button
            onClick={() => setSelectedStep(null)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-4 flex items-center justify-between ${selectedStep === null ? "bg-primary/10 border border-primary/30 text-primary" : "hover:bg-base-200 text-base-content/60 border border-transparent"}`}
          >
            <span className="font-medium">All prospects</span>
            {displayStats.total_prospects > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${selectedStep === null ? "bg-primary/20 text-primary" : "bg-base-300 text-base-content/40"}`}>
                {displayStats.total_prospects}
              </span>
            )}
          </button>

          {actionSteps.length > 0 && (
            <div>
              <p className="text-xs text-base-content/30 uppercase tracking-widest px-1 mb-3">Pipeline</p>

              {/* Render each track independently, delays shown inline before their step */}
              {(["linkedin", "email", "integration"] as Track[]).map((track) => {
                const trackSteps = steps.filter((s) => (s.track ?? (s.step_type === "email" ? "email" : "linkedin")) === track);
                if (trackSteps.length === 0) return null;
                const trackActionSteps = trackSteps.filter((s) => s.step_type !== "delay");
                if (trackActionSteps.length === 0) return null;

                const isStepSelected = (s: Step) =>
                  typeof selectedStep === "object" && selectedStep !== null &&
                  selectedStep.track === track && selectedStep.step_order === s.step_order;

                const rendered: React.ReactNode[] = [];
                let prevDelay: Step | null = null;
                for (let i = 0; i < trackSteps.length; i++) {
                  const s = trackSteps[i];
                  if (s.step_type === "delay") { prevDelay = s; continue; }
                  const sel = isStepSelected(s);
                  const delayStep = prevDelay;
                  const delayDays = delayStep ? Math.round(delayStep.delay_seconds / 86400) : 0;
                  prevDelay = null;

                  rendered.push(
                    <div key={s.id} className="flex flex-col items-stretch">
                      {delayDays > 0 ? (
                        <>
                          <div className="flex justify-center"><div className="w-px h-3 bg-base-content/20" /></div>
                          <button
                            onClick={() => {
                              const delayKey = { track, step_order: delayStep!.step_order };
                              const isSel = typeof selectedStep === "object" && selectedStep !== null && selectedStep.track === track && selectedStep.step_order === delayStep!.step_order;
                              setSelectedStep(isSel ? null : delayKey);
                            }}
                            className={`w-full flex items-center gap-2 py-1 px-3 rounded-lg transition-colors ${typeof selectedStep === "object" && selectedStep !== null && selectedStep.track === track && selectedStep.step_order === delayStep?.step_order ? "bg-base-300/60 text-base-content/70" : "text-base-content/40 hover:text-base-content/70 hover:bg-base-200/60"}`}
                          >
                            <RiTimeLine size={11} className="shrink-0" />
                            <span className="text-xs">Wait {delayDays}d</span>
                          </button>
                          <div className="flex justify-center"><div className="w-px h-3 bg-base-content/20" /></div>
                        </>
                      ) : rendered.length > 0 ? (
                        <div className="flex justify-center"><div className="w-px h-4 bg-base-content/20" /></div>
                      ) : null}
                      <button
                        onClick={() => setSelectedStep(sel ? null : { track, step_order: s.step_order })}
                        className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center gap-3 border ${sel ? "bg-primary/10 border-primary/30" : "bg-base-200 border-base-300/40 hover:border-base-300/80"}`}
                      >
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs border ${sel ? "bg-primary/20 border-primary/40 text-primary" : `${STEP_COLORS[s.step_type]}`}`}>
                          {STEP_ICONS[s.step_type]}
                        </span>
                        <p className={`text-xs font-medium leading-tight ${sel ? "text-primary" : "text-base-content"}`}>
                          {getStepLabel(s.step_type, s.config)}
                        </p>
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={track} className="mb-4">
                    {trackSteps.some(s => s.track) && (
                      <p className="text-xs text-base-content/20 uppercase tracking-widest px-1 mb-2">{track}</p>
                    )}
                    <div className="flex flex-col">{rendered}</div>
                  </div>
                );
              })}

              {/* Outcome filters */}
              {displayStats.total_prospects > 0 && (
                <div className="mt-4 pt-4 border-t border-base-300/30 flex flex-col gap-1.5">
                  <button
                    onClick={() => setSelectedStep(selectedStep === "completed" ? null : "completed")}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2.5 border ${selectedStep === "completed" ? "text-success bg-success/10 border-success/20" : "text-base-content/50 hover:text-success bg-base-200 border-base-300/40 hover:border-success/20"}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                    <span className="font-medium">{displayStats.completed_prospects} completed</span>
                  </button>
                  {displayStats.failed_prospects > 0 && (
                    <button
                      onClick={() => setSelectedStep(selectedStep === "failed" ? null : "failed")}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2.5 border ${selectedStep === "failed" ? "text-error bg-error/10 border-error/20" : "text-base-content/50 hover:text-error bg-base-200 border-base-300/40 hover:border-error/20"}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-error shrink-0" />
                      <span className="font-medium">{displayStats.failed_prospects} failed / skipped</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prospects table */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {displayStats.total_prospects === 0 ? (
            <div className="text-center py-20 text-base-content/40 text-sm border border-base-300/50 rounded-lg">
              {steps.length === 0
                ? <span>No steps configured yet. <button className="text-primary underline" onClick={() => setShowWizard(true)}>Set up this campaign.</button></span>
                : <span>No prospects yet. <button className="text-primary underline" onClick={() => setShowWizard(true)}>Add prospects to start.</button></span>}
            </div>
          ) : (
            <div>
              {/* Search + filter + bulk action bar */}
              <div className="relative mb-2">
                {selected.size === 0 ? (
                  <div className="flex items-center gap-2.5 flex-wrap py-0.5">
                    <div className="relative shrink-0">
                      <RiSearchLine size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search prospects…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-48 pl-7 pr-3 py-1.5 text-xs bg-base-200 border border-base-300/50 rounded-lg outline-none focus:border-primary/50 placeholder:text-base-content/30"
                      />
                    </div>
                    <div className="w-px h-4 bg-base-300/60 shrink-0" />
                    <FilterBar
                      filters={prospectFilters}
                      onChange={(f) => { setProspectFilters(f); setProspectsPage(0); }}
                      />
                  </div>
                ) : (() => {
                  const sel = prospects.filter((p) => selected.has(p.target_id));
                  const failedSel = sel.filter((p) => p.state === "failed");
                  const unenrollSel = sel.filter((p) => isActive && (p.state === "pending" || p.state === "in_progress"));
                  const removeSel = sel.filter((p) => p.state !== "completed");
                  return (
                    <div className="absolute inset-0 flex items-center gap-2 px-3 bg-base-200 border border-base-300/50 rounded-lg z-10">
                      <span className="text-xs text-base-content/50 flex-1">{selected.size} selected</span>
                      {failedSel.length > 0 && (
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-info/10 text-info border border-info/20 hover:bg-info/20 transition-colors"
                          onClick={() => bulkAction("retry", failedSel.map((p) => p.target_id))}
                        >
                          <RiRefreshLine size={12} /> Retry {failedSel.length} failed
                        </button>
                      )}
                      {unenrollSel.length > 0 && (
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition-colors"
                          onClick={() => bulkAction("unenroll", unenrollSel.map((p) => p.target_id))}
                        >
                          <RiDeleteBinLine size={12} /> Unenroll {unenrollSel.length}
                        </button>
                      )}
                      {removeSel.length > 0 && (
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors"
                          onClick={() => bulkAction("remove", removeSel.map((p) => p.target_id))}
                        >
                          <RiDeleteBinLine size={12} /> Remove {removeSel.length}
                        </button>
                      )}
                      <button
                        className="text-xs text-base-content/30 hover:text-base-content/60 transition-colors px-1"
                        onClick={() => setSelected(new Set())}
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })()}
              </div>

              <div className="overflow-x-auto rounded-lg border border-base-300/50">
                <table className="table w-full text-sm">
                  <thead>
                    <tr className="border-base-300/50 text-base-content/50 text-xs uppercase tracking-wide">
                      <th className="w-8">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={prospects.length > 0 && prospects.every((p) => selected.has(p.target_id))}
                          onChange={() => {
                            if (prospects.every((p) => selected.has(p.target_id))) {
                              setSelected((prev) => { const n = new Set(prev); prospects.forEach((p) => n.delete(p.target_id)); return n; });
                            } else {
                              setSelected((prev) => { const n = new Set(prev); prospects.forEach((p) => n.add(p.target_id)); return n; });
                            }
                          }}
                        />
                      </th>
                      <th>Name</th>
                      <th>Company</th>
                      <th>Step</th>
                      <th>Status</th>
                      <th>Next Action</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-base-content/30 py-8 text-xs">
                          No prospects match this filter.
                        </td>
                      </tr>
                    )}
                    {prospects.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-base-300/30 hover:bg-base-200/50 cursor-pointer ${selected.has(p.target_id) ? "bg-base-200/30" : ""}`}
                        onClick={() => router.push(`/contacts/${p.target_id}`)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
                            checked={selected.has(p.target_id)}
                            onChange={() => setSelected((prev) => { const n = new Set(prev); n.has(p.target_id) ? n.delete(p.target_id) : n.add(p.target_id); return n; })}
                          />
                        </td>
                        <td>
                          <p className="font-medium text-sm">{p.full_name ?? "—"}</p>
                          {p.title && <p className="text-xs text-base-content/40 truncate max-w-40">{p.title}</p>}
                        </td>
                        <td className="text-xs text-base-content/60">{p.company ?? "—"}</td>
                        <td className="text-xs text-base-content/60">
                          {(() => {
                            const activeTrack = typeof selectedStep === "object" && selectedStep !== null ? selectedStep.track : null;
                            const st = activeTrack === "email" ? p.em_step_type : activeTrack === "linkedin" ? p.li_step_type : activeTrack === "integration" ? p.in_step_type : p.step_type;
                            return st === "connect" && p.connection_requested_at
                              ? "Awaiting acceptance"
                              : st === "email"
                              ? <span className="text-warning/80">Cold Email</span>
                              : st ? (STEP_LABELS[st] ?? st) : "—";
                          })()}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {(() => {
                              const isEmailBounce = p.state === "skipped" && !!p.error_message && (p.error_message.includes("bounced") || p.error_message.includes("domain invalid"));
                              const pillClass = isEmailBounce
                                ? "bg-warning/15 text-warning"
                                : (STATE_PILL[p.state] ?? "bg-base-300 text-base-content/50");
                              const label = isEmailBounce ? "email invalid" : p.state.replace("_", " ");
                              return (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${pillClass}`}>
                                  {label}
                                </span>
                              );
                            })()}
                            {(p.state === "failed" || (p.state === "skipped" && p.error_message && (p.error_message.includes("bounced") || p.error_message.includes("domain invalid")))) && p.error_message && (
                              <button
                                className="text-warning/60 hover:text-warning transition-colors"
                                onClick={(e) => { e.stopPropagation(); setErrorModal(p.error_message!); }}
                              >
                                <RiErrorWarningLine size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="text-xs text-base-content/50">
                          {formatNextAction(p.next_step_at, p.state)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            {p.state === "failed" && (
                              <button
                                title="Retry"
                                onClick={() => retryProspect(p.run_id, p.target_id)}
                                className="inline-flex items-center p-1 rounded text-base-content/20 hover:text-info hover:bg-info/10 transition-colors"
                              >
                                <RiRefreshLine size={13} />
                              </button>
                            )}
                            {p.state !== "completed" && (
                              <button
                                title={isActive && p.state !== "failed" ? "Unenroll from campaign" : "Remove from campaign"}
                                onClick={() => isActive && p.state !== "failed"
                                  ? unenrollProspect(p.run_id, p.target_id)
                                  : removeProspect(p.run_id, p.target_id)
                                }
                                className="inline-flex items-center p-1 rounded text-base-content/20 hover:text-error hover:bg-error/10 transition-colors"
                              >
                                <RiDeleteBinLine size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {prospectsTotal > PROSPECTS_PAGE_SIZE && (
                <div className="flex items-center justify-between mt-3 text-sm text-base-content/50">
                  <span className="text-xs">{prospectsPage * PROSPECTS_PAGE_SIZE + 1}–{Math.min((prospectsPage + 1) * PROSPECTS_PAGE_SIZE, prospectsTotal)} of {prospectsTotal}</span>
                  <div className="flex items-center gap-1">
                    <button
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-base-content/50 hover:text-base-content hover:bg-base-300/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => setProspectsPage((p) => p - 1)}
                      disabled={prospectsPage === 0}
                    >
                      <RiArrowLeftSLine size={15} />
                    </button>
                    <span className="px-2 text-xs">{prospectsPage + 1} / {Math.ceil(prospectsTotal / PROSPECTS_PAGE_SIZE)}</span>
                    <button
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-base-content/50 hover:text-base-content hover:bg-base-300/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => setProspectsPage((p) => p + 1)}
                      disabled={prospectsPage >= Math.ceil(prospectsTotal / PROSPECTS_PAGE_SIZE) - 1}
                    >
                      <RiArrowRightSLine size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>}

      {/* ── Analytics tab ── */}
      {activeTab === "analytics" && (
        <AnalyticsPanel workflowId={initial.id} days={days} />
      )}

      {/* Wizard */}
      {showWizard && (
        <Wizard
          workflowId={initial.id}
          workflowName={workflowName}
          initialPrompt={initial.prompt ?? ""}
          allowCrossCampaignOverlap={initial.allow_cross_campaign_overlap === 1}
          initialSteps={steps}
          lists={lists}
          accounts={accounts}
          emailAccounts={emailAccounts}
          templates={templates}
          mode={wizardMode}
          activeRunId={activeRun?.id ?? null}
          activeRunListId={activeRun?.list_id ?? null}
          activeRunEmailAccountIds={activeRunEmailAccountIds}
          onClose={() => { setShowWizard(false); setWizardMode("launch"); refreshSteps(); }}
          onLaunched={() => { setShowWizard(false); setWizardMode("launch"); refreshSteps(); refreshStats(); refreshProspects(); }}
          onRenamed={setWorkflowName}
        />
      )}

      {/* Error details modal */}
      {errorModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setErrorModal(null)}>
          <div className="bg-base-200 border border-base-300/50 rounded-xl p-5 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <RiErrorWarningLine className="text-error" size={16} />
              <span className="text-sm font-semibold">Error details</span>
            </div>
            <pre className="text-xs text-base-content/70 bg-base-300 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
              {errorModal}
            </pre>
            <button className="mt-4 btn btn-sm btn-ghost w-full" onClick={() => setErrorModal(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Stop confirm */}
      {showStop && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-200 border border-base-300/50 max-w-sm">
            <h3 className="font-semibold text-base mb-2">Stop campaign?</h3>
            <p className="text-sm text-base-content/60 mb-4">
              This will mark the campaign as completed. Active prospects stay in their current state.
            </p>
            <div className="modal-action">
              <button className="px-4 py-1.5 rounded-lg text-sm text-base-content/60 hover:text-base-content hover:bg-base-300 transition-colors" onClick={() => setShowStop(false)}>Cancel</button>
              <button className="px-4 py-1.5 rounded-lg text-sm font-medium bg-error/15 text-error border border-error/25 hover:bg-error/25 transition-colors" onClick={stopRun}>Stop Campaign</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowStop(false)} />
        </div>
      )}
    </div>
    </>
  );
}
