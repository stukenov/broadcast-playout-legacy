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
exports.Channel = void 0;
const events_1 = require("events");
class Channel extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.schedule = [];
        this.currentItem = null;
        this.isLive = false;
        this.config = Object.assign({ defaultTransition: 'crossfade', transitionDuration: 1, overlayEnabled: false }, config);
    }
    getId() {
        return this.config.id;
    }
    getName() {
        return this.config.name;
    }
    getConfig() {
        return Object.assign({}, this.config);
    }
    addScheduleItem(item) {
        return __awaiter(this, void 0, void 0, function* () {
            const newItem = Object.assign(Object.assign({}, item), { id: Math.random().toString(36).substr(2, 9), transition: item.transition || this.config.defaultTransition, transitionDuration: item.transitionDuration || this.config.transitionDuration });
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
        });
    }
    getSchedule() {
        return [...this.schedule];
    }
    getCurrentItem() {
        return this.currentItem;
    }
    isCurrentlyLive() {
        return this.isLive;
    }
    switchToLive(rtmpUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isLive) {
                throw new Error('Already in live mode');
            }
            this.isLive = true;
            this.emit('switchToLive', rtmpUrl);
        });
    }
    resumeSchedule() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isLive) {
                throw new Error('Not in live mode');
            }
            this.isLive = false;
            this.emit('resumeSchedule');
        });
    }
    updateOverlay(content) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.config.overlayEnabled) {
                throw new Error('Overlay not enabled for this channel');
            }
            this.emit('overlayUpdate', content);
        });
    }
}
exports.Channel = Channel;
