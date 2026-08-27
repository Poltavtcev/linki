import type { NextApiRequest, NextApiResponse } from "next";
import { premium } from "@/ee";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { step_type, ai_model, ai_prompt, ai_max_words, ai_language, target_id, campaign_prompt } = req.body;

  if (!premium?.ai) {
    return res.status(403).json({ error: "AI Premium feature not available." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }

  try {
    const contactData = premium.ai.getContactWithCompany(target_id);
    if (!contactData) {
      return res.status(404).json({ error: "Target not found" });
    }

    const agentConfig = premium.ai.getAgentConfig();

    const params: any = {
      apiKey,
      model: ai_model,
      stepType: step_type,
      stepPrompt: ai_prompt,
      maxWords: ai_max_words,
      language: ai_language,
      campaignPrompt: campaign_prompt,
      contact: contactData.contact,
      company: contactData.company,
      agentConfig,
      // intentionally omitting targetId, runId, stepId to PREVENT saving to agent_sessions
    };

    let result;
    if (step_type === "email") {
      result = await premium.ai.writeEmail(params);
    } else if (step_type === "message") {
      result = await premium.ai.writeLinkedInMessage(params);
    } else if (step_type === "sales_inmail") {
      result = await premium.ai.writeSalesInMail(params);
    } else {
      return res.status(400).json({ error: "Unknown step type" });
    }

    return res.json(result);
  } catch (err: any) {
    console.error("[preview] AI preview failed:", err);
    return res.status(500).json({ error: err.message || "Failed to generate preview" });
  }
}
