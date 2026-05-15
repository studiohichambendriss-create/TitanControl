#!/bin/bash
# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "------------------------------------------"
echo "🚀 TITANCONTROL: UPDATING FROM GITHUB..."
echo "------------------------------------------"

# Check if we are inside a git repository
if [ ! -d ".git" ]; then
    echo "⚠️ This folder is not a Git repository."
    echo "Attempting to fix automatically..."
    git init
    git remote add origin https://github.com/studiohichambendriss-create/TitanControl.git
    echo "✅ Git initialized and remote added."
fi

# Sync with the latest version on main
echo "📡 Fetching latest updates..."
git fetch origin
git reset --hard origin/main

echo ""
echo "------------------------------------------"
echo "✅ UPDATE COMPLETE!"
echo "Your files are now synced with the latest version."
echo "You can close this window now."
echo "------------------------------------------"

# Pause so the user can see the success message
read -p "Press enter to close..."
