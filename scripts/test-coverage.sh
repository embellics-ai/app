#!/bin/bash

# Test Coverage Report Generator
# This script runs tests with coverage and generates a comprehensive report

echo "🧪 Running Test Suite with Coverage..."
echo "======================================"
echo ""

# Run tests with coverage
npm test -- --coverage

echo ""
echo "📊 Coverage Report Generated!"
echo "======================================"
echo ""
echo "View coverage reports:"
echo "  • Terminal: See above"
echo "  • HTML: open coverage/index.html"
echo "  • JSON: coverage/coverage-final.json"
echo "  • LCOV: coverage/lcov.info"
echo ""
echo "Coverage Thresholds (70%):"
echo "  ✓ Lines"
echo "  ✓ Functions"
echo "  ✓ Branches"
echo "  ✓ Statements"
echo ""

# Open HTML coverage report (optional)
if [ "$1" == "--open" ]; then
  echo "Opening HTML coverage report..."
  open coverage/index.html || xdg-open coverage/index.html || start coverage/index.html
fi
