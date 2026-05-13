import tkinter as tk
from tkinter import ttk
import socket
import serial.tools.list_ports
import threading
import time
import os
import subprocess

class TitanStatusApp:
    def __init__(self, root):
        self.root = root
        self.root.title("TITAN 15: RASPI BRIDGE")
        self.root.geometry("600x450")
        self.root.configure(bg='#0a0b10')
        
        # Style
        self.style = ttk.Style()
        self.style.theme_use('clam')
        
        # Header
        self.header = tk.Label(root, text="🛸 TITAN 15: SYSTEM STATUS", font=("Orbitron", 20, "bold"), 
                              bg='#0a0b10', fg='#00f2ff', pady=20)
        self.header.pack()

        # Status Container
        self.status_frame = tk.Frame(root, bg='#0a0b10')
        self.status_frame.pack(pady=10, fill='x', padx=50)

        # WiFi Status
        self.wifi_label = tk.Label(self.status_frame, text="🌐 WIFI AP:", font=("Inter", 14), bg='#0a0b10', fg='white')
        self.wifi_label.grid(row=0, column=0, sticky='w', pady=5)
        self.wifi_val = tk.Label(self.status_frame, text="STARTING...", font=("Inter", 14, "bold"), bg='#0a0b10', fg='#ff3e3e')
        self.wifi_val.grid(row=0, column=1, sticky='w', padx=20)

        # IP Status
        self.ip_label = tk.Label(self.status_frame, text="📍 BRIDGE IP:", font=("Inter", 14), bg='#0a0b10', fg='white')
        self.ip_label.grid(row=1, column=0, sticky='w', pady=5)
        self.ip_val = tk.Label(self.status_frame, text="0.0.0.0", font=("Inter", 14, "bold"), bg='#0a0b10', fg='#00f2ff')
        self.ip_val.grid(row=1, column=1, sticky='w', padx=20)

        # Arduino Status
        self.ard_label = tk.Label(self.status_frame, text="🔌 ARDUINO:", font=("Inter", 14), bg='#0a0b10', fg='white')
        self.ard_label.grid(row=2, column=0, sticky='w', pady=5)
        self.ard_val = tk.Label(self.status_frame, text="OFFLINE", font=("Inter", 14, "bold"), bg='#0a0b10', fg='#ff3e3e')
        self.ard_val.grid(row=2, column=1, sticky='w', padx=20)

        # Live Log
        self.log_label = tk.Label(root, text="LIVE TELEMETRY:", font=("Inter", 10, "bold"), bg='#0a0b10', fg='#505050')
        self.log_label.pack(pady=(20, 0), padx=50, anchor='w')
        
        self.log_box = tk.Text(root, height=8, bg='#050508', fg='#00ff47', font=("Consolas", 10), 
                              borderwidth=1, relief='solid', padx=10, pady=10)
        self.log_box.pack(padx=50, pady=5, fill='both', expand=True)

        # Footer
        self.footer = tk.Label(root, text="CONNECT LAPTOP TO 'TitanBridge' -> http://[IP]:5000", 
                               font=("Inter", 10), bg='#0a0b10', fg='#a0a0a0', pady=20)
        self.footer.pack()

        # Start Update Thread
        threading.Thread(target=self.update_loop, daemon=True).start()
        
        # Tail bridge.log for live telemetry
        threading.Thread(target=self.tail_log, daemon=True).start()

    def get_ips(self):
        ips = []
        try:
            output = subprocess.check_output(['hostname', '-I']).decode()
            ips = output.strip().split()
        except:
            pass
        return ips
        
    def get_wlan_ip(self):
        try:
            output = subprocess.check_output(['ip', '-4', 'addr', 'show', 'wlan0']).decode()
            for line in output.split('\n'):
                if 'inet ' in line:
                    return line.strip().split()[1].split('/')[0]
        except:
            pass
        return None

    def find_arduino(self):
        ports = list(serial.tools.list_ports.comports())
        for p in ports:
            if "Arduino" in p.description or "ACM" in p.device or "USB" in p.device:
                return p.device
        return None

    def update_loop(self):
        while True:
            ips = self.get_ips()
            port = self.find_arduino()
            wlan_ip = self.get_wlan_ip()

            self.root.after(0, self.update_ui, ips, wlan_ip, port)
            time.sleep(2)

    def update_ui(self, ips, wlan_ip, port):
        # Determine AP status
        is_ap = wlan_ip is not None and (wlan_ip.startswith('192.168.4') or wlan_ip.startswith('10.42'))
        display_ip = wlan_ip if wlan_ip else (ips[0] if ips else "127.0.0.1")
        
        self.ip_val.config(text=display_ip)
        
        if is_ap or os.path.exists('/sys/class/net/wlan0'):
            # Check if hotspot connection is active via nmcli
            try:
                res = subprocess.check_output(['nmcli', '-t', '-f', 'NAME,DEVICE,STATE', 'con', 'show', '--active']).decode()
                if "TitanHotspot" in res or "Hotspot" in res:
                    self.wifi_val.config(text="ACTIVE (TitanBridge)", fg='#00ff47')
                else:
                    self.wifi_val.config(text="WIFI READY", fg='#ff8a00')
            except:
                self.wifi_val.config(text="WIFI ON", fg='#00ff47')
        else:
            self.wifi_val.config(text="OFFLINE", fg='#ff3e3e')
        
        if port:
            self.ard_val.config(text=f"CONNECTED ({port})", fg='#0085ff')
        else:
            self.ard_val.config(text="NOT FOUND", fg='#ff3e3e')

    def tail_log(self):
        # Create log file if it doesn't exist
        log_path = "/home/aldo/TitanControl_Raspi/bridge.log"
        if not os.path.exists(log_path):
            with open(log_path, 'w') as f: f.write("Bridge log started...\n")
            
        process = subprocess.Popen(['tail', '-f', log_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        for line in process.stdout:
            # Show important robot talk
            if any(x in line for x in ["M", "Connected", "LOOP", "VIRTUAL", "Executing", "Sent"]):
                self.root.after(0, self.add_log, line.strip())

    def add_log(self, msg):
        self.log_box.insert(tk.END, msg + "\n")
        self.log_box.see(tk.END)
        # Pulse effect
        self.header.config(fg='#ffffff')
        self.root.after(100, lambda: self.header.config(fg='#00f2ff'))

if __name__ == "__main__":
    root = tk.Tk()
    app = TitanStatusApp(root)
    root.mainloop()
