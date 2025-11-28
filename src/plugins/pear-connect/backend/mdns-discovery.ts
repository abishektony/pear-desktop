import Bonjour from 'bonjour-service';

import type { PearConnectConfig } from '../config';

export class MDNSDiscovery {
  private bonjour: Bonjour | null = null;
  private service: ReturnType<Bonjour['publish']> | null = null;
  private config: PearConnectConfig;

  constructor(config: PearConnectConfig) {
    this.config = config;
  }

  start() {
    if (!this.config.discoveryEnabled) {
      return;
    }

    this.bonjour = new Bonjour();

    this.service = this.bonjour.publish({
      name: this.config.serviceName,
      type: 'pear-connect',
      port: this.config.port,
      txt: {
        version: '1.0.0',
        platform: process.platform,
        requiresAuth: this.config.requireAuth.toString(),
      },
    });
  }

  stop() {
    if (this.service) {
      this.service.stop();
      this.service = null;
    }

    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }
  }

  updateServiceInfo(info: { name?: string; requiresAuth?: boolean }) {
    if (this.service) {
      this.stop();
      if (info.name) {
        this.config.serviceName = info.name;
      }
      if (info.requiresAuth !== undefined) {
        this.config.requireAuth = info.requiresAuth;
      }
      this.start();
    }
  }
}
