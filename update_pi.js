const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

// 1. Add connection logic for bridge
const bridgeLogic = `
const connectBridgeBtn = document.getElementById('connectBridgeBtn');
const piIpInput = document.getElementById('piIp');

// Load saved IP
piIpInput.value = localStorage.getItem('titan_pi_ip') || '';

connectBridgeBtn.onclick = () => {
    const ip = piIpInput.value.trim();
    if (!ip) {
        alert("PLEASE ENTER PI IP");
        return;
    }
    
    localStorage.setItem('titan_pi_ip', ip);
    
    if (socket) {
        socket.disconnect();
    }
    
    // Connect to Pi Bridge on port 5000 (typical for bridge.py)
    socket = io(\`http://\${ip}:5000\`, {
        transports: ['websocket'],
        upgrade: false
    });
    
    connectBridgeBtn.innerText = "CONNECTING...";
    connectBridgeBtn.style.background = "#ff8a00";
    
    socket.on('connect', () => {
        console.log("CONNECTED TO PI BRIDGE");
        connectBridgeBtn.innerText = "PI CONNECTED";
        connectBridgeBtn.style.background = "#00ff47";
        statusIndicator.innerText = "BRIDGE ONLINE";
        statusIndicator.style.background = "#00ff47";
    });
    
    socket.on('disconnect', () => {
        console.log("DISCONNECTED FROM PI BRIDGE");
        connectBridgeBtn.innerText = "CONNECT PI";
        connectBridgeBtn.style.background = "var(--primary)";
        statusIndicator.innerText = "OFFLINE";
        statusIndicator.style.background = "#ff3e3e";
    });
    
    socket.on('connect_error', (err) => {
        console.error("BRIDGE CONNECTION ERROR:", err);
        alert("COULD NOT CONNECT TO PI. IS bridge.py RUNNING?");
        connectBridgeBtn.innerText = "CONNECT PI";
        connectBridgeBtn.style.background = "var(--primary)";
    });
};
`;

// Insert after newSeqBtn logic
content = content.replace(/if \(newSeqBtn\) \{[\s\S]*?\}\n\}/, (match) => match + "\n" + bridgeLogic);

// 2. Update sendCommand to emit via socket
const newSendCommand = `async function sendCommand(cmd) {
    if (writer) {
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(cmd + '\\n'));
    }
    if (socket && socket.connected) {
        socket.emit('command', cmd);
    }
}`;

content = content.replace(/async function sendCommand\(cmd\) \{[\s\S]*?\}/, newSendCommand);

fs.writeFileSync('app.js', content);
