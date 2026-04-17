#!/bin/bash
# Diagnose: Mac repo state vs Vercel
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
LOG=~/Documents/Claude/Projects/OneAce/oneace/check-state.log
exec > "$LOG" 2>&1
set -x

echo "=== Current branch ==="
git branch -v

echo ""
echo "=== Local HEAD (last 20 commits) ==="
git log --oneline -20

echo ""
echo "=== Remote main ==="
git fetch origin 2>&1
git log --oneline origin/main -10

echo ""
echo "=== Remote stable ==="
git log --oneline origin/stable -5

echo ""
echo "=== Tags ==="
git tag -l 'v1.*' --sort=-v:refname

echo ""
echo "=== Diff local vs remote ==="
git log --oneline origin/main..HEAD
echo "--- (above: local commits NOT on remote)"
git log --oneline HEAD..origin/main
echo "--- (above: remote commits NOT on local)"

echo ""
echo "=== UI redesign commit check ==="
git log --oneline --all --grep="UI redesign" | head -5

echo ""
echo "=== DONE ==="
