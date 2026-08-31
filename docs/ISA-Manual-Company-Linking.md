# ISA: Manual Contact-to-Company Linking

## 1. Context & Objective
Currently, the Next.js CRM (`linki`) only assigns targets to companies automatically during the Apollo Enrichment phase (`lib/linkedin/runner.ts`). There is no UI or API for manual linking.
The objective is to allow users to manually link/unlink a Contact (Target) to/from a Company in two places:
1. **From the Contact Profile (`pages/contacts/[id].tsx`):** A dropdown/autocomplete to select a company.
2. **From the Company Profile (`pages/companies/[id].tsx`):** A search/add interface to pull existing contacts into the company.

## 2. Backend Scope
1. **`pages/api/targets/[id].ts` (Target API):**
   - Add `company_id` to the `EDITABLE` array in the `PATCH` handler.
   - Ensure setting `company_id = null` successfully unlinks the target.

2. **`pages/api/contacts/index.ts` (or similar search endpoint):**
   - Verify that it supports simple name/URL search to populate an autocomplete dropdown in the UI.

3. **`pages/api/companies/index.ts`:**
   - Verify that the existing `GET` method supports lightweight search (it already accepts `?search=` and `?full=0`).

## 3. Frontend Scope
1. **`pages/contacts/[id].tsx` (Contact Detail Page):**
   - Replace the static text field for Company linking with a `CompanySelect` autocomplete component.
   - The component will fetch `/api/companies?search={query}&limit=10` and allow the user to select an existing company, patching `/api/targets/{id}` with `company_id: selectedId`.

2. **`pages/companies/[id].tsx` (Company Detail Page):**
   - In the "Contacts" section, add a `+ Add Contact` button.
   - This opens a modal with a `ContactSelect` autocomplete component.
   - The component searches `/api/contacts?search={query}` (or `/api/targets`).
   - On selection, it fires a `PATCH /api/targets/{contactId}` with `{ company_id: companyId }` and refreshes the local contact list.

## 4. Edge Cases & Resilience
- **Unlinking:** The UI must support removing a contact from a company (setting `company_id = null`).
- **Data Integrity:** Only valid company UUIDs must be passed to `company_id`. SQLite foreign key constraints (if enabled) will reject invalid IDs, so error handling on the PATCH request must display a toast notification.

## 5. Execution Steps
1. Modify Backend API (`pages/api/targets/[id].ts`).
2. Build UI `CompanySelect` for the Contact page.
3. Build UI `ContactSelect` Modal for the Company page.
4. E2E Test locally.
