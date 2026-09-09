import re

# Fix characterization-delay.test.ts
with open('tests/integration/characterization-delay.test.ts', 'r') as f:
    c = f.read()
# change expect(state.state).toBe('completed') to 'running'
c = c.replace("expect(state.state).toBe('completed')", "expect(state.state).toBe('running')")
with open('tests/integration/characterization-delay.test.ts', 'w') as f:
    f.write(c)

# Fix delay-routing.test.ts
with open('tests/integration/delay-routing.test.ts', 'r') as f:
    c = f.read()

# Fix Test E
c = c.replace("""
  await tickActions(db);
  let state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  
    expect(state.state).toBe('completed');
""", """
  await tickActions(db);
  let state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.state).toBe('running');
""")

# Fix other tests that also expect 'completed' instantly when they should be 'running'
# Wait! Does Test A (Delay 1h -> Email) expect 'pending' or 'running'?
# Test B (Delay -> END)
# Test C (Multiple delays)
# Test D (No-delay)
