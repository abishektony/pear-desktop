// Pear Connect Web Client
class PearConnectClient {
    constructor() {
        this.ws = null;
        this.token = localStorage.getItem('pear-token');
        this.deviceName = localStorage.getItem('pear-device-name') || '';
        this.isPlaying = false;
        this.currentState = null;
        this.lastQueue = null;
        this.audioElement = null;
        
        this.initElements();
        this.initEventListeners();
        this.loadDeviceName();
        this.initMediaSession();
        
        // Check for pairing code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            this.pairingCodeInput.value = code;
            // Remove code from URL to prevent re-use/sharing
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Auto-connect if token exists or code is present
        if (this.token) {
            this.connect();
        } else if (code) {
            // Allow time for device name to load
            setTimeout(() => this.handleConnect(), 100);
        }
    }

    initElements() {
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.errorMessage = document.getElementById('errorMessage');
        this.authCard = document.getElementById('authCard');
        this.playerCard = document.getElementById('playerCard');
        
        // Auth elements
        this.deviceNameInput = document.getElementById('deviceName');
        this.pairingCodeInput = document.getElementById('pairingCode');
        this.connectBtn = document.getElementById('connectBtn');
        
        // Player elements
        this.trackThumbnail = document.getElementById('trackThumbnail');
        this.trackTitle = document.getElementById('trackTitle');
        this.trackArtist = document.getElementById('trackArtist');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.currentTime = document.getElementById('currentTime');
        this.duration = document.getElementById('duration');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.playIcon = document.getElementById('playIcon');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.queueList = document.getElementById('queueList');
    }

    initEventListeners() {
        this.connectBtn.addEventListener('click', () => this.handleConnect());
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.prevBtn.addEventListener('click', () => this.previous());
        this.nextBtn.addEventListener('click', () => this.next());
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.progressBar.addEventListener('click', (e) => this.handleSeek(e));
        
        // Allow Enter key to connect
        this.pairingCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleConnect();
        });
    }

    loadDeviceName() {
        if (this.deviceName) {
            this.deviceNameInput.value = this.deviceName;
        } else {
            // Generate a default name
            const userAgent = navigator.userAgent;
            let defaultName = 'Mobile Device';
            
            if (/iPhone/.test(userAgent)) defaultName = 'iPhone';
            else if (/iPad/.test(userAgent)) defaultName = 'iPad';
            else if (/Android/.test(userAgent)) defaultName = 'Android Device';
            
            this.deviceNameInput.value = defaultName;
        }
    }

    initMediaSession() {
        if (!('mediaSession' in navigator)) {
            console.log('[Pear Connect] MediaSession API not supported');
            return;
        }

        // Set up media session action handlers
        navigator.mediaSession.setActionHandler('play', () => {
            console.log('[Pear Connect] MediaSession: play');
            this.togglePlayPause();
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            console.log('[Pear Connect] MediaSession: pause');
            this.togglePlayPause();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            console.log('[Pear Connect] MediaSession: previous');
            this.previous();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            console.log('[Pear Connect] MediaSession: next');
            this.next();
        });

        navigator.mediaSession.setActionHandler('seekbackward', () => {
            console.log('[Pear Connect] MediaSession: seek backward');
            if (this.currentState && this.currentState.currentTime > 10) {
                this.sendMessage({ 
                    type: 'SEEK', 
                    payload: this.currentState.currentTime - 10,
                    timestamp: Date.now() 
                });
            }
        });

        navigator.mediaSession.setActionHandler('seekforward', () => {
            console.log('[Pear Connect] MediaSession: seek forward');
            if (this.currentState && this.currentState.currentTime + 10 < this.currentState.duration) {
                this.sendMessage({ 
                    type: 'SEEK', 
                    payload: this.currentState.currentTime + 10,
                    timestamp: Date.now() 
                });
            }
        });

        // Try to set seekto handler (not supported on all browsers)
        try {
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                console.log('[Pear Connect] MediaSession: seek to', details.seekTime);
                if (details.seekTime !== null && details.seekTime !== undefined) {
                    this.sendMessage({ 
                        type: 'SEEK', 
                        payload: details.seekTime,
                        timestamp: Date.now() 
                    });
                }
            });
        } catch (e) {
            console.log('[Pear Connect] seekto action not supported');
        }

        console.log('[Pear Connect] MediaSession initialized');
    }

    updateMediaSession(state) {
        if (!('mediaSession' in navigator) || !state || !state.trackInfo) {
            return;
        }

        // Update metadata
        navigator.mediaSession.metadata = new MediaMetadata({
            title: state.trackInfo.title || 'Unknown Track',
            artist: state.trackInfo.artist || 'Unknown Artist',
            album: state.trackInfo.album || '',
            artwork: state.trackInfo.thumbnail ? [
                { src: state.trackInfo.thumbnail, sizes: '512x512', type: 'image/jpeg' }
            ] : []
        });

        // Update playback state
        navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';

        // Update position state
        if (state.duration > 0) {
            navigator.mediaSession.setPositionState({
                duration: state.duration,
                playbackRate: 1.0,
                position: Math.min(state.currentTime, state.duration)
            });
        }
    }

    async handleConnect() {
        const deviceName = this.deviceNameInput.value.trim();
        const pairingCode = this.pairingCodeInput.value.trim();
        
        if (!deviceName) {
            this.showError('Please enter a device name');
            return;
        }
        
        this.deviceName = deviceName;
        localStorage.setItem('pear-device-name', deviceName);
        
        this.connectBtn.disabled = true;
        this.connectBtn.textContent = 'Connecting...';
        
        try {
            await this.connect(pairingCode || undefined);
        } catch (error) {
            this.showError('Connection failed: ' + error.message);
            this.connectBtn.disabled = false;
            this.connectBtn.textContent = 'Connect';
        }
    }

    async connect(pairingCode) {
        return new Promise((resolve, reject) => {
            // Get WebSocket URL from current location
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateStatus('connected', 'Connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message, pairingCode, resolve, reject);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('disconnected', 'Connection Error');
                reject(new Error('WebSocket connection failed'));
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.updateStatus('disconnected', 'Disconnected');
                this.showAuthCard();
                setTimeout(() => {
                    if (this.token) {
                        this.connect();
                    }
                }, 5000);
            };
        });
    }

    handleMessage(message, pairingCode, resolve, reject) {
        console.log('[Pear Connect Client] Received:', message.type, message.payload ? '(with payload)' : '(no payload)');
        
        switch (message.type) {
            case 'DEVICE_INFO':
                // Send auth request
                this.sendMessage({
                    type: 'AUTH_REQUEST',
                    payload: {
                        deviceName: this.deviceName,
                        deviceType: this.getDeviceType(),
                        token: this.token,
                        pairingCode: pairingCode
                    },
                    timestamp: Date.now()
                });
                break;
                
            case 'AUTH_SUCCESS':
                this.token = message.payload.token;
                localStorage.setItem('pear-token', this.token);
                this.showPlayerCard();
                this.connectBtn.disabled = false;
                this.connectBtn.textContent = 'Connect';
                this.hideError();
                
                // Request initial queue after successful auth
                console.log('[Pear Connect Client] Auth successful, requesting initial queue...');
                setTimeout(() => {
                    this.sendMessage({ type: 'GET_QUEUE', timestamp: Date.now() });
                }, 500);
                
                if (resolve) resolve();
                break;
                
            case 'AUTH_FAILED':
                this.token = null;
                localStorage.removeItem('pear-token');
                this.showError('Authentication failed: ' + (message.payload.reason || 'Unknown error'));
                this.showAuthCard();
                this.connectBtn.disabled = false;
                this.connectBtn.textContent = 'Connect';
                if (reject) reject(new Error(message.payload.reason));
                break;
                
            case 'AUTH_RESPONSE':
                // Show pairing code if needed
                this.showError('Please enter the pairing code: ' + message.payload.pairingCode);
                this.connectBtn.disabled = false;
                this.connectBtn.textContent = 'Connect';
                break;
                
            case 'STATE_UPDATE':
                this.updatePlayerState(message.payload);
                break;
                
            case 'QUEUE_UPDATE':
                this.updateQueue(message.payload);
                break;
                
            case 'ERROR':
                this.showError(message.payload.error);
                break;
                
            case 'PONG':
                // Handle pong
                break;
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    updatePlayerState(state) {
        const oldVideoId = this.currentState?.trackInfo?.videoId;
        const newVideoId = state.trackInfo?.videoId;
        
        this.currentState = state;
        this.isPlaying = state.isPlaying;
        
        // Update play/pause button
        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
        }
        
        // Update track info
        if (state.trackInfo) {
            this.trackTitle.textContent = state.trackInfo.title || 'Unknown';
            this.trackArtist.textContent = state.trackInfo.artist || 'Unknown';
            if (state.trackInfo.thumbnail) {
                this.trackThumbnail.src = state.trackInfo.thumbnail;
            }
        }
        
        // Update progress
        const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
        this.progressFill.style.width = progress + '%';
        this.currentTime.textContent = this.formatTime(state.currentTime);
        this.duration.textContent = this.formatTime(state.duration);
        
        // Update volume
        this.volumeSlider.value = state.volume;
        
        // Update MediaSession
        this.updateMediaSession(state);
        
        // If the video changed, update queue highlighting
        if (oldVideoId && newVideoId && oldVideoId !== newVideoId) {
            console.log('[Pear Connect Client] Track changed from', oldVideoId, 'to', newVideoId, '- updating queue highlighting');
            // Update highlighting immediately
            this.updateQueueHighlighting();
            // Also re-render queue to ensure sync
            if (this.lastQueue && this.lastQueue.length > 0) {
                setTimeout(() => {
                    if (this.lastQueue) {
                        console.log('[Pear Connect Client] Re-rendering queue with new current track');
                        this.updateQueue(this.lastQueue);
                    }
                }, 100);
            }
        }
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.sendMessage({ type: 'PAUSE', timestamp: Date.now() });
        } else {
            this.sendMessage({ type: 'PLAY', timestamp: Date.now() });
        }
    }

    previous() {
        this.sendMessage({ type: 'PREVIOUS', timestamp: Date.now() });
    }

    next() {
        this.sendMessage({ type: 'NEXT', timestamp: Date.now() });
    }

    setVolume(volume) {
        this.sendMessage({ 
            type: 'SET_VOLUME', 
            payload: parseInt(volume),
            timestamp: Date.now() 
        });
    }

    handleSeek(event) {
        if (!this.currentState || !this.currentState.duration) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percentage = x / rect.width;
        const seekTime = this.currentState.duration * percentage;
        
        this.sendMessage({ 
            type: 'SEEK', 
            payload: seekTime,
            timestamp: Date.now() 
        });
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateQueue(queue) {
        console.log('[Pear Connect Client] ========== QUEUE UPDATE START ==========');
        console.log('[Pear Connect Client] Queue data:', queue);
        console.log('[Pear Connect Client] Queue length:', queue ? queue.length : 'null');
        console.log('[Pear Connect Client] Queue list element:', this.queueList);
        
        if (!queue || queue.length === 0) {
            console.log('[Pear Connect Client] Queue is empty, showing empty message');
            this.queueList.innerHTML = '<div class="queue-empty">No tracks in queue</div>';
            this.lastQueue = null;
            console.log('[Pear Connect Client] ========== QUEUE UPDATE END (EMPTY) ==========');
            return;
        }

        // Store queue for re-highlighting
        this.lastQueue = queue;
        
        console.log('[Pear Connect Client] Clearing queue list and rendering', queue.length, 'items');
        this.queueList.innerHTML = '';
        
        const currentVideoId = this.currentState?.trackInfo?.videoId;
        console.log('[Pear Connect Client] Current playing videoId:', currentVideoId);
        
        let currentItemElement = null;
        let currentIndex = -1;
        
        // First pass: find the current playing index
        queue.forEach((item, index) => {
            if (item.isPlaying === true) {
                currentIndex = index;
            }
        });
        
        console.log('[Pear Connect Client] Current playing index:', currentIndex);
        
        queue.forEach((item, index) => {
            if (index < 3) { // Log first 3 items for debugging
                console.log('[Pear Connect Client] Item', index, ':', item.title, '-', item.artist, 'videoId:', item.videoId, 'isPlaying:', item.isPlaying);
            }
            
            const queueItem = document.createElement('div');
            queueItem.className = 'queue-item';
            queueItem.dataset.videoId = item.videoId;
            queueItem.dataset.index = index;
            
            // Use isPlaying flag from server to determine current song
            const isCurrent = item.isPlaying === true;
            if (isCurrent) {
                queueItem.classList.add('current');
                currentItemElement = queueItem;
                console.log('[Pear Connect Client] Marking item', index, 'as current (isPlaying=true)');
            }
            
            // Add position badge relative to current position (0 = current, negative = played, positive = upcoming)
            let positionBadge = '';
            if (currentIndex >= 0) {
                const relativePos = index - currentIndex;
                if (relativePos === 0) {
                    positionBadge = '<span class="queue-item-badge now-playing">0 (Now Playing)</span>';
                } else if (relativePos === 1) {
                    positionBadge = '<span class="queue-item-badge up-next">+1 (Up Next)</span>';
                } else if (relativePos > 1) {
                    positionBadge = `<span class="queue-item-badge position">+${relativePos}</span>`;
                } else if (relativePos < 0) {
                    positionBadge = `<span class="queue-item-badge played">${relativePos}</span>`;
                }
            } else {
                // Fallback if no current found
                positionBadge = `<span class="queue-item-badge position">#${index + 1}</span>`;
            }

            queueItem.innerHTML = `
                <img class="queue-item-thumbnail" src="${item.thumbnail || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\'%3E%3Crect fill=\'%23ddd\' width=\'48\' height=\'48\'/%3E%3C/svg%3E'}" alt="">
                <div class="queue-item-info">
                    <div class="queue-item-title">${item.title}</div>
                    <div class="queue-item-artist">${item.artist}</div>
                </div>
                ${positionBadge}
                <div class="queue-item-duration">${this.formatTime(item.duration)}</div>
            `;

            queueItem.addEventListener('click', () => {
                this.playQueueItem(index);
            });

            this.queueList.appendChild(queueItem);
        });
        
        // Scroll to current item after rendering
        if (currentItemElement) {
            setTimeout(() => {
                currentItemElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                console.log('[Pear Connect Client] Scrolled to current item');
            }, 100);
        }
        
        console.log('[Pear Connect Client] Queue rendering complete. DOM children:', this.queueList.children.length);
        console.log('[Pear Connect Client] ========== QUEUE UPDATE END ==========');
    }

    updateQueueHighlighting() {
        if (!this.lastQueue) {
            return;
        }
        
        console.log('[Pear Connect Client] Updating queue highlighting');
        
        // Remove current class from all items
        const allItems = this.queueList.querySelectorAll('.queue-item');
        allItems.forEach(item => item.classList.remove('current'));
        
        // Find the item marked as playing in the queue data
        let currentItemElement = null;
        const currentIndex = this.lastQueue.findIndex(item => item.isPlaying === true);
        
        if (currentIndex >= 0 && allItems[currentIndex]) {
            allItems[currentIndex].classList.add('current');
            currentItemElement = allItems[currentIndex];
            console.log('[Pear Connect Client] Highlighted item at index', currentIndex, 'as current (isPlaying=true)');
        } else {
            console.log('[Pear Connect Client] No item marked as isPlaying in queue data');
        }
        
        // Scroll to current item
        if (currentItemElement) {
            setTimeout(() => {
                currentItemElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                console.log('[Pear Connect Client] Scrolled to current item');
            }, 100);
        }
    }

    playQueueItem(index) {
        this.sendMessage({ 
            type: 'PLAY_QUEUE_ITEM', 
            payload: index-currentIndex,
            timestamp: Date.now() 
        });
    }

    getDeviceType() {
        const ua = navigator.userAgent;
        if (/iPad/.test(ua)) return 'tablet';
        if (/Mobile|Android|iPhone/.test(ua)) return 'mobile';
        return 'desktop';
    }

    updateStatus(status, text) {
        this.statusText.textContent = text;
        if (status === 'connected') {
            this.statusDot.classList.add('connected');
        } else {
            this.statusDot.classList.remove('connected');
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.add('show');
        setTimeout(() => this.hideError(), 5000);
    }

    hideError() {
        this.errorMessage.classList.remove('show');
    }

    showAuthCard() {
        this.authCard.style.display = 'block';
        this.playerCard.classList.remove('active');
    }

    showPlayerCard() {
        this.authCard.style.display = 'none';
        this.playerCard.classList.add('active');
        
        // Request audio focus to activate MediaSession
        this.activateMediaSession();
    }

    activateMediaSession() {
        // Create a silent audio element to gain audio focus and activate MediaSession
        if ('mediaSession' in navigator && !this.audioElement) {
            this.audioElement = document.createElement('audio');
            this.audioElement.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
            this.audioElement.loop = true;
            this.audioElement.volume = 0;
            
            // Play silent audio to activate media session
            this.audioElement.play().then(() => {
                console.log('[Pear Connect] MediaSession activated');
            }).catch(err => {
                console.log('[Pear Connect] Failed to activate MediaSession:', err);
            });
        }
    }
}

// Initialize client when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PearConnectClient();
});
