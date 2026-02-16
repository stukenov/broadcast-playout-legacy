import fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import path from 'path';
import fs from 'fs';

const server = fastify({ logger: true });

// Register plugins
server.register(cors, {
  origin: true
});

server.register(websocket);

// Serve static overlay template
server.get('/overlay/:channelId', async (request, reply) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 0;
          width: 1920px;
          height: 1080px;
          overflow: hidden;
          background: transparent;
        }
        #logo {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 100px;
          height: 100px;
          background-size: contain;
          background-repeat: no-repeat;
        }
        #ticker {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          font-family: Arial, sans-serif;
          font-size: 24px;
          line-height: 40px;
          white-space: nowrap;
          overflow: hidden;
        }
        #ticker-text {
          display: inline-block;
          animation: ticker 30s linear infinite;
        }
        @keyframes ticker {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      </style>
    </head>
    <body>
      <div id="logo"></div>
      <div id="ticker">
        <div id="ticker-text"></div>
      </div>
      <script>
        const ws = new WebSocket('ws://localhost:3001/ws/${request.params.channelId}');
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'logo') {
            document.getElementById('logo').style.backgroundImage = \`url(\${data.url})\`;
          }
          
          if (data.type === 'ticker') {
            document.getElementById('ticker-text').textContent = data.text;
          }
          
          if (data.type === 'custom') {
            // Handle custom overlay updates
            const element = document.getElementById(data.elementId);
            if (element) {
              Object.assign(element.style, data.styles || {});
              if (data.content) {
                element.innerHTML = data.content;
              }
            }
          }
        };
      </script>
    </body>
    </html>
  `;

  reply.type('text/html').send(html);
});

// WebSocket handler for overlay updates
server.register(async function (fastify) {
  fastify.get('/ws/:channelId', { websocket: true }, (connection, req) => {
    const { socket } = connection;
    const { channelId } = req.params;

    socket.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        // Broadcast the update to all clients for this channel
        server.websocketServer.clients.forEach(client => {
          if (client !== socket && client.readyState === 1) {
            client.send(JSON.stringify(data));
          }
        });
      } catch (error) {
        fastify.log.error('Invalid WebSocket message:', error);
      }
    });
  });
});

// Start the overlay renderer server
const start = async () => {
  try {
    await server.listen({ port: 3001 });
    server.log.info('Overlay renderer server listening on port 3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start(); 