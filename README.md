# TITAN 15 CONTROL SYSTEM

High-performance motor control dashboard for Arduino Mega + PCA9685.

## 🚀 Quick Start
1.  **Flash Arduino**: Upload `TitanControl.ino` to your Arduino Mega.
2.  **Run System**: Double-click `run_titan.bat`.
3.  **Connect**: Click the **Connect Arduino** button in the top right of the dashboard.

## 🛠 Hardware List
- Arduino Mega
- PCA9685 PWM Driver (I2C)
- 15x RS775 Motors
- 15x IBT_2 Motor Drivers
- 2x 12V 30A Power Supplies

## 🎹 Features
- **15x Mixer Faders**: Real-time speed control.
- **Pattern Engine**: Chaos, Wave, Pulse, and Ramp patterns.
- **High-Precision Recorder**: Record movements for hours and play back perfectly.
- **MIDI Integration**: 
    - Load MIDI files to drive motors.
    - Connect MIDI keyboards/controllers to hardware-map motors.
- **Local Storage**: Export recordings as JSON or CSV.

## ⚠️ Requirements
- **Python**: Needed for the local web server (Web Serial security requirement).
- **Chrome/Edge**: Needed for the Web Serial API.
