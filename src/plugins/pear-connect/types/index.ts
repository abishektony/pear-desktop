export interface RemoteClient {
  id: string;
  name: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'other';
  connectedAt: number;
  lastActivity: number;
  authenticated: boolean;
  permissions: ClientPermissions;
}

export interface ClientPermissions {
  playback: boolean;
  volume: boolean;
  playlist: boolean;
  queue: boolean;
}

export type PlaybackTarget = 'laptop' | 'phone' | 'both';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  trackInfo?: TrackInfo;
  queuePosition: number;
  queueLength: number;
  playbackTarget?: PlaybackTarget;
}

export interface TrackInfo {
  title: string;
  artist: string;
  album?: string;
  thumbnail?: string;
  videoId: string;
  duration: number;
}

export interface QueueItem {
  videoId: string;
  title: string;
  artist: string;
  thumbnail?: string;
  duration: number;
  addedBy?: string;
  isPlaying?: boolean; // Mark which item is currently playing
}

export enum MessageType {
  // Auth
  AUTH_REQUEST = 'AUTH_REQUEST',
  AUTH_RESPONSE = 'AUTH_RESPONSE',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILED = 'AUTH_FAILED',

  // Playback Control
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  NEXT = 'NEXT',
  PREVIOUS = 'PREVIOUS',
  SEEK = 'SEEK',
  SET_VOLUME = 'SET_VOLUME',
  SET_PLAYBACK_TARGET = 'SET_PLAYBACK_TARGET',

  // State Sync
  STATE_SYNC = 'STATE_SYNC',
  STATE_UPDATE = 'STATE_UPDATE',

  // Queue/Playlist
  GET_QUEUE = 'GET_QUEUE',
  QUEUE_UPDATE = 'QUEUE_UPDATE',
  ADD_TO_QUEUE = 'ADD_TO_QUEUE',
  REMOVE_FROM_QUEUE = 'REMOVE_FROM_QUEUE',
  PLAY_QUEUE_ITEM = 'PLAY_QUEUE_ITEM',

  // Discovery
  DEVICE_INFO = 'DEVICE_INFO',
  PING = 'PING',
  PONG = 'PONG',

  // Error
  ERROR = 'ERROR',

  // WebRTC Signaling for Audio Streaming
  RTC_OFFER = 'RTC_OFFER',
  RTC_ANSWER = 'RTC_ANSWER',
  RTC_ICE_CANDIDATE = 'RTC_ICE_CANDIDATE',

  // Lyrics
  LYRICS_UPDATE = 'LYRICS_UPDATE',
  GET_LYRICS = 'GET_LYRICS',
}

export interface WebSocketMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  timestamp: number;
  requestId?: string;
}

export interface AuthRequest {
  deviceName: string;
  deviceType: RemoteClient['deviceType'];
  token?: string;
}

export interface AuthResponse {
  qrCode: string;
  pairingCode: string;
  expiresIn: number;
}

export interface DeviceInfo {
  name: string;
  version: string;
  platform: string;
  hostname: string;
  port: number;
}
