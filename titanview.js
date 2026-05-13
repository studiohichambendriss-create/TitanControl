const socket = io();
const motorColors = ['#FF3E3E', '#FF8A00', '#FFD600', '#00FF47', '#00F2FF', '#0085FF', '#7000FF', '#FF00C7', '#FF3E3E', '#FF8A00', '#FFD600', '#00FF47', '#00F2FF', '#0085FF', '#7000FF'];
let currentSequence = [];

// Initialize Grid
const grid = document.getElementById('motorGrid');
for (let i = 0; i < 15; i++) {
    const card = document.createElement('div');
    card.className = 'motor-card';
    card.id = `card-${i}`;
    card.style.background = 'rgba(255,255,255,0.02)';
    card.style.border = '1px solid rgba(255,255,255,0.05)';
    card.style.borderRadius = '12px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.padding = '15px';
    
    card.innerHTML = `
        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${motorColors[i]}; margin-bottom: 10px; box-shadow: 0 0 10px ${motorColors[i]}"></div>
        <h3 style="margin-bottom: 15px; font-family: 'Orbitron'; letter-spacing: 1px;">MOTOR ${i + 1}</h3>
        <input type="range" min="0" max="4095" value="0" class="fader" id="m${i}" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 40px; height: 200px;">
        <div class="speed-val" id="v${i}" style="margin-top: 15px; font-family: 'Orbitron'; font-weight: bold; color: ${motorColors[i]}">0</div>
    `;
    grid.appendChild(card);
}

function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSec = ms / 1000;
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    const msPart = Math.floor((ms % 1000) / 100);
    return `${m}:${s.toString().padStart(2, '0')}.${msPart}`;
}

socket.on('sync_time', (data) => {
    const t = data.t;
    const isPaused = data.is_paused;
    const delay = data.delay;
    const ip = data.ip;
    const isAuto = data.is_auto;
    
    if (ip) document.getElementById('hotspotIp').innerText = `IP: ${ip}`;
    
    const maxT = currentSequence.length > 0 ? currentSequence[currentSequence.length - 1].t : 0;
    
    document.getElementById('loopCurrent').innerText = formatTime(t);
    document.getElementById('loopTotal').innerText = formatTime(maxT);
    document.getElementById('delayVal').innerText = delay.toFixed(1) + 's';
    
    if (!isAuto) {
        document.getElementById('modeVal').innerText = 'REMOTE CONTROL';
        document.getElementById('modeVal').style.color = '#00f2ff';
    } else if (isPaused) {
        document.getElementById('modeVal').innerText = 'PAUSED';
        document.getElementById('modeVal').style.color = '#ff8a00';
    } else {
        document.getElementById('modeVal').innerText = 'AUTONOMOUS';
        document.getElementById('modeVal').style.color = '#00ff47';
    }
    
    if (maxT > 0) {
        const percent = Math.min(100, (t / (maxT + (delay * 1000))) * 100);
        document.getElementById('loopFill').style.width = percent + '%';
    }
});

socket.on('log', (msg) => {
    const content = document.getElementById('logContent');
    const div = document.createElement('div');
    div.style.padding = '2px 0';
    div.innerText = msg;
    content.prepend(div);
    if (content.childNodes.length > 25) {
        content.removeChild(content.lastChild);
    }
});

socket.on('command', (cmd) => {
    if (cmd.startsWith('M')) {
        const parts = cmd.substring(1).split(':');
        if (parts.length === 2) {
            const id = parseInt(parts[0]);
            const val = parseInt(parts[1]);
            if (id < 15) {
                const slider = document.getElementById(`m${id}`);
                const valDisp = document.getElementById(`v${id}`);
                if (slider) slider.value = val;
                if (valDisp) valDisp.innerText = val;
                
                // Visual feedback
                const card = document.getElementById(`card-${id}`);
                card.style.borderColor = motorColors[id];
                card.style.background = `${motorColors[id]}05`;
                setTimeout(() => {
                    card.style.borderColor = 'rgba(255,255,255,0.05)';
                    card.style.background = 'rgba(255,255,255,0.02)';
                }, 100);
            }
        }
    } else if (cmd === 'STOP') {
        for (let i = 0; i < 15; i++) {
            document.getElementById(`m${i}`).value = 0;
            document.getElementById(`v${i}`).innerText = 0;
        }
    }
});

lucide.createIcons();
