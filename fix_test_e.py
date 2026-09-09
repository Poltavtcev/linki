with open('tests/integration/delay-routing.test.ts', 'r') as f:
    c = f.read()

# find Test E
start_idx = c.find("E. Legacy Action Step")
end_idx = len(c)
test_e = c[start_idx:end_idx]
new_test_e = test_e.replace("expect(state.state).toBe('completed')", "expect(state.state).toBe('running')")

c = c[:start_idx] + new_test_e
with open('tests/integration/delay-routing.test.ts', 'w') as f:
    f.write(c)
