const path = require('path');
const CONFIG = require(path.join(__dirname, '../config.js'));

let ws;

function connectWebSocket() {
    // Uses the URL directly from your hidden config.js file[cite: 5]
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

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Automatically show the radio container when the desktop app launches[cite: 5]
window.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    let container = document.getElementById('radio-container');
    if (container) {
        container.classList.remove('hidden');
    }
    updateDisplay();
    setupMicrophone();
});

let container = document.getElementById('radio-container');

// Dragging Logic for Desktop Window[cite: 5]
if (container) {
    container.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        
        isDragging = true;
        let rect = container.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
    });
}

document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;

    if (container) {
        container.style.position = 'absolute';
        container.style.left = newX + 'px';
        container.style.top = newY + 'px';
    }
});

document.addEventListener('mouseup', function() {
    isDragging = false;
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

    // Send the channel update to your live server endpoint[cite: 5]
    fetch(`http://82.197.65.71:3001/api/radio/update`, {
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

// Power Knob Click -> Toggle On/Off[cite: 5]
const powerKnob = document.getElementById('power-knob');
if (powerKnob) {
    powerKnob.addEventListener('click', function() {
        radioState.isOn = !radioState.isOn;
        updateDisplay();
    });
}

// Click Screen -> Activate Direct On-Screen Typing[cite: 5]
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

// Keypad Button Clicks[cite: 5]
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

// Initialize microphone stream capture[cite: 5]
async function setupMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(event.data); // Send raw audio chunks to WebSocket server[cite: 5]
            }
        };

        mediaRecorder.start(100); // Capture chunks every 100ms[cite: 5]
        console.log("Microphone initialized for broadcasting.");
    } catch (err) {
        console.error("Microphone access denied or unavailable:", err);
    }
}