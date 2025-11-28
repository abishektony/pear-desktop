export interface PearConnectConfig {
  enabled: boolean;
  port: number;
  discoveryEnabled: boolean;
  serviceName: string;
  requireAuth: boolean;
  jwtSecret: string;
  maxConnections: number;
  autoSync: boolean;
  allowVolumeControl: boolean;
  allowPlaybackControl: boolean;
  allowPlaylistBrowsing: boolean;
}

export const defaultPearConnectConfig: PearConnectConfig = {
  enabled: true,
  port: 8888,
  discoveryEnabled: true,
  serviceName: 'Pear Desktop',
  requireAuth: true,
  jwtSecret: generateSecret(),
  maxConnections: 5,
  autoSync: true,
  allowVolumeControl: true,
  allowPlaybackControl: true,
  allowPlaylistBrowsing: true,
};

function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}
