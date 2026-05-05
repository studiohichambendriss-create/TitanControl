#!/bin/bash
# TITAN 15 DASHBOARD - MAC LAUNCHER
# This script is double-clickable on macOS.

# Ensure we are in the script's directory
cd "$(dirname "$0")"

echo "🛸 Starting TITAN 15 Robotic Orchestration System..."

# Check for Python (Required for local secure context)
if command -v python3 &>/dev/null; then
    echo "✅ Python 3 detected. Launching server on http://localhost:8000"
    open "http://localhost:8000"
    python3 -m http.server 8000
elif command -v python &>/dev/null; then
    echo "✅ Python detected. Launching server on http://localhost:8000"
    open "http://localhost:8000"
    python -m http.server 8000
else
    echo "❌ ERROR: Python not found. Please install Python 3 to run the Titan Dashboard."
    echo "   Visit https://www.python.org/downloads/ to install."
    read -p "Press enter to exit..."
    exit 1
fi
