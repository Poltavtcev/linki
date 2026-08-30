# Linki Development Protocol (Strict Enforcement)

This protocol must be followed by all agents and subagents when making modifications to the LinkedIn automation logic.

## The 5-Step Process
1. **Audit (Evidence-Based):** 
   - No guessing. No blind assumptions.
   - You MUST run a script to capture real DOM dumps, XHR/Fetch payloads, or logs from LinkedIn.
   - Prove the vulnerability or the new schema using real data.
2. **ISA (Technical Specification):**
   - Write a clear ISA (markdown) detailing how the fix will be implemented based *only* on the evidence gathered.
3. **Implementation:**
   - Execute the code changes in the codebase.
4. **Testing & Debugging:**
   - Run the modified script locally against a real test account.
   - Do NOT deliver the feature until local testing succeeds.
5. **Delivery:**
   - Commit the changes and notify the user with a concise summary.
