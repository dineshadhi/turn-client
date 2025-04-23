// DOM Elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const turnUrlInput = document.getElementById('turnUrl');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const turnUrlInput2 = document.getElementById('turnUrl2');
const usernameInput2 = document.getElementById('username2');
const passwordInput2 = document.getElementById('password2');
const separateCredentialsToggle = document.getElementById('separateCredentials');
const secondaryCredentialsSection = document.getElementById('secondaryCredentials');
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const localStatusDiv = document.getElementById('localStatus');
const remoteStatusDiv = document.getElementById('remoteStatus');
const localIceInfo = document.getElementById('localIceInfo');
const remoteIceInfo = document.getElementById('remoteIceInfo');
const timerDiv = document.getElementById('timer');

// WebRTC configuration
let peerConnection1;
let peerConnection2;
let localStream;
let timerInterval;
let startTime;
let localRelayIp = '';
let remoteRelayIp = '';

// Load saved credentials from localStorage
function loadSavedCredentials() {
    turnUrlInput.value = localStorage.getItem('turnUrl') || '';
    usernameInput.value = localStorage.getItem('username') || '';
    passwordInput.value = localStorage.getItem('password') || '';
    turnUrlInput2.value = localStorage.getItem('turnUrl2') || '';
    usernameInput2.value = localStorage.getItem('username2') || '';
    passwordInput2.value = localStorage.getItem('password2') || '';

    // Load TURN URL history for datalists
    const turnUrlHistory = JSON.parse(localStorage.getItem('turnUrlHistory') || '[]');
    const turnUrlHistoryElem = document.getElementById('turnUrlHistory');
    turnUrlHistoryElem.innerHTML = '';
    turnUrlHistory.forEach(url => {
        const option = document.createElement('option');
        option.value = url;
        turnUrlHistoryElem.appendChild(option);
    });
    const turnUrl2History = JSON.parse(localStorage.getItem('turnUrl2History') || '[]');
    const turnUrl2HistoryElem = document.getElementById('turnUrl2History');
    turnUrl2HistoryElem.innerHTML = '';
    turnUrl2History.forEach(url => {
        const option = document.createElement('option');
        option.value = url;
        turnUrl2HistoryElem.appendChild(option);
    });

    // Load toggle state
    const useSeparateCredentials = localStorage.getItem('useSeparateCredentials') === 'true';
    separateCredentialsToggle.checked = useSeparateCredentials;
    if (useSeparateCredentials) {
        secondaryCredentialsSection.classList.add('visible');
    }
}

// Save credentials to localStorage
function saveCredentials() {
    localStorage.setItem('turnUrl', turnUrlInput.value);
    localStorage.setItem('username', usernameInput.value);
    localStorage.setItem('password', passwordInput.value);
    localStorage.setItem('turnUrl2', turnUrlInput2.value);
    localStorage.setItem('username2', usernameInput2.value);
    localStorage.setItem('password2', passwordInput2.value);
    localStorage.setItem('useSeparateCredentials', separateCredentialsToggle.checked);

    // Update TURN URL history for both inputs
    let turnUrlHistory = JSON.parse(localStorage.getItem('turnUrlHistory') || '[]');
    if (turnUrlInput.value && !turnUrlHistory.includes(turnUrlInput.value)) {
        turnUrlHistory.push(turnUrlInput.value);
        localStorage.setItem('turnUrlHistory', JSON.stringify(turnUrlHistory));
    }
    let turnUrl2History = JSON.parse(localStorage.getItem('turnUrl2History') || '[]');
    if (turnUrlInput2.value && !turnUrl2History.includes(turnUrlInput2.value)) {
        turnUrl2History.push(turnUrlInput2.value);
        localStorage.setItem('turnUrl2History', JSON.stringify(turnUrl2History));
    }
}

// Initialize local video stream
async function initializeLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        updateLocalStatus('ready');
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Error accessing camera and microphone. Please ensure you have granted the necessary permissions.');
        updateLocalStatus('disconnected');
    }
}

// Format time as HH:MM:SS
function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Start the timer
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        timerDiv.textContent = formatTime(elapsedTime);
    }, 1000);
}

// Stop the timer
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerDiv.textContent = '00:00:00';
}

// Helper function to extract IP and port from ICE candidate
function extractIpAndPortFromCandidate(candidate) {
    // Split the candidate string by spaces
    const tokens = candidate.trim().split(/\s+/);
    // The IP is the 5th token, port is the 6th
    const ip = tokens[4] || 'Unknown IP';
    const port = tokens[5] || 'Unknown Port';
    return `${ip}:${port}`;
}

// Create and configure peer connection
function createPeerConnections() {
    const useSeparateCredentials = separateCredentialsToggle.checked;
    
    // Configuration for first peer connection
    const configuration1 = {
        iceTransportPolicy: 'relay',  // Force usage of TURN relay
        iceServers: [{
            urls: turnUrlInput.value,
            username: usernameInput.value,
            credential: passwordInput.value
        }]
    };
    
    // Configuration for second peer connection
    const configuration2 = {
        iceTransportPolicy: 'relay',  // Force usage of TURN relay
        iceServers: [{
            urls: useSeparateCredentials ? turnUrlInput2.value : turnUrlInput.value,
            username: useSeparateCredentials ? usernameInput2.value : usernameInput.value,
            credential: useSeparateCredentials ? passwordInput2.value : passwordInput.value
        }]
    };

    // Create two peer connections to simulate a real P2P connection
    peerConnection1 = new RTCPeerConnection(configuration1);
    peerConnection2 = new RTCPeerConnection(configuration2);

    // Add local stream to first peer connection
    localStream.getTracks().forEach(track => {
        peerConnection1.addTrack(track, localStream);
    });

    // Handle ICE candidates for both connections
    peerConnection1.onicecandidate = event => {
        if (event.candidate) {
            console.log('PC1 ICE candidate:', event.candidate);
            peerConnection2.addIceCandidate(event.candidate);
            if (event.candidate.type === 'relay') {
                localRelayIp = extractIpAndPortFromCandidate(event.candidate.candidate);
                updateLocalStatus('connected');
            }
        }
    };

    peerConnection2.onicecandidate = event => {
        if (event.candidate) {
            console.log('PC2 ICE candidate:', event.candidate);
            peerConnection1.addIceCandidate(event.candidate);
            if (event.candidate.type === 'relay') {
                remoteRelayIp = extractIpAndPortFromCandidate(event.candidate.candidate);
                updateRemoteStatus('connected');
            }
        }
    };

    // Handle connection state changes
    peerConnection1.onconnectionstatechange = () => {
        console.log('Connection state (PC1):', peerConnection1.connectionState);
        updateLocalStatus(peerConnection1.connectionState);
        
        if (peerConnection1.connectionState === 'connected') {
            startTimer();
            connectButton.disabled = true;
            disconnectButton.disabled = false;
        } else if (peerConnection1.connectionState === 'disconnected' || 
                   peerConnection1.connectionState === 'failed' || 
                   peerConnection1.connectionState === 'closed') {
            stopTimer();
            connectButton.disabled = false;
            disconnectButton.disabled = true;
            localRelayIp = '';
        }
    };

    peerConnection2.onconnectionstatechange = () => {
        console.log('Connection state (PC2):', peerConnection2.connectionState);
        updateRemoteStatus(peerConnection2.connectionState);
        
        if (peerConnection2.connectionState === 'disconnected' || 
            peerConnection2.connectionState === 'failed' || 
            peerConnection2.connectionState === 'closed') {
            remoteRelayIp = '';
        }
    };

    peerConnection1.oniceconnectionstatechange = () => {
        console.log('ICE Connection state (PC1):', peerConnection1.iceConnectionState);
        if (peerConnection1.iceConnectionState === 'connected') {
            updateLocalStatus('connected');
        }
    };

    peerConnection2.oniceconnectionstatechange = () => {
        console.log('ICE Connection state (PC2):', peerConnection2.iceConnectionState);
        if (peerConnection2.iceConnectionState === 'connected') {
            updateRemoteStatus('connected');
        }
    };

    // Handle remote stream
    peerConnection2.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };
}

// Update local connection status UI
function updateLocalStatus(state) {
    const statusIcon = localStatusDiv.querySelector('i');
    const statusText = localStatusDiv.querySelector('span');
    
    if (state === 'connected' && localRelayIp) {
        statusText.textContent = `Connected - ${localRelayIp}`;
    } else if (state === 'ready') {
        statusText.textContent = 'Camera Ready';
    } else {
        statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1);
    }
    
    if (state === 'connected') {
        localStatusDiv.className = 'video-status connected';
        statusIcon.className = 'fas fa-circle';
    } else if (state === 'connecting') {
        localStatusDiv.className = 'video-status connecting';
        statusIcon.className = 'fas fa-spinner fa-spin';
    } else if (state === 'ready') {
        localStatusDiv.className = 'video-status ready';
        statusIcon.className = 'fas fa-circle';
    } else {
        localStatusDiv.className = 'video-status disconnected';
        statusIcon.className = 'fas fa-circle';
    }
}

// Update remote connection status UI
function updateRemoteStatus(state) {
    const statusIcon = remoteStatusDiv.querySelector('i');
    const statusText = remoteStatusDiv.querySelector('span');
    
    if (state === 'connected' && remoteRelayIp) {
        statusText.textContent = `Connected - ${remoteRelayIp}`;
    } else {
        statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1);
    }
    
    if (state === 'connected') {
        remoteStatusDiv.className = 'video-status connected';
        statusIcon.className = 'fas fa-circle';
    } else if (state === 'connecting') {
        remoteStatusDiv.className = 'video-status connecting';
        statusIcon.className = 'fas fa-spinner fa-spin';
    } else {
        remoteStatusDiv.className = 'video-status disconnected';
        statusIcon.className = 'fas fa-circle';
    }
}

// Disconnect function
async function disconnect() {
    try {
        if (peerConnection1) {
            peerConnection1.close();
        }
        if (peerConnection2) {
            peerConnection2.close();
        }
        stopTimer();
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        localRelayIp = '';
        remoteRelayIp = '';
        updateLocalStatus('disconnected');
        updateRemoteStatus('disconnected');
    } catch (error) {
        console.error('Error disconnecting:', error);
    }
}

// Connect to TURN server
async function connect() {
    try {
        if (!localStream) {
            await initializeLocalStream();
        }

        saveCredentials();
        createPeerConnections();

        // Create and set local description on first peer
        const offer = await peerConnection1.createOffer();
        await peerConnection1.setLocalDescription(offer);

        // Set the offer as remote description on second peer
        await peerConnection2.setRemoteDescription(offer);

        // Create answer from second peer
        const answer = await peerConnection2.createAnswer();
        await peerConnection2.setLocalDescription(answer);

        // Set answer as remote description on first peer
        await peerConnection1.setRemoteDescription(answer);

        updateLocalStatus('connecting');
        updateRemoteStatus('connecting');
    } catch (error) {
        console.error('Error connecting to TURN server:', error);
        alert('Error connecting to TURN server. Please check your credentials and try again.');
        updateLocalStatus('disconnected');
        updateRemoteStatus('disconnected');
    }
}

// Toggle secondary credentials section
function toggleSecondaryCredentials() {
    if (separateCredentialsToggle.checked) {
        secondaryCredentialsSection.classList.add('visible');
    } else {
        secondaryCredentialsSection.classList.remove('visible');
    }
    saveCredentials();
}

// Event Listeners
connectButton.addEventListener('click', connect);
disconnectButton.addEventListener('click', disconnect);
separateCredentialsToggle.addEventListener('change', toggleSecondaryCredentials);

// Enhance: update TURN URL history on input blur/change
turnUrlInput.addEventListener('blur', saveCredentials);
turnUrlInput.addEventListener('change', saveCredentials);
turnUrlInput2.addEventListener('blur', saveCredentials);
turnUrlInput2.addEventListener('change', saveCredentials);

// Initialize
loadSavedCredentials();
initializeLocalStream(); 