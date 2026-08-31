import type { NextApiRequest, NextApiResponse } from "next";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "@/lib/mcp/server";
import { randomUUID } from "crypto";

// Extend global to persist transports across HMR
declare global {
  var mcpTransports: Map<string, SSEServerTransport> | undefined;
}

if (!globalThis.mcpTransports) {
  globalThis.mcpTransports = new Map();
}

function checkAuth(req: NextApiRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (!auth) return false;
  return auth === `Bearer ${secret}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).end("Method Not Allowed");
  }

  if (!checkAuth(req)) {
    return res.status(401).end("Unauthorized");
  }

  const sessionId = randomUUID();
  const transport = new SSEServerTransport("/api/mcp/message?sessionId=" + sessionId, res);
  globalThis.mcpTransports!.set(sessionId, transport);

  const server = createMcpServer();
  await server.connect(transport);

  // Clean up on disconnect
  res.on("close", () => {
    globalThis.mcpTransports!.delete(sessionId);
    server.close();
  });
}
