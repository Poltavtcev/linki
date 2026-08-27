import type { NextApiRequest, NextApiResponse } from "next";

interface OpenRouterModel {
  id: string;
  name: string;
  provider: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  
  // Dummy endpoint for OpenAI MVP to populate the ModelPicker UI component 
  // without needing a real OpenRouter request.
  
  const models: OpenRouterModel[] = [
    { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai" }
  ];

  return res.json({ models });
}
