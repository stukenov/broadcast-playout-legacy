import { EventEmitter } from 'events';

export interface ChannelConfig {
  id: string;
  name: string;
  outputRtmpUrl?: string;
  outputMpegTsUrl?: string;
  defaultTransition?: 'cut' | 'crossfade' | 'fadewhite';
  transitionDuration?: number; // in seconds
  overlayEnabled?: boolean;
  overlayUrl?: string;
}

export interface ScheduleItem {
  id: string;
  startTime: Date;
  sourceType: 'file' | 'live';
  source: string; // file path or RTMP URL
  duration?: number; // in seconds, optional for live sources
  transition?: 'cut' | 'crossfade' | 'fadewhite';
  transitionDuration?: number;
}

export class Channel extends EventEmitter {
  private config: ChannelConfig;
  private schedule: ScheduleItem[] = [];
  private currentItem: ScheduleItem | null = null;
  private isLive: boolean = false;

  constructor(config: ChannelConfig) {
    super();
    this.config = {
      defaultTransition: 'crossfade',
      transitionDuration: 1,
      overlayEnabled: false,
      ...config
    };
  }

  public getId(): string {
    return this.config.id;
  }

  public getName(): string {
    return this.config.name;
  }

  public getConfig(): ChannelConfig {
    return { ...this.config };
  }

  public async addScheduleItem(item: Omit<ScheduleItem, 'id'>): Promise<ScheduleItem> {
    const newItem: ScheduleItem = {
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      transition: item.transition || this.config.defaultTransition,
      transitionDuration: item.transitionDuration || this.config.transitionDuration
    };

    // Validate no time conflicts
    const conflict = this.schedule.find(existing => {
      const existingStart = existing.startTime.getTime();
      const existingEnd = existingStart + (existing.duration || 0) * 1000;
      const newStart = newItem.startTime.getTime();
      const newEnd = newStart + (newItem.duration || 0) * 1000;

      return (newStart >= existingStart && newStart < existingEnd) ||
             (newEnd > existingStart && newEnd <= existingEnd);
    });

    if (conflict) {
      throw new Error(`Schedule conflict with item ${conflict.id}`);
    }

    this.schedule.push(newItem);
    this.schedule.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    this.emit('scheduleUpdated', this.schedule);
    return newItem;
  }

  public getSchedule(): ScheduleItem[] {
    return [...this.schedule];
  }

  public getCurrentItem(): ScheduleItem | null {
    return this.currentItem;
  }

  public isCurrentlyLive(): boolean {
    return this.isLive;
  }

  public async switchToLive(rtmpUrl: string): Promise<void> {
    if (this.isLive) {
      throw new Error('Already in live mode');
    }

    this.isLive = true;
    this.emit('switchToLive', rtmpUrl);
  }

  public async resumeSchedule(): Promise<void> {
    if (!this.isLive) {
      throw new Error('Not in live mode');
    }

    this.isLive = false;
    this.emit('resumeSchedule');
  }

  public async updateOverlay(content: any): Promise<void> {
    if (!this.config.overlayEnabled) {
      throw new Error('Overlay not enabled for this channel');
    }

    this.emit('overlayUpdate', content);
  }
} 