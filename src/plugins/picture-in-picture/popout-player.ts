// Pop-out Player implementation using Document Picture-in-Picture API
// Keeps the main YouTube Music window open while creating a floating, interactive player window.

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: {
        width?: number;
        height?: number;
        disallowReturnToOpener?: boolean;
      }) => Promise<Window>;
      window: Window | null;
      onenter: ((this: Window, ev: Event) => any) | null;
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
    };
  }
}

let pipWindow: Window | null = null;
let videoPlaceholder: HTMLElement | null = null;
let originalVideoParent: HTMLElement | null = null;
let originalVideoNextSibling: Node | null = null;
let movedVideo: HTMLVideoElement | null = null;
let updateIntervalId: number | null = null;
let isSeeking = false;

// Format seconds into m:ss
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Retrieve YouTube Music Player API
const getPlayerApi = (): any => {
  return (
    (document.querySelector('ytmusic-app-layout') as any)?.playerApi ||
    (document.querySelector('ytmusic-player-bar') as any)?.playerApi ||
    (document.querySelector('#movie_player') as any)
  );
};

export const isPopoutOpen = (): boolean => {
  return pipWindow !== null && !pipWindow.closed;
};

export const closePopout = (): void => {
  if (pipWindow && !pipWindow.closed) {
    pipWindow.close();
  }
};

let isToggling = false;

export const togglePopoutPlayer = async (): Promise<boolean> => {
  if (isToggling) return false;
  isToggling = true;
  try {
    if (isPopoutOpen()) {
      closePopout();
      return false;
    }
    return await openPopoutPlayer();
  } finally {
    setTimeout(() => {
      isToggling = false;
    }, 300);
  }
};

export const openPopoutPlayer = async (): Promise<boolean> => {
  if (!('documentPictureInPicture' in window) || !window.documentPictureInPicture) {
    return false;
  }

  try {
    const width = 380;
    const height = 540;

    pipWindow = await window.documentPictureInPicture.requestWindow({
      width,
      height,
    });

    setupPipWindow(pipWindow);
    return true;
  } catch (error) {
    console.error('[PopoutPlayer] Failed to open Document Picture-in-Picture window:', error);
    return false;
  }
};

const setupPipWindow = (win: Window) => {
  const doc = win.document;
  doc.title = 'Pear Music - Player';

  // Copy CSS styles and fonts from main window
  const styleEl = doc.createElement('style');
  styleEl.textContent = getPopoutStyles();
  doc.head.appendChild(styleEl);

  // Build the Popout UI
  doc.body.innerHTML = `
    <div class="pear-pip-container">
      <!-- Header -->
      <header class="pear-pip-header">
        <div class="pear-pip-brand">
          <svg class="pear-pip-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          <span class="pear-pip-brand-title">Pear Pop-out</span>
        </div>
        <div class="pear-pip-header-actions">
          <button class="pear-pip-header-btn" id="pear-pip-dock" title="Dock back to main window">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- Media Canvas / Video container -->
      <div class="pear-pip-media-wrapper" id="pear-pip-media">
        <div class="pear-pip-video-box" id="pear-pip-video-box"></div>
        <div class="pear-pip-art-box" id="pear-pip-art-box">
          <img id="pear-pip-artwork" src="" alt="Album Artwork" />
          <div class="pear-pip-art-glow" id="pear-pip-art-glow"></div>
        </div>
      </div>

      <!-- Song Meta -->
      <div class="pear-pip-meta">
        <div class="pear-pip-title-wrap">
          <h2 class="pear-pip-title" id="pear-pip-title">Loading track...</h2>
        </div>
        <div class="pear-pip-artist" id="pear-pip-artist">-</div>
      </div>

      <!-- Progress Section -->
      <div class="pear-pip-progress-section">
        <div class="pear-pip-slider-wrapper">
          <input type="range" class="pear-pip-seek-slider" id="pear-pip-seek" min="0" max="100" value="0" step="0.1" />
          <div class="pear-pip-seek-bar-fill" id="pear-pip-seek-fill"></div>
        </div>
        <div class="pear-pip-times">
          <span id="pear-pip-current-time">0:00</span>
          <span id="pear-pip-total-time">0:00</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="pear-pip-controls">
        <button class="pear-pip-btn sub-btn" id="pear-pip-shuffle" title="Shuffle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 3 21 3 21 8"/>
            <line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/>
            <line x1="15" y1="15" x2="21" y2="21"/>
            <line x1="4" y1="4" x2="9" y2="9"/>
          </svg>
        </button>

        <button class="pear-pip-btn" id="pear-pip-prev" title="Previous">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="19 20 9 12 19 4 19 20"/>
            <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>

        <button class="pear-pip-btn main-play-btn" id="pear-pip-play" title="Play/Pause">
          <svg id="pear-pip-play-icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg id="pear-pip-pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>

        <button class="pear-pip-btn" id="pear-pip-next" title="Next">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>

        <button class="pear-pip-btn sub-btn" id="pear-pip-repeat" title="Repeat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>
      </div>

      <!-- Bottom Bar: Like & Volume -->
      <footer class="pear-pip-footer">
        <button class="pear-pip-btn sub-btn" id="pear-pip-like" title="Like">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>

        <div class="pear-pip-volume-group">
          <button class="pear-pip-btn sub-btn" id="pear-pip-vol-btn" title="Mute/Unmute">
            <svg id="pear-pip-vol-high" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            <svg id="pear-pip-vol-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          </button>
          <div class="pear-pip-vol-slider-wrap">
            <input type="range" class="pear-pip-vol-slider" id="pear-pip-volume" min="0" max="100" value="100" />
            <div class="pear-pip-vol-fill" id="pear-pip-vol-fill"></div>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Attach Video into PiP window
  const videoBox = doc.getElementById('pear-pip-video-box');
  const mainVideo = document.querySelector<HTMLVideoElement>('#player video, #song-video video, video');

  if (mainVideo && videoBox) {
    originalVideoParent = mainVideo.parentElement;
    originalVideoNextSibling = mainVideo.nextSibling;
    movedVideo = mainVideo;

    // Create a smooth placeholder in main window
    videoPlaceholder = document.createElement('div');
    videoPlaceholder.className = 'pear-pip-placeholder';
    videoPlaceholder.style.cssText =
      'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(18, 18, 20, 0.85); color: #888; font-size: 14px; border-radius: 12px; backdrop-filter: blur(8px);';
    videoPlaceholder.innerHTML = '<span>🎬 Playing in Pop-out Window (PiP)</span>';

    originalVideoParent?.insertBefore(videoPlaceholder, originalVideoNextSibling);
    videoBox.appendChild(mainVideo);

    // Keep video playing smoothly
    if (!mainVideo.paused) {
      mainVideo.play().catch(() => {});
    }
  }

  // Handle Event Listeners
  attachPipEventListeners(win, doc);

  // Real-time synchronization
  startSyncLoop(win, doc);

  // Restore on close
  win.addEventListener('pagehide', () => {
    cleanupPipWindow();
  });
};

const cleanupPipWindow = () => {
  if (updateIntervalId !== null) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }

  // Restore video back to main window
  if (movedVideo && originalVideoParent) {
    try {
      if (videoPlaceholder && videoPlaceholder.parentElement) {
        originalVideoParent.insertBefore(movedVideo, videoPlaceholder);
        videoPlaceholder.remove();
      } else {
        originalVideoParent.appendChild(movedVideo);
      }
      if (!movedVideo.paused) {
        movedVideo.play().catch(() => {});
      }
    } catch (e) {
      console.warn('[PopoutPlayer] Could not restore video:', e);
    }
  }

  videoPlaceholder = null;
  originalVideoParent = null;
  originalVideoNextSibling = null;
  movedVideo = null;
  pipWindow = null;
};

const attachPipEventListeners = (win: Window, doc: Document) => {
  const dockBtn = doc.getElementById('pear-pip-dock');
  const playBtn = doc.getElementById('pear-pip-play');
  const prevBtn = doc.getElementById('pear-pip-prev');
  const nextBtn = doc.getElementById('pear-pip-next');
  const seekSlider = doc.getElementById('pear-pip-seek') as HTMLInputElement;
  const volSlider = doc.getElementById('pear-pip-volume') as HTMLInputElement;
  const volBtn = doc.getElementById('pear-pip-vol-btn');
  const likeBtn = doc.getElementById('pear-pip-like');
  const shuffleBtn = doc.getElementById('pear-pip-shuffle');
  const repeatBtn = doc.getElementById('pear-pip-repeat');

  dockBtn?.addEventListener('click', () => {
    win.close();
  });

  playBtn?.addEventListener('click', () => {
    const playerApi = getPlayerApi();
    if (playerApi?.playVideo && playerApi?.pauseVideo) {
      const state = playerApi.getPlayerState?.();
      if (state === 1) {
        playerApi.pauseVideo();
      } else {
        playerApi.playVideo();
      }
    } else {
      const playPauseBar = document.querySelector<HTMLButtonElement>(
        '#play-pause-button, .play-pause-button',
      );
      playPauseBar?.click();
    }
  });

  prevBtn?.addEventListener('click', () => {
    const playerApi = getPlayerApi();
    if (playerApi?.previousTrack) {
      playerApi.previousTrack();
    } else {
      document.querySelector<HTMLElement>('.previous-button')?.click();
    }
  });

  nextBtn?.addEventListener('click', () => {
    const playerApi = getPlayerApi();
    if (playerApi?.nextTrack) {
      playerApi.nextTrack();
    } else {
      document.querySelector<HTMLElement>('.next-button')?.click();
    }
  });

  isSeeking = false;
  seekSlider?.addEventListener('input', () => {
    isSeeking = true;
    const progress = parseFloat(seekSlider.value);
    const fill = doc.getElementById('pear-pip-seek-fill');
    if (fill) fill.style.width = `${progress}%`;
  });

  seekSlider?.addEventListener('change', () => {
    const progress = parseFloat(seekSlider.value);
    const video = movedVideo || document.querySelector<HTMLVideoElement>('video');
    const playerApi = getPlayerApi();

    if (video && video.duration) {
      const targetTime = (progress / 100) * video.duration;
      if (playerApi?.seekTo) {
        playerApi.seekTo(targetTime);
      } else {
        video.currentTime = targetTime;
      }
    }
    isSeeking = false;
  });

  volSlider?.addEventListener('input', () => {
    const val = parseInt(volSlider.value, 10);
    const fill = doc.getElementById('pear-pip-vol-fill');
    if (fill) fill.style.width = `${val}%`;

    const playerApi = getPlayerApi();
    if (playerApi?.setVolume) {
      playerApi.setVolume(val);
    }
    const video = movedVideo || document.querySelector<HTMLVideoElement>('video');
    if (video) video.volume = val / 100;
  });

  volBtn?.addEventListener('click', () => {
    const video = movedVideo || document.querySelector<HTMLVideoElement>('video');
    const playerApi = getPlayerApi();
    if (!video) return;

    if (video.muted || video.volume === 0) {
      video.muted = false;
      const targetVol = 80;
      if (playerApi?.setVolume) playerApi.setVolume(targetVol);
      video.volume = 0.8;
      volSlider.value = '80';
    } else {
      video.muted = true;
      if (playerApi?.setVolume) playerApi.setVolume(0);
      volSlider.value = '0';
    }
  });

  likeBtn?.addEventListener('click', () => {
    const ytLike =
      document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer .like button') ||
      document.querySelector<HTMLElement>('ytmusic-player-bar #button-shape-like button') ||
      document.querySelector<HTMLElement>('ytmusic-like-button-renderer .like button');
    ytLike?.click();
  });

  shuffleBtn?.addEventListener('click', () => {
    const ytShuffle =
      document.querySelector<HTMLElement>('.shuffle.ytmusic-player-bar button') ||
      document.querySelector<HTMLElement>('tp-yt-paper-icon-button.shuffle');
    ytShuffle?.click();
  });

  repeatBtn?.addEventListener('click', () => {
    const ytRepeat =
      document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar button') ||
      document.querySelector<HTMLElement>('tp-yt-paper-icon-button.repeat');
    ytRepeat?.click();
  });

  // Keyboard controls inside Popout window
  win.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;

    if (e.code === 'Space' || e.key === 'k') {
      e.preventDefault();
      playBtn?.click();
    } else if (e.code === 'ArrowRight' || e.key === 'l') {
      e.preventDefault();
      const video = movedVideo || document.querySelector<HTMLVideoElement>('video');
      if (video) video.currentTime = Math.min(video.duration, video.currentTime + 5);
    } else if (e.code === 'ArrowLeft' || e.key === 'j') {
      e.preventDefault();
      const video = movedVideo || document.querySelector<HTMLVideoElement>('video');
      if (video) video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      const nextVal = Math.min(100, parseInt(volSlider.value, 10) + 5);
      volSlider.value = `${nextVal}`;
      volSlider.dispatchEvent(new Event('input'));
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      const nextVal = Math.max(0, parseInt(volSlider.value, 10) - 5);
      volSlider.value = `${nextVal}`;
      volSlider.dispatchEvent(new Event('input'));
    } else if (e.key === 'm') {
      e.preventDefault();
      volBtn?.click();
    } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      win.close();
    }
  });
};

const startSyncLoop = (_win: Window, doc: Document) => {
  const titleEl = doc.getElementById('pear-pip-title');
  const artistEl = doc.getElementById('pear-pip-artist');
  const artworkImg = doc.getElementById('pear-pip-artwork') as HTMLImageElement;
  const artGlow = doc.getElementById('pear-pip-art-glow');
  const playIcon = doc.getElementById('pear-pip-play-icon');
  const pauseIcon = doc.getElementById('pear-pip-pause-icon');
  const currentTimeEl = doc.getElementById('pear-pip-current-time');
  const totalTimeEl = doc.getElementById('pear-pip-total-time');
  const seekSlider = doc.getElementById('pear-pip-seek') as HTMLInputElement;
  const seekFill = doc.getElementById('pear-pip-seek-fill');
  const volHigh = doc.getElementById('pear-pip-vol-high');
  const volMute = doc.getElementById('pear-pip-vol-mute');
  const volSlider = doc.getElementById('pear-pip-volume') as HTMLInputElement;
  const volFill = doc.getElementById('pear-pip-vol-fill');
  const likeBtn = doc.getElementById('pear-pip-like');
  const repeatBtn = doc.getElementById('pear-pip-repeat');
  const shuffleBtn = doc.getElementById('pear-pip-shuffle');
  const artBox = doc.getElementById('pear-pip-art-box');
  const videoBox = doc.getElementById('pear-pip-video-box');

  const update = () => {
    if (!pipWindow || pipWindow.closed) return;

    // Track metadata
    const mainTitle = document.querySelector<HTMLElement>('.title.ytmusic-player-bar')?.textContent?.trim() || 'No song playing';
    const mainArtist = document.querySelector<HTMLElement>('.byline.ytmusic-player-bar')?.textContent?.trim() || '-';
    const mainThumb = document.querySelector<HTMLImageElement>(
      'ytmusic-player-bar #song-image img, ytmusic-player-bar yt-img-shadow img, .image.ytmusic-player-bar img'
    )?.src || '';

    if (titleEl && titleEl.textContent !== mainTitle) {
      titleEl.textContent = mainTitle;
      titleEl.title = mainTitle;
    }
    if (artistEl && artistEl.textContent !== mainArtist) {
      artistEl.textContent = mainArtist;
      artistEl.title = mainArtist;
    }
    if (artworkImg && mainThumb && artworkImg.src !== mainThumb) {
      artworkImg.src = mainThumb;
      if (artGlow) artGlow.style.backgroundImage = `url(${mainThumb})`;
    }

    // Video vs Artwork display
    const video = movedVideo || document.querySelector<HTMLVideoElement>('video');
    const isVideoPlaying = video && !video.paused;
    const hasVideoTrack = video && video.videoWidth > 0 && video.style.display !== 'none';

    if (artBox && videoBox) {
      if (hasVideoTrack) {
        artBox.style.display = 'none';
        videoBox.style.display = 'block';
      } else {
        artBox.style.display = 'flex';
        videoBox.style.display = 'none';
      }
    }

    // Play/Pause icon
    if (playIcon && pauseIcon) {
      if (isVideoPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
      } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
      }
    }

    // Progress
    if (video && video.duration && !isNaN(video.duration)) {
      const cur = video.currentTime;
      const dur = video.duration;
      const pct = (cur / dur) * 100;

      if (currentTimeEl) currentTimeEl.textContent = formatTime(cur);
      if (totalTimeEl) totalTimeEl.textContent = formatTime(dur);

      if (seekSlider && !isSeeking && document.activeElement !== seekSlider) {
        seekSlider.value = `${pct}`;
        if (seekFill) seekFill.style.width = `${pct}%`;
      }
    }

    // Volume
    if (video) {
      const isMuted = video.muted || video.volume === 0;
      if (volHigh && volMute) {
        volHigh.style.display = isMuted ? 'none' : 'block';
        volMute.style.display = isMuted ? 'block' : 'none';
      }
      if (volSlider && document.activeElement !== volSlider) {
        const v = isMuted ? 0 : Math.round(video.volume * 100);
        volSlider.value = `${v}`;
        if (volFill) volFill.style.width = `${v}%`;
      }
    }

    // Like button state
    const ytLike = document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer');
    const isLiked = ytLike?.getAttribute('like-status') === 'LIKE';
    if (likeBtn) {
      if (isLiked) {
        likeBtn.classList.add('active');
        likeBtn.style.color = '#10b981';
      } else {
        likeBtn.classList.remove('active');
        likeBtn.style.color = 'inherit';
      }
    }

    // Repeat & Shuffle state
    const ytRepeat = document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar');
    const repeatState = ytRepeat?.getAttribute('aria-checked') || ytRepeat?.getAttribute('repeat-mode_');
    if (repeatBtn) {
      if (repeatState && repeatState !== 'NONE' && repeatState !== 'false') {
        repeatBtn.classList.add('active');
      } else {
        repeatBtn.classList.remove('active');
      }
    }

    const ytShuffle = document.querySelector<HTMLElement>('.shuffle.ytmusic-player-bar');
    const isShuffled = ytShuffle?.getAttribute('aria-checked') === 'true';
    if (shuffleBtn) {
      if (isShuffled) {
        shuffleBtn.classList.add('active');
      } else {
        shuffleBtn.classList.remove('active');
      }
    }
  };

  update();
  updateIntervalId = window.setInterval(update, 250);
};

const getPopoutStyles = (): string => {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    body {
      background-color: #0b0c10;
      color: #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .pear-pip-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 14px 16px;
      gap: 12px;
      background: linear-gradient(180deg, rgba(24, 24, 32, 0.95) 0%, rgba(11, 12, 16, 0.98) 100%);
    }

    /* Header */
    .pear-pip-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 28px;
    }
    .pear-pip-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #10b981;
    }
    .pear-pip-logo {
      width: 18px;
      height: 18px;
    }
    .pear-pip-brand-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #9ca3af;
    }
    .pear-pip-header-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .pear-pip-header-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .pear-pip-header-btn svg {
      width: 16px;
      height: 16px;
    }

    /* Media Area */
    .pear-pip-media-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      max-height: 220px;
      border-radius: 12px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pear-pip-video-box {
      width: 100%;
      height: 100%;
    }
    .pear-pip-video-box video {
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important;
    }
    .pear-pip-art-box {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .pear-pip-art-glow {
      position: absolute;
      top: -20%;
      left: -20%;
      width: 140%;
      height: 140%;
      background-size: cover;
      background-position: center;
      filter: blur(28px) brightness(0.4);
      z-index: 1;
    }
    #pear-pip-artwork {
      position: relative;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 8px;
      z-index: 2;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    }

    /* Meta Info */
    .pear-pip-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: center;
      margin-top: 2px;
    }
    .pear-pip-title-wrap {
      overflow: hidden;
      white-space: nowrap;
    }
    .pear-pip-title {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pear-pip-artist {
      font-size: 13px;
      color: #9ca3af;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Progress & Seek */
    .pear-pip-progress-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    }
    .pear-pip-slider-wrapper {
      position: relative;
      height: 6px;
      display: flex;
      align-items: center;
    }
    .pear-pip-seek-slider {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      z-index: 5;
    }
    .pear-pip-slider-wrapper::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }
    .pear-pip-seek-bar-fill {
      position: absolute;
      height: 4px;
      background: #10b981;
      border-radius: 4px;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
      pointer-events: none;
      transition: height 0.15s ease;
    }
    .pear-pip-slider-wrapper:hover .pear-pip-seek-bar-fill,
    .pear-pip-slider-wrapper:hover::before {
      height: 6px;
    }
    .pear-pip-times {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #6b7280;
      font-variant-numeric: tabular-nums;
    }

    /* Controls */
    .pear-pip-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin: 4px 0;
    }
    .pear-pip-btn {
      background: transparent;
      border: none;
      color: #d1d5db;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .pear-pip-btn:hover {
      color: #fff;
      transform: scale(1.1);
    }
    .pear-pip-btn:active {
      transform: scale(0.95);
    }
    .pear-pip-btn svg {
      width: 20px;
      height: 20px;
    }
    .pear-pip-btn.sub-btn {
      color: #6b7280;
    }
    .pear-pip-btn.sub-btn:hover {
      color: #10b981;
    }
    .pear-pip-btn.sub-btn.active {
      color: #10b981;
    }
    .pear-pip-btn.sub-btn svg {
      width: 17px;
      height: 17px;
    }
    .main-play-btn {
      width: 48px;
      height: 48px;
      background: #10b981;
      color: #0b0c10 !important;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    }
    .main-play-btn:hover {
      background: #34d399;
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
    }
    .main-play-btn svg {
      width: 22px;
      height: 22px;
    }

    /* Footer: Volume & Like */
    .pear-pip-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: auto;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .pear-pip-volume-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      max-width: 160px;
    }
    .pear-pip-vol-slider-wrap {
      position: relative;
      flex: 1;
      height: 4px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      display: flex;
      align-items: center;
    }
    .pear-pip-vol-slider {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      z-index: 5;
    }
    .pear-pip-vol-fill {
      height: 100%;
      background: #9ca3af;
      border-radius: 4px;
      pointer-events: none;
    }
    .pear-pip-volume-group:hover .pear-pip-vol-fill {
      background: #10b981;
    }
  `;
};
