import { getDb } from "./db";
import { randomUUID } from "crypto";

export interface AiGenerationContext {
  target: any;
  channel: 'linkedin' | 'email';
  workflowPrompt?: string | null;
  stepPrompt?: string | null;
  lastInboundMessage?: string | null;
  model?: string;
  auto_send?: boolean;
  systemMessageOverride?: string;
}

export async function generateAiReply(
  db: ReturnType<typeof getDb>,
  context: AiGenerationContext
): Promise<{ generatedText: string; draftId: string; status: 'PAUSED' | 'READY', contextJson: any }> {
  const openaiInt = db.prepare("SELECT api_key FROM integrations WHERE key = 'openai'").get() as { api_key: string } | undefined;
  let apiKey = process.env.OPENAI_API_KEY;
  if (openaiInt?.api_key) {
    const { decryptSecret } = require("./crypto");
    apiKey = decryptSecret(openaiInt.api_key);
  }
  if (!apiKey) throw new Error("Missing API key for AI generation");
  const openai = new (await import("openai")).default({ apiKey });

  const contextJson = { 
    target: context.target, 
    workflowPrompt: context.workflowPrompt, 
    stepPrompt: context.stepPrompt, 
    lastInboundMessage: context.lastInboundMessage 
  };
  
  const systemMsg = context.systemMessageOverride || `You are an AI sales assistant. Your task is to write a ${context.channel} message. Follow the provided instructions carefully.
Campaign Context: ${context.workflowPrompt || 'None'}
Step Instructions: ${context.stepPrompt || 'Write a relevant message.'}
Target Profile: ${JSON.stringify(context.target)}
Last Inbound Message from Target: ${context.lastInboundMessage || 'None'}
Output ONLY the final message content to be sent. Do not include subject lines.`;

  const chat = await openai.chat.completions.create({
     model: context.model || "gpt-4o",
     messages: [{ role: "system", content: systemMsg }]
  });
  
  const generatedText = chat.choices[0].message.content?.trim() || "";
  const draftId = randomUUID();
  const status = context.auto_send ? 'READY' : 'PAUSED';

  return { generatedText, draftId, status, contextJson };
}
