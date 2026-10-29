import { toKeyEvent } from 'keyboardevent-from-electron-accelerator';
import keyEventAreEqual from 'keyboardevents-areequal';
import { render } from 'solid-js/web';

import { getSongMenu } from '@/providers/dom-elements';
import {
  isMusicOrVideoTrack,
  isPlayerMenu,
} from '@/plugins/utils/renderer/check';

import { t } from '@/i18n';

import { PictureInPictureButton } from './templates/picture-in-picture-button';

import type { MusicPlayer } from '@/types/music-player';
import type { PictureInPicturePluginConfig } from './index';
import type { RendererContext } from '@/types/contexts';


export const onPlayerApiReady = async (
  _: MusicPlayer,
  { ipc, getConfig }: RendererContext<PictureInPicturePluginConfig>,
) => {
  const config = await getConfig();

  const togglePictureInPicture = async () => {
    // Open Native Floating Popout Window via Electron BrowserWindow:
    // Keeps YouTube open and responsive in background, opens floating player window!
    ipc.send('peard:toggle-popout-window');
    document.querySelector<HTMLButtonElement>('#icon')?.click();
    return true;
  };

  // Listen for commands from the popout window
  ipc.on('peard:exec-player-command', (cmd: { action: string; value?: any }) => {
    const playerApi = (document.querySelector('ytmusic-app-layout') as any)?.playerApi;
    const video = document.querySelector<HTMLVideoElement>('video');

    switch (cmd.action) {
      case 'play-pause':
        if (playerApi?.playVideo && playerApi?.pauseVideo) {
          playerApi.getPlayerState?.() === 1 ? playerApi.pauseVideo() : playerApi.playVideo();
        } else {
          document.querySelector<HTMLButtonElement>('#play-pause-button, .play-pause-button')?.click();
        }
        break;
      case 'next':
        if (playerApi?.nextTrack) {
          playerApi.nextTrack();
        } else {
          document.querySelector<HTMLElement>('.next-button')?.click();
        }
        break;
      case 'prev':
        if (playerApi?.previousTrack) {
          playerApi.previousTrack();
        } else {
          document.querySelector<HTMLElement>('.previous-button')?.click();
        }
        break;
      case 'seek':
        if (typeof cmd.value === 'number') {
          if (playerApi?.seekTo) {
            playerApi.seekTo(cmd.value);
          } else if (video) {
            video.currentTime = cmd.value;
          }
        }
        break;
      case 'seek-relative':
        if (typeof cmd.value === 'number' && video) {
          const target = Math.max(0, Math.min(video.duration || 0, video.currentTime + cmd.value));
          if (playerApi?.seekTo) {
            playerApi.seekTo(target);
          } else {
            video.currentTime = target;
          }
        }
        break;
      case 'volume':
        if (typeof cmd.value === 'number') {
          if (playerApi?.setVolume) {
            playerApi.setVolume(cmd.value);
          }
          if (video) {
            video.volume = cmd.value / 100;
            video.muted = cmd.value === 0;
          }
        }
        break;
      case 'like': {
        const likeBtn =
          document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer .like button') ||
          document.querySelector<HTMLElement>('ytmusic-player-bar #button-shape-like button') ||
          document.querySelector<HTMLElement>('ytmusic-like-button-renderer .like button');
        likeBtn?.click();
        break;
      }
      case 'shuffle': {
        const shuffleBtn =
          document.querySelector<HTMLElement>('.shuffle.ytmusic-player-bar button') ||
          document.querySelector<HTMLElement>('tp-yt-paper-icon-button.shuffle');
        shuffleBtn?.click();
        break;
      }
      case 'repeat': {
        const repeatBtn =
          document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar button') ||
          document.querySelector<HTMLElement>('tp-yt-paper-icon-button.repeat');
        repeatBtn?.click();
        break;
      }
    }
  });

  let lastKnownThumbnail = '';

  ipc.on('peard:update-song-info', (songInfo: any) => {
    if (songInfo?.imageSrc) {
      lastKnownThumbnail = songInfo.imageSrc;
    }
  });

  const getThumbnailUrl = (): string => {
    // 1. From MediaSession API (most reliable, standard across all platforms)
    try {
      const ms = (navigator as any).mediaSession;
      if (ms?.metadata?.artwork && Array.isArray(ms.metadata.artwork) && ms.metadata.artwork.length > 0) {
        const lastArt = ms.metadata.artwork[ms.metadata.artwork.length - 1]?.src;
        if (lastArt && !lastArt.includes('data:image/gif')) {
          lastKnownThumbnail = lastArt;
          return lastArt;
        }
      }
    } catch {}

    // 2. From cached song info event
    if (lastKnownThumbnail) {
      return lastKnownThumbnail;
    }

    // 3. From DOM element queries
    const imgSelectors = [
      'ytmusic-player-bar .image img',
      'ytmusic-player-bar #song-image img',
      'ytmusic-player-bar yt-img-shadow img',
      'ytmusic-player-bar .thumbnail-image-wrapper img',
      '#player-bar-background img',
      'ytmusic-app-layout #song-image img',
      '#song-image img',
      '.thumbnail img',
    ];

    for (const sel of imgSelectors) {
      const el = document.querySelector<HTMLImageElement>(sel);
      if (el && el.src && el.src.startsWith('http') && !el.src.includes('data:image/gif')) {
        lastKnownThumbnail = el.src;
        return el.src;
      }
    }

    // 4. Derive from videoId in URL if available
    try {
      const videoId = new URLSearchParams(window.location.search).get('v');
      if (videoId) {
        const fallback = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        lastKnownThumbnail = fallback;
        return fallback;
      }
    } catch {}

    return lastKnownThumbnail;
  };

  let isPopoutWindowOpen = false;

  const syncStateToPopout = () => {
    if (!isPopoutWindowOpen) return;

    const video = document.querySelector<HTMLVideoElement>('video');
    const title = document.querySelector<HTMLElement>('.title.ytmusic-player-bar')?.textContent?.trim() || '';
    const artist = document.querySelector<HTMLElement>('.byline.ytmusic-player-bar')?.textContent?.trim() || '';
    const thumbnail = getThumbnailUrl();
    const isPlaying = video ? !video.paused : false;
    const currentTime = video ? video.currentTime : 0;
    const duration = video ? video.duration : 0;
    const volume = video ? (video.muted ? 0 : Math.round(video.volume * 100)) : 100;

    const ytLike = document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer');
    const isLiked = ytLike?.getAttribute('like-status') === 'LIKE';

    const ytRepeat = document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar');
    const repeatState = ytRepeat?.getAttribute('aria-checked') || ytRepeat?.getAttribute('repeat-mode_');

    const ytShuffle = document.querySelector<HTMLElement>('.shuffle.ytmusic-player-bar');
    const isShuffled = ytShuffle?.getAttribute('aria-checked') === 'true';

    ipc.send('peard:send-state-to-popout', {
      title,
      artist,
      thumbnail,
      isPlaying,
      currentTime,
      duration,
      volume,
      isLiked,
      repeatState,
      isShuffled,
    });
  };

  // State synchronization interval: only polls when popout window is open
  setInterval(syncStateToPopout, 300);

  // Send state immediately when pop-out window is opened
  ipc.on('peard:popout-opened', () => {
    isPopoutWindowOpen = true;
    window.dispatchEvent(new CustomEvent('peard:popout-window-opened'));
    syncStateToPopout();
  });

  ipc.on('peard:popout-closed', () => {
    isPopoutWindowOpen = false;
    window.dispatchEvent(new CustomEvent('peard:popout-window-closed'));
  });

  // Allow closing pop-out player if fullscreen player is opened in main window
  window.addEventListener('peard:close-popout-player', () => {
    if (isPopoutWindowOpen) {
      ipc.send('peard:toggle-popout-window');
    }
  });

  // Listen to custom popout trigger event (e.g. from miniplayer button)
  window.addEventListener('peard:toggle-popout-player', () => {
    togglePictureInPicture();
  });

  // Global shortcut: Ctrl+Shift+P / Cmd+Shift+P
  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'p' || event.key === 'P')) {
      const isSearchOpened = document.querySelector<HTMLElement & { opened: boolean }>(
        'ytmusic-search-box',
      )?.opened;
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (!isSearchOpened && activeTag !== 'input' && activeTag !== 'textarea') {
        event.preventDefault();
        togglePictureInPicture();
      }
    }
  });

  if (config.hotkey) {
    const hotkeyEvent = toKeyEvent(config.hotkey);
    window.addEventListener('keydown', (event) => {
      if (
        keyEventAreEqual(event, hotkeyEvent) &&
        !document.querySelector<HTMLElement & { opened: boolean }>(
          'ytmusic-search-box',
        )?.opened
      ) {
        togglePictureInPicture();
      }
    });
  }

  const exitFullScreenButton = document.querySelector<HTMLButtonElement>(
    '.exit-fullscreen-button',
  );
  const getPlayMinimizeButton = () =>
    document.querySelector('.player-minimize-button');
  const appLayout = document.querySelector<HTMLElement>('ytmusic-app-layout');
  const expandMenu = document.querySelector<HTMLElement>('#expanding-menu');
  const middleControls =
    document.querySelector<HTMLButtonElement>('.middle-controls');
  const playerPage = document.querySelector<
    HTMLElement & { playerPageOpen_: boolean }
  >('ytmusic-player-page');
  const togglePlayerPageButton = document.querySelector<HTMLButtonElement>(
    '.toggle-player-page-button',
  );
  const fullScreenButton =
    document.querySelector<HTMLButtonElement>('.fullscreen-button');
  const player = document.querySelector<
    HTMLVideoElement & { onDoubleClick_: (() => void) | undefined }
  >('#player');
  const onPlayerDblClick = player?.onDoubleClick_;
  const mouseLeaveEventListener = () => middleControls?.click();

  const titleBar = document.querySelector<HTMLElement>(
    'nav[data-ytmd-main-panel]',
  );

  const pipClickEventListener = async (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    await togglePictureInPicture();
  };

  ipc.on('peard:pip-toggle', (isPip: boolean) => {
    if (exitFullScreenButton && player) {
      if (isPip) {
        exitFullScreenButton?.addEventListener('click', pipClickEventListener);
        getPlayMinimizeButton()?.removeEventListener(
          'click',
          pipClickEventListener,
        );
        player.onDoubleClick_ = () => {};

        expandMenu?.addEventListener('mouseleave', mouseLeaveEventListener);
        if (!playerPage?.playerPageOpen_) {
          togglePlayerPageButton?.click();
        }

        fullScreenButton?.click();
        appLayout?.classList.add('pip');
        if (titleBar) {
          titleBar.style.display = 'none';
        }
      } else {
        exitFullScreenButton.removeEventListener(
          'click',
          pipClickEventListener,
        );
        getPlayMinimizeButton()?.addEventListener(
          'click',
          pipClickEventListener,
        );
        player.onDoubleClick_ = onPlayerDblClick;
        expandMenu?.removeEventListener('mouseleave', mouseLeaveEventListener);
        exitFullScreenButton.click();
        appLayout?.classList.remove('pip');
        if (titleBar) {
          titleBar.style.display = 'flex';
        }
      }
    }
  });

  getPlayMinimizeButton()?.addEventListener('click', pipClickEventListener);

  const pipButtonContainer = document.createElement('div');
  pipButtonContainer.classList.add(
    'style-scope',
    'menu-item',
    'ytmusic-menu-popup-renderer',
  );
  pipButtonContainer.setAttribute('aria-disabled', 'false');
  pipButtonContainer.setAttribute('aria-selected', 'false');
  pipButtonContainer.setAttribute('role', 'option');
  pipButtonContainer.setAttribute('tabindex', '-1');

  render(
    () => (
      <PictureInPictureButton
        onClick={togglePictureInPicture}
        text={t('plugins.picture-in-picture.templates.button')}
      />
    ),
    pipButtonContainer,
  );

  const observer = new MutationObserver(() => {
    const menu = getSongMenu();

    if (
      menu?.contains(pipButtonContainer) ||
      !isMusicOrVideoTrack() ||
      !isPlayerMenu(menu)
    ) {
      return;
    }

    menu?.prepend(pipButtonContainer);
  });

  observer.observe(document.querySelector('ytmusic-popup-container')!, {
    childList: true,
    subtree: true,
  });
};
