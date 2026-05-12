from flask import Flask, send_from_directory
from flask_socketio import SocketIO
import serial
import serial.tools.list_ports
import threading
import time
import os
import json

app = Flask(__name__, static_folder='.')
socketio = SocketIO(app, cors_allowed_origins="*")

# Serial Configuration
ser = None
SERIAL_PORT = None # Will auto-detect
BAUD_RATE = 115200

# Playback State
current_sequence = []
is_autonomous = True
connected_clients = 0
current_virtual_time = 0.0
playback_index = 0
last_real_time = 0.0
sequence_file = 'sequence.json'

def load_sequence():
    global current_sequence
    if os.path.exists(sequence_file):
        try:
            with open(sequence_file, 'r') as f:
                current_sequence = json.load(f)
                print(f"Loaded sequence with {len(current_sequence)} events.")
        except Exception as e:
            print(f"Error loading sequence: {e}")

load_sequence()

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
    global connected_clients, is_autonomous, current_sequence, current_virtual_time
    connected_clients += 1
    is_autonomous = False # Laptop connected, give it control
    
    status = "CONNECTED" if ser and ser.is_open else "OFFLINE"
    socketio.emit('status', {'serial': status, 'port': SERIAL_PORT})
    
    # Emit sync data so the web app can take over exactly where the pi is
    socketio.emit('sync_data', {
        'sequence': current_sequence,
        'current_time': current_virtual_time
    })
    
    print(f"💻 Laptop connected to bridge. Total clients: {connected_clients}. Autonomous playback PAUSED.")

@socketio.on('disconnect')
def handle_disconnect():
    global connected_clients, is_autonomous
    connected_clients -= 1
    if connected_clients <= 0:
        connected_clients = 0
        is_autonomous = True
        print("💻 All clients disconnected. Autonomous playback RESUMED.")

@socketio.on('upload_sequence')
def handle_upload(seq):
    global current_sequence, current_virtual_time, playback_index
    current_sequence = seq
    current_virtual_time = 0
    playback_index = 0
    try:
        with open(sequence_file, 'w') as f:
            json.dump(seq, f)
        print(f"✅ Saved new sequence with {len(seq)} events to {sequence_file}")
    except Exception as e:
        print(f"❌ Failed to save sequence: {e}")

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

def playback_loop():
    global current_virtual_time, playback_index, last_real_time, is_autonomous
    last_real_time = time.time() * 1000.0
    
    while True:
        now = time.time() * 1000.0
        delta = now - last_real_time
        last_real_time = now
        
        if is_autonomous and len(current_sequence) > 0:
            current_virtual_time += delta
            
            # Find max time to loop
            max_t = 1000
            if len(current_sequence) > 0 and 't' in current_sequence[-1]:
                max_t = current_sequence[-1]['t']
            if max_t <= 0: max_t = 1000
                
            if current_virtual_time >= max_t:
                current_virtual_time = 0
                playback_index = 0
                
            # Process events up to current virtual time
            while playback_index < len(current_sequence) and current_sequence[playback_index]['t'] <= current_virtual_time:
                evt = current_sequence[playback_index]
                m = evt['m']
                v = evt['v']
                
                if m < 15:
                    cmd = f"M{m}:{v}"
                    if ser and ser.is_open:
                        try:
                            ser.write((cmd + '\n').encode())
                        except:
                            pass
                elif m == 21: # STOP ALL
                    if ser and ser.is_open:
                        try:
                            ser.write(("STOP\n").encode())
                        except:
                            pass
                playback_index += 1
                
        time.sleep(0.01) # 10ms loop

if __name__ == '__main__':
    connect_serial()
    
    # Run loops in background
    threading.Thread(target=status_loop, daemon=True).start()
    threading.Thread(target=playback_loop, daemon=True).start()
    
    print("🚀 Titan Bridge starting on http://0.0.0.0:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
