export const miniplayerHTML = `
<div class="pear-player-container">
  <div class="pear-miniplayer" id="pear-miniplayer">
    <div class="pear-miniplayer-main" id="pear-miniplayer-clickable">
      <div class="pear-miniplayer-thumbnail" id="pear-miniplayer-thumb" style="overflow: hidden;">
        <canvas id="pear-miniplayer-canvas" style="width: 100%; height: 100%; display: none;"></canvas>
      </div>
      <div class="pear-miniplayer-info">
        <div class="pear-miniplayer-title" id="pear-miniplayer-title">No song playing</div>
        <div class="pear-miniplayer-artist" id="pear-miniplayer-artist">-</div>
      </div>
      <div class="pear-miniplayer-controls">
        <button class="pear-miniplayer-btn" id="pear-miniplayer-prev" title="Previous">⏮</button>
        <button class="pear-miniplayer-btn play" id="pear-miniplayer-play" title="Play/Pause">▶</button>
        <button class="pear-miniplayer-btn" id="pear-miniplayer-next" title="Next">⏭</button>
      </div>
    </div>
    
    <div class="pear-miniplayer-seek" id="pear-miniplayer-seek">
      <div class="pear-miniplayer-seek-progress" id="pear-miniplayer-seek-progress" style="width: 0%"></div>
      <div class="pear-seek-preview" id="pear-miniplayer-seek-preview">0:00</div>
    </div>
  </div>

  <div class="pear-fullscreen-player" id="pear-fullscreen-player">
    <div class="pear-action-animator" id="pear-action-animator"></div>
    <canvas class="pear-fullscreen-visualizer-bg" id="pear-fullscreen-visualizer-bg"></canvas>
    <div class="pear-visualizer-overlay" id="pear-visualizer-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(8px); background: rgba(0,0,0,0.2);"></div>
    <div class="pear-fullscreen-content" style="position: relative; z-index: 10;">
      <div class="pear-fullscreen-media">
        <!-- Two layers for crossfade dissolve effect -->
        <div class="pear-fullscreen-thumbnail pear-thumb-layer" id="pear-fullscreen-thumb-bottom" style="overflow: hidden;"></div>
        <div class="pear-fullscreen-thumbnail pear-thumb-layer" id="pear-fullscreen-thumb-top" style="overflow: hidden;">
          <canvas id="pear-fullscreen-canvas" style="width: 100%; height: 100%; display: none;"></canvas>
        </div>
      </div>
      
      <div class="pear-fullscreen-info">
        <div class="pear-fullscreen-title" id="pear-fullscreen-title">No song playing</div>
        <div class="pear-fullscreen-artist" id="pear-fullscreen-artist">-</div>
      </div>
      
      <div class="pear-fullscreen-seek" id="pear-fullscreen-seek">
        <div class="pear-fullscreen-seek-progress" id="pear-fullscreen-seek-progress" style="width: 0%"></div>
        <div class="pear-seek-preview" id="pear-fullscreen-seek-preview">0:00</div>
      </div>
      
      <div class="pear-fullscreen-controls">
        <button class="pear-fullscreen-btn" id="pear-fullscreen-like" title="Like">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn" id="pear-fullscreen-prev" title="Previous">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="19 20 9 12 19 4 19 20"/>
            <line x1="5" y1="19" x2="5" y2="5"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn play" id="pear-fullscreen-play" title="Play/Pause">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn" id="pear-fullscreen-next" title="Next">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn" id="pear-fullscreen-repeat" title="Repeat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>
      </div>
    
      <!-- Compact current lyric display for bottom mode -->
      <div class="pear-fullscreen-current-lyric" id="pear-fullscreen-current-lyric">
        <div class="pear-fullscreen-current-lyric-text" id="pear-fullscreen-current-lyric-text"></div>
      </div>
    
      <div class="pear-fullscreen-bottom-controls">
        <div class="pear-fullscreen-volume">
          <button class="pear-fullscreen-btn volume-btn" id="pear-fullscreen-volume-btn" title="Mute/Unmute">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path id="volume-high-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path id="volume-high-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              <line id="volume-mute" x1="23" y1="9" x2="17" y2="15" style="display: none;"/>
              <line id="volume-mute-2" x1="17" y1="9" x2="23" y2="15" style="display: none;"/>
            </svg>
          </button>
          <input type="range" class="pear-fullscreen-volume-slider" id="pear-fullscreen-volume-slider" min="0" max="100" value="100" title="Volume">
          <span class="pear-fullscreen-volume-value" id="pear-fullscreen-volume-value">100%</span>
          <button class="pear-fullscreen-btn sleep-timer-btn" id="pear-fullscreen-sleep-btn" title="Sleep Timer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span class="pear-sleep-timer-badge" id="pear-sleep-timer-badge" style="display: none;"></span>
          </button>
          <button class="pear-fullscreen-btn sync-lyrics-btn" id="pear-fullscreen-sync-btn" title="Sync Lyrics">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path d="M21 21l-3-3" />
            </svg>
          </button>
        </div>
        <button class="pear-fullscreen-btn queue-btn" id="pear-fullscreen-queue-btn" title="Toggle Queue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </button>
        <button class="pear-fullscreen-btn immersive-btn" id="pear-immersive-toggle" title="Immersive Mode">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </button>
        <button class="pear-fullscreen-btn lyrics-btn" id="pear-fullscreen-lyrics-btn" title="Toggle Lyrics">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn popout-btn" id="pear-fullscreen-popout-btn" title="Pop-out Player (Ctrl+Shift+P)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="3" ry="3"/>
            <path d="M14 10l6-6"/>
            <polyline points="15 4 20 4 20 9"/>
            <rect x="5" y="11" width="8" height="8" rx="1.5" ry="1.5" fill="currentColor" fill-opacity="0.2"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn more-btn" id="pear-fullscreen-more-btn" title="More Options">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="19" cy="12" r="1.5"/>
            <circle cx="5" cy="12" r="1.5"/>
          </svg>
        </button>
        <button class="pear-fullscreen-close" id="pear-fullscreen-close" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- More Options Menu for Compact / Small Screen (Player 1) -->
      <div class="pear-fullscreen-more-menu" id="pear-fullscreen-more-menu">
        <div class="pear-more-menu-backdrop" id="pear-more-menu-backdrop"></div>
        <div class="pear-more-menu-card">
          <div class="pear-more-menu-header">
            <div class="pear-more-menu-title-wrap">
              <span class="pear-more-menu-title">Player Controls</span>
              <span class="pear-more-menu-subtitle">Quick access & settings</span>
            </div>
            <button class="pear-more-menu-close" id="pear-more-menu-close" title="Close Menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <!-- Volume Section -->
          <div class="pear-more-menu-section">
            <div class="pear-more-menu-volume">
              <button class="pear-more-menu-vol-btn" id="pear-more-vol-btn" title="Mute/Unmute">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path class="vol-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path class="vol-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  <line class="vol-mute-1" x1="23" y1="9" x2="17" y2="15" style="display: none;"/>
                  <line class="vol-mute-2" x1="17" y1="9" x2="23" y2="15" style="display: none;"/>
                </svg>
              </button>
              <input type="range" class="pear-more-menu-vol-slider" id="pear-more-vol-slider" min="0" max="100" value="100" title="Volume">
              <span class="pear-more-menu-vol-val" id="pear-more-vol-val">100%</span>
            </div>
          </div>

          <!-- Buttons Grid -->
          <div class="pear-more-menu-grid">
            <button class="pear-more-menu-item" id="pear-more-item-queue" title="Toggle Queue">
              <div class="pear-more-menu-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </div>
              <div class="pear-more-menu-text">
                <span class="pear-more-menu-name">Queue</span>
                <span class="pear-more-menu-desc">Upcoming tracks</span>
              </div>
            </button>

            <button class="pear-more-menu-item" id="pear-more-item-lyrics" title="Toggle Lyrics">
              <div class="pear-more-menu-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
              <div class="pear-more-menu-text">
                <span class="pear-more-menu-name">Lyrics</span>
                <span class="pear-more-menu-desc">Synced lyrics view</span>
              </div>
            </button>

            <button class="pear-more-menu-item" id="pear-more-item-immersive" title="Immersive Mode">
              <div class="pear-more-menu-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div class="pear-more-menu-text">
                <span class="pear-more-menu-name">Immersive</span>
                <span class="pear-more-menu-desc">Cinematic player</span>
              </div>
            </button>

            <button class="pear-more-menu-item" id="pear-more-item-sleep" title="Sleep Timer">
              <div class="pear-more-menu-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span class="pear-more-badge" id="pear-more-sleep-badge" style="display: none;"></span>
              </div>
              <div class="pear-more-menu-text">
                <span class="pear-more-menu-name">Sleep Timer</span>
                <span class="pear-more-menu-desc" id="pear-more-sleep-status">Off</span>
              </div>
            </button>

            <button class="pear-more-menu-item" id="pear-more-item-sync" title="Sync Lyrics">
              <div class="pear-more-menu-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path d="M21 21l-3-3" />
                </svg>
              </div>
              <div class="pear-more-menu-text">
                <span class="pear-more-menu-name">Sync Lyrics</span>
                <span class="pear-more-menu-desc">Adjust timing offset</span>
              </div>
            </button>

            <button class="pear-more-menu-item" id="pear-more-item-popout" title="Pop-out Player">
              <div class="pear-more-menu-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="3" ry="3"/>
                  <path d="M14 10l6-6"/>
                  <polyline points="15 4 20 4 20 9"/>
                  <rect x="5" y="11" width="8" height="8" rx="1.5" ry="1.5" fill="currentColor" fill-opacity="0.2"/>
                </svg>
              </div>
              <div class="pear-more-menu-text">
                <span class="pear-more-menu-name">Pop-out</span>
                <span class="pear-more-menu-desc">Floating window</span>
              </div>
            </button>

            <button class="pear-more-menu-item" id="pear-more-item-like" title="Like / Unlike Song">
              <div class="pear-more-menu-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </div>
              <div class="pear-more-menu-text">
                <span class="pear-more-menu-name">Favorite</span>
                <span class="pear-more-menu-desc" id="pear-more-like-status">Like song</span>
              </div>
            </button>

            <button class="pear-more-menu-item" id="pear-more-item-repeat" title="Repeat Mode">
              <div class="pear-more-menu-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="17 1 21 5 17 9"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <polyline points="7 23 3 19 7 15"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
              </div>
              <div class="pear-more-menu-text">
                <span class="pear-more-menu-name">Repeat</span>
                <span class="pear-more-menu-desc" id="pear-more-repeat-status">Toggle repeat</span>
              </div>
            </button>
          </div>
        </div>
      </div>
        
      <div class="pear-fullscreen-lyrics-panel" id="pear-fullscreen-lyrics-panel">
        <div class="pear-fullscreen-queue-header">
          <h3>Lyrics</h3>
        </div>
        <div class="pear-fullscreen-lyrics-content" id="pear-fullscreen-lyrics-content"></div>
      </div>

      <div class="pear-fullscreen-queue-panel" id="pear-fullscreen-queue-panel">
        <div class="pear-fullscreen-queue-header">
          <h3>Queue</h3>
        </div>
        <div class="pear-fullscreen-queue-content" id="pear-fullscreen-queue-content"></div>
      </div>
    </div>
  </div>

  <!-- Sleep Timer Modal -->
  <div class="pear-sleep-timer-modal" id="pear-sleep-timer-modal">
    <div class="pear-sleep-timer-content">
      <div class="pear-sleep-timer-title">Sleep Timer</div>
      <div class="pear-sleep-timer-subtitle">Music will pause after the selected time</div>
      <div class="pear-sleep-timer-options">
        <button class="pear-sleep-timer-option selected" data-minutes="5">5 min</button>
        <button class="pear-sleep-timer-option" data-minutes="10">10 min</button>
        <button class="pear-sleep-timer-option" data-minutes="15">15 min</button>
        <button class="pear-sleep-timer-option" data-minutes="30">30 min</button>
        <button class="pear-sleep-timer-option" data-minutes="45">45 min</button>
        <button class="pear-sleep-timer-option" data-minutes="60">1 hr</button>
      </div>
      <div class="pear-sleep-timer-custom">
        <span>Or set custom:</span>
        <input type="number" id="pear-sleep-timer-custom-input" min="1" max="480" placeholder="30">
        <span>minutes</span>
      </div>
      <div class="pear-sleep-timer-wait-toggle">
        <label>
          <input type="checkbox" id="pear-sleep-timer-wait-end" checked>
          <span>Wait until current song ends</span>
        </label>
      </div>
      <div class="pear-sleep-timer-buttons">
        <button class="pear-sleep-timer-btn primary" id="pear-sleep-timer-start">Start Timer</button>
        <button class="pear-sleep-timer-btn cancel" id="pear-sleep-timer-cancel" style="display: none;">Cancel Timer</button>
        <button class="pear-sleep-timer-btn secondary" id="pear-sleep-timer-close">Close</button>
      </div>
    </div>
  </div>

  <!-- Sync Lyrics Modal -->
  <div class="pear-sleep-timer-modal" id="pear-sync-lyrics-modal">
    <div class="pear-sleep-timer-content pear-sync-lyrics-content">
      <div class="pear-sleep-timer-title">Sync Lyrics</div>
      <div class="pear-sleep-timer-subtitle">Fine-tune lyrics timing to match the vocals for this track</div>

      <!-- Live Offset Display Badge -->
      <div class="pear-sync-lyrics-badge-wrap">
        <span class="pear-sync-lyrics-badge" id="pear-sync-lyrics-display">0.0s</span>
        <span class="pear-sync-lyrics-badge-hint" id="pear-sync-lyrics-hint">In sync</span>
      </div>

      <!-- Interactive Slider -->
      <div class="pear-sync-slider-container">
        <div class="pear-sync-slider-track-wrap">
          <input type="range" id="pear-sync-lyrics-slider" min="-10" max="10" step="0.1" value="0" class="pear-sync-slider">
        </div>
        <div class="pear-sync-slider-labels">
          <span>-10s</span>
          <span>-5s</span>
          <span>0s</span>
          <span>+5s</span>
          <span>+10s</span>
        </div>
      </div>

      <!-- Quick Nudge & Direct Seconds Input -->
      <div class="pear-sync-nudge-row">
        <button class="pear-sync-nudge-btn" data-nudge="-0.5">-0.5s</button>
        <button class="pear-sync-nudge-btn" data-nudge="-0.1">-0.1s</button>
        <div class="pear-sync-input-box" title="Enter seconds (e.g. 2.5)">
          <input type="number" id="pear-sync-lyrics-custom-input" step="any" placeholder="0.0" class="pear-sync-direct-input">
          <span class="pear-sync-unit">sec</span>
        </div>
        <button class="pear-sync-nudge-btn" data-nudge="0.1">+0.1s</button>
        <button class="pear-sync-nudge-btn" data-nudge="0.5">+0.5s</button>
      </div>

      <!-- Quick Presets -->
      <div class="pear-sleep-timer-options" id="pear-sync-lyrics-options">
        <button class="pear-sleep-timer-option" data-seconds="-2">-2.0s</button>
        <button class="pear-sleep-timer-option" data-seconds="-1">-1.0s</button>
        <button class="pear-sleep-timer-option selected" data-seconds="0">0.0s</button>
        <button class="pear-sleep-timer-option" data-seconds="1">+1.0s</button>
        <button class="pear-sleep-timer-option" data-seconds="2">+2.0s</button>
      </div>

      <!-- Modal Action Buttons -->
      <div class="pear-sleep-timer-buttons">
        <button class="pear-sleep-timer-btn primary" id="pear-sync-lyrics-apply">Save for Song</button>
        <button class="pear-sleep-timer-btn secondary" id="pear-sync-lyrics-close">Cancel</button>
      </div>
    </div>
  </div>
</div>
`;
