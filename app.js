let draggedNode = null;
let port;
let writer;
let socket; // Bridge socket

window.onload = () => {
    document.getElementById('loader').style.opacity = '0';
    setTimeout(() => document.getElementById('loader').remove(), 500);
};
let motors = Array(15).fill(0);
let targetMotors = Array(15).fill(0);
let isRecording = false;
let isPaused = false;
let isPlaying = false;
let startTime = 0;
let pauseStartTime = 0;
let totalPausedTime = 0;
let recording = [];
let playbackIndex = 0;
let playStartTime = 0;
let playbackTimeout;
let virtualTime = 0;
let lastRealTime = 0;
let patternInterval;

const motorGrid = document.getElementById('motorGrid');
const connectBtn = document.getElementById('connectBtn');
const statusIndicator = document.getElementById('connectionStatus');
const recordBtn = document.getElementById('recordBtn');
const stopPlaybackBtn = document.getElementById('stopPlaybackBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const recordTimer = document.getElementById('recordTimer');

let isSaved = true;

const clearSeqBtn = document.getElementById('clearSeqBtn');
if (clearSeqBtn) {
    clearSeqBtn.onclick = () => {
        if (!isSaved && recording.length > 0) {
            if (confirm("Do you want to SAVE this recording before removing? (Click OK to save, Cancel to discard)")) {
                document.getElementById('exportBtn').click();
            }
        }
        if (isRecording) startStopRecording();
        recording = [];
        renderSequencer();
        document.getElementById('timelineScrubber').value = 0;
        document.getElementById('timelineScrubber').max = 0;
        document.getElementById('timelineCurrent').innerText = "00:00";
        document.getElementById('timelineTotal').innerText = "00:00";
        playBtn.disabled = true;
        stopPlaybackBtn.disabled = true;
        virtualTime = 0;
        playbackIndex = 0;
        isSaved = true;
        
        // Remove svg playhead
        const playhead = document.getElementById('svg-playhead');
        if (playhead) playhead.remove();
    };
}

const timelineScrubber = document.getElementById('timelineScrubber');
timelineScrubber.oninput = (e) => {
    if (isRecording || recording.length === 0) return;
    
    // Stop playback if playing
    if (isPlaying) {
        isPlaying = false;
        playBtn.innerHTML = '<i data-lucide="play"></i> PLAY';
        lucide.createIcons();
    }
    
    virtualTime = parseFloat(e.target.value);
    document.getElementById('timelineCurrent').innerText = formatTimeShort(virtualTime);
    
    // Update SVG playhead
    const svgPlayhead = document.getElementById('svg-playhead');
    if (svgPlayhead) {
        const svg = svgPlayhead.parentElement;
        if (svg) {
            const maxT = recording[recording.length - 1].t || 1000;
            const x = (virtualTime / maxT) * svg.clientWidth;
            svgPlayhead.setAttribute('x1', x);
            svgPlayhead.setAttribute('x2', x);
        }
    }
    
    // Fast-forward to state
    applyStateAtTime(virtualTime);
};

function applyStateAtTime(t) {
    // Find latest state for each parameter before or at time t
    let state = {};
    for (let i = 0; i < recording.length; i++) {
        if (recording[i].t > t) break;
        state[recording[i].m] = recording[i].v;
        playbackIndex = i + 1; // Update playback index for resume
    }
    
    // Apply state
    Object.keys(state).forEach(mStr => {
        const m = parseInt(mStr);
        const v = state[m];
        if (m < 15) {
            setMotor(m, v, true);
        } else {
            if (m === 15) {
                let patName = '';
                if (v === 1000) patName = 'chaos';
                else if (v === 2000) patName = 'wave';
                else if (v === 3000) patName = 'pulse';
                else if (v === 4000) patName = 'ramp';
                if (patName) {
                    const btn = document.querySelector(`.pattern-btn[data-pattern="${patName}"]`);
                    if (btn && !btn.classList.contains('active')) btn.click();
                } else {
                    stopPattern();
                }
            } else if (m === 16) { document.getElementById('p_speed').value = v / 40.95; }
            else if (m === 17) { document.getElementById('p_power').value = v; }
            else if (m === 18) { document.getElementById('p_spread').value = v / 40.95; }
            else if (m === 19) { document.getElementById('p_chaos').value = v / 40.95; }
            else if (m === 20) { document.getElementById('p_chaos_lerp_speed').value = v / 40.95; }
            
            // Trigger input events so any UI listeners (like number values next to sliders) update
            if (m >= 16 && m <= 20) {
                let id = '';
                if (m === 16) id = 'p_speed';
                if (m === 17) id = 'p_power';
                if (m === 18) id = 'p_spread';
                if (m === 19) id = 'p_chaos';
                if (m === 20) id = 'p_chaos_lerp_speed';
                if (id) document.getElementById(id).dispatchEvent(new Event('input'));
            }
        }
    });
}




const exportBtn = document.getElementById('exportBtn');

let midiMap = JSON.parse(localStorage.getItem('titan_v2_midi_map') || '{}');
let isMappingMode = false;
let selectedMotorId = null;
let lastMidiPort = localStorage.getItem('titan_midi_port');
let midiAccess = null;
let hoveredMotorIds = new Set();
let hoverMidiSignal = localStorage.getItem('titan_hover_midi');
let hoveredMotorId = null;
let isMappingHover = false;
let systemMidiMap = JSON.parse(localStorage.getItem('titan_system_midi') || '{}');
let isMappingRecorder = false;
let hoveredAction = null;
let pianoHoverMidiSignal = localStorage.getItem('titan_piano_hover_midi');
let isMappingPianoHover = false;

const motorColors = [
    '#FF3E3E', '#FF8A00', '#FFD600', '#A3FF00', '#00FF47', 
    '#00FFB2', '#00F2FF', '#0085FF', '#2900FF', '#9E00FF', 
    '#FF00D6', '#FF005C', '#FFFFFF', '#A0A0A0', '#505050',
    '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4'
];

// No global midiMapBtn anymore

// Initialize Motors
for (let i = 0; i < 15; i++) {
    const card = document.createElement('div');
    card.className = 'motor-card';
    card.id = `card-${i}`;
    card.onmouseenter = () => {
        hoveredMotorId = i;
        targetMotors[i] = motors[i]; // Sync target on hover
        if (document.getElementById('hoverModeToggle').checked) {
            card.classList.add('hover-active');
        }
    };
    card.onmouseleave = () => {
        if (hoveredMotorId === i) {
            if (document.getElementById('hoverModeToggle').checked && document.getElementById('hoverResetToggle').checked) {
                if (document.getElementById('hoverLerpResetToggle').checked) {
                    targetMotors[i] = 0;
                } else {
                    setMotor(i, 0);
                    targetMotors[i] = 0;
                }
            }
            card.classList.remove('hover-active');
            hoveredMotorId = null;
        }
    };
    card.innerHTML = `
        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${motorColors[i]}; margin-bottom: 2px;"></div>
        <h3>MOTOR ${i + 1}</h3>
        <input type="range" min="0" max="4095" value="0" id="m${i}" class="fader">
        <div class="speed-val" id="v${i}">0</div>
        <button class="midi-btn" id="midi-btn-${i}" onclick="toggleMidiMap(${i})">NONE</button>
    `;
    motorGrid.appendChild(card);

    const slider = card.querySelector('input');
    slider.oninput = (e) => {
        const val = parseInt(e.target.value);
        setMotor(i, val);
    };
    
    updateMidiButtonText(i);
}
updateMidiUI(); 
updateHoverMappingUI();

function saveSettings() {
    const settings = {
        sessionName: document.getElementById('recordName').value,
        piano: document.getElementById('pianoModeToggle').checked,
        pianoHover: document.getElementById('pianoHoverToggle').checked,
        lerp: document.getElementById('pianoLerpToggle').checked,
        speed: document.getElementById('pianoLerpSpeed').value,
        autoCC: document.getElementById('autoMapCCToggle').checked,
        hover: document.getElementById('hoverModeToggle').checked,
        hoverReset: document.getElementById('hoverResetToggle').checked,
        pianoHoverReset: document.getElementById('pianoHoverResetToggle').checked,
        hoverLerpReset: document.getElementById('hoverLerpResetToggle').checked,
        hoverLerpSpeed: document.getElementById('hoverLerpSpeed').value,
        pianoHoverLerpReset: document.getElementById('pianoHoverLerpResetToggle').checked,
        pianoHoverLerpSpeed: document.getElementById('pianoHoverLerpSpeed').value,
        autoSave: document.getElementById('autoSaveToggle').checked
    };
    localStorage.setItem('titan_settings', JSON.stringify(settings));
}

function loadSettings() {
    const s = JSON.parse(localStorage.getItem('titan_settings') || '{}');
    if (s.sessionName !== undefined) document.getElementById('recordName').value = s.sessionName;
    if (s.autoSave !== undefined) document.getElementById('autoSaveToggle').checked = s.autoSave;
    
    // Hardware toggles reset on refresh
    document.getElementById('pianoModeToggle').checked = false;
    document.getElementById('pianoHoverToggle').checked = false;
    document.getElementById('hoverModeToggle').checked = false;
    document.getElementById('pianoHoverResetToggle').checked = false;
    document.getElementById('hoverResetToggle').checked = false;
    document.getElementById('pianoHoverLerpResetToggle').checked = false;
    document.getElementById('hoverLerpResetToggle').checked = false;
    document.getElementById('pianoLerpToggle').checked = false;
    document.getElementById('autoMapCCToggle').checked = false;

    // Load sliders/speeds (still persistent)
    if (s.speed !== undefined) {
        document.getElementById('pianoLerpSpeed').value = s.speed;
        document.getElementById('lerpSpeedVal').innerText = s.speed;
    }
    if (s.hoverLerpSpeed !== undefined) {
        document.getElementById('hoverLerpSpeed').value = s.hoverLerpSpeed;
        document.getElementById('hoverLerpVal').innerText = s.hoverLerpSpeed;
    }
    if (s.pianoHoverLerpSpeed !== undefined) {
        document.getElementById('pianoHoverLerpSpeed').value = s.pianoHoverLerpSpeed;
        document.getElementById('pianoHoverLerpVal').innerText = s.pianoHoverLerpSpeed;
    }

    // Trigger UI updates to hide panels
    document.getElementById('pianoModeToggle').dispatchEvent(new Event('change'));
    document.getElementById('hoverModeToggle').dispatchEvent(new Event('change'));
    document.getElementById('pianoHoverToggle').dispatchEvent(new Event('change'));
    document.getElementById('hoverResetToggle').dispatchEvent(new Event('change'));
    document.getElementById('pianoHoverResetToggle').dispatchEvent(new Event('change'));
}

loadSettings();

function updateHoverMappingUI() {
    const status = document.getElementById('hoverMidiStatus');
    if (status) status.innerText = hoverMidiSignal || 'NONE';
    
    const pianoStatus = document.getElementById('pianoHoverMidiStatus');
    if (pianoStatus) pianoStatus.innerText = pianoHoverMidiSignal || 'NONE';
    
    const btn = document.getElementById('mapHoverMidiBtn');
    if (btn) {
        if (isMappingHover) {
            btn.classList.add('active');
            btn.innerText = "MOVE MIDI NOW...";
        } else {
            btn.classList.remove('active');
            btn.innerText = `MAP HOVER MIDI: ${hoverMidiSignal ? hoverMidiSignal.replace('-', ' ') : 'NONE'}`;
        }
    }
}

document.getElementById('mapHoverMidiBtn').onclick = () => {
    isMappingHover = !isMappingHover;
    if (isMappingHover) isMappingMode = false; // Mutually exclusive
    updateHoverMappingUI();
}

function updateSystemMidiUI() {
    ['REC', 'PAUSE', 'PLAY', 'STOP', 'SPEED'].forEach(act => {
        const lbl = document.getElementById(`status-${act}`);
        if (!lbl) return;
        const mapped = systemMidiMap[act];
        if (mapped) {
            lbl.innerText = mapped.replace('-', ' ');
            lbl.className = 'midi-status-label mapped';
        } else {
            lbl.innerText = 'UNMAPPED';
            lbl.className = 'midi-status-label unmapped';
        }
    });
}

document.getElementById('toggleRecMidiMap').onclick = (e) => {
    e.stopPropagation();
    isMappingRecorder = !isMappingRecorder;
    const btn = document.getElementById('toggleRecMidiMap');
    if (isMappingRecorder) {
        document.body.classList.add('mapping-active');
        btn.classList.add('active');
        updateSystemMidiUI();
    } else {
        document.body.classList.remove('mapping-active');
        btn.classList.add('active');
        btn.classList.remove('active');
    }
};

window.addEventListener('click', (e) => {
    if (isMappingRecorder && !document.querySelector('.recorder-panel').contains(e.target)) {
        isMappingRecorder = false;
        document.body.classList.remove('mapping-active');
        document.getElementById('toggleRecMidiMap').classList.remove('active');
    }
});

// Setup hover for buttons
['REC', 'PAUSE', 'PLAY', 'STOP', 'SPEED'].forEach(action => {
    let btnId;
    if (action === 'REC') btnId = 'recordBtn';
    else if (action === 'STOP') btnId = 'stopAllBtn';
    else if (action === 'SPEED') btnId = 'playbackSpeed';
    else btnId = `${action.toLowerCase()}Btn`;
    
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.onmouseenter = () => hoveredAction = action;
        btn.onmouseleave = () => hoveredAction = null;
    }
});

updateSystemMidiUI();;

function updateMidiUI() {
    const select = document.getElementById('midiInputSelect');
    const hasMidi = select && select.value !== "";
    document.querySelectorAll('.midi-btn').forEach(btn => {
        btn.style.display = hasMidi ? 'block' : 'none';
    });
    const recMap = document.getElementById('recMidiMappingContainer');
    if (recMap) recMap.style.display = hasMidi ? 'block' : 'none';
}

function updateMidiButtonText(motorId) {
    const btn = document.getElementById(`midi-btn-${motorId}`);
    if (!btn) return;
    
    let mapping = midiMap[motorId] || "NONE";
    btn.innerText = mapping.replace('-', ' ');
}

function toggleMidiMap(id) {
    if (selectedMotorId === id) {
        selectedMotorId = null;
        isMappingMode = false;
        document.getElementById(`card-${id}`).classList.remove('selecting');
    } else {
        if (selectedMotorId !== null) {
            document.getElementById(`card-${selectedMotorId}`).classList.remove('selecting');
        }
        selectedMotorId = id;
        isMappingMode = true;
        document.getElementById(`card-${id}`).classList.add('selecting');
    }
}

// Serial Connection
connectBtn.onclick = async () => {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        writer = port.writable.getWriter();
        statusIndicator.innerText = 'ONLINE';
        statusIndicator.classList.add('online');
        connectBtn.style.display = 'none';
    } catch (e) {
        console.error(e);
        alert('Serial connection failed');
    }
};

async function sendCommand(cmd) {
    if (writer) {
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(cmd + '\n'));
    } else if (socket && socket.connected) {
        socket.emit('command', cmd);
    }
}

// Bridge Connection Logic
const connectBridgeBtn = document.getElementById('connectBridgeBtn');
const piIpSelect = document.getElementById('piIp');

connectBridgeBtn.onclick = () => {
    let ip = piIpSelect.value;
    if (!ip) {
        ip = prompt("Enter Pi IP address (e.g. 192.168.4.1):");
        if (!ip) return;
    }
    
    if (socket) socket.disconnect();
    
    const url = ip.includes(':') ? `http://${ip}` : `http://${ip}:5000`;
    console.log("Connecting to bridge at:", url);
    
    socket = io(url);
    
    socket.on('connect', () => {
        console.log("✅ Connected to Titan Bridge at", url);
        statusIndicator.innerText = 'BRIDGE: ONLINE';
        statusIndicator.classList.add('online');
        connectBridgeBtn.innerText = "CONNECTED";
        connectBridgeBtn.style.background = "var(--primary)";
    });

    socket.on('connect_error', (err) => {
        console.error("❌ Bridge Connection Error:", err);
        statusIndicator.innerText = 'BRIDGE: ERROR';
        statusIndicator.classList.remove('online');
        connectBridgeBtn.innerText = "RETRY PI";
    });

    socket.on('status', (data) => {
        if (data.serial === 'ONLINE') {
            statusIndicator.innerText = 'BRIDGE: ARDUINO OK';
            statusIndicator.classList.add('online');
        } else {
            statusIndicator.innerText = 'BRIDGE: NO ARDUINO';
            statusIndicator.classList.remove('online');
        }
    });
};

// Auto-try localhost bridge if available
if (typeof io !== 'undefined') {
    socket = io({ reconnectionAttempts: 3 });
    socket.on('connect', () => {
        statusIndicator.innerText = 'LOCAL BRIDGE';
        statusIndicator.classList.add('online');
    });
}

async function setMotor(id, val, skipRecord = false) {
    motors[id] = val;
    document.getElementById(`m${id}`).value = val;
    document.getElementById(`v${id}`).innerText = val;
    await sendCommand(`M${id}:${val}`);

    if (isRecording && !isPaused && !skipRecord) {
        isSaved = false;
        recording.push({
            t: performance.now() - startTime - totalPausedTime,
            m: id,
            v: val
        });
    }
}

// Emergency Stop
function stopAll() {
    stopPattern();
    isRecording = false;
    isPlaying = false;
    isPaused = false;
    for (let i = 0; i < 15; i++) {
        setMotor(i, 0, true);
    }
    sendCommand('STOP');
    
    recordBtn.innerHTML = '<i data-lucide="circle"></i> REC';
    recordBtn.classList.remove('active');
    pauseBtn.disabled = true;
    pauseBtn.innerHTML = '<i data-lucide="pause"></i> PAUSE';
    playBtn.innerHTML = '<i data-lucide="play"></i> PLAY';
    playBtn.style.display = 'flex';
    playBtn.classList.remove('active');
    document.querySelector('.timeline-container').classList.remove('visible');
    lucide.createIcons();
}
document.getElementById('stopAllBtn').onclick = stopAll;

// Recording Logic
function getActivePatternVal() {
    const activeBtn = document.querySelector('.pattern-btn.active');
    if (!activeBtn) return 0;
    const pat = activeBtn.dataset.pattern;
    if (pat === 'chaos') return 1000;
    if (pat === 'wave') return 2000;
    if (pat === 'pulse') return 3000;
    if (pat === 'ramp') return 4000;
    return 0;
}

function startStopRecording() {
    if (!isRecording) {
        if (!isSaved && recording.length > 0) {
            if (!confirm("Current recording not saved! Start new recording anyway?")) return;
        }
        
        isRecording = true;
        isPaused = false;
        isPlaying = false; // Stop playback if running
        recording = [];
        startTime = performance.now();
        totalPausedTime = 0;
        virtualTime = 0;
        
        // Record baseline
        for (let i = 0; i < 15; i++) {
            recording.push({ t: 0, m: i, v: motors[i] });
        }
        isSaved = false;
        
        recording.push({ t: 0, m: 15, v: getActivePatternVal() });
        recording.push({ t: 0, m: 16, v: parseInt(document.getElementById('p_speed').value) * 40.95 });
        recording.push({ t: 0, m: 17, v: parseInt(document.getElementById('p_power').value) });
        recording.push({ t: 0, m: 18, v: parseInt(document.getElementById('p_spread').value) * 40.95 });
        recording.push({ t: 0, m: 19, v: parseInt(document.getElementById('p_chaos').value) * 40.95 });
        recording.push({ t: 0, m: 20, v: parseInt(document.getElementById('p_chaos_lerp_speed').value) * 40.95 });
        
        recordBtn.innerHTML = '<i data-lucide="square"></i> STOP REC';
        recordBtn.classList.add('active');
        recordBtn.style.color = '#ff3e3e';
        recordBtn.style.borderColor = '#ff3e3e';
        
        stopPlaybackBtn.style.display = 'none';
        pauseBtn.disabled = false;
        playBtn.disabled = true;
        updateTimer();
        lucide.createIcons();
    } else {
        isRecording = false;
        recordBtn.innerHTML = '<i data-lucide="circle"></i> REC';
        recordBtn.classList.remove('active');
        recordBtn.style.color = '';
        recordBtn.style.borderColor = '';
        
        stopPlaybackBtn.style.display = 'inline-flex';
        playBtn.disabled = recording.length === 0;
        lucide.createIcons();
        updateTimelineTotal();
        document.querySelector('.timeline-container').classList.add('visible');
        renderSequencer();
        
        isSaved = false;

        // Auto Save
        if (document.getElementById('autoSaveToggle').checked && recording.length > 21) {
            exportBtn.click();
        }
    }
}

function stopPlayback() {
    isPlaying = false;
    isRecording = false;
    virtualTime = 0;
    playbackIndex = 0;
    document.getElementById('timelineScrubber').value = 0;
    document.getElementById('timelineCurrent').innerText = "00:00";
    
    // Remove active styles from record
    recordBtn.innerHTML = '<i data-lucide="circle"></i> REC';
    recordBtn.classList.remove('active');
    recordBtn.style.color = '';
    recordBtn.style.borderColor = '';
    
    // Play button reset
    playBtn.innerHTML = '<i data-lucide="play"></i> PLAY';
    
    // Update Playhead UI
    const svgPlayhead = document.getElementById('svg-playhead');
    if (svgPlayhead) {
        svgPlayhead.setAttribute('x1', 0);
        svgPlayhead.setAttribute('x2', 0);
    }
    
    // Reset state to t=0
    if (recording.length > 0) applyStateAtTime(0);
    
    lucide.createIcons();
}

function pauseRecording() {
    if (isRecording || isPlaying) {
        if (!isPaused) {
            isPaused = true;
            pauseStartTime = performance.now();
            pauseBtn.innerHTML = '<i data-lucide="play"></i> RESUME';
            if (isPlaying) clearTimeout(playbackTimeout);
        } else {
            isPaused = false;
            const pauseDuration = performance.now() - pauseStartTime;
            if (isRecording) totalPausedTime += pauseDuration;
            if (isPlaying) {
                playStartTime += pauseDuration;
                runPlayback();
            }
            pauseBtn.innerHTML = '<i data-lucide="pause"></i> PAUSE';
        }
        lucide.createIcons();
    }
}

recordBtn.onclick = startStopRecording;
pauseBtn.onclick = pauseRecording;

function updateTimer() {
    if (!isRecording && !isPlaying) return;
    let now;
    if (isRecording) {
        now = isPaused ? (pauseStartTime - startTime - totalPausedTime) : (performance.now() - startTime - totalPausedTime);
    } else {
        now = isPaused ? (pauseStartTime - playStartTime) : (performance.now() - playStartTime);
    }
    
    // Update Timeline UI
    if (isPlaying) {
        now = virtualTime;
        document.getElementById('timelineCurrent').innerText = formatTimeShort(now);
        
    if (isPlaying) {
        document.getElementById('timelineCurrent').innerText = formatTimeShort(now);
        document.getElementById('timelineScrubber').value = Math.floor(now);
        const svgPlayhead = document.getElementById('svg-playhead');
        if (svgPlayhead) {
            const svg = svgPlayhead.parentElement;
            if (svg && recording.length > 0) {
                const maxT = recording[recording.length - 1].t || 1000;
                const x = (now / maxT) * svg.clientWidth;
                svgPlayhead.setAttribute('x1', x);
                svgPlayhead.setAttribute('x2', x);
            }
        }
    }

    }

    const ms = Math.floor(now % 1000).toString().padStart(3, '0');
    const s = Math.floor((now / 1000) % 60).toString().padStart(2, '0');
    const m = Math.floor((now / 60000) % 60).toString().padStart(2, '0');
    const h = Math.floor(now / 3600000).toString().padStart(2, '0');
    recordTimer.innerText = `${h}:${m}:${s}.${ms}`;
    requestAnimationFrame(updateTimer);
}

// Playback Logic
function startStopPlayback() {
    if (isRecording) return;
    if (!isPlaying) {
        isPaused = false;
        if (recording.length === 0) return;
        isPlaying = true;
        isPaused = false;
        playbackIndex = 0;
        virtualTime = 0;
        lastRealTime = performance.now();
        playBtn.innerHTML = '<i data-lucide="square"></i> STOP';
        playBtn.classList.add('active');
        pauseBtn.disabled = false;
        updateTimer();
        lucide.createIcons();
        runPlayback();
    } else {
        stopPlayback();
    }
}

function stopPlayback() {
    isPlaying = false;
    isPaused = false;
    clearTimeout(playbackTimeout);
    playBtn.innerHTML = '<i data-lucide="play"></i> PLAY';
    playBtn.classList.remove('active');
    pauseBtn.disabled = true;
    pauseBtn.innerHTML = '<i data-lucide="pause"></i> PAUSE';
    lucide.createIcons();
}

playBtn.onclick = startStopPlayback;

function updateTimelineTotal() {
    if (recording.length === 0) return;
    const totalMs = recording[recording.length - 1].t;
    document.getElementById('timelineTotal').innerText = formatTimeShort(totalMs);
    document.getElementById('timelineScrubber').max = Math.floor(totalMs);
}

function formatTimeShort(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

const scrubber = document.getElementById('timelineScrubber');
scrubber.oninput = (e) => {
    const val = parseInt(e.target.value);
    virtualTime = val;
    lastRealTime = performance.now();
    
    // Find where we are in the recording
    playbackIndex = recording.findIndex(evt => evt.t >= val);
    if (playbackIndex === -1) playbackIndex = recording.length;

    document.getElementById('timelineCurrent').innerText = formatTimeShort(val);
    
    // Scrub to nearest frame for visual feedback
    const frame = recording.findLast(evt => evt.t <= val);
    if (frame) setMotor(frame.m, frame.v, true);
};

function runPlayback() {
    if (!isPlaying || isPaused || !recording.length) return;
    
    const realNow = performance.now();
    const realDelta = realNow - lastRealTime;
    lastRealTime = realNow;
    
    const speed = parseFloat(document.getElementById('playbackSpeed').value);
    virtualTime += realDelta * speed;
    
    if (virtualTime >= recording[recording.length - 1].t) {
        stopPlayback();
        return;
    }

    while (playbackIndex < recording.length && recording[playbackIndex].t <= virtualTime) {
        const event = recording[playbackIndex];
        if (event.m < 15) {
            setMotor(event.m, event.v, true);
        } else {
            if (event.m === 15) {
                let patName = '';
                if (event.v === 1000) patName = 'chaos';
                else if (event.v === 2000) patName = 'wave';
                else if (event.v === 3000) patName = 'pulse';
                else if (event.v === 4000) patName = 'ramp';
                if (patName) {
                    const btn = document.querySelector(`.pattern-btn[data-pattern="${patName}"]`);
                    if (btn && !btn.classList.contains('active')) {
                        btn.click();
                    }
                } else {
                    stopPattern();
                }
            } else if (event.m === 16) { document.getElementById('p_speed').value = event.v / 40.95; }
            else if (event.m === 17) { document.getElementById('p_power').value = event.v; }
            else if (event.m === 18) { document.getElementById('p_spread').value = event.v / 40.95; }
            else if (event.m === 19) { document.getElementById('p_chaos').value = event.v / 40.95; }
            else if (event.m === 20) { document.getElementById('p_chaos_lerp_speed').value = event.v / 40.95; }
        }

        playbackIndex++;
    }
    
    playbackTimeout = setTimeout(runPlayback, 10);
}

// Import Logic
document.getElementById('importFile').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    
    if (file.name.endsWith('.json')) {
        reader.onload = (ev) => {
            recording = JSON.parse(ev.target.result);
            playBtn.disabled = false;
            updateTimelineTotal();
            document.querySelector('.timeline-container').classList.add('visible');
            renderSequencer();
            alert('JSON Loaded');
        };
        reader.readAsText(file);
    } else if (file.name.endsWith('.csv')) {
        reader.onload = (ev) => {
            const lines = ev.target.result.split('\n').slice(1);
            recording = lines.filter(l => l.trim()).map(l => {
                const [t, m, v] = l.split(',');
                return { t: parseFloat(t), m: parseInt(m), v: parseInt(v) };
            });
            playBtn.disabled = false;
            updateTimelineTotal();
            document.querySelector('.timeline-container').classList.add('visible');
            renderSequencer();
            alert('CSV Loaded');
        };
        reader.readAsText(file);
    } else if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
        reader.onload = (ev) => {
            recording = [];
            const player = new MidiPlayer.Player((event) => {
                if (event.name === 'Note on') {
                    isSaved = false;
        recording.push({
                        t: event.tick * 2, // Approximate timing
                        m: (event.noteNumber - 60) % 15,
                        v: Math.floor((event.velocity / 127) * 4095)
                    });
                }
            });
            player.loadArrayBuffer(ev.target.result);
            // We don't play it yet, just store it as a recording
            playBtn.disabled = false;
            updateTimelineTotal();
            document.querySelector('.timeline-container').classList.add('visible');
            renderSequencer();
            alert('MIDI Imported as Sequence');
        };
        reader.readAsArrayBuffer(file);
    }
};

// Export Logic
exportBtn.onclick = () => {
    const format = document.getElementById('exportFormat').value;
    let content, type, ext;

    if (format === 'json') {
        content = JSON.stringify(recording);
        type = 'application/json';
        ext = 'json';
    } else if (format === 'csv') {
        content = 'time,motor,value\n' + recording.map(e => `${e.t},${e.m},${e.v}`).join('\n');
        type = 'text/csv';
        ext = 'csv';
    } else if (format === 'mid') {
        // Simple MIDI Generator (Header + Track + End)
        const header = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 128];
        const trackHead = [0x4D, 0x54, 0x72, 0x6B];
        let data = [];
        let lastTime = 0;
        
        recording.forEach(e => {
            let delta = Math.floor((e.t - lastTime) / 2);
            if (delta < 0) delta = 0;
            // Variable length quantity (simplified for small deltas)
            data.push(delta & 0x7F); 
            data.push(0x90, 60 + (e.m % 15), Math.floor((e.v / 4095) * 127));
            lastTime = e.t;
        });
        data.push(0, 0xFF, 0x2F, 0); // End of Track
        
        const dataLen = [ (data.length >> 24) & 0xFF, (data.length >> 16) & 0xFF, (data.length >> 8) & 0xFF, data.length & 0xFF ];
        const blob = new Blob([new Uint8Array([...header, ...trackHead, ...dataLen, ...data])], {type: 'audio/midi'});
        const url = URL.createObjectURL(blob);
        isSaved = true;
    const a = document.createElement('a');
        a.href = url;
        const name = document.getElementById('recordName').value || `motor_sequence_${Date.now()}`;
        a.download = `${name}.mid`;
        a.click();
        return;
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    isSaved = true;
    const a = document.createElement('a');
    a.href = url;
    const name = document.getElementById('recordName').value || `motor_sequence_${Date.now()}`;
    a.download = `${name}.${ext}`;
    a.click();
};

// Patterns Logic
function stopPattern() {
    clearInterval(patternInterval);
    document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('patternSettings').classList.remove('active');
    document.querySelectorAll('.pattern-settings .setting').forEach(s => s.style.display = 'none');
}


const pMap = { p_speed: 16, p_power: 17, p_spread: 18, p_chaos: 19, p_chaos_lerp_speed: 20 };
Object.keys(pMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', (e) => {
            if (isRecording && !isPaused) {
                let v = parseInt(e.target.value);
                if (id !== 'p_power') v = v * 40.95;
                isSaved = false;
        recording.push({ t: performance.now() - startTime - totalPausedTime, m: pMap[id], v: v });
            }
        });
    }
});

const getPSettings = () => ({
    speed: parseInt(document.getElementById('p_speed').value) / 50,
    power: parseInt(document.getElementById('p_power').value),
    spread: parseInt(document.getElementById('p_spread').value) / 50,
    chaos: parseInt(document.getElementById('p_chaos').value),
    lerp: document.getElementById('p_chaos_lerp').checked,
    lerpSpeed: parseInt(document.getElementById('p_chaos_lerp_speed').value) / 500
});

document.querySelectorAll('.pattern-btn').forEach(btn => {
    btn.onclick = () => {
        const isActive = btn.classList.contains('active');
        stopPattern();
        
        if (isActive) return; 

        const pattern = btn.dataset.pattern;
        if (isRecording && !isPaused) {
            let pVal = 0;
            if (pattern === 'chaos') pVal = 1000;
            if (pattern === 'wave') pVal = 2000;
            if (pattern === 'pulse') pVal = 3000;
            if (pattern === 'ramp') pVal = 4000;
            isSaved = false;
        recording.push({ t: performance.now() - startTime - totalPausedTime, m: 15, v: pVal });
        }

        btn.classList.add('active');
        document.getElementById('patternSettings').classList.add('active');
        
        // Show/hide relevant sliders
        document.querySelectorAll('.pattern-settings .setting').forEach(s => {
            if (s.classList.contains('p-all')) s.style.display = 'flex';
            else if (s.classList.contains(`p-${pattern}`)) s.style.display = 'flex';
            else s.style.display = 'none';
        });
        
        if (pattern === 'chaos') {
            patternInterval = setInterval(() => {
                const s = getPSettings();
                if (Math.random() * 100 < s.chaos) {
                    const id = Math.floor(Math.random() * 15);
                    const val = Math.floor(Math.random() * s.power);
                    if (s.lerp) {
                        targetMotors[id] = val;
                    } else {
                        setMotor(id, val, true);
                    }
                }
            }, 100 / getPSettings().speed);
        } else if (pattern === 'wave') {
            let t = 0;
            patternInterval = setInterval(() => {
                const s = getPSettings();
                for (let i = 0; i < 15; i++) {
                    const val = Math.floor((Math.sin(t + i * s.spread) + 1) * (s.power / 2));
                    setMotor(i, val, true);
                }
                t += 0.1 * s.speed;
            }, 30);
        } else if (pattern === 'pulse') {
            let t = 0;
            patternInterval = setInterval(() => {
                const s = getPSettings();
                const val = Math.floor((Math.sin(t) + 1) * (s.power / 2));
                for (let i = 0; i < 15; i++) setMotor(i, val, true);
                t += 0.1 * s.speed;
            }, 30);
        } else if (pattern === 'ramp') {
            let v = 0;
            patternInterval = setInterval(() => {
                const s = getPSettings();
                v = (v + (50 * s.speed)) % s.power;
                for (let i = 0; i < 15; i++) setMotor(i, Math.floor(v), true);
            }, 20);
        }
    };
});

// MIDI Logic
const midiFile = document.getElementById('midiFile');
const midiInfo = document.getElementById('midiInfo');

midiFile.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        midiInfo.innerText = `Loaded: ${file.name}`;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const player = new MidiPlayer.Player((event) => {
                if (event.name === 'Note on') {
                    // Map MIDI notes 60-74 to motors 0-14
                    const mId = (event.noteNumber - 60) % 15;
                    const val = Math.floor((event.velocity / 127) * 4095);
                    setMotor(mId, val);
                } else if (event.name === 'Note off') {
                    const mId = (event.noteNumber - 60) % 15;
                    setMotor(mId, 0);
                }
            });
            player.loadArrayBuffer(ev.target.result);
            player.play();
        };
        reader.readAsArrayBuffer(file);
    }
};

// Removed old global MIDI mapping logic

// Hardware MIDI
function initMIDI() {
    const select = document.getElementById('midiInputSelect');
    if (!navigator.requestMIDIAccess) {
        if (select) select.innerHTML = '<option>NOT SUPPORTED</option>';
        return;
    }

    if (midiAccess) {
        console.log("Refreshing existing MIDI access...");
        updateInputsFromAccess(midiAccess);
        return;
    }

    console.log("Requesting MIDI Access...");
    navigator.requestMIDIAccess().then(access => {
        midiAccess = access;
        console.log("MIDI Access Granted");
        
        access.onstatechange = (e) => {
            console.log("MIDI State Change:", e.port.name, e.port.state);
            updateInputsFromAccess(access);
        };
        
        updateInputsFromAccess(access);

        select.onchange = () => {
            if (select.value) {
                localStorage.setItem('titan_midi_port', select.value);
                const input = access.inputs.get(select.value);
                if (input) setupMidiInput(input);
            } else {
                localStorage.removeItem('titan_midi_port');
            }
            updateMidiUI();
        };
    }).catch(err => {
        console.error("MIDI Access Denied:", err);
        if (select) select.innerHTML = `<option>BLOCKED: ${err.message || 'Check Perms'}</option>`;
        updateMidiUI();
    });
}

function updateInputsFromAccess(access) {
    const select = document.getElementById('midiInputSelect');
    if (!select) return;

    const currentVal = select.value || lastMidiPort;
    select.innerHTML = '<option value="">None Found</option>';
    
    const inputs = Array.from(access.inputs.values());
    console.log("Found", inputs.length, "inputs");
    
    inputs.forEach(input => {
        const opt = document.createElement('option');
        opt.value = input.id;
        opt.innerText = input.name;
        select.appendChild(opt);
    });
    
    if (currentVal) {
        select.value = currentVal;
        const input = access.inputs.get(select.value);
        if (input) setupMidiInput(input);
    }
    updateMidiUI();
}

function setupMidiInput(input) {
    console.log("Setting up MIDI Input:", input.name);
    // Clear other listeners
    if (midiAccess) {
        midiAccess.inputs.forEach(i => i.onmidimessage = null);
    }
    
        input.onmidimessage = (msg) => {
            const [status, data1, data2] = msg.data;
            const type = status & 0xf0;

            if (isMappingHover) {
                if (type === 0xB0 || (type === 0x90 && data2 > 0)) {
                    isMappingHover = false;
                    hoverMidiSignal = (type === 0xB0) ? `CC-${data1}` : `NOTE-${data1}`;
                    localStorage.setItem('titan_hover_midi', hoverMidiSignal);
                    updateHoverMappingUI();
                    console.log("Hover MIDI Mapped:", hoverMidiSignal);
                }
                return;
            }

            if (isMappingMode && selectedMotorId !== null) {
                const isNote = (type === 0x90 && data2 > 0);
                const isCC = (type === 0xB0);
                const pianoMode = document.getElementById('pianoModeToggle')?.checked;

                if (isCC || isNote) {
                    const signal = isCC ? `CC-${data1}` : `NOTE-${data1}`;
                    midiMap[selectedMotorId] = signal;
                    
                    if (isNote && pianoMode) {
                        const whiteKeyOffsets = [0, 2, 4, 5, 7, 9, 11];
                        let currentNote = data1;
                        let octave = Math.floor(currentNote / 12);
                        let noteInOctave = currentNote % 12;
                        let whiteIndex = whiteKeyOffsets.indexOf(noteInOctave);
                        
                        // If starting on black key, move to next white
                        if (whiteIndex === -1) {
                            whiteIndex = whiteKeyOffsets.findIndex(n => n > noteInOctave);
                            if (whiteIndex === -1) { whiteIndex = 0; octave++; }
                        }

                        for (let i = selectedMotorId + 1; i < 15; i++) {
                            whiteIndex++;
                            if (whiteIndex >= 7) { whiteIndex = 0; octave++; }
                            const nextNote = octave * 12 + whiteKeyOffsets[whiteIndex];
                            midiMap[i] = `NOTE-${nextNote}`;
                            updateMidiButtonText(i);
                        }
                    }

                    if (isCC && document.getElementById('autoMapCCToggle')?.checked) {
                        let currentCC = data1;
                        for (let i = selectedMotorId + 1; i < 15; i++) {
                            currentCC++;
                            if (currentCC > 127) break;
                            midiMap[i] = `CC-${currentCC}`;
                            updateMidiButtonText(i);
                        }
                    }

                    localStorage.setItem('titan_v2_midi_map', JSON.stringify(midiMap));
                    updateMidiButtonText(selectedMotorId);
                    
                    document.getElementById(`card-${selectedMotorId}`).classList.remove('selecting');
                    selectedMotorId = null;
                    isMappingMode = false;
                }
                return;
            }

            const isCC = (type === 0xB0);
            const isNote = (type === 0x90 && data2 > 0) || (type === 0x80) || (type === 0x90 && data2 === 0);
            const signal = isCC ? `CC-${data1}` : `NOTE-${data1}`;
            const val = Math.floor((data2 / 127) * 4095);

            if (isMappingPianoHover) {
                if (type === 0xB0 || (type === 0x90 && data2 > 0)) {
                    pianoHoverMidiSignal = (type === 0xB0) ? `CC-${data1}` : `NOTE-${data1}`;
                    localStorage.setItem('titan_piano_hover_midi', pianoHoverMidiSignal);
                    isMappingPianoHover = false;
                    const btn = document.getElementById('mapPianoHoverMidiBtn');
                    btn.classList.remove('active');
                    btn.innerHTML = `MAP PIANO HOVER MIDI: <span id="pianoHoverMidiStatus">${pianoHoverMidiSignal || 'NONE'}</span>`;
                    updateHoverMappingUI();
                }
                return;
            }

            if (isMappingRecorder && hoveredAction) {
                if (type === 0xB0 || (type === 0x90 && data2 > 0)) {
                    const mappedSignal = (type === 0xB0) ? `CC-${data1}` : `NOTE-${data1}`;
                    systemMidiMap[hoveredAction] = mappedSignal;
                    localStorage.setItem('titan_system_midi', JSON.stringify(systemMidiMap));
                    updateSystemMidiUI();
                }
                return;
            }

            // System MIDI Actions
            const isNoteOn = (type === 0x90 && data2 > 0);
            const isCCActive = (type === 0xB0 && data2 > 64); // Trigger on high CC value
            
            if (isNoteOn || isCCActive) {
                if (signal === systemMidiMap.REC) startStopRecording();
                if (signal === systemMidiMap.PAUSE) pauseRecording();
                if (signal === systemMidiMap.PLAY) startStopPlayback();
                if (signal === systemMidiMap.STOP) stopAll();
            }

            if (type === 0xB0 && signal === systemMidiMap.SPEED) {
                const speedVal = (data2 / 127 * 4.9 + 0.1).toFixed(1);
                document.getElementById('playbackSpeed').value = speedVal;
                document.getElementById('playSpeedVal').innerText = speedVal;
            }

            // Hover Mode Logic
            if (document.getElementById('hoverModeToggle').checked && signal === hoverMidiSignal && hoveredMotorId !== null) {
                setMotor(hoveredMotorId, val);
                targetMotors[hoveredMotorId] = val; // Sync target to prevent lerp fighting
            }

            // Piano Hover Logic
            if (document.getElementById('pianoHoverToggle').checked) {
                const isPianoNote = (type === 0x90 || type === 0x80);
                if (isPianoNote) {
                    // Find which motor is mapped to this note
                    let foundMotorId = -1;
                    for (let mId = 0; mId < 15; mId++) {
                        if (midiMap[mId] === signal) {
                            foundMotorId = mId;
                            break;
                        }
                    }

                    if (foundMotorId !== -1) {
                        if (type === 0x90 && data2 > 0) {
                            hoveredMotorIds.add(foundMotorId);
                            targetMotors[foundMotorId] = motors[foundMotorId];
                            const card = document.getElementById(`card-${foundMotorId}`);
                            if (card) card.classList.add('hover-active');
                        } else if (type === 0x80 || (type === 0x90 && data2 === 0)) {
                            // Always trigger reset on key release if enabled
                            if (document.getElementById('pianoHoverResetToggle').checked) {
                                if (document.getElementById('pianoHoverLerpResetToggle').checked) {
                                    targetMotors[foundMotorId] = 0;
                                } else {
                                    setMotor(foundMotorId, 0);
                                    targetMotors[foundMotorId] = 0;
                                }
                            }
                            
                            const card = document.getElementById(`card-${foundMotorId}`);
                            if (card) card.classList.remove('hover-active');
                            hoveredMotorIds.delete(foundMotorId);
                        }
                    }
                }
                
                // Value control for Piano Hover (knob control while keys are held)
                if (type === 0xB0 && signal === pianoHoverMidiSignal && hoveredMotorIds.size > 0) {
                    hoveredMotorIds.forEach(mId => {
                        setMotor(mId, val);
                        targetMotors[mId] = val;
                    });
                }
                if (isPianoNote || (type === 0xB0 && signal === pianoHoverMidiSignal)) return;
            }

            // Global Motor MIDI Mapping
            for (let mId = 0; mId < 15; mId++) {
                if (midiMap[mId] === signal) {
                    const target = (type === 0x80 || (type === 0x90 && data2 === 0)) ? 0 : val;
                    if (document.getElementById('pianoLerpToggle')?.checked) {
                        targetMotors[mId] = target;
                    } else {
                        setMotor(mId, target, true);
                    }
                }
            }
        };
}

initMIDI();

// Tab Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        const panel = btn.closest('.panel');
        panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        panel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    };
});

document.getElementById('playbackSpeed').oninput = (e) => {
    const val = parseFloat(e.target.value).toFixed(1);
    document.getElementById('playSpeedVal').innerText = val;
};
// Auto-select last port on load
setTimeout(() => {
    const select = document.getElementById('midiInputSelect');
    if (lastMidiPort && select) {
        select.value = lastMidiPort;
        select.dispatchEvent(new Event('change'));
    }
}, 500);

// Piano & Pattern & Hover Lerp Logic
setInterval(() => {
    const pianoLerp = document.getElementById('pianoLerpToggle')?.checked && document.getElementById('pianoModeToggle')?.checked;
    const chaosLerp = document.getElementById('p_chaos_lerp')?.checked && document.querySelector('.pattern-btn[data-pattern="chaos"]').classList.contains('active');
    const hoverLerp = document.getElementById('hoverLerpResetToggle')?.checked && document.getElementById('hoverModeToggle')?.checked;
    const pianoHoverLerp = document.getElementById('pianoHoverLerpResetToggle')?.checked && document.getElementById('pianoHoverToggle')?.checked;
    
    if (!pianoLerp && !chaosLerp && !hoverLerp && !pianoHoverLerp) return;

    let speed;
    if (pianoLerp) speed = parseInt(document.getElementById('pianoLerpSpeed').value) / 500;
    else if (chaosLerp) speed = parseInt(document.getElementById('p_chaos_lerp_speed').value) / 500;
    else if (hoverLerp) speed = parseInt(document.getElementById('hoverLerpSpeed').value) / 500;
    else speed = parseInt(document.getElementById('pianoHoverLerpSpeed').value) / 500;
    
    for (let i = 0; i < 15; i++) {
        if (motors[i] !== targetMotors[i]) {
            const diff = targetMotors[i] - motors[i];
            if (Math.abs(diff) < 10) {
                setMotor(i, targetMotors[i], true);
            } else {
                setMotor(i, Math.round(motors[i] + diff * speed), true);
            }
        }
    }
}, 30);

// UI Toggles
document.getElementById('pianoModeToggle').onchange = (e) => {
    document.getElementById('pianoLerpSettings').style.display = e.target.checked ? 'block' : 'none';
    saveSettings();
};

document.getElementById('pianoHoverToggle').onchange = (e) => {
    if (e.target.checked) {
        // Untoggle Mouse Hover
        const mh = document.getElementById('hoverModeToggle');
        if (mh.checked) {
            mh.checked = false;
            mh.dispatchEvent(new Event('change'));
        }
    }
    document.getElementById('pianoHoverSettings').style.display = e.target.checked ? 'block' : 'none';
    saveSettings();
};

document.getElementById('pianoLerpToggle').onchange = (e) => {
    document.getElementById('lerpSpeedContainer').style.display = e.target.checked ? 'block' : 'none';
    // Sync targets with current motors when turning on
    if (e.target.checked) targetMotors = [...motors];
    saveSettings();
};

document.getElementById('pianoLerpSpeed').oninput = (e) => {
    document.getElementById('lerpSpeedVal').innerText = e.target.value;
    saveSettings();
};

document.getElementById('autoMapCCToggle').onchange = () => saveSettings();
document.getElementById('hoverModeToggle').onchange = (e) => {
    if (e.target.checked) {
        // Untoggle Piano Hover
        const ph = document.getElementById('pianoHoverToggle');
        if (ph.checked) {
            ph.checked = false;
            ph.dispatchEvent(new Event('change'));
        }
    }
    document.getElementById('hoverSettingsDiv').style.display = e.target.checked ? 'block' : 'none';
    saveSettings();
};
document.getElementById('hoverResetToggle').onchange = (e) => {
    document.getElementById('hoverLerpGroup').style.display = e.target.checked ? 'block' : 'none';
    saveSettings();
};

document.getElementById('p_chaos_lerp').onchange = (e) => {
    document.getElementById('chaos_lerp_speed_container').style.display = e.target.checked ? 'block' : 'none';
};

document.getElementById('pianoHoverResetToggle').onchange = (e) => {
    document.getElementById('pianoHoverLerpGroup').style.display = e.target.checked ? 'block' : 'none';
    saveSettings();
};

document.getElementById('mapPianoHoverMidiBtn').onclick = (e) => {
    isMappingPianoHover = !isMappingPianoHover;
    e.target.classList.toggle('active');
    e.target.innerHTML = isMappingPianoHover ? 'MOVE KNOB...' : `MAP PIANO HOVER MIDI: <span id="pianoHoverMidiStatus">${pianoHoverMidiSignal || 'NONE'}</span>`;
};

document.getElementById('p_chaos_lerp_speed').oninput = (e) => {
    document.getElementById('chaos_lerp_val').innerText = e.target.value;
};

document.getElementById('recordName').oninput = () => saveSettings();
document.getElementById('autoSaveToggle').onchange = () => saveSettings();

document.getElementById('hoverLerpResetToggle').onchange = (e) => {
    document.getElementById('hoverLerpSpeedContainer').style.display = e.target.checked ? 'block' : 'none';
    saveSettings();
};
document.getElementById('hoverLerpSpeed').oninput = (e) => {
    document.getElementById('hoverLerpVal').innerText = e.target.value;
    saveSettings();
};
document.getElementById('pianoHoverLerpResetToggle').onchange = (e) => {
    document.getElementById('pianoHoverLerpSpeedContainer').style.display = e.target.checked ? 'block' : 'none';
    saveSettings();
};
document.getElementById('pianoHoverLerpSpeed').oninput = (e) => {
    document.getElementById('pianoHoverLerpVal').innerText = e.target.value;
    saveSettings();
};

// Final cleanup: No more alerts on mapping, just visual glow.
// (Logic already in place via selectedMotorId)

// Sequencer UI
// Sequencer UI
let draggedNode = null;

function renderSequencer() {
    const track = document.getElementById('sequencerTracks');
    if (!track) return;
    
    if (track._cleanUp) track._cleanUp();
    track.innerHTML = '';
    
    if (recording.length === 0) return;
    
    const motorEvents = Array(21).fill(0).map(() => []);
    recording.forEach(evt => motorEvents[evt.m].push(evt));
    
    const maxT = recording[recording.length - 1].t || 1000;
    
    const svgWidth = Math.max(track.clientWidth, maxT / 10); 
    const svgHeight = track.clientHeight - 20;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.style.overflow = 'visible';
    svg.style.marginTop = '10px';
    
    const getX = (t) => (t / maxT) * svgWidth;
    const getY = (v) => svgHeight - (v / 4095) * svgHeight;
    
    // Draw paths
    motorEvents.forEach((events, m) => {
        if (events.length === 0) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let d = `M ${getX(events[0].t)} ${getY(events[0].v)}`;
        for (let i = 1; i < events.length; i++) {
            d += ` L ${getX(events[i].t)} ${getY(events[i].v)}`;
        }
        d += ` L ${svgWidth} ${getY(events[events.length - 1].v)}`;
        
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', motorColors[m]);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-opacity', '0.6');
        path.id = `path-m${m}`;
        svg.appendChild(path);
    });
    
    // Draw nodes
    motorEvents.forEach((events, m) => {
        events.forEach((evt, idx) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', getX(evt.t));
            circle.setAttribute('cy', getY(evt.v));
            circle.setAttribute('r', 6);
            circle.setAttribute('fill', motorColors[m]);
            circle.setAttribute('stroke', '#000');
            circle.setAttribute('stroke-width', '2');
            circle.style.cursor = 'ns-resize';
            
            circle.onmousedown = (e) => {
                e.stopPropagation();
                draggedNode = { circle, evt, m, idx };
                document.querySelectorAll('.motor-card').forEach(c => c.style.boxShadow = '');
                const card = document.getElementById(`card-${m}`);
                if (card) {
                    card.style.boxShadow = `0 0 15px ${motorColors[m]}`;
                    card.style.borderColor = motorColors[m];
                    setTimeout(() => {
                        card.style.boxShadow = '';
                        card.style.borderColor = 'var(--glass-border)';
                    }, 2000);
                }
            };
            
            svg.appendChild(circle);
        });
    });
    
    
    const playhead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    playhead.id = 'svg-playhead';
    playhead.setAttribute('x1', 0);
    playhead.setAttribute('y1', 0);
    playhead.setAttribute('x2', 0);
    playhead.setAttribute('y2', svgHeight);
    playhead.setAttribute('stroke', '#fff');
    playhead.setAttribute('stroke-width', '2');
    svg.appendChild(playhead);

track.appendChild(svg);
    
    const moveHandler = (e) => {
        if (!draggedNode) return;
        const rect = svg.getBoundingClientRect();
        let y = e.clientY - rect.top;
        if (y < 0) y = 0;
        if (y > svgHeight) y = svgHeight;
        
        const newVal = Math.round(4095 - (y / svgHeight) * 4095);
        draggedNode.evt.v = newVal;
        draggedNode.circle.setAttribute('cy', y);
        
        if (!isPlaying && !isRecording) setMotor(draggedNode.m, newVal, true);
        
        const events = motorEvents[draggedNode.m];
        let d = `M ${getX(events[0].t)} ${getY(events[0].v)}`;
        for (let i = 1; i < events.length; i++) {
            d += ` L ${getX(events[i].t)} ${getY(events[i].v)}`;
        }
        d += ` L ${svgWidth} ${getY(events[events.length - 1].v)}`;
        const path = svg.querySelector(`#path-m${draggedNode.m}`);
        if (path) path.setAttribute('d', d);
    };
    
    const upHandler = () => {
        if (draggedNode) draggedNode = null;
    };
    
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
    
    track._cleanUp = () => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
    };
}


function renderSequencer() {
    const track = document.getElementById('sequencerTracks');
    if (!track) return;
    
    if (track._cleanUp) track._cleanUp();
    track.innerHTML = '';
    
    if (recording.length === 0) return;
    
    const motorEvents = Array(21).fill(0).map(() => []);
    recording.forEach(evt => {
        if (evt.m < 21) motorEvents[evt.m].push(evt);
    });
    
    const maxT = recording[recording.length - 1].t || 1000;
    
    const svgWidth = Math.max(track.clientWidth, maxT / 10); 
    const svgHeight = track.clientHeight - 20;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.style.overflow = 'visible';
    svg.style.marginTop = '10px';
    
    const getX = (t) => (t / maxT) * svgWidth;
    const getY = (v) => svgHeight - (v / 4095) * svgHeight;
    
    // Draw paths using Bezier curve
    motorEvents.forEach((events, m) => {
        if (events.length === 0) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let d = `M ${getX(events[0].t)} ${getY(events[0].v)}`;
        
        for (let i = 1; i < events.length; i++) {
            const e1 = events[i-1];
            const e2 = events[i];
            const x1 = getX(e1.t);
            const y1 = getY(e1.v);
            const x2 = getX(e2.t);
            const y2 = getY(e2.v);
            const cx = (x1 + x2) / 2;
            d += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
        }
        d += ` L ${svgWidth} ${getY(events[events.length - 1].v)}`;
        
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', motorColors[m] || '#ffffff');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-opacity', '0.6');
        path.id = `path-m${m}`;
        svg.appendChild(path);
    });
    
    // Draw nodes
    motorEvents.forEach((events, m) => {
        events.forEach((evt, idx) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', getX(evt.t));
            circle.setAttribute('cy', getY(evt.v));
            circle.setAttribute('r', 6);
            circle.setAttribute('fill', motorColors[m] || '#ffffff');
            circle.setAttribute('stroke', '#000');
            circle.setAttribute('stroke-width', '2');
            circle.style.cursor = 'ns-resize';
            
            circle.onmousedown = (e) => {
                e.stopPropagation();
                draggedNode = { circle, evt, m, idx };
                document.querySelectorAll('.motor-card').forEach(c => c.style.boxShadow = '');
                const card = document.getElementById(`card-${m}`);
                if (card) {
                    card.style.boxShadow = `0 0 15px ${motorColors[m] || '#ffffff'}`;
                    card.style.borderColor = motorColors[m] || '#ffffff';
                    setTimeout(() => {
                        card.style.boxShadow = '';
                        card.style.borderColor = 'var(--glass-border)';
                    }, 2000);
                }
            };
            
            svg.appendChild(circle);
        });
    });
    
    // Playhead line
    const playhead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    playhead.id = 'svg-playhead';
    playhead.setAttribute('x1', 0);
    playhead.setAttribute('y1', 0);
    playhead.setAttribute('x2', 0);
    playhead.setAttribute('y2', svgHeight);
    playhead.setAttribute('stroke', '#fff');
    playhead.setAttribute('stroke-width', '2');
    svg.appendChild(playhead);

    track.appendChild(svg);
    
    const moveHandler = (e) => {
        if (!draggedNode) return;
        const rect = svg.getBoundingClientRect();
        let y = e.clientY - rect.top;
        if (y < 0) y = 0;
        if (y > svgHeight) y = svgHeight;
        
        const newVal = Math.round(4095 - (y / svgHeight) * 4095);
        draggedNode.evt.v = newVal;
        draggedNode.circle.setAttribute('cy', y);
        
        if (!isPlaying && !isRecording && draggedNode.m < 15) {
            setMotor(draggedNode.m, newVal, true);
        }
        
        const events = motorEvents[draggedNode.m];
        let d = `M ${getX(events[0].t)} ${getY(events[0].v)}`;
        for (let i = 1; i < events.length; i++) {
            const e1 = events[i-1];
            const e2 = events[i];
            const cx = (getX(e1.t) + getX(e2.t)) / 2;
            d += ` C ${cx} ${getY(e1.v)}, ${cx} ${getY(e2.v)}, ${getX(e2.t)} ${getY(e2.v)}`;
        }
        d += ` L ${svgWidth} ${getY(events[events.length - 1].v)}`;
        const path = svg.querySelector(`#path-m${draggedNode.m}`);
        if (path) path.setAttribute('d', d);
    };
    
    const upHandler = () => {
        if (draggedNode) draggedNode = null;
    };
    
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
    
    track._cleanUp = () => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
    };
}
