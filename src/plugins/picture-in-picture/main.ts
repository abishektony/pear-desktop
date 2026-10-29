import { BrowserWindow, ipcMain } from 'electron';

import type { PictureInPicturePluginConfig } from './index';
import type { BackendContext } from '@/types/contexts';

import popoutHtml from './popout-window.html?raw';

let config: PictureInPicturePluginConfig;
let popoutWindow: BrowserWindow | null = null;

export const onMainLoad = async ({
  window,
  getConfig,
  setConfig,
  ipc: { send, on },
}: BackendContext<PictureInPicturePluginConfig>) => {
  config ??= await getConfig();

  const togglePopoutWindow = () => {
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      popoutWindow.close();
      popoutWindow = null;
      send('peard:popout-closed');
      return;
    }

    const pipPos = (config.savePosition && config['pip-position']) || [100, 100];
    const pipSz = (config.saveSize && config['pip-size']) || [360, 520];

    popoutWindow = new BrowserWindow({
      parent: window,
      width: pipSz[0],
      height: pipSz[1],
      minWidth: 280,
      minHeight: 380,
      x: pipPos[0],
      y: pipPos[1],
      frame: false,
      alwaysOnTop: config.alwaysOnTop ?? true,
      resizable: true,
      backgroundColor: '#0b0c10',
      show: false,
      skipTaskbar: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    });

    popoutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(popoutHtml)}`);

    popoutWindow.once('ready-to-show', () => {
      popoutWindow?.show();
      send('peard:popout-opened');
    });

    popoutWindow.on('moved', () => {
      if (config.savePosition && popoutWindow && !popoutWindow.isDestroyed()) {
        const [x, y] = popoutWindow.getPosition();
        setConfig({ 'pip-position': [x, y] });
      }
    });

    popoutWindow.on('resized', () => {
      if (config.saveSize && popoutWindow && !popoutWindow.isDestroyed()) {
        const [w, h] = popoutWindow.getSize();
        setConfig({ 'pip-size': [w, h] });
      }
    });

    popoutWindow.on('closed', () => {
      popoutWindow = null;
      send('peard:popout-closed');
    });
  };

  // Toggle pop-out window from renderer
  on('peard:toggle-popout-window', () => {
    togglePopoutWindow();
  });

  on('plugin:toggle-picture-in-picture', () => {
    togglePopoutWindow();
  });

  on('peard:close-popout-from-main', () => {
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      popoutWindow.close();
      popoutWindow = null;
    }
  });

  // Relay commands from popout window to main YouTube window
  ipcMain.on('peard:player-command-from-popout', (_, cmd: { action: string; value?: any }) => {
    if (cmd.action === 'close') {
      if (popoutWindow && !popoutWindow.isDestroyed()) {
        popoutWindow.close();
        popoutWindow = null;
      }
    } else if (cmd.action === 'minimize') {
      popoutWindow?.minimize();
    } else {
      window.webContents.send('peard:exec-player-command', cmd);
    }
  });

  // Relay state from main window to popout window
  ipcMain.on('peard:send-state-to-popout', (_, state: any) => {
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      popoutWindow.webContents.send('peard:sync-player-state', state);
    }
  });
};

export const onConfigChange = (newConfig: PictureInPicturePluginConfig) => {
  config = newConfig;
  if (popoutWindow && !popoutWindow.isDestroyed()) {
    popoutWindow.setAlwaysOnTop(config.alwaysOnTop ?? true);
  }
};
