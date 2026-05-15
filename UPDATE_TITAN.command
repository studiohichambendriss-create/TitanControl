#!/bin/bash
# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "------------------------------------------"
echo "🚀 TITANCONTROL: UPDATING FROM GITHUB..."
echo "------------------------------------------"

# Sync with the latest version on main
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
