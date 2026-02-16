# Broadcast Playout Legacy

A TypeScript-based TV channel playout system that enables seamless streaming of scheduled video content with support for live broadcasts, frame-accurate scheduling, and real-time HTML5 graphics overlays.

## Features

- **Frame-Accurate Scheduling**: Precise timing for MP4 files and RTMP streams
- **Smooth Transitions**: Support for crossfade, cut, and fade-through-white transitions
- **Live Broadcasting**: Instant switching to live RTMP input sources
- **Graphics Overlays**: Real-time HTML5 overlay rendering
- **Multi-Channel Support**: Manage multiple broadcast channels simultaneously
- **Multiple Output Formats**: RTMP and MPEG-TS streaming output
- **RESTful API**: Complete control via HTTP endpoints
- **WebSocket Support**: Real-time status updates and notifications
- **Docker Ready**: Containerized deployment for production

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Web Framework**: Fastify
- **Media Processing**: FFmpeg via fluent-ffmpeg
- **Real-time Communication**: WebSocket (ws)

## Prerequisites

- Node.js 18 or later
- FFmpeg
- Docker and Docker Compose (for containerized deployment)

## Installation

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/stukenov/broadcast-playout-legacy.git
   cd broadcast-playout-legacy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. Build the TypeScript code:
   ```bash
   npm run build
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Docker Deployment

1. Build and start the containers:
   ```bash
   docker-compose up -d
   ```

2. View logs:
   ```bash
   docker-compose logs -f
   ```

3. Stop the containers:
   ```bash
   docker-compose down
   ```

## Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# FFmpeg Configuration (optional)
# FFMPEG_PATH=/usr/bin/ffmpeg
```

## API Reference

### Health Check

```bash
GET /health
```

Returns the server health status.

### Create a Channel

```bash
curl -X POST http://localhost:3000/channels \
  -H "Content-Type: application/json" \
  -d '{
    "id": "channel1",
    "name": "Test Channel",
    "outputRtmpUrl": "rtmp://localhost/live/channel1",
    "outputMpegTsUrl": "udp://localhost:1234",
    "overlayEnabled": true
  }'
```

### Get All Channels

```bash
GET /channels
```

Returns all channels with their current status and schedule.

### Get Channel Details

```bash
GET /channels/:id
```

Returns detailed information about a specific channel.

### Delete Channel

```bash
DELETE /channels/:id
```

Removes a channel and stops its playout.

### Schedule Content

```bash
curl -X POST http://localhost:3000/channels/channel1/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2024-03-01T12:00:00Z",
    "sourceType": "file",
    "source": "/media/video1.mp4",
    "duration": 300,
    "transition": "crossfade"
  }'
```

### Get Channel Schedule

```bash
GET /channels/:id/schedule
```

Returns the schedule for a specific channel.

### Switch to Live

```bash
curl -X POST http://localhost:3000/channels/channel1/switchLive \
  -H "Content-Type: application/json" \
  -d '{
    "rtmpUrl": "rtmp://source.com/live/input1"
  }'
```

### Resume Scheduled Content

```bash
POST /channels/:id/resumeSchedule
```

Returns to scheduled content from live mode.

### Update Overlay

```bash
curl -X PUT http://localhost:3000/channels/channel1/overlay \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ticker",
    "text": "Breaking News: Important Update"
  }'
```

## WebSocket Events

Connect to `ws://localhost:3000/ws` to receive real-time updates:

- Channel creation/deletion events
- Schedule updates
- Live mode switches
- Overlay changes
- Error notifications

## Project Structure

```
src/
├── api/          # API server and routes
├── core/         # Core playout functionality
├── models/       # Data models and types
├── services/     # Business logic and services
├── utils/        # Utility functions
└── overlays/     # HTML5 overlay renderer
```

## Development

### Available Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Start development server with auto-reload
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint TypeScript code

### Running Tests

```bash
npm test
```

## Docker Compose Services

The included `docker-compose.yml` provides:

- **playout**: Main playout service (ports 3000, 3001)
- **rtmp**: NGINX RTMP server for testing (ports 1935, 8080)

## Performance Considerations

- The system is designed to handle multiple channels efficiently
- Resource limits can be configured in `docker-compose.yml`
- Frame-accurate switching requires adequate CPU and memory resources
- Consider using GPU acceleration for improved FFmpeg performance
- For production use, ensure FFmpeg is compiled with hardware acceleration support

## Troubleshooting

### Common Issues

**Port already in use**
```bash
# Change PORT in .env file or kill the process using the port
lsof -ti:3000 | xargs kill -9
```

**FFmpeg not found**
```bash
# Install FFmpeg
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Or set FFMPEG_PATH in .env
```

**Permission errors with video files**
```bash
# Ensure the video files are readable by the Node.js process
chmod 644 /path/to/video.mp4
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Fastify](https://www.fastify.io/)
- Media processing powered by [FFmpeg](https://ffmpeg.org/)
- Real-time communication via [WebSocket](https://github.com/websockets/ws)

## Support

For issues, questions, or contributions, please visit the [GitHub Issues](https://github.com/stukenov/broadcast-playout-legacy/issues) page.

---

**Note**: This is a legacy version of the playout system. For the latest version, see [broadcast-playout](https://github.com/stukenov/broadcast-playout). 