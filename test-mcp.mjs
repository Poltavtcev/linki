import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const token = "d1c0b9a8f7e6d5c4b3a2f1e6d7c9b8a1";
const url = new URL("http://localhost:3000/api/mcp");

async function main() {
  const transport = new SSEClientTransport(url, {
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const client = new Client({ name: "test", version: "1" }, { capabilities: {} });
  
  await client.connect(transport);
  console.log("✅ Connected!");

  const tools = await client.listTools();
  console.log("✅ Tools:", tools.tools.map(t => t.name));

  process.exit(0);
}

main().catch(console.error);
