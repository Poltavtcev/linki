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
  
  const openai = new OpenAI({ apiKey: params.apiKey });

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
  const costUsd = (inputTokens * 0.150 / 1000000) + (outputTokens * 0.600 / 1000000);

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
      params.model,
      inputTokens,
      outputTokens,
      null, // cost not calculated natively in MVP
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

  const stopBasic = () => {
    if (channel === "email") {
      db.prepare("UPDATE targets SET email_replied_at = COALESCE(email_replied_at, ?) WHERE id = ?").run(now, targetId);
    } else {
      db.prepare("UPDATE targets SET last_replied_at = COALESCE(last_replied_at, ?) WHERE id = ?").run(now, targetId);
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
    const apiKey = process.env.OPENAI_API_KEY;
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
        { role: "user", content: text.slice(0, 12000) }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content;
    if (content) {
       const obj = JSON.parse(content);
       const kind = obj.kind;
       console.log(`[runner-trace] AI CLASSIFICATION RESULT kind=${kind}`);
       
       if (replyId && channel === "email") {
         db.prepare("UPDATE email_replies SET classification_json = ?, classified_at = ?, classification_error = NULL WHERE id = ?").run(JSON.stringify(obj), now, replyId);
       }
       
       if (kind !== "ooo_followup") {
          stopBasic();
       }
    } else {
      if (replyId && channel === "email") {
        db.prepare("UPDATE email_replies SET classification_error = ? WHERE id = ?").run("Empty response", replyId);
      }
      stopBasic(); // Fallback on empty response
    }
  } catch (e) {
    console.log(`[runner-trace] AI CLASSIFICATION ERROR targetId=${targetId}`);
    console.warn(`[ee/replies] AI classification failed for target ${targetId}, falling back to deterministic STOP`, e);
    if (replyId && channel === "email") {
      db.prepare("UPDATE email_replies SET classification_error = ? WHERE id = ?").run(String(e), replyId);
    }
    stopBasic();
  }
}

const replies = {
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
    
    await processReply(targetId, "email", text, replyId);
  },

  shouldSyncInbox: () => false,
  syncAccountInbox: async () => 0
};

export const premium = {
  ai,
  replies
};

export default premium;
