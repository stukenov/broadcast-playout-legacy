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
exports.FFmpegPipeline = void 0;
const events_1 = require("events");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
class FFmpegPipeline extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.currentCommand = null;
        this.isRunning = false;
        this.config = Object.assign({ width: 1920, height: 1080, fps: 30, videoBitrate: '4000k', audioBitrate: '128k' }, config);
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                throw new Error('Pipeline is already running');
            }
            this.isRunning = true;
            this.emit('started');
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isRunning) {
                return;
            }
            if (this.currentCommand) {
                this.currentCommand.kill('SIGKILL');
                this.currentCommand = null;
            }
            this.isRunning = false;
            this.emit('stopped');
        });
    }
    switchSource(item, transition = 'crossfade', transitionDuration = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isRunning) {
                throw new Error('Pipeline is not running');
            }
            // Kill existing command if any
            if (this.currentCommand) {
                this.currentCommand.kill('SIGKILL');
            }
            const command = (0, fluent_ffmpeg_1.default)();
            // Input setup
            if (item.sourceType === 'file') {
                command.input(item.source);
            }
            else {
                command.input(item.source)
                    .inputOptions(['-re']); // Read input at native framerate
            }
            // Output setup
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
                    '-f flv'
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
                    '-f mpegts'
                ]);
            }
            // Common output options
            command
                .outputOptions([
                `-s ${this.config.width}x${this.config.height}`,
                `-r ${this.config.fps}`,
                '-g 30',
                '-keyint_min 30'
            ])
                .on('start', (commandLine) => {
                this.emit('sourceSwitch', { item, commandLine });
            })
                .on('error', (err, stdout, stderr) => {
                this.emit('error', { error: err, stdout, stderr });
            })
                .on('end', () => {
                this.emit('sourceEnd', item);
            });
            // Start the command
            this.currentCommand = command;
            command.run();
        });
    }
    updateOverlay(content) {
        return __awaiter(this, void 0, void 0, function* () {
            // For FFmpeg implementation, we'd need to handle dynamic overlay updates
            // This could involve updating a source image/video that FFmpeg is using as overlay
            // or using FFmpeg's complex filtergraph with dynamic updates
            this.emit('overlayUpdate', content);
        });
    }
}
exports.FFmpegPipeline = FFmpegPipeline;
