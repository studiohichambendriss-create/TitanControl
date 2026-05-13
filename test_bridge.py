import socketio
import sys
import json
import time

sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print("\n✅ [TEST] Connected to Titan Bridge!")

@sio.on('status')
def on_status(data):
    print(f"📡 [STATUS] Serial: {data.get('serial')} | Port: {data.get('port')}")

@sio.on('sync_data')
def on_sync(data):
    seq_len = len(data.get('sequence', []))
    print(f"📥 [SYNC] Received sequence with {seq_len} events.")

@sio.on('command')
def on_cmd(cmd):
    print(f"🤖 [COMMAND SENT TO ARDUINO] -> {cmd}")

def run():
    try:
        sio.connect('http://localhost:5000')
        print("\n--- TITAN BRIDGE TESTER ---")
        print("Type commands:")
        print("  'pause'  - Pause Pi Loop")
        print("  'resume' - Resume Pi Loop")
        print("  'test'   - Upload 2-second test sequence")
        print("  'exit'   - Stop testing")
        print("---------------------------\n")
        
        while True:
            cmd = input("TESTER > ").strip().lower()
            if not cmd: continue
            
            if cmd == 'pause':
                sio.emit('set_autonomous_pause', True)
                print("⏸️  Sent Pause...")
            elif cmd == 'resume':
                sio.emit('set_autonomous_pause', False)
                print("▶️  Sent Resume...")
            elif cmd == 'test':
                # Simple test sequence: Motor 0 pulse
                seq = [
                    {'t': 0, 'm': 0, 'v': 0},
                    {'t': 500, 'm': 0, 'v': 2048},
                    {'t': 1000, 'm': 0, 'v': 4095},
                    {'t': 1500, 'm': 0, 'v': 2048},
                    {'t': 2000, 'm': 0, 'v': 0}
                ]
                sio.emit('upload_sequence', {'sequence': seq, 'delay': 1.5})
                print("📤 Sent 2s test sequence (1.5s delay)...")
            elif cmd == 'exit':
                break
            else:
                print(f"❓ Unknown command: {cmd}")
                
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if sio.connected:
            sio.disconnect()

if __name__ == '__main__':
    run()
