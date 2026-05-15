import os
file_path = '/home/aldo/TitanControl_Raspi/status_gui.py'
with open(file_path, 'r') as f:
    content = f.read()

content = content.replace("msg + '\\\\n'", "msg + '\\n'")
content = content.replace("started...\\\\n'", "started...\\n'")

with open(file_path, 'w') as f:
    f.write(content)
print("GUI patched successfully.")
