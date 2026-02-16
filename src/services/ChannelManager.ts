import { Channel, ChannelConfig } from '../models/Channel';
import { MediaPipeline, FFmpegPipeline } from '../core/MediaPipeline';
import { EventEmitter } from 'events';

export class ChannelManager extends EventEmitter {
  private channels: Map<string, Channel> = new Map();
  private pipelines: Map<string, MediaPipeline> = new Map();

  constructor() {
    super();
  }

  public async createChannel(config: ChannelConfig): Promise<Channel> {
    if (this.channels.has(config.id)) {
      throw new Error(`Channel with ID ${config.id} already exists`);
    }

    const channel = new Channel(config);
    const pipeline = new FFmpegPipeline({
      outputRtmpUrl: config.outputRtmpUrl,
      outputMpegTsUrl: config.outputMpegTsUrl
    });

    // Set up channel event handlers
    channel.on('scheduleUpdated', (schedule) => {
      this.emit('channelScheduleUpdated', { channelId: config.id, schedule });
    });

    channel.on('switchToLive', async (rtmpUrl) => {
      try {
        await pipeline.switchSource({
          id: 'live',
          startTime: new Date(),
          sourceType: 'live',
          source: rtmpUrl
        });
        this.emit('channelSwitchedToLive', { channelId: config.id, rtmpUrl });
      } catch (error) {
        this.emit('error', { channelId: config.id, error });
      }
    });

    channel.on('resumeSchedule', async () => {
      try {
        const currentItem = channel.getCurrentItem();
        if (currentItem) {
          await pipeline.switchSource(currentItem);
        }
        this.emit('channelResumedSchedule', { channelId: config.id });
      } catch (error) {
        this.emit('error', { channelId: config.id, error });
      }
    });

    channel.on('overlayUpdate', async (content) => {
      try {
        await pipeline.updateOverlay(content);
        this.emit('channelOverlayUpdated', { channelId: config.id, content });
      } catch (error) {
        this.emit('error', { channelId: config.id, error });
      }
    });

    // Set up pipeline event handlers
    pipeline.on('error', (error) => {
      this.emit('error', { channelId: config.id, error });
    });

    // Store channel and pipeline
    this.channels.set(config.id, channel);
    this.pipelines.set(config.id, pipeline);

    // Start the pipeline
    await pipeline.start();

    this.emit('channelCreated', { channelId: config.id, config });
    return channel;
  }

  public async deleteChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    const pipeline = this.pipelines.get(channelId);

    if (!channel || !pipeline) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    await pipeline.stop();
    this.channels.delete(channelId);
    this.pipelines.delete(channelId);

    this.emit('channelDeleted', { channelId });
  }

  public getChannel(channelId: string): Channel {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }
    return channel;
  }

  public getAllChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  public async startScheduler(): Promise<void> {
    // Start a timer to check schedule every second
    setInterval(() => {
      this.checkSchedules();
    }, 1000);
  }

  private async checkSchedules(): Promise<void> {
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
            await pipeline.switchSource(
              currentItem,
              currentItem.transition,
              currentItem.transitionDuration
            );
          }
        } catch (error) {
          this.emit('error', { channelId, error });
        }
      }
    }
  }
} 