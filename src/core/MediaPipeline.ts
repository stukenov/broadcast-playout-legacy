import { EventEmitter } from 'events';
import * as ffmpeg from 'fluent-ffmpeg';
import { ScheduleItem } from '../models/Channel';
import * as path from 'path';
import { FrameTimer } from '../utils/FrameTimer';

export interface MediaPipelineConfig {
  outputRtmpUrl?: string;
  outputMpegTsUrl?: string;
  width?: number;
  height?: number;
  fps?: number;
  videoBitrate?: string;
  audioBitrate?: string;
  workDir?: string;
  frameTolerance?: number;
}

export interface MediaPipeline {
  start(): Promise<void>;
  stop(): Promise<void>;
  switchSource(item: ScheduleItem, transition?: string, transitionDuration?: number): Promise<void>;
  updateOverlay(content: any): Promise<void>;
}

export interface CommandLineEvent {
  item: ScheduleItem;
  commandLine: string;
}

export interface ErrorEvent {
  error: Error;
  stdout?: string;
  stderr?: string;
}

export interface FFmpegPipelineEvents {
  started: () => void;
  stopped: () => void;
  sourceSwitch: (event: CommandLineEvent) => void;
  error: (event: ErrorEvent) => void;
  sourceEnd: (item: ScheduleItem) => void;
  overlayUpdate: (content: any) => void;
}

interface FFmpegEvents {
  start: (commandLine: string) => void;
  stderr: (stderrLine: string) => void;
  error: (err: Error, stdout: string, stderr: string) => void;
  end: (stdout: string, stderr: string) => void;
}

declare module 'fluent-ffmpeg' {
  interface FfmpegCommand {
    on<K extends keyof FFmpegEvents>(event: K, listener: FFmpegEvents[K]): this;
  }
}

export class FFmpegPipeline extends EventEmitter implements MediaPipeline {
  private config: MediaPipelineConfig;
  private currentCommand: ffmpeg.FfmpegCommand | null = null;
  private nextCommand: ffmpeg.FfmpegCommand | null = null;
  private isRunning: boolean = false;
  private currentItem: ScheduleItem | null = null;
  private transitionInProgress: boolean = false;
  private frameTimer: FrameTimer;

  constructor(config: MediaPipelineConfig) {
    super();
    this.config = {
      width: 1920,
      height: 1080,
      fps: 30,
      videoBitrate: '4000k',
      audioBitrate: '128k',
      workDir: './temp',
      frameTolerance: 1,
      ...config
    };

    this.frameTimer = new FrameTimer({
      fps: this.config.fps!,
      tolerance: this.config.frameTolerance
    });

    this.frameTimer.on('error', (error: Error) => {
      this.emit('error', { error, stdout: '', stderr: '' } as ErrorEvent);
    });
  }

  public on = <K extends keyof FFmpegPipelineEvents>(
    event: K,
    listener: FFmpegPipelineEvents[K]
  ): this => {
    return super.on(event, listener);
  };

  public emit = <K extends keyof FFmpegPipelineEvents>(
    event: K,
    ...args: Parameters<FFmpegPipelineEvents[K]>
  ): boolean => {
    return super.emit(event, ...args);
  };

  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Pipeline is already running');
    }

    this.frameTimer.start();
    this.isRunning = true;
    this.emit('started');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.frameTimer.stop();

    if (this.currentCommand) {
      this.currentCommand.kill('SIGKILL');
      this.currentCommand = null;
    }

    if (this.nextCommand) {
      this.nextCommand.kill('SIGKILL');
      this.nextCommand = null;
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  private setupCommandEventHandlers(command: ffmpeg.FfmpegCommand, item: ScheduleItem): void {
    command
      .on('start', (commandLine: string) => {
        this.emit('sourceSwitch', { item, commandLine } as CommandLineEvent);
      })
      .on('stderr', (stderr: string) => {
        // Handle stderr output if needed
      })
      .on('error', (err: Error, stdout: string, stderr: string) => {
        this.emit('error', { error: err, stdout, stderr } as ErrorEvent);
      })
      .on('end', (stdout: string, stderr: string) => {
        this.emit('sourceEnd', item);
      });
  }

  private async createTransitionCommand(
    currentSource: string,
    nextSource: string,
    transition: string,
    transitionDuration: number
  ): Promise<ffmpeg.FfmpegCommand> {
    // Wait for the next frame boundary before starting the transition
    await this.frameTimer.waitForNextFrame();

    const command = new ffmpeg.FfmpegCommand();
    
    // Input setup with frame-accurate seeking
    command
      .input(currentSource)
      .inputOptions([
        '-accurate_seek',
        '-re', // Read at native framerate
        '-copyts' // Preserve timestamps
      ])
      .input(nextSource)
      .inputOptions([
        '-accurate_seek',
        '-re',
        '-copyts'
      ]);

    // Calculate exact number of frames for transition
    const transitionFrames = Math.round(transitionDuration * this.config.fps!);
    
    // Complex filter for transition
    let filterComplex = '';
    switch (transition) {
      case 'fadewhite':
        filterComplex = `[0:v][1:v]xfade=transition=fade:duration=${transitionDuration}:offset=0:color=white[v]`;
        break;
      case 'cut':
        // For cut, we'll use a very short crossfade (1 frame)
        filterComplex = `[0:v][1:v]xfade=transition=fade:duration=${1/this.config.fps!}:offset=0[v]`;
        break;
      case 'crossfade':
      default:
        filterComplex = `[0:v][1:v]xfade=transition=fade:duration=${transitionDuration}:offset=0[v]`;
        break;
    }

    // Audio crossfade with exact frame alignment
    filterComplex += `;[0:a][1:a]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[a]`;

    command.complexFilter(filterComplex, ['v', 'a']);

    // Output setup with frame-accurate options
    if (this.config.outputRtmpUrl) {
      command
        .output(this.config.outputRtmpUrl)
        .outputOptions([
          '-c:v libx264',
          '-preset ultrafast',
          '-tune zerolatency',
          `-b:v ${this.config.videoBitrate}`,
          '-c:a aac',
          `-b:a ${this.config.audioBitrate}`,
          '-f flv',
          '-fflags nobuffer',
          '-flags low_delay',
          '-vsync cfr', // Constant frame rate
          `-r ${this.config.fps}`,
          '-copytb 1', // Use timebase from input
          '-async 1' // Audio sync method
        ]);
    }

    if (this.config.outputMpegTsUrl) {
      command
        .output(this.config.outputMpegTsUrl)
        .outputOptions([
          '-c:v libx264',
          '-preset ultrafast',
          `-b:v ${this.config.videoBitrate}`,
          '-c:a aac',
          `-b:a ${this.config.audioBitrate}`,
          '-f mpegts',
          '-muxdelay 0',
          '-muxpreload 0'
        ]);
    }

    // Common output options for frame accuracy
    command
      .outputOptions([
        `-s ${this.config.width}x${this.config.height}`,
        `-r ${this.config.fps}`,
        '-g 30',
        '-keyint_min 30',
        '-sc_threshold 0', // Disable scene change detection
        '-sws_flags bilinear', // Fast scaling
        '-max_muxing_queue_size 1024'
      ]);

    // Set up event handlers
    this.setupCommandEventHandlers(command, this.currentItem!);

    return command;
  }

  public async switchSource(
    item: ScheduleItem,
    transition: string = 'crossfade',
    transitionDuration: number = 1
  ): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Pipeline is not running');
    }

    if (this.transitionInProgress) {
      throw new Error('Transition already in progress');
    }

    this.transitionInProgress = true;

    try {
      if (!this.currentItem) {
        // First item, no transition needed
        await this.startDirectPlayback(item);
      } else {
        // Create transition between current and next
        const command = await this.createTransitionCommand(
          this.currentItem.source,
          item.source,
          transition,
          transitionDuration
        );

        // Start the transition
        if (this.currentCommand) {
          this.currentCommand.kill('SIGKILL');
        }
        this.currentCommand = command;
        command.run();
      }

      this.currentItem = item;
    } catch (error) {
      this.transitionInProgress = false;
      throw error;
    }
  }

  private async startDirectPlayback(item: ScheduleItem): Promise<void> {
    // Wait for the next frame boundary
    await this.frameTimer.waitForNextFrame();

    const command = new ffmpeg.FfmpegCommand();

    if (item.sourceType === 'file') {
      command
        .input(item.source)
        .inputOptions([
          '-re',
          '-copyts',
          '-vsync cfr'
        ]);
    } else {
      command
        .input(item.source)
        .inputOptions([
          '-re',
          '-copyts',
          '-vsync cfr'
        ]);
    }

    // Set up outputs with frame-accurate options
    if (this.config.outputRtmpUrl) {
      command
        .output(this.config.outputRtmpUrl)
        .outputOptions([
          '-c:v libx264',
          '-preset ultrafast',
          '-tune zerolatency',
          `-b:v ${this.config.videoBitrate}`,
          '-c:a aac',
          `-b:a ${this.config.audioBitrate}`,
          '-f flv',
          '-fflags nobuffer',
          '-flags low_delay',
          '-vsync cfr',
          `-r ${this.config.fps}`,
          '-copytb 1',
          '-async 1'
        ]);
    }

    if (this.config.outputMpegTsUrl) {
      command
        .output(this.config.outputMpegTsUrl)
        .outputOptions([
          '-c:v libx264',
          '-preset ultrafast',
          `-b:v ${this.config.videoBitrate}`,
          '-c:a aac',
          `-b:a ${this.config.audioBitrate}`,
          '-f mpegts',
          '-muxdelay 0',
          '-muxpreload 0'
        ]);
    }

    command
      .outputOptions([
        `-s ${this.config.width}x${this.config.height}`,
        `-r ${this.config.fps}`,
        '-g 30',
        '-keyint_min 30',
        '-sc_threshold 0',
        '-sws_flags bilinear',
        '-max_muxing_queue_size 1024'
      ]);

    // Set up event handlers
    this.setupCommandEventHandlers(command, item);

    this.currentCommand = command;
    command.run();
  }

  public async updateOverlay(content: any): Promise<void> {
    // Implementation of overlay updates will be handled separately
    this.emit('overlayUpdate', content);
  }
} 