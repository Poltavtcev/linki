import type { NextApiRequest, NextApiResponse } from "next";

function checkAuth(req: NextApiRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (!auth) return false;
  return auth === `Bearer ${secret}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  if (!checkAuth(req)) {
    return res.status(401).end("Unauthorized");
  }

  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    return res.status(400).end("Missing sessionId");
  }

  const transport = globalThis.mcpTransports?.get(sessionId);
  if (!transport) {
    return res.status(404).end("Session not found or expired");
  }

  try {
    await transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("MCP handlePostMessage error:", error);
    if (!res.headersSent) {
      res.status(500).end("Internal Server Error");
    }
  }
}
