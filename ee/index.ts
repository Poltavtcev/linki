import OpenAI from "openai";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

type Channel = "message" | "email" | "sales_inmail";

export interface CommunityAiParams {
  apiKey: string;
  model: string;
  stepType: Channel;
  stepPrompt?: string;
  maxWords?: number;
  language?: string;
  campaignPrompt?: string;
  contact: Record<string, unknown>;
  company?: Record<string, unknown> | null;
  agentConfig?: Record<string, unknown>;
  previousMessageContext?: { followupNumber: number; previousMessage: string };
  followupContext?: { followupNumber: number; previousSubject: string; previousBody: string };
  replyContext?: string;
  runId?: string;
  targetId?: string;
  stepId?: string;
}

function compactRecord(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== null && field !== "" && field !== undefined),
  );
}

function buildPrompt(params: CommunityAiParams): string {
  const outputShape = params.stepType === "message"
    ? '{"body":"personalized LinkedIn message"}'
    : '{"subject":"concise subject","body":"personalized message body"}';

  const instructions = [
    "Write concise, natural B2B outreach that sounds like a thoughtful human.",
    "Use only facts supplied in the contact and company context; never invent achievements, events, or relationships.",
    "Avoid hype, generic compliments, fake familiarity, and unsupported claims.",
    `Write in ${params.language || "English"}.`,
    params.maxWords ? `Keep the body at or below ${params.maxWords} words.` : "Keep the body brief.",
  ];

  if (params.stepType === "email") {
    instructions.push("Do NOT generate an email signature, sender name, sender placeholder, or sign-off/closing (e.g., Best regards, Pozdrawiam). The application handles the sender signature separately.");
  }

  instructions.push(`Return only valid JSON matching ${outputShape}.`);

  return JSON.stringify({
    task: params.stepType,
    instructions,
    campaign_context: params.campaignPrompt || null,
    step_instruction: params.stepPrompt || null,
    global_system_prompt: params.agentConfig?.system_prompt || null,
    global_user_prompt: params.agentConfig?.user_prompt || null,
    contact: compactRecord(params.contact),
    company: compactRecord(params.company),
    previous_linkedin_message: params.previousMessageContext || null,
    previous_email: params.followupContext || null,
    reply_context: params.replyContext || null,
    examples: {
      email: params.agentConfig?.email_examples || null,
      linkedin: params.agentConfig?.linkedin_examples || null,
    },
  }, null, 2);
}

function parseModelJson(content: string, stepType: Channel): { subject?: string; body: string } {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: { subject?: unknown; body?: unknown };
  try {
    parsed = JSON.parse(cleaned) as { subject?: unknown; body?: unknown };
  } catch {
    if (stepType === "message" && cleaned) return { body: cleaned };
    throw new Error("The selected model did not return valid JSON");
  }

  const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
  const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : undefined;
  if (!body) throw new Error("The selected model returned an empty message");
  if (stepType !== "message" && !subject) throw new Error("The selected model returned no subject");
  return { subject, body };
}

async function generateContent(params: CommunityAiParams) {
  const prompt = buildPrompt(params);
  
  if (!params.apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set.");
  }
  
  const openai = new OpenAI({
    apiKey: params.apiKey,
    baseURL: params.apiKey.startsWith("sk-or-") ? "https://openrouter.ai/api/v1" : undefined
  });

  const response = await openai.chat.completions.create({
    model: params.model || "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert B2B outbound copywriter. Return valid JSON only." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  
  const parsed = parseModelJson(content, params.stepType);
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const isMini = (params.model || "gpt-4o-mini").includes("mini");
  const inRate = isMini ? 0.150 : 5.000;
  const outRate = isMini ? 0.600 : 15.000;
  const costUsd = (inputTokens * inRate / 1000000) + (outputTokens * outRate / 1000000);

  if (params.runId || params.targetId || params.stepId) {
    const db = getDb();
    db.prepare(`
      INSERT INTO agent_sessions
        (id, run_id, target_id, step_id, model, input_tokens, output_tokens, cost_usd, prompt, generated_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      params.runId ?? null,
      params.targetId ?? null,
      params.stepId ?? null,
      params.model || "gpt-4o-mini",
      inputTokens,
      outputTokens,
      costUsd,
      prompt,
      JSON.stringify(parsed),
    );
  }

  return { ...parsed, inputTokens, outputTokens, costUsd };
}

const ai = {
  getAgentConfig() {
    const db = getDb();
    const configRow = db.prepare("SELECT * FROM agent_config LIMIT 1").get() as Record<string, unknown> | undefined;
    return configRow ?? {
      default_model: "gpt-4o-mini",
      system_prompt: null,
      user_prompt: null,
      email_examples: null,
      linkedin_examples: null,
    };
  },

  getContactWithCompany(targetId: string) {
    const db = getDb();
    const contact = db.prepare("SELECT * FROM targets WHERE id = ?").get(targetId) as Record<string, unknown> | undefined;
    if (!contact) return null;
    const companyId = typeof contact.company_id === "string" ? contact.company_id : null;
    const company = companyId
      ? db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId) as Record<string, unknown> | undefined
      : null;
    return { contact, company: company ?? null };
  },

  async writeEmail(params: CommunityAiParams) {
    const result = await generateContent({ ...params, stepType: "email" });
    return { subject: result.subject ?? "", body: result.body, input_tokens: result.inputTokens, output_tokens: result.outputTokens, cost_usd: result.costUsd };
  },

  async writeLinkedInMessage(params: CommunityAiParams) {
    const result = await generateContent({ ...params, stepType: "message" });
    return { body: result.body, input_tokens: result.inputTokens, output_tokens: result.outputTokens, cost_usd: result.costUsd };
  },

  async writeSalesInMail(params: CommunityAiParams) {
    const result = await generateContent({ ...params, stepType: "sales_inmail" });
    return { subject: result.subject ?? "", body: result.body, input_tokens: result.inputTokens, output_tokens: result.outputTokens, cost_usd: result.costUsd };
  },
};

// Unified decision pipeline for all reply events
export async function processReply(targetId: string, channel: "email" | "linkedin", text?: string, replyId?: string) {
  const db = getDb();
  const now = new Date().toISOString();

  // F-01: Check if deterministic correlation already routed this profile to an on_replied edge.
  const activeCheckRuns = db.prepare(`
    SELECT rps.current_step_id, r.workflow_id
    FROM run_profile_states rps
    JOIN run_profiles rp ON rps.run_profile_id = rp.id
    JOIN runs r ON rp.run_id = r.id
    WHERE rp.target_id = ? AND rps.state IN ('pending', 'running', 'paused')
  `).all(targetId) as { current_step_id: string | null, workflow_id: string }[];
  
  let alreadyCorrelated = false;
  for (const run of activeCheckRuns) {
    if (run.current_step_id) {
      const steps = db.prepare("SELECT edges_json FROM workflow_steps WHERE workflow_id = ?").all(run.workflow_id) as { edges_json: string | null }[];
      for (const step of steps) {
        if (step.edges_json) {
          try {
            const edges = JSON.parse(step.edges_json);
            if (edges['on_replied'] === run.current_step_id) {
              alreadyCorrelated = true;
              break;
            }
          } catch (e) {}
        }
      }
    }
  }

  if (alreadyCorrelated) {
    return;
  }

  const stopBasic = () => {
    if (channel === "email") {
      db.prepare("UPDATE targets SET email_replied_at = COALESCE(email_replied_at, ?) WHERE id = ?").run(now, targetId);
    } else {
      db.prepare("UPDATE targets SET last_replied_at = COALESCE(last_replied_at, ?) WHERE id = ?").run(now, targetId);
    }

    if (replyId) {
      db.prepare("UPDATE email_replies SET classified_at = ?, classification_json = ? WHERE id = ? AND classified_at IS NULL").run(now, '{"kind":"human_reply","fallback":true}', replyId);
    }

    db.prepare(`
      UPDATE run_profile_tracks 
      SET state = 'skipped', error_message = 'Lead replied'
      WHERE run_profile_id IN (SELECT id FROM run_profiles WHERE target_id = ?)
        AND state NOT IN ('completed', 'failed', 'skipped')
    `).run(targetId);

    const activeRuns = db.prepare(`
      SELECT rps.run_profile_id, rps.current_step_id, rps.state, r.workflow_id
      FROM run_profile_states rps
      JOIN run_profiles rp ON rps.run_profile_id = rp.id
      JOIN runs r ON rp.run_id = r.id
      WHERE rp.target_id = ? AND rps.state IN ('pending', 'running', 'paused')
    `).all(targetId) as { run_profile_id: string, current_step_id: string | null, state: string, workflow_id: string }[];

    for (const run of activeRuns) {
      let onRepliedEdge: string | null = null;
      let currentOrder = 999999;
      
      if (run.current_step_id) {
        const stepRow = db.prepare("SELECT step_order FROM workflow_steps WHERE id = ?").get(run.current_step_id) as { step_order: number } | undefined;
        if (stepRow) {
          currentOrder = stepRow.step_order;
        }
      }

      const lastMessageStep = db.prepare(`
        SELECT id, edges_json FROM workflow_steps
        WHERE workflow_id = ?
          AND step_order <= ?
          AND step_type IN ('message', 'email', 'sales_inmail')
        ORDER BY step_order DESC
        LIMIT 1
      `).get(run.workflow_id, currentOrder) as { id: string, edges_json: string | null } | undefined;

      if (lastMessageStep && lastMessageStep.edges_json) {
        try {
          const edges = JSON.parse(lastMessageStep.edges_json);
          if (edges['on_replied']) {
            onRepliedEdge = String(edges['on_replied']);
          }
        } catch (e) {
          // ignore parsing error
        }
      }

      if (onRepliedEdge) {
        db.prepare(`
          UPDATE run_profile_states
          SET current_step_id = ?, state = 'pending', next_eval_at = NULL
          WHERE run_profile_id = ?
        `).run(onRepliedEdge, run.run_profile_id);
      } else {
        db.prepare(`
          UPDATE run_profile_states
          SET state = 'skipped', error_message = 'Lead replied'
          WHERE run_profile_id = ?
        `).run(run.run_profile_id);
      }
    }
  };

  if (process.env.AI_REPLY_INTELLIGENCE !== "true") {
    // AI is OFF -> Deterministic STOP
    stopBasic();
    return;
  }

  if (!text) {
    // AI is ON but no text provided -> Safety STOP
    stopBasic();
    return;
  }

  // AI is ON -> classification
  try {
    let apiKey = process.env.OPENAI_API_KEY;
    const openaiInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openai'").get() as { api_key: string } | undefined;
    if (openaiInt?.api_key) {
      const { decryptSecret } = require("@/lib/crypto");
      apiKey = decryptSecret(openaiInt.api_key);
    }

    if (!apiKey) {
      // Fallback to basic stop if no API key
      stopBasic();
      return;
    }
    
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // For classification MVP
      temperature: 0,
      messages: [
        { role: "system", content: "You classify a single sales reply. The reply may be written in any language. Classify its meaning, not specific keywords. Do not assume English. Respond with ONLY a compact JSON object and nothing else. Keys: kind (exactly one of: ooo_followup, substitute, call_task, human_reply, not_interested)." },
        { role: "user", content: Array.from(text).slice(0, 12000).join('') }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content;
    if (content) {
       const obj = JSON.parse(content);
       const kind = obj.kind;
       console.log(`[email-inbox] Reply classified as ${kind}`);
       
       if (replyId) {
         db.prepare("UPDATE email_replies SET classification_json = ?, classified_at = ?, classification_error = NULL WHERE id = ?").run(JSON.stringify(obj), now, replyId);
       }
       
       if (kind !== "ooo_followup") {
          stopBasic();
       }
    } else {
      if (replyId) {
        db.prepare("UPDATE email_replies SET classification_error = ? WHERE id = ?").run("Empty response", replyId);
      }
      throw new Error("Empty response from AI"); // Do not stopBasic() here
    }
  } catch (e) {
    console.warn(`[ee/replies] AI classification failed for target ${targetId}, skipping deterministic STOP`, e);
    if (replyId) {
      db.prepare("UPDATE email_replies SET classification_error = ? WHERE id = ?").run(String(e), replyId);
    }
    // Removed stopBasic() to allow retries
  }
}

const replies = {
  async retryFailed() {
    const db = getDb();
    const failed = db.prepare(`SELECT id FROM email_replies WHERE classified_at IS NULL AND classification_error IS NOT NULL`).all() as { id: string }[];
    for (const f of failed) {
      await this.classifyAndDispatch(f.id).catch(() => {});
    }
  },

  async classifyAndDispatch(replyId: string) {
    const db = getDb();
    const reply = db.prepare(`
      SELECT er.*, t.email, t.full_name
      FROM email_replies er 
      JOIN targets t ON t.id = er.target_id 
      WHERE er.id = ?
    `).get(replyId) as Record<string, unknown> | undefined;
    
    if (!reply) return;
    
    const targetId = String(reply.target_id);
    const text = `${reply.subject || ""}\n${reply.body_text || ""}`.trim();
    const fromEmail = String(reply.from_email || "");
    const channel = fromEmail.startsWith("urn:li:") ? "linkedin" : "email";
    
    await processReply(targetId, channel, text, replyId);
  },

  shouldSyncInbox: () => false,
  syncAccountInbox: async () => 0
};

export const premium = {
  ai,
  replies
};

export default premium;
