// ===========================================
// QWERTY COMMAND - Audio Manager
// ===========================================

class AudioManager {
    constructor() {
        this.ctx = null; // AudioContext, created on first user interaction
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.musicVolume = 0.4;
        this.sfxVolume = 0.5;

        // Music tracks
        this.tracks = [
            'music/Glitch Circuit Loop.mp3',
            'music/Glitch Loop Cartridge.mp3',
            'music/Glitch Loop Cartridge-2.mp3',
        ];
        this.trackElements = [];
        this.currentTrackIndex = 0;
        this.musicPlaying = false;

        // Active loops keyed by "name" or "name:id"
        this.activeLoops = new Map();

        this._initTracks();
    }

    _initTracks() {
        for (const src of this.tracks) {
            const audio = new Audio(src);
            audio.loop = true;
            audio.volume = this.musicVolume;
            audio.preload = 'auto';
            this.trackElements.push(audio);
        }
    }

    _ensureContext() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    // ---- Music ----

    playMusic() {
        if (!this.musicEnabled) return;
        this._stopAllTracks();
        const track = this.trackElements[this.currentTrackIndex];
        track.currentTime = 0;
        track.volume = this.musicVolume;
        track.play().catch(() => {});
        this.musicPlaying = true;
    }

    stopMusic() {
        this._stopAllTracks();
        this.musicPlaying = false;
    }

    pauseMusic() {
        if (!this.musicPlaying) return;
        const track = this.trackElements[this.currentTrackIndex];
        track.pause();
    }

    resumeMusic() {
        if (!this.musicPlaying || !this.musicEnabled) return;
        const track = this.trackElements[this.currentTrackIndex];
        track.play().catch(() => {});
    }

    nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
        if (this.musicPlaying) {
            this.playMusic();
        }
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) {
            this.pauseMusic();
        } else if (this.musicPlaying) {
            this.resumeMusic();
        }
        return this.musicEnabled;
    }

    toggleSFX() {
        this.sfxEnabled = !this.sfxEnabled;
        if (!this.sfxEnabled) {
            this.stopAllLoops();
        }
        return this.sfxEnabled;
    }

    _stopAllTracks() {
        for (const track of this.trackElements) {
            track.pause();
            track.currentTime = 0;
        }
    }

    // ---- SFX ----

    play(name) {
        if (!this.sfxEnabled) return;
        const fn = this._sfx[name];
        if (fn) fn.call(this);
    }

    startLoop(name, id) {
        if (!this.sfxEnabled) return;
        const key = id != null ? `${name}:${id}` : name;
        // Don't start if already running
        if (this.activeLoops.has(key)) return;
        const fn = this._loops[name];
        if (fn) {
            const handle = fn.call(this);
            if (handle) this.activeLoops.set(key, handle);
        }
    }

    stopLoop(name, id) {
        const key = id != null ? `${name}:${id}` : name;
        const handle = this.activeLoops.get(key);
        if (handle) {
            handle.stop();
            this.activeLoops.delete(key);
        }
    }

    stopAllLoops() {
        for (const [key, handle] of this.activeLoops) {
            handle.stop();
        }
        this.activeLoops.clear();
    }

    // ---- Utility ----

    _osc(type, freq, duration, gainVal, freqEnd) {
        const ctx = this._ensureContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        if (freqEnd != null) {
            osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(gainVal * this.sfxVolume, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }

    _noise(duration, gainVal, filterFreq) {
        const ctx = this._ensureContext();
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(gainVal * this.sfxVolume, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

        if (filterFreq) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = filterFreq;
            source.connect(filter).connect(gain).connect(ctx.destination);
        } else {
            source.connect(gain).connect(ctx.destination);
        }
        source.start();
        source.stop(ctx.currentTime + duration);
    }

    _arpeggio(notes, noteLen, type, gainVal) {
        const ctx = this._ensureContext();
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || 'square';
            osc.frequency.value = freq;
            const startTime = ctx.currentTime + i * noteLen;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime((gainVal || 0.3) * this.sfxVolume, startTime + 0.01);
            gain.gain.linearRampToValueAtTime(0, startTime + noteLen * 0.9);
            osc.connect(gain).connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + noteLen);
        });
    }

    // ---- Sound Effects Definitions ----

    get _sfx() {
        return {
            interceptorLaunch: () => {
                // Rising square wave sweep 200→800Hz, ~150ms
                this._osc('square', 200, 0.15, 0.25, 800);
            },

            explosion: () => {
                // White noise burst + low square thud, ~300ms
                this._noise(0.3, 0.4, 2000);
                this._osc('square', 80, 0.2, 0.3, 40);
            },

            ufoExplosion: () => {
                // Noise burst + ascending square arpeggio, ~600ms
                this._noise(0.4, 0.4, 3000);
                this._arpeggio([200, 400, 600, 800, 1000], 0.1, 'square', 0.2);
            },

            launcherHit: () => {
                // Low noise burst + triangle bass drop, ~800ms
                this._noise(0.6, 0.5, 800);
                this._osc('triangle', 200, 0.8, 0.4, 40);
            },

            launcherDestroyed: () => {
                // Same as launcher hit but longer, deeper, ~1200ms
                this._noise(1.0, 0.6, 600);
                this._osc('triangle', 160, 1.2, 0.5, 20);
                this._osc('square', 100, 0.8, 0.2, 30);
            },

            correctKey: () => {
                // Short square wave tick at 880Hz, ~50ms
                this._osc('square', 880, 0.05, 0.15);
            },

            errorKey: () => {
                // Square wave 150Hz buzz, ~200ms
                this._osc('square', 150, 0.2, 0.25);
            },

            targetLock: () => {
                // Two-tone square beep 660→880Hz, ~120ms
                const ctx = this._ensureContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(660, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.06);
                gain.gain.setValueAtTime(0.2 * this.sfxVolume, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
                osc.connect(gain).connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
            },

            backspace: () => {
                // Descending square blip 600→300Hz, ~80ms
                this._osc('square', 600, 0.08, 0.15, 300);
            },

            inputClear: () => {
                // Descending sweep 800→200Hz, ~150ms
                this._osc('square', 800, 0.15, 0.2, 200);
            },

            waveAnnouncement: () => {
                // 3-note ascending arpeggio C-E-G, ~500ms
                this._arpeggio([523.25, 659.25, 783.99], 0.15, 'square', 0.25);
            },

            waveEnd: () => {
                // Low rumble noise + rising sweep, ~400ms
                this._noise(0.4, 0.3, 400);
                this._osc('square', 100, 0.4, 0.2, 600);
            },

            bonusStart: () => {
                // Fast alternating high tones (alarm), ~400ms
                const ctx = this._ensureContext();
                for (let i = 0; i < 4; i++) {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.value = i % 2 === 0 ? 1200 : 900;
                    const start = ctx.currentTime + i * 0.1;
                    gain.gain.setValueAtTime(0.2 * this.sfxVolume, start);
                    gain.gain.linearRampToValueAtTime(0, start + 0.08);
                    osc.connect(gain).connect(ctx.destination);
                    osc.start(start);
                    osc.stop(start + 0.1);
                }
            },

            gameOver: () => {
                // 4-note descending minor arpeggio, ~1.5s
                this._arpeggio([523.25, 440, 349.23, 261.63], 0.35, 'square', 0.3);
            },

            gameStart: () => {
                // 4-note ascending major arpeggio, ~600ms
                this._arpeggio([261.63, 329.63, 392, 523.25], 0.14, 'square', 0.25);
            },

            pause: () => {
                // Short click (noise burst), ~30ms
                this._noise(0.03, 0.3);
            },

            ufoAppears: () => {
                // Descending wobble tone, ~300ms
                const ctx = this._ensureContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.3);

                // Add vibrato via LFO
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 20;
                lfoGain.gain.value = 50;
                lfo.connect(lfoGain).connect(osc.frequency);
                lfo.start();
                lfo.stop(ctx.currentTime + 0.3);

                gain.gain.setValueAtTime(0.3 * this.sfxVolume, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
                osc.connect(gain).connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            },
        };
    }

    // ---- Loop Definitions ----

    get _loops() {
        return {
            bonusCountdown: () => {
                // Rhythmic tick at ~2Hz, loops for 5s
                const ctx = this._ensureContext();
                const interval = setInterval(() => {
                    if (!this.sfxEnabled) return;
                    this._osc('square', 1000, 0.04, 0.15);
                }, 500);

                return {
                    stop: () => clearInterval(interval),
                };
            },

            ufoHum: () => {
                // Low triangle wave with vibrato, continuous
                const ctx = this._ensureContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = 80;

                // Vibrato LFO
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 6;
                lfoGain.gain.value = 15;
                lfo.connect(lfoGain).connect(osc.frequency);

                gain.gain.value = 0.12 * this.sfxVolume;
                osc.connect(gain).connect(ctx.destination);
                osc.start();
                lfo.start();

                return {
                    stop: () => {
                        try {
                            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
                            osc.stop(ctx.currentTime + 0.15);
                            lfo.stop(ctx.currentTime + 0.15);
                        } catch (e) {
                            // Already stopped
                        }
                    },
                };
            },
        };
    }
}
