with open('lib/linkedin/runner.ts', 'r') as f:
    lines = f.readlines()

# line 1086 is index 1085
del lines[1085]

with open('lib/linkedin/runner.ts', 'w') as f:
    f.writelines(lines)
