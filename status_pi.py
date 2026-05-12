import time
import os
import serial.tools.list_ports
import socket

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def find_arduino():
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        if "Arduino" in p.description or "ACM" in p.device or "USB" in p.device:
            return p.device
    return None

def main():
    while True:
        os.system('clear')
        print("🛸 TITAN 15: RASPI STATUS OVERZICHT")
        print("="*40)
        
        ip = get_ip()
        print(f"🌐 WIFI IP:   {ip}")
        print(f"📡 WIFI AP:   {'ACTIVE (Check Phone/Laptop)' if ip.startswith('192.168.4') else 'NOT IN AP MODE'}")
        
        port = find_arduino()
        if port:
            print(f"🔌 ARDUINO:   CONNECTED on {port}")
        else:
            print(f"🔌 ARDUINO:   NOT FOUND! Check cable.")
            
        print("-" * 40)
        print("HOW TO USE:")
        print(f"1. Connect laptop to Pi WiFi")
        print(f"2. Open browser to http://{ip}:5000")
        print("-" * 40)
        print("PRESS CTRL+C TO EXIT")
        
        time.sleep(2)

if __name__ == "__main__":
    main()
