import { EventEmitter } from 'events';

export interface FrameTimerConfig {
  fps: number;
  tolerance?: number; // Tolerance in milliseconds
  maxDrift?: number; // Maximum allowed drift before auto-correction (ms)
  autoCorrect?: boolean; // Whether to auto-correct drift
}

export interface FrameTimerEvents {
  frame: (timestamp: number) => void;
  error: (error: Error) => void;
  drift: (driftMs: number) => void;
  correction: (correctionMs: number) => void;
}

export class FrameTimer extends EventEmitter {
  private fps: number;
  private frameDuration: number;
  private tolerance: number;
  private maxDrift: number;
  private autoCorrect: boolean;
  private lastFrameTime: number = 0;
  private running: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private accumulatedDrift: number = 0;
  private frameCount: number = 0;

  constructor(config: FrameTimerConfig) {
    super();
    this.fps = config.fps;
    this.frameDuration = 1000 / this.fps;
    this.tolerance = config.tolerance || 1; // Default 1ms tolerance
    this.maxDrift = config.maxDrift || 5; // Default 5ms max drift
    this.autoCorrect = config.autoCorrect ?? true; // Default true
  }

  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastFrameTime = Date.now();
    this.frameCount = 0;
    this.accumulatedDrift = 0;

    // Use setInterval for the base timing
    this.timer = setInterval(() => {
      this.tick();
    }, this.frameDuration);

    // Make the timer unref() so it doesn't keep the process alive
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public stop(): void {
    if (!this.running) {
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.running = false;
    this.frameCount = 0;
    this.accumulatedDrift = 0;
  }

  private tick(): void {
    const now = Date.now();
    const elapsed = now - this.lastFrameTime;
    const drift = elapsed - this.frameDuration;

    // Update frame count
    this.frameCount++;
    
    // Accumulate drift
    this.accumulatedDrift += drift;

    // Check if we're within tolerance
    if (Math.abs(drift) > this.tolerance) {
      this.emit('drift', drift);
      
      // Emit error if drift exceeds maxDrift
      if (Math.abs(drift) > this.maxDrift) {
        this.emit('error', new Error(`Frame timing drift exceeded maximum: ${drift}ms`));
      }

      // Auto-correct if enabled and drift is significant
      if (this.autoCorrect && Math.abs(this.accumulatedDrift) > this.maxDrift) {
        const correction = -this.accumulatedDrift;
        this.lastFrameTime += correction;
        this.accumulatedDrift = 0;
        this.emit('correction', correction);
      }
    }

    this.emit('frame', now);
    this.lastFrameTime = now;
  }

  public getFrameNumber(timestamp: number): number {
    return Math.floor(timestamp / this.frameDuration);
  }

  public getFrameTime(frameNumber: number): number {
    return frameNumber * this.frameDuration;
  }

  public getNextFrameTime(timestamp: number): number {
    const currentFrame = this.getFrameNumber(timestamp);
    return this.getFrameTime(currentFrame + 1);
  }

  public calculateFrameOffset(startTime: number, endTime: number): number {
    return Math.round((endTime - startTime) / this.frameDuration);
  }

  public isFrameBoundary(timestamp: number): boolean {
    const frameTime = this.getFrameTime(this.getFrameNumber(timestamp));
    return Math.abs(timestamp - frameTime) <= this.tolerance;
  }

  public async waitForNextFrame(): Promise<number> {
    return new Promise((resolve) => {
      const now = Date.now();
      const nextFrame = this.getNextFrameTime(now);
      const delay = nextFrame - now;

      // Use high-resolution timer for sub-millisecond precision
      const hrDelay = Math.max(0, delay);
      setTimeout(() => {
        const actualTime = Date.now();
        // Check if we hit our target frame time within tolerance
        if (Math.abs(actualTime - nextFrame) > this.tolerance) {
          this.emit('drift', actualTime - nextFrame);
        }
        resolve(actualTime);
      }, hrDelay);
    });
  }

  public getFPS(): number {
    return this.fps;
  }

  public getFrameDuration(): number {
    return this.frameDuration;
  }

  public getCurrentFrameCount(): number {
    return this.frameCount;
  }

  public getCurrentDrift(): number {
    return this.accumulatedDrift;
  }
} 