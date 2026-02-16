"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const ChannelManager_1 = require("../services/ChannelManager");
const server = (0, fastify_1.default)({ logger: true });
const channelManager = new ChannelManager_1.ChannelManager();
// Register plugins
server.register(cors_1.default, {
    origin: true // Allow all origins in development
});
server.register(websocket_1.default);
// Register WebSocket handler for real-time updates
server.register(function (fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        fastify.get('/ws', { websocket: true }, (connection, req) => {
            const { socket } = connection;
            // Forward channel manager events to WebSocket clients
            const eventHandler = (event) => {
                socket.send(JSON.stringify(event));
            };
            channelManager.on('channelCreated', eventHandler);
            channelManager.on('channelDeleted', eventHandler);
            channelManager.on('channelScheduleUpdated', eventHandler);
            channelManager.on('channelSwitchedToLive', eventHandler);
            channelManager.on('channelResumedSchedule', eventHandler);
            channelManager.on('channelOverlayUpdated', eventHandler);
            channelManager.on('error', eventHandler);
            socket.on('close', () => {
                channelManager.removeListener('channelCreated', eventHandler);
                channelManager.removeListener('channelDeleted', eventHandler);
                channelManager.removeListener('channelScheduleUpdated', eventHandler);
                channelManager.removeListener('channelSwitchedToLive', eventHandler);
                channelManager.removeListener('channelResumedSchedule', eventHandler);
                channelManager.removeListener('channelOverlayUpdated', eventHandler);
                channelManager.removeListener('error', eventHandler);
            });
        });
    });
});
// Channel management endpoints
server.post('/channels', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const channel = yield channelManager.createChannel(request.body);
        return { success: true, channel: channel.getConfig() };
    }
    catch (error) {
        reply.status(400).send({ success: false, error: error.message });
    }
}));
server.delete('/channels/:id', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield channelManager.deleteChannel(request.params.id);
        return { success: true };
    }
    catch (error) {
        reply.status(404).send({ success: false, error: error.message });
    }
}));
server.get('/channels/:id', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const channel = channelManager.getChannel(request.params.id);
        return {
            success: true,
            channel: channel.getConfig(),
            schedule: channel.getSchedule(),
            currentItem: channel.getCurrentItem(),
            isLive: channel.isCurrentlyLive()
        };
    }
    catch (error) {
        reply.status(404).send({ success: false, error: error.message });
    }
}));
server.get('/channels', () => __awaiter(void 0, void 0, void 0, function* () {
    const channels = channelManager.getAllChannels();
    return {
        success: true,
        channels: channels.map(channel => (Object.assign(Object.assign({}, channel.getConfig()), { schedule: channel.getSchedule(), currentItem: channel.getCurrentItem(), isLive: channel.isCurrentlyLive() })))
    };
}));
// Scheduling endpoints
server.post('/channels/:id/schedule', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const channel = channelManager.getChannel(request.params.id);
        const item = yield channel.addScheduleItem(request.body);
        return { success: true, item };
    }
    catch (error) {
        reply.status(400).send({ success: false, error: error.message });
    }
}));
server.get('/channels/:id/schedule', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const channel = channelManager.getChannel(request.params.id);
        return { success: true, schedule: channel.getSchedule() };
    }
    catch (error) {
        reply.status(404).send({ success: false, error: error.message });
    }
}));
// Live control endpoints
server.post('/channels/:id/switchLive', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const channel = channelManager.getChannel(request.params.id);
        yield channel.switchToLive(request.body.rtmpUrl);
        return { success: true };
    }
    catch (error) {
        reply.status(400).send({ success: false, error: error.message });
    }
}));
server.post('/channels/:id/resumeSchedule', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const channel = channelManager.getChannel(request.params.id);
        yield channel.resumeSchedule();
        return { success: true };
    }
    catch (error) {
        reply.status(400).send({ success: false, error: error.message });
    }
}));
// Overlay control endpoint
server.put('/channels/:id/overlay', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const channel = channelManager.getChannel(request.params.id);
        yield channel.updateOverlay(request.body);
        return { success: true };
    }
    catch (error) {
        reply.status(400).send({ success: false, error: error.message });
    }
}));
// Start the scheduler
channelManager.startScheduler();
// Start the server
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield server.listen({ port: 3000 });
        server.log.info('Server listening on port 3000');
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
});
start();
