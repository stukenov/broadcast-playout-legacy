import { FastifyInstance } from 'fastify';
import fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from 'dotenv';
import { WebSocket } from 'ws';
import { ChannelManager } from '../services/ChannelManager';
import { ChannelConfig, ScheduleItem } from '../models/Channel';
import { SocketStream } from '@fastify/websocket';

declare module 'fastify' {
  interface FastifyInstance {
    websocketServer: {
      clients: Set<WebSocket>;
    };
  }
}

// Load environment variables
config();

// Create Fastify instance with TypeScript support
const server: FastifyInstance = fastify({
  logger: true
});
const channelManager = new ChannelManager();

// Register plugins
server.register(cors);
server.register(websocket);

// Health check route
server.get('/health', async () => {
  return { status: 'ok' as const };
});

// WebSocket route for real-time updates
server.register(async function (fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (connection) => {
    const socket = connection.socket;
    
    socket.on('message', (data) => {
      const message = data.toString();
      // Echo back the message
      socket.send(`Server received: ${message}`);
    });
  });
});

// Channel management endpoints
server.post<{
  Body: ChannelConfig
}>('/channels', async (request, reply) => {
  try {
    const channel = await channelManager.createChannel(request.body);
    return { success: true, channel: channel.getConfig() };
  } catch (error) {
    reply.status(400).send({ success: false, error: error.message });
  }
});

server.delete<{
  Params: { id: string }
}>('/channels/:id', async (request, reply) => {
  try {
    await channelManager.deleteChannel(request.params.id);
    return { success: true };
  } catch (error) {
    reply.status(404).send({ success: false, error: error.message });
  }
});

server.get<{
  Params: { id: string }
}>('/channels/:id', async (request, reply) => {
  try {
    const channel = channelManager.getChannel(request.params.id);
    return {
      success: true,
      channel: channel.getConfig(),
      schedule: channel.getSchedule(),
      currentItem: channel.getCurrentItem(),
      isLive: channel.isCurrentlyLive()
    };
  } catch (error) {
    reply.status(404).send({ success: false, error: error.message });
  }
});

server.get('/channels', async () => {
  const channels = channelManager.getAllChannels();
  return {
    success: true,
    channels: channels.map(channel => ({
      ...channel.getConfig(),
      schedule: channel.getSchedule(),
      currentItem: channel.getCurrentItem(),
      isLive: channel.isCurrentlyLive()
    }))
  };
});

// Scheduling endpoints
server.post<{
  Params: { id: string }
  Body: Omit<ScheduleItem, 'id'>
}>('/channels/:id/schedule', async (request, reply) => {
  try {
    const channel = channelManager.getChannel(request.params.id);
    const item = await channel.addScheduleItem(request.body);
    return { success: true, item };
  } catch (error) {
    reply.status(400).send({ success: false, error: error.message });
  }
});

server.get<{
  Params: { id: string }
}>('/channels/:id/schedule', async (request, reply) => {
  try {
    const channel = channelManager.getChannel(request.params.id);
    return { success: true, schedule: channel.getSchedule() };
  } catch (error) {
    reply.status(404).send({ success: false, error: error.message });
  }
});

// Live control endpoints
server.post<{
  Params: { id: string }
  Body: { rtmpUrl: string }
}>('/channels/:id/switchLive', async (request, reply) => {
  try {
    const channel = channelManager.getChannel(request.params.id);
    await channel.switchToLive(request.body.rtmpUrl);
    return { success: true };
  } catch (error) {
    reply.status(400).send({ success: false, error: error.message });
  }
});

server.post<{
  Params: { id: string }
}>('/channels/:id/resumeSchedule', async (request, reply) => {
  try {
    const channel = channelManager.getChannel(request.params.id);
    await channel.resumeSchedule();
    return { success: true };
  } catch (error) {
    reply.status(400).send({ success: false, error: error.message });
  }
});

// Overlay control endpoint
server.put<{
  Params: { id: string }
  Body: any
}>('/channels/:id/overlay', async (request, reply) => {
  try {
    const channel = channelManager.getChannel(request.params.id);
    await channel.updateOverlay(request.body);
    return { success: true };
  } catch (error) {
    reply.status(400).send({ success: false, error: error.message });
  }
});

// Start the scheduler
channelManager.startScheduler();

// Start the server
const start = async () => {
  try {
    await server.listen({ 
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      host: '0.0.0.0'
    });
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
  } catch (error: unknown) {
    if (error instanceof Error) {
      server.log.error(error.message);
    } else {
      server.log.error('An unknown error occurred');
    }
    process.exit(1);
  }
};

start(); 