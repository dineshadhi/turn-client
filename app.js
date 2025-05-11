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
const mediaSourceSelect = document.getElementById('mediaSource');
const themeToggle = document.getElementById('themeToggle');
const maximizeButtons = document.querySelectorAll('.maximize-btn');

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
    mediaSourceSelect.value = localStorage.getItem('mediaSource') || 'camera';

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
    localStorage.setItem('mediaSource', mediaSourceSelect.value);

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
        // Stop any existing stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        const mediaSource = mediaSourceSelect.value;
        
        if (mediaSource === 'camera') {
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
        } else if (mediaSource === 'screen') {
            // For screen sharing we need to use getDisplayMedia
            localStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: {
                    cursor: 'always'
                },
                audio: true 
            });
            
            // Add event listener to detect when user stops sharing
            localStream.getVideoTracks()[0].addEventListener('ended', () => {
                // Reset to camera when user stops screen sharing
                mediaSourceSelect.value = 'camera';
                saveCredentials();
                initializeLocalStream();
            });
        }
        
        localVideo.srcObject = localStream;
        updateLocalStatus('ready');
    } catch (error) {
        console.error('Error accessing media devices:', error);
        showToast('Error accessing media devices. Please ensure you have granted the necessary permissions.', 'error');
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

// Show toast notification
function showToast(message, type = 'info') {
    // Check if a toast container exists, create one if not
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
        
        // Add toast container styles
        const style = document.createElement('style');
        style.textContent = `
            .toast-container {
                position: fixed;
                bottom: 1rem;
                right: 1rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                z-index: 1000;
                max-width: 350px;
            }
            .toast {
                padding: 0.75rem 1rem;
                border-radius: var(--radius);
                box-shadow: var(--shadow-md);
                display: flex;
                align-items: center;
                gap: 0.5rem;
                animation: slideIn 0.3s ease, fadeOut 0.5s ease 2.5s forwards;
                pointer-events: auto;
                width: 100%;
            }
            .toast-info {
                background-color: var(--secondary);
                color: var(--secondary-foreground);
                border-left: 4px solid var(--primary);
            }
            .toast-error {
                background-color: rgba(239, 68, 68, 0.15);
                color: rgb(239, 68, 68);
                border-left: 4px solid var(--destructive);
            }
            .toast-success {
                background-color: rgba(34, 197, 94, 0.15);
                color: rgb(34, 197, 94);
                border-left: 4px solid rgb(34, 197, 94);
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon
    const icon = document.createElement('i');
    if (type === 'info') icon.className = 'fas fa-info-circle';
    else if (type === 'error') icon.className = 'fas fa-exclamation-circle';
    else if (type === 'success') icon.className = 'fas fa-check-circle';
    
    // Message
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(messageSpan);
    toastContainer.appendChild(toast);
    
    // Remove toast after animation
    setTimeout(() => {
        toast.remove();
    }, 3000);
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
            showToast('Connection established successfully', 'success');
        } else if (peerConnection1.connectionState === 'disconnected' || 
                   peerConnection1.connectionState === 'failed' || 
                   peerConnection1.connectionState === 'closed') {
            stopTimer();
            connectButton.disabled = false;
            disconnectButton.disabled = true;
            localRelayIp = '';
            if (peerConnection1.connectionState === 'failed') {
                showToast('Connection failed', 'error');
            }
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
        showToast('Disconnected successfully', 'info');
    } catch (error) {
        console.error('Error disconnecting:', error);
        showToast('Error while disconnecting', 'error');
    }
}

// Connect to TURN server
async function connect() {
    try {
        if (!localStream) {
            await initializeLocalStream();
        }

        saveCredentials();
        
        // Validate inputs
        if (!turnUrlInput.value) {
            showToast('Please enter a TURN server URL', 'error');
            turnUrlInput.focus();
            return;
        }
        
        if (!usernameInput.value || !passwordInput.value) {
            showToast('Please enter username and password', 'error');
            usernameInput.focus();
            return;
        }
        
        const useSeparateCredentials = separateCredentialsToggle.checked;
        if (useSeparateCredentials && (!turnUrlInput2.value || !usernameInput2.value || !passwordInput2.value)) {
            showToast('Please enter all secondary credentials', 'error');
            turnUrlInput2.focus();
            return;
        }

        showToast('Connecting to TURN server...', 'info');
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
        showToast('Error connecting to TURN server. Please check your credentials.', 'error');
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

// Handle video maximize/minimize
function toggleMaximizeVideo(event) {
    const button = event.currentTarget;
    const videoCard = button.closest('.video-card');
    const videoWrapper = button.closest('.video-wrapper');

    // Add checks for elements
    if (!button || !videoCard || !videoWrapper) {
        console.error('Could not find necessary elements for video maximization.');
        return;
    }

    console.log(`Toggling maximize for wrapper:`, videoWrapper);
    const isMaximized = videoWrapper.classList.toggle('maximized');
    console.log(`Wrapper is now maximized: ${isMaximized}`);

    // Manage body overflow
    if (isMaximized) {
        console.log('Hiding body overflow');
        document.body.style.overflow = 'hidden';
    } else {
        console.log('Restoring body overflow');
        document.body.style.overflow = '';
    }
}

// Event Listeners
connectButton.addEventListener('click', connect);
disconnectButton.addEventListener('click', disconnect);
separateCredentialsToggle.addEventListener('change', toggleSecondaryCredentials);
mediaSourceSelect.addEventListener('change', () => {
    saveCredentials();
    initializeLocalStream();
});

maximizeButtons.forEach(button => {
    if (button) { // Check if button exists before adding listener
        button.addEventListener('click', toggleMaximizeVideo);
    } else {
        console.error('Found a null element in maximizeButtons NodeList');
    }
});

// Enhance: update TURN URL history on input blur/change
turnUrlInput.addEventListener('blur', saveCredentials);
turnUrlInput.addEventListener('change', saveCredentials);
turnUrlInput2.addEventListener('blur', saveCredentials);
turnUrlInput2.addEventListener('change', saveCredentials);

// Handle dark mode toggle
function initializeThemeToggle() {
    const themeIcon = themeToggle.querySelector('i');
    
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const prefersDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);

    if (prefersDark) {
        document.body.classList.add('dark');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
    
    // Add event listener for theme toggle
    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        if (isDark) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    });
}

// Initialize theme toggle
initializeThemeToggle();

// Initialize
loadSavedCredentials();
initializeLocalStream(); 
