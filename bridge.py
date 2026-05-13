from flask import Flask, send_from_directory, request
from flask_socketio import SocketIO
import serial
import serial.tools.list_ports
import threading
import time
import os
import json
import subprocess

_cached_ip = None
_last_ip_check = 0

def get_wlan_ip():
    global _cached_ip, _last_ip_check
    now = time.time()
    if _cached_ip and (now - _last_ip_check) < 60:
        return _cached_ip
    try:
        output = subprocess.check_output(['ip', '-4', 'addr', 'show', 'wlan0']).decode()
        for line in output.split('\n'):
            if 'inet ' in line:
                _cached_ip = line.strip().split()[1].split('/')[0]
                _last_ip_check = now
                return _cached_ip
    except:
        pass
    return "0.0.0.0"

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
autonomous_paused = False
loop_delay_ms = 0

def load_sequence():
    global current_sequence, loop_delay_ms
    if os.path.exists(sequence_file):
        try:
            with open(sequence_file, 'r') as f:
                data = json.load(f)
                if isinstance(data, dict) and 'sequence' in data:
                    current_sequence = data['sequence']
                    loop_delay_ms = data.get('delay', 0) * 1000
                else:
                    current_sequence = data
                print(f"Loaded sequence with {len(current_sequence)} events. Loop Delay: {loop_delay_ms}ms")
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

@app.route('/titanview')
def titanview():
    return send_from_directory('.', 'titanview.html')

@socketio.on('connect')
def handle_connect():
    global connected_clients, is_autonomous, current_sequence, current_virtual_time
    
    client_ip = request.remote_addr
    is_local = client_ip.startswith('127.') or client_ip == '::1' or client_ip == 'localhost' or client_ip == get_wlan_ip()
    
    if not is_local:
        connected_clients += 1
        is_autonomous = False # Laptop connected, give it control
        print(f"💻 Laptop connected ({client_ip}). Autonomous playback PAUSED.")
    else:
        print(f"🖥️ Local Pi screen connected ({client_ip}). Autonomous playback continues.")
    
    status = "CONNECTED" if ser and ser.is_open else "OFFLINE"
    socketio.emit('status', {'serial': status, 'port': SERIAL_PORT})
    
    # Emit sync data so the UI (local or remote) can show the current state
    socketio.emit('sync_data', {
        'sequence': current_sequence,
        'current_time': current_virtual_time
    })

@socketio.on('disconnect')
def handle_disconnect():
    global connected_clients, is_autonomous
    
    client_ip = request.remote_addr
    is_local = client_ip.startswith('127.') or client_ip == '::1' or client_ip == 'localhost' or client_ip == get_wlan_ip()
    
    if not is_local:
        connected_clients -= 1
        if connected_clients <= 0:
            connected_clients = 0
            is_autonomous = True
            print("💻 Laptop disconnected. Autonomous playback RESUMED.")
    else:
        print(f"🖥️ Local Pi screen disconnected ({client_ip}).")

@socketio.on('upload_sequence')
def handle_upload(data):
    global current_sequence, current_virtual_time, playback_index, loop_delay_ms
    
    if isinstance(data, dict) and 'sequence' in data:
        seq = data['sequence']
        loop_delay_ms = data.get('delay', 0) * 1000
    else:
        seq = data
        
    current_sequence = seq
    current_virtual_time = 0
    playback_index = 0
    try:
        with open(sequence_file, 'w') as f:
            json.dump({'sequence': seq, 'delay': loop_delay_ms / 1000}, f)
        print(f"✅ Saved new sequence with {len(seq)} events. Delay: {loop_delay_ms}ms")
        # Tell all UI clients about the new sequence immediately!
        socketio.emit('sync_data', {
            'sequence': current_sequence,
            'current_time': current_virtual_time
        })
    except Exception as e:
        print(f"❌ Failed to save sequence: {e}")

@socketio.on('set_autonomous_pause')
def handle_autonomous_pause(is_paused):
    global autonomous_paused
    autonomous_paused = is_paused
    print(f"Autonomous playback paused state set to: {is_paused}")

@socketio.on('command')
def handle_command(cmd):
    global ser
    print(f"📡 [REMOTE] Received Command: {cmd}")
    if ser and ser.is_open:
        try:
            ser.write((cmd + '\n').encode())
        except:
            print("❌ Write failed, reconnecting...")
            connect_serial()
    else:
        # Ghost mode for testing without hardware
        msg = f"🛠️ [VIRTUAL ARDUINO] Executing: {cmd}"
        print(msg)
        socketio.emit('log', msg)

def status_loop():
    while True:
        port = find_arduino()
        status = "ONLINE" if port and ser and ser.is_open else "OFFLINE"
        socketio.emit('status', {'serial': status, 'port': port})
        time.sleep(2)

def sync_loop():
    while True:
        # Emit time to all clients for UI sync
        socketio.emit('sync_time', {
            't': current_virtual_time,
            'is_paused': autonomous_paused,
            'is_auto': is_autonomous,
            'delay': loop_delay_ms / 1000.0,
            'ip': get_wlan_ip()
        })
        time.sleep(0.1) # 10Hz sync

def playback_loop():
    global current_virtual_time, playback_index, last_real_time, is_autonomous, autonomous_paused, loop_delay_ms
    last_real_time = time.time() * 1000.0
    
    while True:
        now = time.time() * 1000.0
        delta = now - last_real_time
        last_real_time = now
        
        if is_autonomous and not autonomous_paused and len(current_sequence) > 0:
            current_virtual_time += delta
            
            # Find max time to loop
            max_t = 1000
            if len(current_sequence) > 0 and 't' in current_sequence[-1]:
                max_t = current_sequence[-1]['t']
            if max_t <= 0: max_t = 1000
                
            if current_virtual_time >= max_t + loop_delay_ms:
                current_virtual_time = 0
                playback_index = 0
                
            if current_virtual_time < max_t:
                # Process events up to current virtual time
                while playback_index < len(current_sequence) and current_sequence[playback_index]['t'] <= current_virtual_time:
                    evt = current_sequence[playback_index]
                    m = evt['m']
                    v = evt['v']
                    
                    if m < 15:
                        cmd = f"M{m}:{v}"
                        socketio.emit('command', cmd)
                        if ser and ser.is_open:
                            try:
                                ser.write((cmd + '\n').encode())
                                msg = f"🤖 [LOOP] Sent: {cmd}"
                                print(msg)
                                socketio.emit('log', msg)
                            except:
                                pass
                        else:
                            msg = f"🤖 [VIRTUAL LOOP] Sent: {cmd}"
                            print(msg)
                            socketio.emit('log', msg)
                    elif m == 21: # STOP ALL
                        socketio.emit('command', 'STOP')
                        if ser and ser.is_open:
                            try:
                                ser.write(("STOP\n").encode())
                                msg = "🤖 [LOOP] Sent: STOP"
                                print(msg)
                                socketio.emit('log', msg)
                            except:
                                pass
                        else:
                            msg = "🤖 [VIRTUAL LOOP] Sent: STOP"
                            print(msg)
                            socketio.emit('log', msg)
                    playback_index += 1
                
        time.sleep(0.01) # 10ms loop

if __name__ == '__main__':
    connect_serial()
    
    # Run loops in background
    threading.Thread(target=status_loop, daemon=True).start()
    threading.Thread(target=playback_loop, daemon=True).start()
    threading.Thread(target=sync_loop, daemon=True).start()
    
    print("🚀 Titan Bridge starting on http://0.0.0.0:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
