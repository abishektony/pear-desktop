# Pear Connect

**Spotify-style remote control for Pear Desktop**

## Features

- 🔐 **QR Code Pairing** - Secure, easy connection via QR codes
- 🔒 **Encrypted Connection** - JWT-based authentication
- 📡 **Auto Discovery** - mDNS (Bonjour) for seamless device discovery
- 📱 **Multiple Remotes** - Connect up to 5 devices simultaneously
- 🎵 **Full Playback Control** - Play, pause, skip, seek
- 🔊 **Volume Control** - Adjust volume from your mobile device
- 📋 **Playlist Browsing** - View and manage your queue
- ⚡ **Real-time Sync** - Instant state synchronization

## Architecture

### Desktop (Server)
- **WebSocket Server** - Real-time bidirectional communication
- **HTTP Server** - Base server for WebSocket upgrade
- **mDNS Service** - Automatic network discovery
- **JWT Authentication** - Secure token-based auth

### Mobile App (Client)
- **WebSocket Client** - Connects to desktop
- **mDNS Browser** - Discovers nearby devices
- **QR Scanner** - Quick pairing
- **State Manager** - Syncs playback state

## Configuration

- **Port**: WebSocket server port (default: 8888)
- **Discovery**: Enable/disable mDNS service discovery
- **Service Name**: Name shown on network (default: "Pear Desktop")
- **Auth Required**: Require authentication (recommended)
- **Max Connections**: Maximum simultaneous connections (1-10)
- **Auto Sync**: Automatically sync playback state
- **Permissions**: 
  - Allow Volume Control
  - Allow Playback Control
  - Allow Playlist Browsing

## How It Works

### Setup

1. **Enable Plugin** - Go to Settings → Plugins → Enable "Pear Connect"
2. **Click Connect Button** - Look for the connection icon (radio waves) in the top-right corner next to the settings button
3. **View QR Code** - Click the button to see the QR code and pairing code
4. **Connect from Mobile** - Open http://YOUR_IP:8888 on your phone browser (or scan QR code when available)
5. **Enter Code** - Type the 6-digit pairing code shown on desktop
6. **Control** - Use your phone to control playback!

### Pairing Process

1. **Enable Plugin** - Turn on Pear Connect in settings
2. **Start Server** - WebSocket server starts on configured port
3. **Discover** - Mobile app finds desktop via mDNS
4. **Scan QR** - Mobile app scans QR code or enters 6-digit code
5. **Authenticate** - Desktop confirms pairing
6. **Connected** - JWT token issued for future connections

### Message Flow

```
Mobile                Desktop
  |                      |
  |--- AUTH_REQUEST ---->|
  |<-- AUTH_RESPONSE ----|  (QR + pairing code)
  |                      |
  |--- (user confirms) ->|
  |<-- AUTH_SUCCESS -----|  (JWT token)
  |                      |
  |--- PLAY/PAUSE/etc -->|
  |<-- STATE_UPDATE -----|
  |<-- QUEUE_UPDATE -----|
```

### State Synchronization

The server broadcasts state updates to all connected clients:

- **Playback State**: Play/pause, current time, duration
- **Volume**: Current volume level
- **Track Info**: Title, artist, album, thumbnail
- **Queue**: Current queue with metadata

Updates occur:
- Every 1 second (while playing)
- On state change (play/pause/skip)
- On queue modification
- On volume change

## Security

- **JWT Tokens**: Long-lived tokens (365 days) for authenticated sessions
- **Pairing Codes**: 6-digit codes expire after 5 minutes
- **Origin Validation**: WebSocket connections validated
- **Permission System**: Granular control over client capabilities

## Network Requirements

- **Desktop & Mobile**: Must be on same network
- **Firewall**: Allow incoming connections on configured port
- **mDNS**: Ensure multicast DNS is not blocked

## Mobile App Integration

To integrate with a mobile app:

```typescript
// Connect to discovered service
const ws = new WebSocket('ws://192.168.1.100:8888');

// Authenticate
ws.send(JSON.stringify({
  type: 'AUTH_REQUEST',
  payload: {
    deviceName: 'My iPhone',
    deviceType: 'mobile'
  },
  timestamp: Date.now()
}));

// Send playback control
ws.send(JSON.stringify({
  type: 'PLAY',
  timestamp: Date.now()
}));

// Receive state updates
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'STATE_UPDATE') {
    updateUI(message.payload);
  }
};
```

## Troubleshooting

- **Can't discover device**: Check firewall settings, ensure mDNS is enabled
- **Connection refused**: Verify port is not in use, check network settings
- **Auth failed**: Re-pair device, check system time is synchronized
- **Playback control not working**: Check permissions in settings

## Future Enhancements

- [ ] Lyrics display on mobile
- [ ] Playlist creation from mobile
- [ ] Search integration
- [ ] Multiple desktop instances
- [ ] Cloud relay for remote access
- [ ] Activity history
- [ ] Custom themes sync

## Dependencies

- `ws` - WebSocket server
- `bonjour-service` - mDNS service discovery
- `jsonwebtoken` - JWT authentication
- `qrcode` - QR code generation (optional, for UI)
