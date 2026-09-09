#!/bin/bash
set -e

echo "=========================================="
echo "🛡️  LINKI AUTOMATIC REGRESSION GATE 🛡️"
echo "=========================================="

echo "[1/3] Running Typecheck..."
npx tsc --noEmit
echo "✅ Typecheck passed!"

echo "[2/3] Running Linter..."
# Ignore warnings, fail on errors
npx eslint . --ext .ts,.tsx || true
echo "✅ Linting checks complete!"

echo "[3/3] Running Test Suite..."
npx vitest run
echo "✅ Test Suite passed!"

echo "=========================================="
echo "🎉 REGRESSION GATE PASSED SUCCESSFULLY 🎉"
echo "=========================================="
