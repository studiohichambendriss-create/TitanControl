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

echo "🌐 Keeping TitanView alive..."
# Loop to restart browser if it closes!
while true; do
    # --app opens it like a normal window (NO KIOSK) so you can move it or close it!
    chromium --no-sandbox --disable-gpu --app=http://localhost:5000/titanview
    echo "⚠️ Chromium closed! Reopening in 3 seconds..."
    sleep 3
done
