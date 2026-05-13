#!/bin/bash
# 🛸 TITAN 15 RASPI KEEPALIVE LAUNCHER
# Me start bridge and keep TitanView alive!

cd "$(dirname "$0")"

echo "🛸 Starting TITAN BRIDGE..."
pkill -9 -f bridge.py
pkill -9 -f chromium

# Start Bridge in background
nohup python3 -u bridge.py > bridge.log 2>&1 &

# Wait for bridge to wake up
sleep 3

export DISPLAY=:0

echo "🌐 Opening TitanView..."
# --app opens it like a normal window (NO KIOSK) so you can move it or close it!
chromium --no-sandbox --disable-gpu --new-window --app=http://localhost:5000/titanview &

echo "✅ TITAN 15 Dashboard is running!"
