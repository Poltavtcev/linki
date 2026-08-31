# ISA: Next.js MCP Server Implementation

## 1. Context & Objective
Implement a fully functional Model Context Protocol (MCP) server directly inside the Next.js API router (`/api/mcp`). This allows AI agents (like Claude Desktop or Cursor) to securely connect to the Linki CRM via HTTP SSE (Server-Sent Events) and execute tools to read/write the SQLite database.

## 2. Architecture
Since Next.js API routes are stateless request handlers, but MCP SSE requires a persistent connection and routing POST messages to the correct SSE transport, we will use a global in-memory map. (This works safely here because this Next.js app runs as a stateful Node.js server backed by local SQLite).

**Routing & State:**
- `pages/api/mcp/index.ts`: Handles `GET`. Initiates the SSE connection, creates an `SSEServerTransport`, and stores it in `globalThis.mcpTransports` keyed by a UUID session ID.
- `pages/api/mcp/message.ts`: Handles `POST`. Receives JSON-RPC messages from the client, looks up the transport by the `sessionId` query parameter, and passes the message to the transport.
- `lib/mcp/server.ts`: Contains the `Server` instantiation (from `@modelcontextprotocol/sdk/server/index.js`) and defines the Tools.

## 3. Security
- Both endpoints will check for the `Authorization: Bearer <token>` header.
- The token will be matched against `process.env.INTERNAL_API_SECRET`.

## 4. Tools Provided
The initial MCP server will expose the following core CRM tools to the LLM:
1. `search_contacts`: Search `targets` table by name, title, or company. (Returns ID, name, company, title).
2. `get_contact`: Retrieve full CRM details for a specific contact UUID.
3. `update_contact`: Update editable fields on a contact (including `company_id`).
4. `search_companies`: Search `companies` by name or domain.
5. `sql_read_only`: Execute a read-only (`SELECT`) SQLite query against `linki.db`. This acts as an ultimate escape hatch for the AI to do custom analytics or complex joins (the agent will be provided with the schema in its system prompt).

## 5. Execution Steps
1. Verify `@modelcontextprotocol/sdk` is installed (already in `package.json`).
2. Create `lib/mcp/server.ts` with the tool implementations wrapping `lib/db.ts`.
3. Create `pages/api/mcp/index.ts` (SSE endpoint).
4. Create `pages/api/mcp/message.ts` (Message routing endpoint).
5. Test connectivity using an MCP client or `curl`.
