#!/bin/bash
# 🛸 TITAN 15 RASPI KEEPALIVE LAUNCHER
# Me start bridge and keep TitanView alive!

cd "$(dirname "$0")"

echo "🛸 Starting TITAN BRIDGE..."
pkill -9 -f bridge.py
pkill -9 -f chromium

# Clear old logs so Python GUI doesn't show old ghosts!
> bridge.log

# Start Bridge in background
nohup python3 -u bridge.py > bridge.log 2>&1 &

# Wait for bridge to wake up
sleep 3

export DISPLAY=:0

echo "🌐 Opening TitanView..."
# Open the debug python GUI so user can see raw logs
python3 status_gui.py > gui.log 2>&1 &
sleep 1

# --app opens it like a normal window (NO KIOSK) so you can move it or close it!
# Aggressive flags to disable GPU and background fluff
chromium --no-sandbox --disable-gpu --disable-software-rasterizer --disable-dev-shm-usage --password-store=basic --user-data-dir=/tmp/titan_chrome --new-window --disable-sync --no-first-run http://localhost:5000/titanview &

echo "✅ TITAN 15 Dashboard is running!"
