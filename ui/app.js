const path = require('path');
const CONFIG = require(path.join(__dirname, '../config.js'));

let ws;

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

let radioState = {
    isOn: false,
    channel: 0,
    channelName: "---",
    volume: 30,
    isTyping: false
};

// Initialize elements and WebSocket on load
window.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    let container = document.getElementById('radio-container');
    if (container) {
        container.classList.remove('hidden');
    }
    updateDisplay();
    setupMicrophone();
});

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
                channelDisplay.innerText = radioState.channel > 0 ? radioState.channelName : "MUTE";
            }
        }
    }
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
    radioState.channelName = `Channel ${newChannel}`;
    updateDisplay();

    // Send the channel update to your live server endpoint
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

// Power Knob Click -> Toggle On/Off
const powerKnob = document.getElementById('power-knob');
if (powerKnob) {
    powerKnob.addEventListener('click', function() {
        radioState.isOn = !radioState.isOn;
        updateDisplay();
    });
}

// Click Screen -> Activate Direct On-Screen Typing
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

// Keypad Button Clicks
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

// Initialize microphone stream capture
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

// Add PTT state variables
let pttKey = "ControlLeft"; // Default PTT key
let isListeningForKey = false;
let isTransmitting = false;

// Open/Close Settings Modal
document.getElementById('settings-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    let modal = document.getElementById('settings-modal');
    modal.classList.toggle('hidden');
});

document.getElementById('save-settings').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
});

// Key capture for PTT configuration
let pttBtn = document.getElementById('ptt-key-btn');
pttBtn.addEventListener('click', () => {
    isListeningForKey = true;
    pttBtn.innerText = "Press any key...";
});

window.addEventListener('keydown', (e) => {
    if (isListeningForKey) {
        pttKey = e.code;
        pttBtn.innerText = `PTT: ${e.key.toUpperCase()} (${e.code})`;
        isListeningForKey = false;
        e.preventDefault();
        return;
    }

    // PTT Transmit Trigger (Press)
    if (e.code === pttKey && !isTransmitting && radioState.isOn) {
        isTransmitting = true;
        console.log("PTT Active: Transmitting audio...");
        // Unmute mediaRecorder stream or send active signal if needed
    }
});

window.addEventListener('keyup', (e) => {
    // PTT Release Trigger
    if (e.code === pttKey && isTransmitting) {
        isTransmitting = false;
        console.log("PTT Released: Muted.");
    }
});