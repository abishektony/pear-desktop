import QRCode from 'qrcode';
import { ElementFromHtml } from '@/plugins/utils/renderer';
import managerHTML from './manager.html?raw';
import type { RemoteClient, PlaybackTarget } from '../types';
import type { RendererContext } from '@/types/contexts';

export class PearConnectUIManager {
  private element: HTMLElement;
  private ipc: RendererContext<never>['ipc'];
  private qrCanvas: HTMLCanvasElement | null = null;
  private portElement: HTMLElement | null = null;
  private urlElement: HTMLElement | null = null;
  private pairingCodeElement: HTMLElement | null = null;
  private pairingTimerElement: HTMLElement | null = null;
  private devicesElement: HTMLElement | null = null;
  private deviceCountElement: HTMLElement | null = null;
  private updateInterval: number | null = null;
  private copyButtonElement: HTMLButtonElement | null = null;
  private playbackTargetContainer: HTMLElement | null = null;
  private playbackTargetHint: HTMLElement | null = null;
  private currentPlaybackTarget: PlaybackTarget = 'laptop';

  constructor(ipc: RendererContext<never>['ipc']) {
    this.ipc = ipc;
    this.element = ElementFromHtml(managerHTML);
    this.initElements();
    this.setupCopyButton();
    this.setupPlaybackTargetButtons();
    this.loadCurrentPlaybackTarget();
    this.startUpdating();
  }

  private initElements() {
    this.qrCanvas = this.element.querySelector('#pear-connect-qr-canvas');
    this.portElement = this.element.querySelector('#pear-connect-port');
    this.urlElement = this.element.querySelector('#pear-connect-url');
    this.pairingCodeElement = this.element.querySelector('#pear-connect-pairing-code');
    this.pairingTimerElement = this.element.querySelector('#pear-connect-pairing-timer');
    this.devicesElement = this.element.querySelector('#pear-connect-devices');
    this.deviceCountElement = this.element.querySelector('#pear-connect-device-count');
    this.copyButtonElement = this.element.querySelector('#pear-connect-copy-btn');
    this.playbackTargetContainer = this.element.querySelector('#pear-connect-playback-target');
    this.playbackTargetHint = this.element.querySelector('#pear-connect-target-hint');
  }

  private setupCopyButton() {
    if (this.copyButtonElement) {
      this.copyButtonElement.addEventListener('click', () => {
        const code = this.pairingCodeElement?.textContent || '';
        if (code && code !== '------') {
          navigator.clipboard.writeText(code).then(() => {
            const originalText = this.copyButtonElement!.textContent;
            this.copyButtonElement!.textContent = '✓';
            this.copyButtonElement!.style.background = '#4caf50';
            setTimeout(() => {
              this.copyButtonElement!.textContent = originalText;
              this.copyButtonElement!.style.background = '';
            }, 1500);
          }).catch(() => {
            // Silent fail
          });
        }
      });
    }
  }

  private async loadCurrentPlaybackTarget() {
    try {
      const target = await this.ipc.invoke('pear-connect:get-playback-target') as PlaybackTarget;
      if (target) {
        this.currentPlaybackTarget = target;
        this.updatePlaybackTargetUI(target);
      }
    } catch (error) {
      // Silent fail - use default
    }
  }

  private setupPlaybackTargetButtons() {
    if (!this.playbackTargetContainer) return;

    const buttons = this.playbackTargetContainer.querySelectorAll('.pear-connect-target-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = (e.currentTarget as HTMLElement).getAttribute('data-target') as PlaybackTarget;
        if (target) {
          await this.setPlaybackTarget(target);
        }
      });
    });
  }

  private async setPlaybackTarget(target: PlaybackTarget) {
    try {
      await this.ipc.invoke('pear-connect:set-playback-target', target);
      this.currentPlaybackTarget = target;
      this.updatePlaybackTargetUI(target);
    } catch (error) {
      // Silent fail
    }
  }

  private updatePlaybackTargetUI(target: PlaybackTarget) {
    if (!this.playbackTargetContainer || !this.playbackTargetHint) return;

    // Update button states
    const buttons = this.playbackTargetContainer.querySelectorAll('.pear-connect-target-btn');
    buttons.forEach(btn => {
      const btnTarget = btn.getAttribute('data-target');
      btn.classList.toggle('active', btnTarget === target);
    });

    // Update hint text
    const hints: Record<PlaybackTarget, string> = {
      laptop: 'Music plays on your laptop only',
      phone: 'Music plays on your phone only',
      both: 'Music plays on both devices simultaneously',
    };
    this.playbackTargetHint.textContent = hints[target];
  }

  private async startUpdating() {
    await this.update();
    this.updateInterval = window.setInterval(() => {
      this.update();
    }, 2000);
  }

  private async update() {
    try {
      // Get server info from backend
      const serverInfo = await this.ipc.invoke('pear-connect:get-server-info') as { port: number; ip: string } | null;
      if (!serverInfo) return;

      const { port, ip: localIP } = serverInfo;
      let url = `http://${localIP}:${port}`;

      // Update UI
      if (this.portElement) this.portElement.textContent = port.toString();
      if (this.urlElement) this.urlElement.textContent = url;

      // Get pending pairings
      const pendingPairings = await this.ipc.invoke('pear-connect:get-pending-pairings') as Array<{
        clientId: string;
        code: string;
        expiresAt: number;
      }>;

      if (pendingPairings.length > 0) {
        const pairing = pendingPairings[0];
        if (this.pairingCodeElement) {
          this.pairingCodeElement.textContent = pairing.code;
        }

        // Add code to URL for QR code
        url = `${url}?code=${pairing.code}`;

        const timeLeft = Math.max(0, Math.floor((pairing.expiresAt - Date.now()) / 1000));
        if (this.pairingTimerElement) {
          this.pairingTimerElement.textContent = `Expires in ${timeLeft}s`;
        }
      } else {
        if (this.pairingCodeElement) {
          this.pairingCodeElement.textContent = '------';
        }
        if (this.pairingTimerElement) {
          this.pairingTimerElement.textContent = 'Waiting for connection...';
        }
      }

      // Generate QR code
      if (this.qrCanvas) {
        await QRCode.toCanvas(this.qrCanvas, url, {
          width: 200,
          margin: 2,
          color: {
            dark: '#1e90ff',
            light: '#000000',
          },
        });
      }

      // Get connected clients
      const clients = await this.ipc.invoke('pear-connect:get-clients') as RemoteClient[];
      this.updateDevicesList(clients);

    } catch (error) {
      // Silent fail
    }
  }

  private updateDevicesList(clients: RemoteClient[]) {
    if (!this.devicesElement || !this.deviceCountElement) return;

    this.deviceCountElement.textContent = `(${clients.length})`;

    if (clients.length === 0) {
      this.devicesElement.innerHTML = `
        <div class="pear-connect-empty">
          No devices connected
        </div>
      `;
      return;
    }

    this.devicesElement.innerHTML = clients.map(client => `
      <div class="pear-connect-device">
        <div class="pear-connect-device-icon">
          ${this.getDeviceIcon(client.deviceType)}
        </div>
        <div class="pear-connect-device-info">
          <div class="pear-connect-device-name">${this.escapeHtml(client.name)}</div>
          <div class="pear-connect-device-details">
            ${client.deviceType} • Connected ${this.getTimeAgo(client.connectedAt)}
          </div>
        </div>
        <button class="pear-connect-device-disconnect" data-client-id="${client.id}">
          Disconnect
        </button>
      </div>
    `).join('');

    // Add disconnect handlers
    this.devicesElement.querySelectorAll('.pear-connect-device-disconnect').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const clientId = (e.target as HTMLElement).getAttribute('data-client-id');
        if (clientId) {
          this.disconnectClient(clientId);
        }
      });
    });
  }

  private async disconnectClient(clientId: string) {
    try {
      await this.ipc.invoke('pear-connect:disconnect-client', clientId);
      await this.update();
    } catch (error) {
      // Silent fail
    }
  }

  private getDeviceIcon(deviceType: string): string {
    const icons: Record<string, string> = {
      mobile: '📱',
      tablet: '💻',
      desktop: '🖥️',
      other: '📟',
    };
    return icons[deviceType] || icons.other;
  }

  private getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }



  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
