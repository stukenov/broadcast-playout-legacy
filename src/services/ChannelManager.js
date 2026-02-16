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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelManager = void 0;
const Channel_1 = require("../models/Channel");
const MediaPipeline_1 = require("../core/MediaPipeline");
const events_1 = require("events");
class ChannelManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.channels = new Map();
        this.pipelines = new Map();
    }
    createChannel(config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.channels.has(config.id)) {
                throw new Error(`Channel with ID ${config.id} already exists`);
            }
            const channel = new Channel_1.Channel(config);
            const pipeline = new MediaPipeline_1.FFmpegPipeline({
                outputRtmpUrl: config.outputRtmpUrl,
                outputMpegTsUrl: config.outputMpegTsUrl
            });
            // Set up channel event handlers
            channel.on('scheduleUpdated', (schedule) => {
                this.emit('channelScheduleUpdated', { channelId: config.id, schedule });
            });
            channel.on('switchToLive', (rtmpUrl) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield pipeline.switchSource({
                        id: 'live',
                        startTime: new Date(),
                        sourceType: 'live',
                        source: rtmpUrl
                    });
                    this.emit('channelSwitchedToLive', { channelId: config.id, rtmpUrl });
                }
                catch (error) {
                    this.emit('error', { channelId: config.id, error });
                }
            }));
            channel.on('resumeSchedule', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    const currentItem = channel.getCurrentItem();
                    if (currentItem) {
                        yield pipeline.switchSource(currentItem);
                    }
                    this.emit('channelResumedSchedule', { channelId: config.id });
                }
                catch (error) {
                    this.emit('error', { channelId: config.id, error });
                }
            }));
            channel.on('overlayUpdate', (content) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield pipeline.updateOverlay(content);
                    this.emit('channelOverlayUpdated', { channelId: config.id, content });
                }
                catch (error) {
                    this.emit('error', { channelId: config.id, error });
                }
            }));
            // Set up pipeline event handlers
            pipeline.on('error', (error) => {
                this.emit('error', { channelId: config.id, error });
            });
            // Store channel and pipeline
            this.channels.set(config.id, channel);
            this.pipelines.set(config.id, pipeline);
            // Start the pipeline
            yield pipeline.start();
            this.emit('channelCreated', { channelId: config.id, config });
            return channel;
        });
    }
    deleteChannel(channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const channel = this.channels.get(channelId);
            const pipeline = this.pipelines.get(channelId);
            if (!channel || !pipeline) {
                throw new Error(`Channel with ID ${channelId} not found`);
            }
            yield pipeline.stop();
            this.channels.delete(channelId);
            this.pipelines.delete(channelId);
            this.emit('channelDeleted', { channelId });
        });
    }
    getChannel(channelId) {
        const channel = this.channels.get(channelId);
        if (!channel) {
            throw new Error(`Channel with ID ${channelId} not found`);
        }
        return channel;
    }
    getAllChannels() {
        return Array.from(this.channels.values());
    }
    startScheduler() {
        return __awaiter(this, void 0, void 0, function* () {
            // Start a timer to check schedule every second
            setInterval(() => {
                this.checkSchedules();
            }, 1000);
        });
    }
    checkSchedules() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            for (const [channelId, channel] of this.channels) {
                if (channel.isCurrentlyLive()) {
                    continue; // Skip channels in live mode
                }
                const schedule = channel.getSchedule();
                const currentItem = schedule.find(item => {
                    const startTime = item.startTime.getTime();
                    const endTime = startTime + (item.duration || 0) * 1000;
                    return now.getTime() >= startTime && now.getTime() < endTime;
                });
                if (currentItem && currentItem !== channel.getCurrentItem()) {
                    try {
                        const pipeline = this.pipelines.get(channelId);
                        if (pipeline) {
                            yield pipeline.switchSource(currentItem, currentItem.transition, currentItem.transitionDuration);
                        }
                    }
                    catch (error) {
                        this.emit('error', { channelId, error });
                    }
                }
            }
        });
    }
}
exports.ChannelManager = ChannelManager;
