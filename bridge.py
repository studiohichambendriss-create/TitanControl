from flask import Flask, send_from_directory
from flask_socketio import SocketIO
import serial
import serial.tools.list_ports
import threading
import time
import os

app = Flask(__name__, static_folder='.')
socketio = SocketIO(app, cors_allowed_origins="*")

# Serial Configuration
ser = None
SERIAL_PORT = None # Will auto-detect
BAUD_RATE = 115200

def find_arduino():
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        if "Arduino" in p.description or "ACM" in p.device or "USB" in p.device:
            return p.device
    return None

def connect_serial():
    global ser, SERIAL_PORT
    SERIAL_PORT = find_arduino()
    if SERIAL_PORT:
        try:
            ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
            print(f"✅ Connected to Arduino on {SERIAL_PORT}")
            return True
        except Exception as e:
            print(f"❌ Serial Error: {e}")
    return False

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('.', path)

@socketio.on('connect')
def handle_connect():
    status = "CONNECTED" if ser and ser.is_open else "OFFLINE"
    socketio.emit('status', {'serial': status, 'port': SERIAL_PORT})
    print("💻 Laptop connected to bridge")

@socketio.on('command')
def handle_command(cmd):
    global ser
    if ser and ser.is_open:
        try:
            ser.write((cmd + '\n').encode())
        except:
            print("❌ Write failed, reconnecting...")
            connect_serial()
    else:
        # Try to reconnect if not connected
        if connect_serial():
            ser.write((cmd + '\n').encode())

def status_loop():
    while True:
        port = find_arduino()
        status = "ONLINE" if port and ser and ser.is_open else "OFFLINE"
        socketio.emit('status', {'serial': status, 'port': port})
        time.sleep(2)

if __name__ == '__main__':
    connect_serial()
    # Run status loop in background
    threading.Thread(target=status_loop, daemon=True).start()
    print("🚀 Titan Bridge starting on http://0.0.0.0:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
