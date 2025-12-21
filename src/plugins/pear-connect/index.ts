import { createPlugin } from '@/utils';
import { t } from '@/i18n';

import { defaultPearConnectConfig } from './config';
import { PearConnectBackend } from './backend';
import { PearConnectUIManager } from './ui/manager';

import type { MenuContext, BackendContext } from '@/types/contexts';

import type { PearConnectConfig } from './config';
import type { PlaybackState, QueueItem } from './types';
import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

import style from './style.css?inline';

let backendInstance: PearConnectBackend | null = null;

export default createPlugin({
  name: () => t('plugins.pear-connect.name'),
  description: () => t('plugins.pear-connect.description'),
  restartNeeded: false,
  addedVersion: '3.12.0',
  config: defaultPearConnectConfig,
  stylesheets: [style],

  menu: async ({ window }: MenuContext<PearConnectConfig>) => {
    return [
      {
        label: t('plugins.pear-connect.menu.show-qr'),
        click: () => {
          // Send message to renderer to show dialog
          window.webContents.send('pear-connect:show-dialog');
        },
      },
    ];
  },

  async backend({ window: win, getConfig }: BackendContext<PearConnectConfig>) {
    const config = await getConfig();
    backendInstance = new PearConnectBackend(config, win);
    backendInstance.start();

    return {
      onConfigChange(newConfig: PearConnectConfig) {
        backendInstance?.onConfigChange(newConfig);
      },
    };
  },

  renderer: {
    ipc: undefined as RendererContext<never>['ipc'] | undefined,
    playerApi: undefined as MusicPlayer | undefined,
    updateInterval: undefined as number | undefined,
    queueSyncInterval: undefined as number | undefined,
    lastState: undefined as PlaybackState | undefined,
    lastQueue: undefined as QueueItem[] | undefined,
    queueObserver: undefined as MutationObserver | undefined,
    sidebarObserver: undefined as MutationObserver | undefined,
    uiManager: undefined as PearConnectUIManager | undefined,
    dialog: undefined as HTMLElement | undefined,
    overlay: undefined as HTMLElement | undefined,
    // WebRTC audio streaming
    peerConnections: new Map<string, RTCPeerConnection>(),
    audioContext: undefined as AudioContext | undefined,
    mediaStream: undefined as MediaStream | undefined,
    currentLyrics: undefined as Array<{ time: number; text: string; translation?: string }> | undefined,


    async start({ ipc }) {
      this.ipc = ipc;

      // Listen for show dialog request from menu
      ipc.on('pear-connect:show-dialog', () => {
        (this as any).showConnectDialog();
      });

      // Listen for play queue item request
      ipc.on('pear-connect:play-queue-item', (index: number) => {
        try {
          (this as any).handlePlayQueueItem(index);
        } catch (error) {
          // Silent fail
        }
      });

      // Listen for playback control from backend
      ipc.on('pear-connect:playback-control', (action: string) => {
        (this as any).handlePlaybackControl(action);
      });

      // Listen for volume control from backend
      ipc.on('pear-connect:volume-control', (volume: number) => {
        (this as any).handleVolumeControl(volume);
      });

      // Listen for seek from backend
      ipc.on('pear-connect:seek', (time: number) => {
        (this as any).handleSeek(time);
      });

      // Listen for playback target changes
      ipc.on('pear-connect:playback-target-changed', (target: string) => {
        // Mute/unmute laptop based on target
        if (this.playerApi) {
          if (target === 'phone') {
            // Mute laptop when playing on phone only
            this.playerApi.mute();
          } else {
            // Unmute laptop for 'laptop' or 'both' modes
            this.playerApi.unMute();
          }
        }
        // If switching to phone or both, ensure audio streaming is active
        if (target === 'phone' || target === 'both') {
          (this as any).setupAudioCapture();
        }
      });

      // WebRTC Signaling - Handle RTC offer from phone
      ipc.on('pear-connect:rtc-offer', async (data: { clientId: string; offer: RTCSessionDescriptionInit }) => {
        await (this as any).handleRTCOffer(data.clientId, data.offer);
      });

      // WebRTC Signaling - Handle ICE candidate from phone
      ipc.on('pear-connect:rtc-ice-candidate', async (data: { clientId: string; candidate: RTCIceCandidateInit }) => {
        const pc = this.peerConnections.get(data.clientId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      });

      // Handle lyrics request
      ipc.on('pear-connect:get-lyrics', async () => {
        (this as any).sendLyricsUpdate();
      });

      // Add Pear Connect button to the UI (with retry)
      const injectButtons = () => {
        this.addConnectButton();
        this.addSidebarButton();
        // this.addFloatingButton();
      };

      // Try immediately and periodically to ensure they persist
      injectButtons();
      this.updateInterval = window.setInterval(injectButtons, 2000);

      // Start monitoring playback state
      (this as any).startStateMonitoring();

      // Monitor queue changes
      (this as any).startQueueMonitoring();

      // Listen for global click events on queue controls for instant updates
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Check if click is on queue-related elements
        if (target.closest('ytmusic-player-queue-item') ||
          target.closest('.play-button') ||
          target.closest('.queue') ||
          target.closest('[aria-label*="queue"]') ||
          target.closest('[aria-label*="Queue"]')) {
          setTimeout(() => (this as any).sendQueueUpdate(), 50);
        }
      }, true);
    },

    onPlayerApiReady(playerApi) {
      this.playerApi = playerApi;

      // Listen to state changes
      this.playerApi.addEventListener('onStateChange', () => {
        (this as any).sendStateUpdate();
        // Also update queue on state change (e.g., track ended, skipped)
        (this as any).sendQueueUpdate();
      });

      // Listen to video changes to update queue immediately
      this.playerApi.addEventListener('videodatachange', () => {
        // Update state immediately
        (this as any).sendStateUpdate();
        // Update queue immediately (no delay)
        (this as any).sendQueueUpdate();

        // Backup updates in case DOM wasn't ready (image/title update delay)
        // This ensures the UI eventually shows the correct song info if DOM was stale
        setTimeout(() => (this as any).sendStateUpdate(), 500);
        setTimeout(() => (this as any).sendStateUpdate(), 1000);
        setTimeout(() => (this as any).sendStateUpdate(), 2000);

        // Backup update for queue
        setTimeout(() => (this as any).sendQueueUpdate(), 100);
        setTimeout(() => (this as any).sendQueueUpdate(), 1000);
      });
    },

    stop() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }

      if (this.queueSyncInterval) {
        clearInterval(this.queueSyncInterval);
      }

      if (this.queueObserver) {
        this.queueObserver.disconnect();
      }

      if (this.uiManager) {
        this.uiManager.destroy();
        this.uiManager = undefined;
      }

      // Remove connect button
      const connectBtn = document.querySelector('#pear-connect-btn');
      if (connectBtn) {
        connectBtn.remove();
      }

      // Remove sidebar button
      const sidebarBtn = document.querySelector('#pear-connect-sidebar-item');
      if (sidebarBtn) {
        sidebarBtn.remove();
      }

      // Remove floating button
      const fabBtn = document.querySelector('#pear-connect-fab');
      if (fabBtn) {
        fabBtn.remove();
      }
    },

    addConnectButton(this: any) {
      // Try multiple selectors for the settings button
      const selectors = [
        '#right-content > ytmusic-settings-button',
        'ytmusic-settings-button',
        '#right-content ytmusic-menu-renderer tp-yt-paper-icon-button',
        'tp-yt-paper-icon-button.ytmusic-settings-button'
      ];

      let rightContent = null;
      for (const selector of selectors) {
        rightContent = document.querySelector(selector);
        if (rightContent) {
          break;
        }
      }

      if (!rightContent) {
        return;
      }

      // Check if button already exists
      if (document.querySelector('#pear-connect-btn')) {
        return;
      }

      const button = document.createElement('button');
      button.id = 'pear-connect-btn';
      button.className = 'pear-connect-icon';
      button.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M12,2C6.48,2,2,6.48,2,12c0,5.52,4.48,10,10,10s10-4.48,10-10C22,6.48,17.52,2,12,2z M12,20c-4.41,0-8-3.59-8-8 s3.59-8,8-8s8,3.59,8,8S16.41,20,12,20z M12,6c-3.31,0-6,2.69-6,6s2.69,6,6,6s6-2.69,6-6S15.31,6,12,6z M12,14c-1.1,0-2-0.9-2-2 s0.9-2,2-2s2,0.9,2,2S13.1,14,12,14z"/>
        </svg>
      `;
      button.title = 'Pear Connect';
      button.style.cssText = `
        background: none;
        border: none;
        padding: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 8px;
        border-radius: 50%;
        transition: background 0.2s;
      `;

      button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(255, 255, 255, 0.1)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.background = 'none';
      });

      button.addEventListener('click', () => {
        this.showConnectDialog();
      });

      rightContent.parentElement?.insertBefore(button, rightContent);
    },

    addSidebarButton(this: any) {
      // Check if already added
      if (document.getElementById('pear-connect-sidebar-item')) return;

      // Find the sidebar items container
      // We want the main navigation section (Home, Explore, Library)
      const sidebarSections = document.querySelectorAll('ytmusic-guide-section-renderer');
      let sidebarItems = null;

      // Find the section that contains "Home" or "Explore"
      for (const section of Array.from(sidebarSections)) {
        // Check text content of the section to identify it
        // The text content usually includes the button labels
        const text = section.textContent?.toLowerCase() || '';
        if (text.includes('home') || text.includes('explore') || text.includes('library')) {
          sidebarItems = section.querySelector('#items');
          if (sidebarItems) break;
        }
      }

      if (!sidebarItems) {
        // Fallback to the first one found if it has items
        const firstSection = document.querySelector('ytmusic-guide-section-renderer');
        sidebarItems = firstSection?.querySelector('#items');
      }

      if (!sidebarItems) return;

      const item = document.createElement('ytmusic-guide-entry-renderer');
      item.id = 'pear-connect-sidebar-item';
      item.className = 'style-scope ytmusic-guide-section-renderer';
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');

      // Use the same structure as other sidebar items
      item.innerHTML = `
        <tp-yt-paper-item class="style-scope ytmusic-guide-entry-renderer" role="link" tabindex="-1">
          <yt-icon class="guide-icon style-scope ytmusic-guide-entry-renderer">
            <svg viewBox="0 0 24 24" width="24" height="24" style="display: block; width: 100%; height: 100%;">
              <path fill="currentColor" d="M3.9,12c0-1.71,1.39-3.1,3.1-3.1h4V7H7c-2.76,0-5,2.24-5,5s2.24,5,5,5h4v-1.9H7C5.29,15.1,3.9,13.71,3.9,12z M8,13h8v-2H8V13z M17,7h-4v1.9h4c1.71,0,3.1,1.39,3.1,3.1s-1.39,3.1-3.1,3.1h-4V17h4c2.76,0,5-2.24,5-5S19.76,7,17,7z"/>
            </svg>
          </yt-icon>
          <yt-formatted-string class="title style-scope ytmusic-guide-entry-renderer"></yt-formatted-string>
        </tp-yt-paper-item>
      `;

      // Set the text content after the element is created
      setTimeout(() => {
        const titleElement = item.querySelector('yt-formatted-string.title');
        if (titleElement) {
          // Set text directly
          titleElement.textContent = 'Pear Connect';
          // Also set it in the attributed string if it exists
          const attrString = titleElement.querySelector('yt-attributed-string');
          if (attrString) {
            attrString.textContent = 'Pear Connect';
          }
          // Remove is-empty attribute if present
          titleElement.removeAttribute('is-empty');
        }
      }, 0);

      item.addEventListener('click', () => {
        this.showConnectDialog();
      });

      item.style.cursor = 'pointer';

      // Insert at the top of the list
      sidebarItems.prepend(item);
    },

    addFloatingButton(this: any) {
      if (document.getElementById('pear-connect-fab')) return;

      const fab = document.createElement('button');
      fab.id = 'pear-connect-fab';
      fab.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M12,2C6.48,2,2,6.48,2,12c0,5.52,4.48,10,10,10s10-4.48,10-10C22,6.48,17.52,2,12,2z M12,20c-4.41,0-8-3.59-8-8 s3.59-8,8-8s8,3.59,8,8S16.41,20,12,20z M12,6c-3.31,0-6,2.69-6,6s2.69,6,6,6s6-2.69,6-6S15.31,6,12,6z M12,14c-1.1,0-2-0.9-2-2 s0.9-2,2-2s2,0.9,2,2S13.1,14,12,14z"/>
        </svg>
      `;
      fab.title = 'Pear Connect';
      fab.style.cssText = `
        position: fixed;
        top: 57px;
        left: 80px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgb(52, 128, 203);
        color: white;
        border: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      `;

      fab.addEventListener('mouseenter', () => {
        fab.style.transform = 'scale(1.1)';
      });

      fab.addEventListener('mouseleave', () => {
        fab.style.transform = 'scale(1)';
      });

      fab.addEventListener('click', () => {
        this.showConnectDialog();
      });

      document.body.appendChild(fab);
    },

    showConnectDialog(this: any) {
      // Remove existing dialog if any
      this.hideConnectDialog();

      // Create overlay
      this.overlay = document.createElement('div');
      this.overlay.className = 'pear-connect-overlay';
      this.overlay.addEventListener('click', () => this.hideConnectDialog());

      // Create dialog
      this.dialog = document.createElement('div');
      this.dialog.className = 'pear-connect-dialog';

      // Create header
      const header = document.createElement('div');
      header.className = 'pear-connect-header';
      header.innerHTML = `
        <div class="pear-connect-title">Pear Connect</div>
        <button class="pear-connect-close">✕</button>
      `;

      const closeBtn = header.querySelector('.pear-connect-close');
      closeBtn?.addEventListener('click', () => this.hideConnectDialog());

      this.dialog.appendChild(header);

      // Create UI manager
      if (this.ipc) {
        this.uiManager = new PearConnectUIManager(this.ipc);
        this.dialog.appendChild(this.uiManager.getElement());
      }

      document.body.appendChild(this.overlay);
      document.body.appendChild(this.dialog);
    },

    hideConnectDialog(this: any) {
      if (this.overlay) {
        this.overlay.remove();
        this.overlay = undefined;
      }

      if (this.dialog) {
        this.dialog.remove();
        this.dialog = undefined;
      }

      if (this.uiManager) {
        this.uiManager.destroy();
        this.uiManager = undefined;
      }
    },

    startStateMonitoring(this: any) {
      // Update state every second
      this.updateInterval = window.setInterval(() => {
        this.sendStateUpdate();
      }, 1000);

      // Sync queue every 5 seconds to catch any missed updates (reduced from 10s)
      this.queueSyncInterval = window.setInterval(() => {
        this.sendQueueUpdate();
      }, 5000);
    },

    startQueueMonitoring(this: any) {
      // Send initial queue quickly
      setTimeout(() => this.sendQueueUpdate(), 500);
      setTimeout(() => this.sendQueueUpdate(), 1000);

      // Monitor for changes in multiple locations
      const setupObserver = () => {
        // Try multiple selectors for the queue
        const queueSelectors = [
          '#side-panel ytmusic-player-queue',
          'ytmusic-player-queue',
          '#side-panel #contents',
        ];

        let queueElement = null;
        for (const selector of queueSelectors) {
          queueElement = document.querySelector(selector);
          if (queueElement) {
            break;
          }
        }

        if (queueElement) {
          // Use MutationObserver with instant updates (no debounce for faster response)
          this.queueObserver = new MutationObserver(() => {
            this.sendQueueUpdate();
          });

          this.queueObserver.observe(queueElement, {
            childList: true,
            subtree: true,
            characterData: true,
          });

          // Add click event listeners to queue items for instant updates
          const addClickListeners = () => {
            const queueItems = document.querySelectorAll('ytmusic-player-queue-item');
            queueItems.forEach((item) => {
              if (!(item as any)._pearConnectListener) {
                item.addEventListener('click', () => {
                  setTimeout(() => this.sendQueueUpdate(), 50);
                });
                (item as any)._pearConnectListener = true;
              }
            });
          };

          // Add listeners initially and on mutations
          addClickListeners();
          const clickObserver = new MutationObserver(addClickListeners);
          clickObserver.observe(queueElement, { childList: true });
        } else {
          setTimeout(setupObserver, 2000);
        }
      };

      setupObserver();
    },

    sendStateUpdate(this: any) {
      if (!this.playerApi) return;

      const state: PlaybackState = {
        isPlaying: this.playerApi.getPlayerState() === 1,
        currentTime: this.playerApi.getCurrentTime() ?? 0,
        duration: this.playerApi.getDuration() ?? 0,
        volume: this.playerApi.getVolume() ?? 100,
        queuePosition: 0,
        queueLength: 0,
        trackInfo: this.getCurrentTrackInfo(),
      };

      // Only send if state changed
      if (JSON.stringify(state) !== JSON.stringify(this.lastState)) {
        this.lastState = state;
        this.ipc?.send('pear-connect:state-update', state);
      }
    },

    sendQueueUpdate(this: any) {
      const queue = this.getQueue();

      // Quick check to avoid unnecessary updates
      const queueStr = JSON.stringify(queue);
      if (queueStr === JSON.stringify(this.lastQueue)) {
        return; // Skip if identical
      }

      this.lastQueue = queue;
      // Send immediately without delay
      this.ipc?.send('pear-connect:queue-update', queue);
    },

    getCurrentTrackInfo(this: any) {
      const titleElement = document.querySelector('.ytmusic-player-bar .title');
      const artistElement = document.querySelector('.ytmusic-player-bar .byline');
      const thumbnailElement = document.querySelector<HTMLImageElement>('.ytmusic-player-bar img');
      const albumElement = document.querySelector('.ytmusic-player-bar .subtitle');

      const videoData = this.playerApi?.getVideoData();
      const videoId = videoData?.video_id;

      let thumbnail = thumbnailElement?.src;
      if (thumbnail) {
        // Try to get higher quality image
        // Replace s60, w60-h60, etc with larger dimensions
        thumbnail = thumbnail.replace(/s\d+(-c-k)?/, 's512$1').replace(/w\d+-h\d+/, 'w512-h512');
      } else if (videoId) {
        // Fallback to standard maxres if DOM image is missing
        thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      }

      return {
        title: titleElement?.textContent?.trim() ?? videoData?.title ?? 'Unknown',
        artist: artistElement?.textContent?.trim() ?? videoData?.author ?? 'Unknown',
        album: albumElement?.textContent?.trim(),
        thumbnail: thumbnail,
        videoId: videoId ?? '',
        duration: this.playerApi?.getDuration() ?? 0,
      };
    },

    getQueue(this: any): QueueItem[] {
      const queue: QueueItem[] = [];
      const queueItems = document.querySelectorAll('ytmusic-player-queue-item');

      queueItems.forEach((item, idx) => {
        const titleEl = item.querySelector('.song-title');
        const artistEl = item.querySelector('.byline');
        const thumbnailEl = item.querySelector<HTMLImageElement>('img');
        const durationEl = item.querySelector('.duration');

        // Check if this item is currently selected/playing
        // YouTube Music adds 'selected' attribute or has play-button-state="playing"
        const isSelected = item.hasAttribute('selected') ||
          item.getAttribute('play-button-state') === 'playing' ||
          item.classList.contains('playing');

        // Try to extract videoId from the item's data or href
        let videoId = '';
        const linkEl = item.querySelector('a[href*="watch"]');
        if (linkEl) {
          const href = linkEl.getAttribute('href');
          const match = href?.match(/[?&]v=([^&]+)/);
          if (match) videoId = match[1];
        }

        // Parse duration from text like "3:45"
        let duration = 0;
        const durationText = durationEl?.textContent?.trim();
        if (durationText) {
          const parts = durationText.split(':').map(p => parseInt(p, 10));
          if (parts.length === 2) {
            duration = parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }

        // Fallback: use playerApi for current track info
        if (isSelected && this.playerApi) {
          const currentVideo = this.playerApi.getVideoData();
          if (currentVideo?.video_id) {
            videoId = currentVideo.video_id;
            if (!duration) duration = this.playerApi.getDuration() ?? 0;
          }
        }

        queue.push({
          videoId,
          title: titleEl?.textContent?.trim() ?? 'Unknown',
          artist: artistEl?.textContent?.trim() ?? 'Unknown',
          thumbnail: thumbnailEl?.src,
          duration,
          isPlaying: isSelected, // Mark which item is currently playing
        });
      });

      return queue;
    },

    handlePlaybackControl(this: any, action: string) {
      if (!this.playerApi) {
        return;
      }

      switch (action) {
        case 'PLAY':
          this.playerApi.playVideo();
          break;
        case 'PAUSE':
          this.playerApi.pauseVideo();
          break;
        case 'NEXT':
          this.playerApi.nextVideo();
          break;
        case 'PREVIOUS':
          this.playerApi.previousVideo();
          break;
      }
    },

    handleVolumeControl(this: any, volume: number) {
      this.playerApi?.setVolume(volume);
    },

    handleSeek(this: any, time: number) {
      this.playerApi?.seekTo(time);
    },

    handleAddToQueue(this: any, item: QueueItem) {
      // Add to queue using the video ID
      if (item.videoId) {
        // This would require accessing the queue API
      }
    },

    handlePlayQueueItem(this: any, index: number) {
      const queueItems = document.querySelectorAll('ytmusic-player-queue-item');
      if (!queueItems[index]) {
        return;
      }

      // Method 1: Use relative navigation (more reliable)
      if (this.playerApi) {
        // Find the currently playing item in the queue
        const currentIndex = Array.from(queueItems).findIndex(item => item.hasAttribute('selected'));

        if (currentIndex !== -1) {
          const relativeIndex = index - currentIndex;

          if (relativeIndex === 0) {
            // Clicked the current song, just restart it
            this.playerApi.seekTo(0);
            this.playerApi.playVideo();
            return;
          }

          // Navigate forward
          if (relativeIndex > 0) {
            for (let i = 0; i < relativeIndex; i++) {
              this.playerApi.nextVideo();
            }
            return;
          }

          // Navigate backward
          if (relativeIndex < 0) {
            for (let i = 0; i < Math.abs(relativeIndex); i++) {
              this.playerApi.previousVideo();
            }
            return;
          }
        }
      }

      // Method 2: Fallback to clicking the item directly
      const item = queueItems[index] as HTMLElement;

      // Try clicking the item's play button (appears on hover)
      const playButton = item.querySelector('ytmusic-play-button-renderer button, .play-button');
      if (playButton) {
        (playButton as HTMLElement).click();
        return;
      }

      // Try clicking the main clickable area
      const clickArea = item.querySelector('.clickable-area, ytmusic-thumbnail-renderer, .song-title');
      if (clickArea) {
        (clickArea as HTMLElement).click();
        return;
      }

      // Fallback: simulate a double-click on the whole item
      const evt = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
      item.dispatchEvent(evt);
    },

    // WebRTC Audio Streaming Methods
    async setupAudioCapture(this: any) {
      try {
        // Don't re-create if already exists
        if (this.mediaStream) return;

        // Find the YouTube Music video/audio element
        const videoElement = document.querySelector('video') as HTMLVideoElement;
        if (!videoElement) {
          console.log('[Pear Connect] No video element found yet');
          return;
        }

        // Create audio context if not exists
        if (!this.audioContext) {
          this.audioContext = new AudioContext();
        }

        // Capture the audio from the video element
        // We use captureStream to get a MediaStream from the video
        const stream = (videoElement as any).captureStream?.() || (videoElement as any).mozCaptureStream?.();
        if (stream) {
          // Get only audio tracks
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length > 0) {
            this.mediaStream = new MediaStream(audioTracks);
            console.log('[Pear Connect] Audio capture ready');
          }
        }
      } catch (error) {
        console.error('[Pear Connect] Audio capture error:', error);
      }
    },

    async handleRTCOffer(this: any, clientId: string, offer: RTCSessionDescriptionInit) {
      try {
        // Ensure audio capture is set up
        await this.setupAudioCapture();

        if (!this.mediaStream) {
          console.error('[Pear Connect] No media stream available');
          return;
        }

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        this.peerConnections.set(clientId, pc);

        // Add audio track to peer connection
        this.mediaStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
          pc.addTrack(track, this.mediaStream);
        });

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            this.ipc?.send('pear-connect:rtc-ice-candidate', {
              clientId,
              candidate: event.candidate.toJSON()
            });
          }
        };

        // Set remote description and create answer
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send answer back to phone
        this.ipc?.send('pear-connect:rtc-answer', {
          clientId,
          answer: pc.localDescription?.toJSON()
        });

        console.log('[Pear Connect] WebRTC connection established with', clientId);
      } catch (error) {
        console.error('[Pear Connect] RTC offer handling error:', error);
      }
    },

    sendLyricsUpdate(this: any) {
      // Try to get lyrics from the synced-lyrics plugin if available
      try {
        // Get the global lyrics provider if it exists
        const lyricsProvider = (window as any).__syncedLyricsProvider;
        if (lyricsProvider && lyricsProvider.getCurrentLyrics) {
          const lyrics = lyricsProvider.getCurrentLyrics();
          if (lyrics) {
            this.currentLyrics = lyrics;
            this.ipc?.send('pear-connect:lyrics-update', lyrics);
            return;
          }
        }

        // Alternative: try to scrape from the lyrics panel if visible
        const lyricsContainer = document.querySelector('.ytmusic-player-bar-lyrics-container, .lyrics-content');
        if (lyricsContainer) {
          const lyricsText = lyricsContainer.textContent;
          if (lyricsText) {
            this.ipc?.send('pear-connect:lyrics-update', [{ time: 0, text: lyricsText }]);
            return;
          }
        }

        // No lyrics available
        this.ipc?.send('pear-connect:lyrics-update', null);
      } catch (error) {
        console.error('[Pear Connect] Lyrics fetch error:', error);
        this.ipc?.send('pear-connect:lyrics-update', null);
      }
    },

    cleanupPeerConnection(this: any, clientId: string) {
      const pc = this.peerConnections.get(clientId);
      if (pc) {
        pc.close();
        this.peerConnections.delete(clientId);
      }
    },
  },
});
