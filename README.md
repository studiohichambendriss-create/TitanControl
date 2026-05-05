# 🛸 TITAN 15: Robotic Art Orchestration Dashboard

A professional-grade, high-fidelity motor control system designed for precision robotic art production. This dashboard provides real-time control, sequence recording, and complex MIDI orchestration for 15 high-power motors.

## 🌟 Professional Features

### 🎬 Advanced Transport & Recording
- **Variable Speed Playback**: Precise control from **0.1x to 5.0x speed** with a virtual-time sync engine.
- **Auto-Save System**: Integrated session naming and automatic export to JSON/CSV/MIDI upon recording completion.
- **Timeline Scrubber**: High-resolution timeline with frame-accurate scrubbing and visual feedback.

### 🎹 MIDI Performance Engine
- **Polyphonic Piano Hover**: Group and control multiple motors simultaneously by holding piano keys. A game-changer for live robotic performances.
- **Tactile Mouse Hover**: Instantly map any MIDI knob to whichever motor fader your mouse is currently over.
- **Deep Orchestration**: Map everything—transport (Play/Rec/Stop), pattern speeds, and individual motor faders—to any MIDI hardware.
- **Auto-Map CC**: Rapidly map entire fader banks by moving just the first knob.

### 🌊 Pattern & Lerp Engine
- **Organic Motion**: Configurable **Lerp (Linear Interpolation)** for all inputs, ensuring fluid robotic movement without jitter.
- **Smooth Reset**: Customizable "Lerp to Zero" on exit for both Mouse and Piano hover modes.
- **Chaos & Wave**: Advanced mathematical patterns for organic, non-repetitive motion.

### 💎 Design & UX
- **Glassmorphism UI**: Premium dark-mode interface with cyan neon accents and Orbitron industrial typography.
- **Persistent Workspace**: Every toggle, slider, and mapping is saved to local storage—pick up exactly where you left off.

## 🚀 Quick Start
1.  **Flash Hardware**: Upload `TitanControl.ino` to your Arduino Mega.
2.  **Launch Server**: Run `run_titan.bat` to start the local environment.
3.  **Connect**: Open the dashboard in Chrome/Edge and click **CONNECT ARDUINO**.
4.  **Calibrate**: Set your MIDI Hardware Port in the Hardware tab and begin mapping.

## 🛠 Hardware Architecture
- **Controller**: Arduino Mega 2560
- **Driver**: PCA9685 16-Channel PWM (I2C)
- **Actuators**: 15x RS775 High-Torque Motors
- **Power**: Dual 12V 30A DC Rail

## ⚠️ Requirements
- **Web Serial API**: Use a modern browser (Chrome/Edge/Opera).
- **Python 3**: Required for the local secure context server.
- **MIDI Access**: Grant permissions when prompted by the browser.

---
*Built for precision. Engineered for art.*
