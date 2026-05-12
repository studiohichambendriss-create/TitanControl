#!/bin/bash
# 🛸 TITAN 15 RASPI LAUNCHER
# Me start server and browser.

# Go to script dir
cd "$(dirname "$0")"

echo "🛸 Starting TITAN 15 Dashboard..."

# Kill old servers
pkill -f "python3 -m http.server 8000"

# Start server in back
python3 -m http.server 8000 &

# Wait for server
sleep 2

echo "🌐 Opening Chromium..."
# Open chromium in fullscreen/kiosk
chromium-browser --start-fullscreen --disable-features=TranslateUI --no-first-run --check-for-update-interval=31536000 http://localhost:8000
