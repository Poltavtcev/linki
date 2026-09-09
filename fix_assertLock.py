with open('lib/linkedin/runner.ts', 'r') as f:
    content = f.read()

# 1. Add assertLock to executeStep params
old_params = "  campaignPrompt?: string | null\n): Promise<StepExecutionResult> {"
new_params = "  campaignPrompt?: string | null,\n  assertLock: () => void = () => {}\n): Promise<StepExecutionResult> {"
content = content.replace(old_params, new_params)

# 2. Add assertLock to executeStep call in tickActions
old_call = "const result = await executeStep(db, state.run_id, state.run_profile_id, state.id, target, step, state.account_id, limits, state.email_account_id, emailLimits, promptQ?.prompt);"
new_call = "const result = await executeStep(db, state.run_id, state.run_profile_id, state.id, target, step, state.account_id, limits, state.email_account_id, emailLimits, promptQ?.prompt, assertLock);"
content = content.replace(old_call, new_call)

with open('lib/linkedin/runner.ts', 'w') as f:
    f.write(content)
