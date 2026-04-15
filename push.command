#!/bin/bash
cd "$(dirname "$0")"
echo "Pushing to GitHub..."
git push origin main
echo ""
echo "Done! Press any key to close."
read -n 1
