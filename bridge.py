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
LOG_FILE = 'bridge.log'

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
SERIAL_PORT = None
BAUD_RATE = 115200

# Playback State
current_sequence = []
is_autonomous = True
connected_clients = 0
current_virtual_time = 0.0
playback_index = 0
last_real_time = 0.0
sequence_file = 'sequence.json'
autonomous_paused = True
loop_delay_ms = 0
current_motor_states = [0] * 15

def log(msg):
    timestamp = time.strftime('%H:%M:%S')
    full_msg = f'[{timestamp}] {msg}'
    print(full_msg)
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(full_msg + '\n')
    except:
        pass
    socketio.emit('log', full_msg)

def stop_motors():
    global ser
    log('⏹️ Stopping all motors...')
    if ser and ser.is_open:
        try:
            ser.write(b'STOP\n')
            for i in range(15):
                ser.write(f'M{i}:0\n'.encode())
        except Exception as e:
            log(f'❌ Failed to send STOP: {e}')
    else:
        log('🛠️ [VIRTUAL] STOP all motors')

def resume_motors():
    global ser
    log('▶️ Restoring motor states before resume...')
    if ser and ser.is_open:
        try:
            for i in range(15):
                if current_motor_states[i] > 0:
                    ser.write(f'M{i}:{current_motor_states[i]}\n'.encode())
                    time.sleep(0.01)
        except Exception as e:
            log(f'❌ Failed to send resume states: {e}')
    else:
        log('🛠️ [VIRTUAL] Restoring motor states')

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
                log(f'Loaded sequence with {len(current_sequence)} events. Loop Delay: {loop_delay_ms}ms')
        except Exception as e:
            log(f'Error loading sequence: {e}')

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
            log(f'✅ Connected to Arduino on {SERIAL_PORT}')
            return True
        except Exception as e:
            log(f'❌ Serial Error: {e}')
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

@app.route('/clear')
def clear_loop():
    global current_sequence, autonomous_paused, is_autonomous, playback_index
    current_sequence = []
    autonomous_paused = True
    is_autonomous = False
    playback_index = 0
    stop_motors()
    try:
        if os.path.exists(sequence_file):
            os.remove(sequence_file)
    except:
        pass
    log('🧹 PILOOP CLEARED')
    return '🧹 CLEARED'

@app.route('/play')
def play_loop():
    global autonomous_paused, is_autonomous
    autonomous_paused = False
    is_autonomous = True
    log('▶️ Piloop Started via HTTP')
    return '▶️ Playback Started'

@app.route('/pause')
def pause_loop():
    global autonomous_paused
    autonomous_paused = True
    stop_motors()
    log('⏸️ Piloop Paused via HTTP')
    return '⏸️ Playback Paused'

@socketio.on('connect')
def handle_connect():
    global connected_clients, is_autonomous, current_sequence, current_virtual_time
    client_ip = request.remote_addr
    is_local = client_ip.startswith('127.') or client_ip == '::1' or client_ip == 'localhost' or client_ip == get_wlan_ip()
    
    if not is_local:
        connected_clients += 1
        is_autonomous = False
        log(f'💻 Laptop connected ({client_ip}). Master Mode Active.')
    else:
        log(f'🖥️ Local Pi screen connected ({client_ip}).')
    
    status = "CONNECTED" if ser and ser.is_open else "OFFLINE"
    socketio.emit('status', {'serial': status, 'port': SERIAL_PORT})
    socketio.emit('sync_data', {'sequence': current_sequence, 'current_time': current_virtual_time})

@socketio.on('disconnect')
def handle_disconnect():
    global connected_clients, is_autonomous, autonomous_paused
    client_ip = request.remote_addr
    is_local = client_ip.startswith('127.') or client_ip == '::1' or client_ip == 'localhost' or client_ip == get_wlan_ip()
    if not is_local:
        connected_clients -= 1
        if connected_clients <= 0:
            connected_clients = 0
            is_autonomous = True
            if len(current_sequence) > 0:
                autonomous_paused = False
                log('💻 Laptop disconnected. RESUMING Autonomous Playback.')
            else:
                log('💻 Laptop disconnected. Autonomous Mode Active (Empty).')

@socketio.on('upload_sequence')
def handle_upload(data):
    global current_sequence, current_virtual_time, playback_index, loop_delay_ms, autonomous_paused
    if isinstance(data, dict) and 'sequence' in data:
        seq = data['sequence']
        loop_delay_ms = data.get('delay', 0) * 1000
    else:
        seq = data
    current_sequence = seq
    current_virtual_time = 0
    playback_index = 0
    autonomous_paused = True
    try:
        with open(sequence_file, 'w') as f:
            json.dump({'sequence': seq, 'delay': loop_delay_ms / 1000}, f)
        log(f'✅ New sequence uploaded ({len(seq)} events). READY.')
        socketio.emit('sync_data', {'sequence': current_sequence, 'current_time': current_virtual_time})
    except Exception as e:
        log(f'❌ Failed to save sequence: {e}')

@socketio.on('control_piloop')
def handle_piloop_control(data):
    global is_autonomous, autonomous_paused, playback_index, current_virtual_time
    action = data.get('action')
    if action == 'start':
        is_autonomous = True
        autonomous_paused = False
        playback_index = 0
        current_virtual_time = 0
        log('▶️ PILOOP STARTED')
    elif action == 'stop':
        is_autonomous = False
        autonomous_paused = True
        stop_motors()
        log('⏹️ PILOOP STOPPED')
    elif action == 'pause':
        autonomous_paused = True
        stop_motors()
        log('⏸️ PILOOP PAUSED')
    elif action == 'resume':
        resume_motors()
        autonomous_paused = False
        log('▶️ PILOOP RESUMED')

@socketio.on('command')
def handle_command(cmd):
    global ser
    log(f'📡 [MASTER] Received: {cmd}')
    if cmd.startswith('M'):
        try:
            parts = cmd[1:].split(':')
            m, v = int(parts[0]), int(parts[1])
            if m < 15:
                current_motor_states[m] = v
        except:
            pass
    
    if ser and ser.is_open:
        try:
            ser.write((cmd + '\n').encode())
        except:
            log('❌ Write failed, reconnecting...')
            connect_serial()
    else:
        log(f'🛠️ [VIRTUAL] Executing: {cmd}')

def status_loop():
    while True:
        port = find_arduino()
        status = "ONLINE" if port and ser and ser.is_open else "OFFLINE"
        socketio.emit('status', {'serial': status, 'port': port})
        time.sleep(2)

def sync_loop():
    while True:
        socketio.emit('sync_time', {'t': current_virtual_time, 'is_paused': autonomous_paused, 'is_auto': is_autonomous, 'delay': loop_delay_ms / 1000.0, 'ip': get_wlan_ip()})
        time.sleep(0.1)

def playback_loop():
    global current_virtual_time, playback_index, last_real_time, is_autonomous, autonomous_paused, loop_delay_ms
    last_real_time = time.time() * 1000.0
    while True:
        now = time.time() * 1000.0
        delta = now - last_real_time
        last_real_time = now
        if is_autonomous and not autonomous_paused and len(current_sequence) > 0:
            current_virtual_time += delta
            max_t = 1000
            if len(current_sequence) > 0 and 't' in current_sequence[-1]:
                max_t = current_sequence[-1]['t']
            if max_t <= 0: max_t = 1000
            if current_virtual_time >= max_t + loop_delay_ms:
                current_virtual_time = 0
                playback_index = 0
                log('🔄 Loop Restart')
            if current_virtual_time < max_t:
                while playback_index < len(current_sequence) and current_sequence[playback_index]['t'] <= current_virtual_time:
                    evt = current_sequence[playback_index]
                    m, v = evt['m'], evt['v']
                    if m < 15:
                        current_motor_states[m] = v
                        cmd = f"M{m}:{v}"
                        if ser and ser.is_open:
                            try:
                                ser.write((cmd + '\n').encode())
                                log(f'🤖 [LOOP] {cmd}')
                            except: pass
                        else: log(f'🤖 [VIRTUAL LOOP] {cmd}')
                    elif m == 21:
                        if ser and ser.is_open:
                            try:
                                ser.write(b"STOP\n")
                                log('🤖 [LOOP] STOP')
                            except: pass
                        else: log('🤖 [VIRTUAL LOOP] STOP')
                    playback_index += 1
        time.sleep(0.01)

if __name__ == '__main__':
    connect_serial()
    threading.Thread(target=status_loop, daemon=True).start()
    threading.Thread(target=playback_loop, daemon=True).start()
    threading.Thread(target=sync_loop, daemon=True).start()
    log(f'🚀 Titan Bridge starting on http://{get_wlan_ip()}:5000')
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
