# Titan Pi Loop Mode and GUI Fixes

## 1. Fix Pi GUI (`status_gui.py`)
- **Problem**: UI shows "NOT IN AP MODE" and wrong local IP when AP is actually running.
- **Solution**: Update `status_gui.py` to specifically look for the `wlan0` IP (which is `10.42.0.1` for NetworkManager shared mode or `192.168.4.1`) and reliably detect the `TitanHotspot` connection.

## 2. Fix Pi Loop Mode Execution (`bridge.py`)
- **Problem**: Loop mode does not execute correctly when the sequence is sent from the TitanControl website.
- **Solution**: Debug `bridge.py` `playback_loop` logic. Ensure timers are correct and commands are sent to Arduino correctly during playback.

## 3. Add Pause Button for Pi Loop Mode (UI + `bridge.py`)
- **Problem**: Need a way to pause the Pi's autonomous loop from the website.
- **Solution**: Add a "PAUSE PI" button next to "UPLOAD TO PI". Send a pause command via Socket.IO. Implement pause state in `bridge.py`.

## 4. Add Adjustable Loop Delay (UI + `bridge.py`)
- **Problem**: Loop should wait for a specific time before restarting.
- **Solution**: Add an input next to the upload button for "Delay (sec)". Send this delay to the Pi. Update `bridge.py` loop to sleep for this delay before repeating.
