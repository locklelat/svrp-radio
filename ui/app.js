const path = require('path');
const CONFIG = require(path.join(__dirname, '../config.js'));
const packageJson = require('../package.json');
const { ipcRenderer } = require('electron');

let ws;

// --- PTT & Volume State Variables (Declared First) ---
let pttKey = localStorage.getItem('svrp_ptt_key') || "ControlLeft";
let pttKeyLabel = localStorage.getItem('svrp_ptt_label') || "CTRL (ControlLeft)";
let radioVolume = parseInt(localStorage.getItem('svrp_volume')) || 30;

let volUpKey = localStorage.getItem('svrp_volup_key') || "NumpadAdd";
let volDownKey = localStorage.getItem('svrp_voldown_key') || "NumpadSubtract";

let isListeningForPTT = false;
let isListeningForVolUp = false;
let isListeningForVolDown = false;
let isTransmitting = false;

let radioState = {
    isOn: false,
    channel: 0,
    channelName: "---",
    volume: radioVolume,
    isTyping: false
};

// --- Audio Initialization ---
const pttStartSound = new Audio('./sounds/keydown.mp3');
const pttEndSound = new Audio('./sounds/keyup.mp3');

function playSound(audioObj) {
    if (!radioState.isOn) return;
    if (!audioObj) return;
    audioObj.volume = radioState.volume / 100;
    audioObj.currentTime = 0;
    audioObj.play().catch(e => {
        // Silently catch any playback restrictions
    });
}

function connectWebSocket() {
    ws = new WebSocket(CONFIG.WS_URL);
    
    ws.onopen = () => {
        console.log("Connected to radio bridge.");
    };
    
    ws.onmessage = async (event) => {
        let blob = new Blob([event.data], { type: 'audio/webm' });
        let audioUrl = URL.createObjectURL(blob);
        let audio = new Audio(audioUrl);
        audio.play().catch(e => console.log("Audio error:", e));
    };

    ws.onclose = () => {
        setTimeout(connectWebSocket, 3000);
    };
}

function cancelTyping() {
    radioState.isTyping = false;
    let inputContainer = document.getElementById('inline-input-container');
    let channelDisplay = document.getElementById('channel-display');
    let channelInput = document.getElementById('channel-input');

    if (inputContainer) inputContainer.classList.add('hidden');
    if (channelDisplay) channelDisplay.classList.remove('hidden');
    if (channelInput) channelInput.value = '';
}

// Channel Name Mapping (matching your server configuration)[cite: 7]
const channelNames = {
    1: "SASP TAC 1",
    2: "SASP TAC 2",
    3: "SASP TAC 3",
    4: "SASP TAC 4",
    5: "SASP TRAFFIC",
    6: "SASP DRUG TASK",
    7: "SASP PURSUIT 3",
    8: "SASP PURSUIT 2",
    9: "SASP PURSUIT 1",
    10: "STATE PATROL"
};

function getChannelLabel(channel) {
    if (channel <= 0) return "0";
    return channelNames[channel] || `CHANNEL ${channel}`;
}

function updateDisplay() {
    let powerStatus = document.getElementById('power-status');
    let channelDisplay = document.getElementById('channel-display');
    let volumeDisplay = document.getElementById('volume-display');
    let inputContainer = document.getElementById('inline-input-container');
    let screenHint = document.getElementById('screen-hint');

    if (volumeDisplay) volumeDisplay.innerText = `Vol: ${radioState.volume}%`;

    if (!radioState.isOn) {
        if (powerStatus) {
            powerStatus.innerText = "OFF";
            powerStatus.style.color = "red";
        }
        if (channelDisplay) channelDisplay.innerText = "---";
        cancelTyping();
        if (screenHint) screenHint.innerText = "";
    } else {
        if (powerStatus) {
            powerStatus.innerText = "ON";
            powerStatus.style.color = "green";
        }
        if (screenHint) screenHint.innerText = radioState.isTyping ? "Enter" : "Tune";

        if (!radioState.isTyping) {
            if (inputContainer) inputContainer.classList.add('hidden');
            if (channelDisplay) {
                channelDisplay.classList.remove('hidden');
                channelDisplay.innerText = radioState.channel > 0 ? getChannelLabel(radioState.channel) : "0";
            }
        }
    }
}

function submitChannel() {
    let inputField = document.getElementById('channel-input');
    if (!inputField) return;
    
    let newChannel = parseInt(inputField.value);
    
    if (isNaN(newChannel) || newChannel <= 0) {
        cancelTyping();
        updateDisplay();
        return;
    }

    cancelTyping();
    radioState.channel = newChannel;
    radioState.channelName = getChannelLabel(newChannel);
    updateDisplay();

    fetch(`${CONFIG.API_URL}/api/radio/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            channel: newChannel,
            identifier: "desktop_user" 
        })
    }).then(resp => resp.json()).catch(err => {
        console.log("Failed to sync channel with server:", err);
    });
}

async function setupMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(event.data);
            }
        };

        mediaRecorder.start(100);
        console.log("Microphone initialized for broadcasting.");
    } catch (err) {
        console.error("Microphone access denied or unavailable:", err);
    }
}

// --- Single Unified DOMContentLoaded Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    let container = document.getElementById('radio-container');
    if (container) {
        container.classList.remove('hidden');
    }
    
    let versionSpan = document.getElementById('app-version');
    if (versionSpan) {
        versionSpan.innerText = `v${packageJson.version}`;
    }

    updateDisplay();
    setupMicrophone();

    // Set initial button labels in settings modal
    let pttBtn = document.getElementById('ptt-key-btn');
    if (pttBtn) pttBtn.innerText = `PTT: ${pttKeyLabel}`;
    
    let volUpBtn = document.getElementById('volup-key-btn');
    if (volUpBtn) volUpBtn.innerText = `Vol Up: ${volUpKey}`;

    let volDownBtn = document.getElementById('voldown-key-btn');
    if (volDownBtn) volDownBtn.innerText = `Vol Down: ${volDownKey}`;

    syncGlobalShortcuts(); // Register shortcuts on boot
});

// --- Event Listeners & UI Controls ---

const powerKnob = document.getElementById('power-knob');
if (powerKnob) {
    powerKnob.addEventListener('click', function() {
        radioState.isOn = !radioState.isOn;
        updateDisplay();
    });
}

const radioScreen = document.getElementById('radio-screen');
if (radioScreen) {
    radioScreen.addEventListener('click', function(e) {
        if (!radioState.isOn) return;
        if (radioState.isTyping) return;

        radioState.isTyping = true;
        let channelDisplay = document.getElementById('channel-display');
        let inputContainer = document.getElementById('inline-input-container');
        let inputField = document.getElementById('channel-input');
        let screenHint = document.getElementById('screen-hint');

        if (channelDisplay) channelDisplay.classList.add('hidden');
        if (inputContainer) inputContainer.classList.remove('hidden');
        if (screenHint) screenHint.innerText = "Enter";
        
        if (inputField) {
            inputField.value = '';
            inputField.focus();
        }
    });
}

document.querySelectorAll('.num-btn').forEach(button => {
    button.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!radioState.isOn) return;
        
        if (!radioState.isTyping) {
            radioState.isTyping = true;
            let channelDisplay = document.getElementById('channel-display');
            let inputContainer = document.getElementById('inline-input-container');
            let screenHint = document.getElementById('screen-hint');
            let inputField = document.getElementById('channel-input');

            if (channelDisplay) channelDisplay.classList.add('hidden');
            if (inputContainer) inputContainer.classList.remove('hidden');
            if (screenHint) screenHint.innerText = "Enter";
            if (inputField) inputField.value = '';
        }

        let val = this.getAttribute('data-value');
        let inputField = document.getElementById('channel-input');
        if (!inputField) return;

        if (val === 'DEL') {
            inputField.value = inputField.value.slice(0, -1);
        } else if (val === 'OK') {
            submitChannel();
        } else {
            inputField.value += val;
        }
        inputField.focus();
    });
});

let channelInput = document.getElementById('channel-input');
if (channelInput) {
    channelInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            submitChannel();
        }
    });
}

// Settings Modal Controls
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');

if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsModal.classList.toggle('hidden');
    });
}

const saveSettingsBtn = document.getElementById('save-settings');
if (saveSettingsBtn && settingsModal) {
    saveSettingsBtn.addEventListener('click', () => {
        localStorage.setItem('svrp_ptt_key', pttKey);
        localStorage.setItem('svrp_ptt_label', pttKeyLabel);
        localStorage.setItem('svrp_volume', radioState.volume);
        localStorage.setItem('svrp_volup_key', volUpKey);
        localStorage.setItem('svrp_voldown_key', volDownKey);
        syncGlobalShortcuts();
        settingsModal.classList.add('hidden');
    });
}

// Keybind remapping button clicks
document.getElementById('ptt-key-btn')?.addEventListener('click', () => {
    isListeningForPTT = true;
    isListeningForVolUp = false;
    isListeningForVolDown = false;
    document.getElementById('ptt-key-btn').innerText = "Press any key...";
});

document.getElementById('volup-key-btn')?.addEventListener('click', () => {
    isListeningForVolUp = true;
    isListeningForPTT = false;
    isListeningForVolDown = false;
    document.getElementById('volup-key-btn').innerText = "Press any key...";
});

document.getElementById('voldown-key-btn')?.addEventListener('click', () => {
    isListeningForVolDown = true;
    isListeningForPTT = false;
    isListeningForVolUp = false;
    document.getElementById('voldown-key-btn').innerText = "Press any key...";
});

// Global Keydown & Keyup Handler
window.addEventListener('keydown', (e) => {
    if (isListeningForPTT) {
        pttKey = e.code;
        pttKeyLabel = `${e.key.toUpperCase()} (${e.code})`;
        document.getElementById('ptt-key-btn').innerText = `PTT: ${pttKeyLabel}`;
        isListeningForPTT = false;
        e.preventDefault();
        return;
    }

    if (isListeningForVolUp) {
        volUpKey = e.code;
        document.getElementById('volup-key-btn').innerText = `Vol Up: ${volUpKey}`;
        isListeningForVolUp = false;
        e.preventDefault();
        return;
    }

    if (isListeningForVolDown) {
        volDownKey = e.code;
        document.getElementById('voldown-key-btn').innerText = `Vol Down: ${volDownKey}`;
        isListeningForVolDown = false;
        e.preventDefault();
        return;
    }

    // Volume Up Hotkey
    if (e.code === volUpKey && radioState.isOn) {
        radioState.volume = Math.min(100, radioState.volume + 5);
        updateDisplay();
        return;
    }

    // Volume Down Hotkey
    if (e.code === volDownKey && radioState.isOn) {
        radioState.volume = Math.max(0, radioState.volume - 5);
        updateDisplay();
        return;
    }

    // PTT Transmit Trigger (Press)
    if (e.code === pttKey && !isTransmitting && radioState.isOn) {
        isTransmitting = true;
        playSound(pttStartSound);
        console.log("PTT Active: Transmitting audio...");
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === pttKey && isTransmitting) {
        isTransmitting = false;
        playSound(pttEndSound);
        console.log("PTT Released: Muted.");
    }
});

// Send keybinds to main.js to register them globally
function syncGlobalShortcuts() {
    ipcRenderer.send('register-shortcuts', {
        pttKey: pttKey,
        volUpKey: volUpKey,
        volDownKey: volDownKey
    });
}