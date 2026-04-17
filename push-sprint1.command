#!/bin/bash
# Sprint 1 — v1.0.0-rc7 push script
# Double-click this file in Finder to push main + tag + stable, then verify.
# Output is mirrored to push-sprint1.log so Claude can read the result.

set -e
cd "$(dirname "$0")"

LOG="push-sprint1.log"
exec > >(tee "$LOG") 2>&1

echo "=== $(date) ==="
echo "cwd: $(pwd)"
echo

echo "--- git push origin main ---"
git push origin main

echo
echo "--- git push origin v1.0.0-rc7 ---"
git push origin v1.0.0-rc7

echo
echo "--- git push origin stable --force-with-lease ---"
git push origin stable --force-with-lease

echo
echo "--- ./scripts/verify.sh deploy ---"
if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy
else
  echo "scripts/verify.sh not found or not executable — skipped"
fi

echo
echo "=== DONE $(date) ==="
echo
echo "Pencereyi kapatmak için bu pencerede Enter'a basabilirsin."
read -r _
