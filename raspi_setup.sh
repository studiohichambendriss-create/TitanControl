#!/bin/bash
# 🛸 TITAN 15 RASPI SETUP
# Me help you install stuff.

echo "📦 Updating system..."
sudo apt update

echo "🛠 Installing Python and Chromium..."
sudo apt install -y python3 chromium-browser

echo "🔌 Adding user to dialout group for Serial access..."
sudo usermod -a -G dialout $USER

echo "✅ Setup done! Please REBOOT your Pi before running."
