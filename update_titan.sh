#!/bin/bash
echo "🚀 Updating TitanControl from GitHub..."
git fetch origin
git reset --hard origin/main
echo "✅ Update complete! Your local files are now synced with the latest version."
