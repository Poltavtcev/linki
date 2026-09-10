# DEFERRED-LISTS-API-001 — Oversized Response in /api/lists/[id]

## Confirmed Facts
- The API route `pages/api/lists/[id]/index.ts` currently returns the list metadata alongside ALL associated `targets` in a single unpaginated response.
- In production, a list with ~2406 targets triggered a Next.js warning: `API response ... exceeds 4MB`.
- The exact response size was estimated at ~5.5 MB based on a sample target payload, but the only strictly confirmed fact is that the response is `>4MB`.
- This is a scalability/API contract issue affecting the UI and network layer. It is **not** a blocker for the Campaign Engine runner.

## Future Scope (When Resumed)
When this task is scheduled for implementation, the following steps MUST be executed:
1. **Measure:** Accurately measure the actual response size in the network layer to establish a baseline.
2. **Audit Consumers:** Find all frontend and backend consumers of `/api/lists/[id]`.
3. **Evaluate Solutions:** Evaluate options such as adding pagination (limit/offset), selective field projection (fetching only necessary columns instead of `t.*`), or separating list metadata from target data.
4. **Safeguard Contracts:** Ensure that the API contract change does not break the Campaign Engine UI, the List view, or any other existing consumers.

**STATUS: DEFERRED / NOT IMPLEMENTED**
No production code modifications or refactoring were performed.
