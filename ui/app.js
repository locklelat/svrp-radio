const path = require('path');
const CONFIG = require(path.join(__dirname, '../config.js'));

let ws = new WebSocket(CONFIG.WS_URL);

const path = require('path');
const CONFIG = require(path.join(__dirname, '../config.js'));

let ws;

function connectWebSocket() {
    // Uses the URL directly from your hidden config.js file
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

// Automatically show the radio container when the desktop app launches
window.addEventListener('DOMContentLoaded', () => {
    let container = document.getElementById('radio-container');
    container.classList.remove('hidden');
    updateDisplay();
});

let container = document.getElementById('radio-container');

// Dragging Logic for Desktop Window
container.addEventListener('mousedown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    
    isDragging = true;
    let rect = container.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
});

document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;

    container.style.position = 'absolute';
    container.style.left = newX + 'px';
    container.style.top = newY + 'px';
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

    volumeDisplay.innerText = `Vol: ${radioState.volume}%`;

    if (!radioState.isOn) {
        powerStatus.innerText = "OFF";
        powerStatus.style.color = "red";
        channelDisplay.innerText = "---";
        cancelTyping();
        screenHint.innerText = "";
    } else {
        powerStatus.innerText = "ON";
        powerStatus.style.color = "green";
        screenHint.innerText = radioState.isTyping ? "Enter" : "Tune";

        if (!radioState.isTyping) {
            inputContainer.classList.add('hidden');
            channelDisplay.classList.remove('hidden');
            channelDisplay.innerText = radioState.channel > 0 ? radioState.channelName : "MUTE";
        }
    }
}

function cancelTyping() {
    radioState.isTyping = false;
    document.getElementById('inline-input-container').classList.add('hidden');
    document.getElementById('channel-display').classList.remove('hidden');
    document.getElementById('channel-input').value = '';
}

function submitChannel() {
    let inputField = document.getElementById('channel-input');
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

    // Send the channel update to your live FiveM server API endpoint
    fetch(`https://your-fivem-server-ip:30120/svrp-radio/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            channel: newChannel,
            identifier: "some_unique_user_id" // Maps the desktop user to in-game
        })
    }).then(resp => resp.json()).catch(err => {
        console.log("Failed to sync channel with server:", err);
    });
}

// Power Knob Click -> Toggle On/Off
document.getElementById('power-knob').addEventListener('click', function() {
    radioState.isOn = !radioState.isOn;
    updateDisplay();
});

// Click Screen -> Activate Direct On-Screen Typing
document.getElementById('radio-screen').addEventListener('click', function(e) {
    if (!radioState.isOn) return;
    if (radioState.isTyping) return;

    radioState.isTyping = true;
    let channelDisplay = document.getElementById('channel-display');
    let inputContainer = document.getElementById('inline-input-container');
    let inputField = document.getElementById('channel-input');

    channelDisplay.classList.add('hidden');
    inputContainer.classList.remove('hidden');
    document.getElementById('screen-hint').innerText = "Enter";
    
    inputField.value = '';
    inputField.focus();
});

// Keypad Button Clicks
document.querySelectorAll('.num-btn').forEach(button => {
    button.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!radioState.isOn) return;
        
        if (!radioState.isTyping) {
            radioState.isTyping = true;
            document.getElementById('channel-display').classList.add('hidden');
            document.getElementById('inline-input-container').classList.remove('hidden');
            document.getElementById('screen-hint').innerText = "Enter";
            document.getElementById('channel-input').value = '';
        }

        let val = this.getAttribute('data-value');
        let inputField = document.getElementById('channel-input');

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

document.getElementById('channel-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        submitChannel();
    }
});

// Initialize microphone stream capture
async function setupMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(event.data); // Send raw audio chunks to WebSocket server
            }
        };

        mediaRecorder.start(100); // Capture chunks every 100ms
        console.log("Microphone initialized for broadcasting.");
    } catch (err) {
        console.error("Microphone access denied or unavailable:", err);
    }
}

// Call connection setup when app loads
window.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    // Optional: bind PTT key (e.g., CapsLock or Left Ctrl) to start/stop broadcasting
});