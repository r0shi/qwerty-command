// ===========================================
// QWERTY COMMAND - Game Engine
// ===========================================

// ===========================================
// Sky Renderer (gradient + twinkling stars)
// ===========================================

class SkyRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.animationId = null;

        // Colors for the gradient (dark at top, purple-blue at bottom to match buildings)
        this.topColor = { r: 8, g: 8, b: 20 };       // Almost black
        this.bottomColor = { r: 75, g: 55, b: 120 }; // Purple-blue to match building tops

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.generateStars();
        this.draw();
    }

    generateStars() {
        this.stars = [];
        const numStars = Math.floor((this.canvas.width * this.canvas.height) / 3000);

        // Color options: white (most common), plus subtle red, blue, orange
        const starColors = [
            { r: 255, g: 255, b: 255, weight: 70 },  // White (majority)
            { r: 255, g: 200, b: 200, weight: 10 },  // Subtle red
            { r: 200, g: 220, b: 255, weight: 10 },  // Subtle blue
            { r: 255, g: 220, b: 180, weight: 10 },  // Subtle orange
        ];

        const pickColor = () => {
            const total = starColors.reduce((sum, c) => sum + c.weight, 0);
            let rand = Math.random() * total;
            for (const color of starColors) {
                rand -= color.weight;
                if (rand <= 0) return color;
            }
            return starColors[0];
        };

        for (let i = 0; i < numStars; i++) {
            const color = pickColor();
            const radius = Math.random() * 1.5 + 0.5;
            // ~12% of stars get starburst shape, biased toward brighter/larger ones
            const isBurst = radius > 0.9 && Math.random() < 0.24;
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height * 0.75, // Only in upper 75%
                radius: radius,
                baseAlpha: Math.random() * 0.4 + 0.15,
                alpha: 0,
                twinkleSpeed: Math.random() * 0.0375 + 0.00625,
                twinkleOffset: Math.random() * Math.PI * 2,
                // Second harmonic for more complex twinkling
                twinkleSpeed2: Math.random() * 0.0875 + 0.025,
                twinkleOffset2: Math.random() * Math.PI * 2,
                // Occasional bright flash: random interval
                flashPhase: Math.random() * Math.PI * 2,
                flashSpeed: Math.random() * 0.00625 + 0.0025,
                color: { r: color.r, g: color.g, b: color.b },
                burst: isBurst,
                burstLen: isBurst ? (radius * 3 + Math.random() * 2) : 0,
                rotation: Math.random() * Math.PI * 0.5, // Slight random rotation for bursts
            });
        }
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Draw gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, `rgb(${this.topColor.r}, ${this.topColor.g}, ${this.topColor.b})`);
        gradient.addColorStop(1, `rgb(${this.bottomColor.r}, ${this.bottomColor.g}, ${this.bottomColor.b})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // Draw stars
        const time = Date.now() / 1000;
        for (const star of this.stars) {
            // Multi-layered twinkling: two sine waves at different speeds
            const t1 = Math.sin(time * star.twinkleSpeed * 10 + star.twinkleOffset);
            const t2 = Math.sin(time * star.twinkleSpeed2 * 10 + star.twinkleOffset2) * 0.5;
            // Occasional bright flash (sharp peak using pow of abs sin)
            const flashRaw = Math.sin(time * star.flashSpeed * 10 + star.flashPhase);
            const flash = Math.pow(Math.max(0, flashRaw), 8) * 0.9;

            star.alpha = star.baseAlpha + (t1 + t2) * 0.375 + flash;
            star.alpha = Math.max(0.05, Math.min(1, star.alpha));

            const { r, g, b } = star.color;

            if (star.burst) {
                // Draw 4-point starburst shape
                const spikeLen = star.burstLen * (0.8 + star.alpha * 0.4);
                const coreR = star.radius * 0.8;
                ctx.save();
                ctx.translate(star.x, star.y);
                ctx.rotate(star.rotation);

                // Draw thin cross spikes
                const spikeWidth = Math.max(0.3, star.radius * 0.3);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${star.alpha * 0.7})`;
                ctx.fillRect(-spikeWidth / 2, -spikeLen, spikeWidth, spikeLen * 2);
                ctx.fillRect(-spikeLen, -spikeWidth / 2, spikeLen * 2, spikeWidth);

                // Bright core
                ctx.beginPath();
                ctx.arc(0, 0, coreR, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${star.alpha})`;
                ctx.fill();

                // Soft glow around burst
                ctx.beginPath();
                ctx.arc(0, 0, spikeLen * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${star.alpha * 0.1})`;
                ctx.fill();

                ctx.restore();
            } else {
                // Regular circular star
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${star.alpha})`;
                ctx.fill();

                // Glow for brighter stars
                if (star.radius > 1 && star.alpha > 0.5) {
                    ctx.beginPath();
                    ctx.arc(star.x, star.y, star.radius * 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${star.alpha * 0.15})`;
                    ctx.fill();
                }
            }
        }
    }

    startAnimation() {
        const animate = () => {
            this.draw();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// ===========================================
// API Client (abstracts storage backend)
// ===========================================

class ScoreAPI {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.useServer = true;
    }

    async getGlobalBest() {
        if (!this.useServer) {
            return this._getLocalBest();
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/scores/best`);
            if (!response.ok) throw new Error('API error');
            const data = await response.json();
            return data.best;
        } catch (error) {
            console.warn('API unavailable, using localStorage:', error.message);
            this.useServer = false;
            return this._getLocalBest();
        }
    }

    async saveScore(score, wave, accuracy, difficulty) {
        // Always save to localStorage as backup
        this._saveLocalScore(score, wave);

        if (!this.useServer) {
            return { saved: true, best: this._getLocalBest() };
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/scores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score, wave, accuracy, difficulty })
            });
            if (!response.ok) throw new Error('API error');
            return await response.json();
        } catch (error) {
            console.warn('API unavailable, using localStorage:', error.message);
            this.useServer = false;
            return { saved: true, best: this._getLocalBest() };
        }
    }

    async getHighScores(limit = 10) {
        if (!this.useServer) {
            return [this._getLocalBest()].filter(Boolean);
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/scores?limit=${limit}`);
            if (!response.ok) throw new Error('API error');
            const data = await response.json();
            return data.scores;
        } catch (error) {
            console.warn('API unavailable, using localStorage:', error.message);
            this.useServer = false;
            return [this._getLocalBest()].filter(Boolean);
        }
    }

    async getStats(difficulty) {
        if (!this.useServer) return null;
        try {
            const response = await fetch(`${this.baseUrl}/api/stats?difficulty=${difficulty}`);
            if (!response.ok) throw new Error('API error');
            const data = await response.json();
            return data.stats;
        } catch (error) {
            return null;
        }
    }

    _getLocalBest() {
        const score = parseInt(localStorage.getItem('qwertyCommandHighScore')) || 0;
        const wave = parseInt(localStorage.getItem('qwertyCommandHighScoreWave')) || 1;
        if (score === 0) return null;
        return { score, wave, player_name: 'Local' };
    }

    _saveLocalScore(score, wave) {
        const currentBest = parseInt(localStorage.getItem('qwertyCommandHighScore')) || 0;
        if (score > currentBest) {
            localStorage.setItem('qwertyCommandHighScore', score);
            localStorage.setItem('qwertyCommandHighScoreWave', wave);
        }
    }
}

// ===========================================
// Game Class
// ===========================================

class TypingCommand {
    constructor() {
        this.missiles = [];
        this.launchers = [];
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('qwertyCommandHighScore')) || 0;
        this.highScoreWave = parseInt(localStorage.getItem('qwertyCommandHighScoreWave')) || 1;
        this.wave = 1;
        this.waveTimer = 0;
        this.difficulty = 'normal';
        this.requireBackspace = true;
        this.caseSensitive = false;
        this.errorCount = 0;
        this.maxErrors = 5;
        this.lockedMissile = null;
        this.targetedMissiles = [];  // All missiles matching current prefix
        this.reticles = [];  // Dynamic reticle elements
        this.isPaused = false;
        this.isGameOver = false;
        this.isRunning = false;
        this.waitingToStart = false;
        this.lastSpawnTime = 0;
        this.animationId = null;

        this.container = document.getElementById('game-container');
        this.typingDisplay = document.getElementById('typing-display');
        this.inputArea = document.getElementById('input-area');
        this.reticle = document.getElementById('reticle');
        this.scoreEl = document.getElementById('score');
        this.highScoreEl = document.getElementById('high-score');
        this.waveEl = document.getElementById('wave');
        this.waveAnnouncement = document.getElementById('wave-announcement');
        this.gameOverEl = document.getElementById('game-over');
        this.mainMenu = document.getElementById('main-menu');
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.pauseBtn = document.getElementById('pause-btn');
        this.waveTimerEl = document.getElementById('wave-timer');
        this.waveTimerItem = this.waveTimerEl.parentElement;
        this.bonusIndicator = document.getElementById('bonus-indicator');
        this.bonusCountdownEl = this.bonusIndicator.querySelector('.countdown-time');

        this.typedText = '';
        this.inBonusPeriod = false;
        this.inWaveTransition = false;
        this.activeWords = new Set();
        this.maxWaveReached = 1;
        this.totalKeystrokes = 0;
        this.correctKeystrokes = 0;

        // Config and word lists (loaded async)
        this.config = null;
        this.wordLists = {};
        this.isLoaded = false;

        // Score API for persistent storage
        this.scoreAPI = new ScoreAPI();

        // Audio manager
        this.audio = new AudioManager();

        // Sky renderer
        this.skyRenderer = new SkyRenderer(document.getElementById('sky-canvas'));
        this.skyRenderer.startAnimation();

        this.init();
    }

    async init() {
        await this.loadConfig();
        await this.loadWordLists();
        this.generateRowWords();

        // Load high score from persistent storage
        await this.loadHighScore();

        this.isLoaded = true;

        this.updateHighScoreDisplay();
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        document.getElementById('backspace-toggle').classList.toggle('active', this.requireBackspace);
        document.getElementById('case-toggle').classList.toggle('active', this.caseSensitive);

        // Enable menu buttons now that we're loaded
        document.querySelectorAll('.menu-btn').forEach(btn => btn.disabled = false);
    }

    async loadHighScore() {
        try {
            const best = await this.scoreAPI.getGlobalBest();
            if (best) {
                this.highScore = best.score;
                this.highScoreWave = best.wave || 1;
            }
        } catch (error) {
            console.warn('Failed to load high score:', error);
            // Keep defaults from localStorage in constructor
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('config.json');
            this.config = await response.json();
        } catch (error) {
            console.error('Failed to load config:', error);
            // Fall back to defaults
            this.config = this.getDefaultConfig();
        }
    }

    async loadWordLists() {
        const listNames = ['easy', 'medium', 'hard', 'phrases', 'punctuated'];

        for (const name of listNames) {
            try {
                const path = this.config.wordLists?.[name] || `words/${name}.txt`;
                const response = await fetch(path);
                const text = await response.text();
                this.wordLists[name] = text.split('\n').filter(w => w.trim().length > 0);
            } catch (error) {
                console.error(`Failed to load word list ${name}:`, error);
                this.wordLists[name] = [];
            }
        }
    }

    generateRowWords() {
        // Generate practice words from allowed keys
        const rows = this.config.rowKeys || {
            homeRow: 'asdfghjkl;',
            topRow: 'qwertyuiop',
            bottomRow: 'zxcvbnm,.'
        };

        for (const [rowName, keys] of Object.entries(rows)) {
            this.wordLists[rowName] = this.generateWordsFromKeys(keys, 50);
        }
    }

    generateWordsFromKeys(keys, count) {
        const words = [];
        const keyArray = keys.split('');

        for (let i = 0; i < count; i++) {
            // Generate words of length 3-6
            const length = 3 + Math.floor(Math.random() * 4);
            let word = '';
            for (let j = 0; j < length; j++) {
                word += keyArray[Math.floor(Math.random() * keyArray.length)];
            }
            words.push(word);
        }

        return words;
    }

    getDefaultConfig() {
        return {
            timing: { waveDurationMs: 60000, waveAnnouncementMs: 1500, waveTransitionMs: 2500, bonusPeriodMs: 5000 },
            speeds: { baseSpeed: 1, speedIncreasePerWave: 0.08, lengthSpeedFactor: 0.03, speedVariability: 0.2 },
            spawning: {
                beginner: { baseSpawnIntervalMs: 4000, spawnIntervalDecreasePerWave: 150, minSpawnIntervalMs: 1200 },
                normal: { baseSpawnIntervalMs: 2500, spawnIntervalDecreasePerWave: 120, minSpawnIntervalMs: 800 },
                expert: { baseSpawnIntervalMs: 2000, spawnIntervalDecreasePerWave: 100, minSpawnIntervalMs: 500 }
            },
            ufo: { chance: 0.08, minWave: { beginner: 8, normal: 2, expert: 2 }, speedMultiplier: 0.6 },
            scoring: { basePoints: 100, lengthBonus: 20, ufoBonus: 500, accuracyMultipliers: { "100": 10, "99": 5, "98": 3, "97": 2 } },
            launcher: { hp: 1, count: 3 },
            waves: {
                beginner: [{ name: "Easy Words", lists: ["easy"], speed: 0.6 }],
                normal: [{ name: "Medium Words", lists: ["medium"], speed: 1.0 }],
                expert: [{ name: "Hard Words", lists: ["hard"], speed: 1.2 }]
            }
        };
    }

    updateTypingDisplay() {
        if (this.typedText.length === 0) {
            this.typingDisplay.innerHTML = '<span class="placeholder">Type to defend...</span><span class="cursor"></span>';
        } else {
            this.typingDisplay.innerHTML = this.typedText + '<span class="cursor"></span>';
        }
    }

    createLaunchers() {
        const launchersEl = document.getElementById('launchers');
        launchersEl.innerHTML = '';
        this.launchers = [];

        const count = this.config.launcher?.count || 3;
        const hp = this.config.launcher?.hp || 1;

        for (let i = 0; i < count; i++) {
            const launcher = document.createElement('div');
            launcher.className = 'launcher';
            launcher.innerHTML = `
                <div class="launcher-turret"></div>
                <div class="launcher-hp">HP: ${hp}</div>
            `;
            launchersEl.appendChild(launcher);

            this.launchers.push({
                element: launcher,
                hp: hp,
                x: 0,
                y: 0,
            });
        }

        requestAnimationFrame(() => {
            this.launchers.forEach((launcher, i) => {
                const rect = launcher.element.getBoundingClientRect();
                launcher.x = rect.left + rect.width / 2;
                launcher.y = rect.top;
            });
        });
    }

    toggleBackspace() {
        this.requireBackspace = !this.requireBackspace;
        document.getElementById('backspace-toggle').classList.toggle('active', this.requireBackspace);
    }

    toggleCaseSensitive() {
        this.caseSensitive = !this.caseSensitive;
        document.getElementById('case-toggle').classList.toggle('active', this.caseSensitive);
    }

    toggleMusic() {
        const enabled = this.audio.toggleMusic();
        document.getElementById('music-toggle').classList.toggle('active', enabled);
        const pauseToggle = document.getElementById('pause-music-toggle');
        if (pauseToggle) pauseToggle.classList.toggle('active', enabled);
    }

    toggleSFX() {
        const enabled = this.audio.toggleSFX();
        document.getElementById('sfx-toggle').classList.toggle('active', enabled);
        const pauseToggle = document.getElementById('pause-sfx-toggle');
        if (pauseToggle) pauseToggle.classList.toggle('active', enabled);
    }

    async loadStats(difficulty, targetEl) {
        if (!targetEl) return;
        targetEl.innerHTML = '<div class="stats-loading">Loading stats...</div>';
        const stats = await this.scoreAPI.getStats(difficulty);
        if (!stats) {
            targetEl.innerHTML = '<div class="stats-empty">No stats recorded yet for this difficulty.</div>';
            return;
        }
        const a = stats.accuracy;
        const p = stats.percentiles;
        const d = stats.distribution;
        const total = stats.games;
        const pct = (count) => total > 0 ? Math.round(count / total * 100) : 0;

        let html = `<div class="stats-header">${stats.difficulty.toUpperCase()} — ${stats.games} games</div>`;

        // Main stats grid
        html += '<div class="stats-grid">';
        html += `<div class="stats-cell"><span class="stats-val">${a.avg}%</span><span class="stats-lbl">Avg Accuracy</span></div>`;
        html += `<div class="stats-cell"><span class="stats-val">${a.median}%</span><span class="stats-lbl">Median</span></div>`;
        html += `<div class="stats-cell"><span class="stats-val">${a.min}% — ${a.max}%</span><span class="stats-lbl">Min / Max</span></div>`;
        html += `<div class="stats-cell"><span class="stats-val">${stats.score.max}</span><span class="stats-lbl">Top Score</span></div>`;
        html += `<div class="stats-cell"><span class="stats-val">${stats.score.avg}</span><span class="stats-lbl">Avg Score</span></div>`;
        html += `<div class="stats-cell"><span class="stats-val">${stats.wave.max}</span><span class="stats-lbl">Best Wave</span></div>`;
        html += `<div class="stats-cell"><span class="stats-val">${stats.wave.avg}</span><span class="stats-lbl">Avg Wave</span></div>`;
        if (stats.trend != null) {
            const sign = stats.trend >= 0 ? '+' : '';
            const cls = stats.trend >= 0 ? 'trend-up' : 'trend-down';
            html += `<div class="stats-cell"><span class="stats-val ${cls}">${sign}${stats.trend}%</span><span class="stats-lbl">Trend</span></div>`;
        } else {
            html += `<div class="stats-cell"><span class="stats-val">${a.stdev}%</span><span class="stats-lbl">Std Dev</span></div>`;
        }
        html += '</div>';

        // Percentiles row
        html += '<div class="stats-percentiles">';
        html += '<div class="stats-sub-header">Accuracy Percentiles</div>';
        html += '<div class="stats-pct-row">';
        for (const [label, val] of [['P10', p.p10], ['P25', p.p25], ['P75', p.p75], ['P90', p.p90], ['P95', p.p95]]) {
            html += `<div class="stats-pct-cell"><span class="stats-pct-val">${val}%</span><span class="stats-pct-lbl">${label}</span></div>`;
        }
        html += '</div></div>';

        // Distribution bar
        html += '<div class="stats-dist">';
        html += '<div class="stats-sub-header">Accuracy Distribution</div>';
        const buckets = [
            { key: '97-100', label: '97%+', cls: 'dist-great' },
            { key: '95-97', label: '95-97%', cls: 'dist-good' },
            { key: '90-95', label: '90-95%', cls: 'dist-ok' },
            { key: '80-90', label: '80-90%', cls: 'dist-fair' },
            { key: 'below_80', label: '<80%', cls: 'dist-low' },
        ];
        html += '<div class="dist-bar">';
        for (const b of buckets) {
            const pc = pct(d[b.key]);
            if (pc > 0) {
                html += `<div class="dist-seg ${b.cls}" style="width:${pc}%" title="${b.label}: ${d[b.key]}/${total}">${pc > 6 ? pc + '%' : ''}</div>`;
            }
        }
        html += '</div>';
        html += '<div class="dist-legend">';
        for (const b of buckets) {
            if (d[b.key] > 0) {
                html += `<span class="legend-item"><span class="legend-dot ${b.cls}"></span>${b.label} (${d[b.key]})</span>`;
            }
        }
        html += '</div></div>';

        targetEl.innerHTML = html;
    }

    showStats(context) {
        this._statsContext = context;
        const overlay = document.getElementById('stats-overlay');
        const liveSection = document.getElementById('stats-live-section');
        const historySection = document.getElementById('stats-history-section');

        // Show live game stats if opened from pause
        if (context === 'pause' && this.isRunning) {
            const accuracy = this.totalKeystrokes > 0
                ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 1000) / 10
                : 100;
            liveSection.innerHTML = `
                <div class="stats-live-panel">
                    <div class="stats-sub-header">Current Game — ${this.difficulty.toUpperCase()}</div>
                    <div class="stats-grid">
                        <div class="stats-cell"><span class="stats-val">${this.score}</span><span class="stats-lbl">Score</span></div>
                        <div class="stats-cell"><span class="stats-val">${this.wave}</span><span class="stats-lbl">Wave</span></div>
                        <div class="stats-cell"><span class="stats-val">${accuracy}%</span><span class="stats-lbl">Accuracy</span></div>
                        <div class="stats-cell"><span class="stats-val">${this.correctKeystrokes}/${this.totalKeystrokes}</span><span class="stats-lbl">Keys</span></div>
                    </div>
                </div>
            `;
        } else {
            liveSection.innerHTML = '';
        }

        // Load historical stats for the active tab
        const activeTab = overlay.querySelector('.stats-tab.active');
        const diff = activeTab ? activeTab.dataset.difficulty : 'normal';
        this.loadStats(diff, historySection);

        overlay.classList.remove('hidden');
    }

    hideStats() {
        document.getElementById('stats-overlay').classList.add('hidden');
    }

    async switchStatsTab(difficulty) {
        const overlay = document.getElementById('stats-overlay');
        overlay.querySelectorAll('.stats-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.difficulty === difficulty);
        });
        const content = document.getElementById('stats-history-section');
        await this.loadStats(difficulty, content);
    }

    startGame(difficulty) {
        if (!this.isLoaded) return;
        this.hideStats();

        this.difficulty = difficulty;
        this.wave = 1;
        this.maxWaveReached = 1;
        this.score = 0;
        this.missiles = [];
        this.lockedMissile = null;
        this.targetedMissiles = [];
        this.clearReticles();
        this.isGameOver = false;
        this.isPaused = false;
        this.isRunning = true;
        this.lastSpawnTime = Date.now();
        this.typedText = '';
        this.inBonusPeriod = false;
        this.inWaveTransition = false;
        this.activeWords = new Set();
        this.totalKeystrokes = 0;
        this.correctKeystrokes = 0;
        this.errorCount = 0;

        document.querySelectorAll('.missile').forEach(m => m.remove());

        this.createLaunchers();
        this.updateHUD();
        this.updateTypingDisplay();

        this.mainMenu.classList.add('hidden');
        this.gameOverEl.classList.add('hidden');
        this.pauseOverlay.classList.add('hidden');
        this.inputArea.classList.remove('hidden');
        this.pauseBtn.textContent = 'PAUSE';
        this.pauseBtn.classList.add('visible');

        this.audio.play('gameStart');
        this.audio.playMusic();
        this.startWave();
    }

    startWave() {
        const waveDefs = this.config.waves?.[this.difficulty] || [];
        const waveIndex = Math.min(this.wave - 1, waveDefs.length - 1);
        const waveDef = waveDefs[waveIndex] || { name: "Wave " + this.wave, lists: ["medium"], speed: 1.0 };

        const shouldPause = waveDef.pause;

        if (this.wave === 1 || shouldPause) {
            if (shouldPause) {
                this.waveAnnouncement.textContent = `WAVE ${this.wave}: ${waveDef.name}\nPress any key to start`;
            } else {
                this.waveAnnouncement.textContent = `WAVE ${this.wave}: ${waveDef.name}`;
            }
            this.waveAnnouncement.classList.add('visible');
            this.audio.play('waveAnnouncement');

            if (shouldPause) {
                this.isPaused = true;
                this.waitingToStart = true;
            } else {
                setTimeout(() => {
                    this.waveAnnouncement.classList.remove('visible');
                }, this.config.timing?.waveAnnouncementMs || 1500);
            }
        }

        this.waveTimer = Date.now();
        this.waveEl.textContent = this.wave;
        const waveDuration = this.config.timing?.waveDurationMs || 60000;
        this.waveTimerEl.textContent = (waveDuration / 1000).toFixed(1);
        this.waveTimerItem.classList.remove('bonus-hidden');
        this.bonusIndicator.classList.add('hidden');
        this.inBonusPeriod = false;

        if (!this.animationId) {
            this.gameLoop();
        }
    }

    getWaveDef() {
        const waveDefs = this.config.waves?.[this.difficulty] || [];
        const waveIndex = Math.min(this.wave - 1, waveDefs.length - 1);
        return waveDefs[waveIndex] || { name: "Wave " + this.wave, lists: ["medium"], speed: 1.0 };
    }

    getRandomWord() {
        const waveDef = this.getWaveDef();
        const listName = waveDef.lists[Math.floor(Math.random() * waveDef.lists.length)];
        const list = this.wordLists[listName] || this.wordLists.medium || ['word'];

        let attempts = 0;
        let word;
        do {
            word = list[Math.floor(Math.random() * list.length)];
            attempts++;
        } while (this.activeWords.has(word) && attempts < 20);

        return word;
    }

    getUFOChallenge() {
        const ufoSpecial = this.config.ufoSpecial || {};
        const types = Object.keys(ufoSpecial);
        if (types.length === 0) {
            return { display: "UFO", answer: "UFO", type: "default" };
        }

        const type = types[Math.floor(Math.random() * types.length)];
        const list = ufoSpecial[type];
        const item = list[Math.floor(Math.random() * list.length)];

        if (typeof item === 'string') {
            return { display: item, answer: item, type };
        } else {
            return { display: item.display, answer: item.answer, type };
        }
    }

    spawnMissile() {
        const ufoConfig = this.config.ufo || {};
        const minWave = typeof ufoConfig.minWave === 'object'
            ? (ufoConfig.minWave[this.difficulty] || 8)
            : (ufoConfig.minWave || 8);
        const isUFO = this.wave >= minWave && Math.random() < (ufoConfig.chance || 0.08);
        let word, answer, type = 'normal';

        if (isUFO) {
            const ufo = this.getUFOChallenge();
            word = ufo.display;
            answer = ufo.answer;
            type = 'ufo';
        } else {
            word = this.getRandomWord();
            answer = word;
        }

        if (!this.caseSensitive) {
            word = word.toLowerCase();
            answer = answer.toLowerCase();
        }

        let startX, startY, vx, vy, targetLauncher = null;

        // Speed calculation
        const waveDef = this.getWaveDef();
        const speeds = this.config.speeds || {};
        let speed = (speeds.baseSpeed || 1) * (waveDef.speed || 1);
        speed += (this.wave - 1) * (speeds.speedIncreasePerWave || 0.08);
        speed -= answer.length * (speeds.lengthSpeedFactor || 0.03);
        const variability = speeds.speedVariability || 0.2;
        speed *= (1 - variability/2) + Math.random() * variability;
        speed = Math.max(speed, 0.3);

        if (isUFO) {
            speed *= ufoConfig.speedMultiplier || 0.6;
            const goingRight = Math.random() > 0.5;
            startX = goingRight ? -100 : window.innerWidth + 100;
            startY = 80 + Math.random() * 150;
            vx = goingRight ? speed * 1.5 : -speed * 1.5;
            vy = 0;
        } else {
            startX = Math.random() * (window.innerWidth - 100) + 50;
            startY = -50;

            const activeLaunchers = this.launchers.filter(l => l.hp > 0);
            if (activeLaunchers.length === 0) return;

            targetLauncher = activeLaunchers[Math.floor(Math.random() * activeLaunchers.length)];
            const targetX = targetLauncher.x;
            const targetY = targetLauncher.y;

            const dx = targetX - startX;
            const dy = targetY - startY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            vx = (dx / dist) * speed;
            vy = (dy / dist) * speed;
        }

        const missileEl = document.createElement('div');
        missileEl.className = 'missile' + (isUFO ? ' ufo' : '');

        // Label offset from projectile (positioned below)
        const labelOffsetX = 0;
        const labelOffsetY = 25;

        if (isUFO) {
            missileEl.innerHTML = `
                <div class="ufo-saucer"></div>
                <div class="missile-word">${word}</div>
            `;
        } else {
            // Calculate trail angle (points opposite to velocity direction)
            const trailAngle = Math.atan2(-vy, -vx) * (180 / Math.PI) - 90;

            missileEl.innerHTML = `
                <div class="missile-projectile"></div>
                <div class="missile-trail" style="transform: rotate(${trailAngle}deg)"></div>
                <div class="missile-connector"></div>
                <div class="missile-word">${word}</div>
            `;

            // Position label and connector
            const wordEl = missileEl.querySelector('.missile-word');
            wordEl.style.left = labelOffsetX + 'px';
            wordEl.style.top = labelOffsetY + 'px';

            // Connector from projectile (0,0) to label
            const connectorEl = missileEl.querySelector('.missile-connector');
            const connectorLength = Math.sqrt(labelOffsetX * labelOffsetX + labelOffsetY * labelOffsetY);
            const connectorAngle = Math.atan2(labelOffsetY, labelOffsetX) * (180 / Math.PI) - 90;
            connectorEl.style.height = connectorLength + 'px';
            connectorEl.style.transform = `rotate(${connectorAngle}deg)`;
        }

        // x/y track the projectile (head) position directly
        missileEl.style.left = startX + 'px';
        missileEl.style.top = startY + 'px';
        this.container.appendChild(missileEl);

        this.activeWords.add(answer);

        const missile = {
            element: missileEl,
            word: word,
            answer: answer,
            type: type,
            x: startX,
            y: startY,
            vx: vx,
            vy: vy,
            targetLauncher: targetLauncher,
        };
        this.missiles.push(missile);

        if (isUFO) {
            missile._id = Date.now() + Math.random();
            this.audio.play('ufoAppears');
            this.audio.startLoop('ufoHum', missile._id);
        }
    }

    handleKeydown(e) {
        if (this.waitingToStart && this.isRunning) {
            if (e.key !== 'Escape') {
                this.waitingToStart = false;
                this.waveAnnouncement.classList.remove('visible');
                this.isPaused = false;
                this.waveTimer = Date.now();
            }
            return;
        }

        if (e.key === 'Escape' && this.isRunning && !this.isGameOver) {
            this.togglePause();
            return;
        }

        if (this.isPaused || this.isGameOver || !this.isRunning) return;

        if (e.key === 'Backspace') {
            e.preventDefault();
            if (this.typedText.length > 0) {
                this.audio.play('backspace');
                // Check if the character being removed was correct
                const charIndex = this.typedText.length - 1;
                // Use first targeted missile to check if char was correct
                const target = this.lockedMissile || this.targetedMissiles[0];
                const wasCorrect = target &&
                    charIndex < target.answer.length &&
                    this.typedText[charIndex] === target.answer[charIndex];

                if (wasCorrect) {
                    // Undo correct keystroke entirely - like it never happened
                    this.totalKeystrokes--;
                    this.correctKeystrokes--;
                }
                // If incorrect: leave counts alone - the error still counts against accuracy,
                // but backspace itself doesn't add any additional penalty

                // If we're backspacing over an error, decrement error count
                if (this.errorCount > 0 && !wasCorrect) {
                    this.errorCount--;
                }

                this.typedText = this.typedText.slice(0, -1);
                this.updateTypingDisplay();

                if (this.typedText.length === 0) {
                    // Clear all targeting
                    this.targetedMissiles.forEach(m => {
                        this.updateMissileWordDisplay(m, 0);
                        m.element.classList.remove('locked', 'targeted');
                    });
                    this.targetedMissiles = [];
                    this.lockedMissile = null;
                    this.clearReticles();
                    this.errorCount = 0;
                } else {
                    this.processTyping();
                }
            }
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            this.audio.play('inputClear');
            // Clear all targeting
            this.targetedMissiles.forEach(m => {
                this.updateMissileWordDisplay(m, 0);
                m.element.classList.remove('locked', 'targeted');
            });
            this.targetedMissiles = [];
            this.lockedMissile = null;
            this.typedText = '';
            this.errorCount = 0;
            this.updateTypingDisplay();
            this.clearReticles();
            return;
        }

        if (e.key.length === 1) {
            e.preventDefault();
            // Block input if we've hit max errors (requireBackspace mode)
            if (this.requireBackspace && this.errorCount >= this.maxErrors) {
                return;
            }
            this.totalKeystrokes++;
            this.typedText += e.key;
            this.updateTypingDisplay();
            this.processTyping();
        }
    }

    processTyping() {
        const typed = this.typedText;

        // Find all missiles that match the current typed prefix
        const matchingMissiles = this.missiles.filter(m =>
            m.answer.startsWith(typed) && typed.length > 0
        );

        // Update targeted missiles
        const oldTargeted = this.targetedMissiles;
        this.targetedMissiles = matchingMissiles;

        // Update visual states
        oldTargeted.forEach(m => {
            if (!matchingMissiles.includes(m)) {
                m.element.classList.remove('locked', 'targeted');
                this.updateMissileWordDisplay(m, 0);
            }
        });

        matchingMissiles.forEach(m => {
            m.element.classList.add('targeted');
            if (matchingMissiles.length === 1) {
                m.element.classList.add('locked');
            } else {
                m.element.classList.remove('locked');
            }
            this.updateMissileWordDisplay(m, typed.length);
        });

        // Update locked missile (only when exactly one match)
        const wasLocked = this.lockedMissile;
        this.lockedMissile = matchingMissiles.length === 1 ? matchingMissiles[0] : null;

        // Target lock sound when we first lock onto a single missile
        if (this.lockedMissile && !wasLocked) {
            this.audio.play('targetLock');
        }

        // Update reticles
        this.updateReticles();

        // Handle completion or errors
        if (matchingMissiles.length === 1 && matchingMissiles[0].answer === typed) {
            // Word completed
            this.correctKeystrokes++;
            this.errorCount = 0;
            const completedMissile = matchingMissiles[0];
            this.targetedMissiles = [];
            this.lockedMissile = null;
            this.typedText = '';
            this.updateTypingDisplay();
            this.clearReticles();
            setTimeout(() => this.destroyMissile(completedMissile), 80);
        } else if (typed.length > 0 && matchingMissiles.length === 0) {
            // No matches - typo
            this.audio.play('errorKey');
            this.typingDisplay.classList.add('error');
            setTimeout(() => this.typingDisplay.classList.remove('error'), 300);

            // Animate error on previously targeted missiles
            oldTargeted.forEach(m => {
                const wordEl = m.element.querySelector('.missile-word');
                if (wordEl) {
                    wordEl.classList.add('error');
                    setTimeout(() => wordEl.classList.remove('error'), 300);
                }
            });

            if (this.requireBackspace) {
                this.errorCount++;
            } else {
                this.typedText = this.typedText.slice(0, -1);
                this.updateTypingDisplay();
                this.processTyping(); // Re-evaluate with corrected text
                return;
            }
        } else if (typed.length > 0 && matchingMissiles.length > 0) {
            // Valid keystroke - matches at least one word
            this.correctKeystrokes++;
            this.audio.play('correctKey');
        }
    }

    updateMissileWordDisplay(missile, typedCount) {
        const wordEl = missile.element.querySelector('.missile-word');
        const word = missile.word;
        if (typedCount === 0) {
            wordEl.innerHTML = word;
        } else {
            const typed = word.substring(0, typedCount);
            const remaining = word.substring(typedCount);
            wordEl.innerHTML = `<span class="typed">${typed}</span>${remaining}`;
        }
    }

    togglePause() {
        if (this.isGameOver || !this.isRunning || this.waitingToStart) return;

        this.isPaused = !this.isPaused;
        this.pauseOverlay.classList.toggle('hidden', !this.isPaused);
        this.pauseBtn.textContent = this.isPaused ? 'RESUME' : 'PAUSE';
        this.audio.play('pause');
        if (this.isPaused) {
            this.audio.pauseMusic();
            this.audio.stopAllLoops();
            // Sync pause overlay toggles with current audio state
            const pmToggle = document.getElementById('pause-music-toggle');
            const psToggle = document.getElementById('pause-sfx-toggle');
            if (pmToggle) pmToggle.classList.toggle('active', this.audio.musicEnabled);
            if (psToggle) psToggle.classList.toggle('active', this.audio.sfxEnabled);
        } else {
            this.audio.resumeMusic();
            this.hideStats();
        }
    }

    destroyMissile(missile) {
        const scoring = this.config.scoring || {};
        let points = (scoring.basePoints || 100) + (missile.answer.length * (scoring.lengthBonus || 20));
        if (missile.type === 'ufo') {
            points += scoring.ufoBonus || 500;
        }
        if (this.inBonusPeriod) {
            points *= 2;
        }
        this.score += points;
        this.updateHUD();

        // Remove from active tracking immediately (so it can't be hit again)
        this.activeWords.delete(missile.answer);
        this.missiles = this.missiles.filter(m => m !== missile);

        if (missile.type === 'ufo') {
            this.audio.stopLoop('ufoHum', missile._id);
        }

        // Fire interceptor from a random active launcher
        // Explosion and missile removal happen when interceptor arrives
        const onArrival = () => {
            if (missile.type === 'ufo') {
                this.createUFOExplosion(missile.x, missile.y, points);
            } else {
                this.createExplosion(missile.x, missile.y);
            }
            missile.element.remove();
        };
        this.fireInterceptor(missile.x, missile.y, onArrival);
    }

    fireInterceptor(targetX, targetY, onArrival) {
        const activeLaunchers = this.launchers.filter(l => l.hp > 0);
        if (activeLaunchers.length === 0) {
            // No launchers available - trigger callback immediately
            if (onArrival) onArrival();
            return;
        }

        const launcher = activeLaunchers[Math.floor(Math.random() * activeLaunchers.length)];
        const interceptorHeight = 60;

        // Interceptor head (tip) is at the bottom of the element
        // Start with head at launcher position, end with head at target
        const startX = launcher.x;
        const startY = launcher.y - interceptorHeight;
        const endX = targetX;
        const endY = targetY - interceptorHeight;

        this.audio.play('interceptorLaunch');

        const interceptor = document.createElement('div');
        interceptor.className = 'interceptor';

        // Calculate angle to target (from head positions)
        const dx = targetX - launcher.x;
        const dy = targetY - launcher.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        interceptor.style.transformOrigin = 'center bottom';
        interceptor.style.transform = `rotate(${angle}deg)`;

        interceptor.style.left = startX + 'px';
        interceptor.style.top = startY + 'px';
        this.container.appendChild(interceptor);

        // Animate to target
        const duration = 250;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out for snappy feel
            const easeProgress = 1 - Math.pow(1 - progress, 2);

            const currentX = startX + (endX - startX) * easeProgress;
            const currentY = startY + (endY - startY) * easeProgress;

            interceptor.style.left = currentX + 'px';
            interceptor.style.top = currentY + 'px';

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                interceptor.remove();
                if (onArrival) onArrival();
            }
        };

        requestAnimationFrame(animate);
    }

    createUFOExplosion(x, y, points) {
        this.audio.play('ufoExplosion');
        const explosion = document.createElement('div');
        explosion.className = 'ufo-explosion';
        explosion.innerHTML = `
            <div class="ufo-explosion-core"></div>
            <div class="ufo-explosion-ring"></div>
            <div class="ufo-explosion-ring"></div>
            <div class="ufo-explosion-ring"></div>
        `;
        explosion.style.left = (x - 60) + 'px';
        explosion.style.top = (y - 60) + 'px';
        this.container.appendChild(explosion);

        const pointsEl = document.createElement('div');
        pointsEl.className = 'ufo-points';
        pointsEl.textContent = `+${points}`;
        pointsEl.style.left = x + 'px';
        pointsEl.style.top = (y - 30) + 'px';
        this.container.appendChild(pointsEl);

        setTimeout(() => {
            explosion.remove();
            pointsEl.remove();
        }, 1000);
    }

    createExplosion(x, y) {
        this.audio.play('explosion');
        const explosion = document.createElement('div');
        explosion.className = 'explosion';
        explosion.innerHTML = '<div class="explosion-inner"></div>';
        explosion.style.left = (x - 40) + 'px';
        explosion.style.top = (y - 40) + 'px';
        this.container.appendChild(explosion);

        setTimeout(() => explosion.remove(), 500);
    }

    hitLauncher(launcher) {
        launcher.hp--;
        launcher.element.querySelector('.launcher-hp').textContent = `HP: ${launcher.hp}`;

        if (launcher.hp <= 0) {
            this.audio.play('launcherDestroyed');
        } else {
            this.audio.play('launcherHit');
        }

        this.createMushroomCloud(launcher.x, launcher.y);
        this.createScreenFlash();

        const launchersEl = document.getElementById('launchers');
        const cityEl = document.getElementById('city');
        launchersEl.classList.add('shaking');
        cityEl.classList.add('shaking');
        setTimeout(() => {
            launchersEl.classList.remove('shaking');
            cityEl.classList.remove('shaking');
        }, 400);

        if (launcher.hp <= 0) {
            launcher.element.classList.add('destroyed');

            const activeLaunchers = this.launchers.filter(l => l.hp > 0);
            if (activeLaunchers.length === 0) {
                this.gameOver();
            }
        } else {
            launcher.element.classList.add('damaged');
        }
    }

    createMushroomCloud(x, y) {
        const cloud = document.createElement('div');
        cloud.className = 'mushroom-cloud';
        cloud.innerHTML = `
            <div class="mushroom-cap"></div>
            <div class="mushroom-stem"></div>
            <div class="mushroom-ring"></div>
        `;
        cloud.style.left = (x - 60) + 'px';
        cloud.style.top = (y - 180) + 'px';
        this.container.appendChild(cloud);

        setTimeout(() => cloud.remove(), 1500);
    }

    createScreenFlash() {
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        this.container.appendChild(flash);

        setTimeout(() => flash.remove(), 400);
    }

    updateHUD() {
        this.scoreEl.textContent = this.score;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.highScoreWave = this.maxWaveReached;
            localStorage.setItem('qwertyCommandHighScore', this.highScore);
            localStorage.setItem('qwertyCommandHighScoreWave', this.highScoreWave);
            this.updateHighScoreDisplay();
        }
    }

    updateHighScoreDisplay() {
        this.highScoreEl.textContent = `${this.highScore} (W${this.highScoreWave})`;
    }

    clearReticles() {
        // Remove all dynamic reticles
        this.reticles.forEach(r => r.remove());
        this.reticles = [];
        this.reticle.classList.remove('active');
    }

    removeMissileFromTargeting(missile) {
        // Remove a missile from targeting (e.g., when it's destroyed or leaves screen)
        const wasTargeted = this.targetedMissiles.includes(missile);
        this.targetedMissiles = this.targetedMissiles.filter(m => m !== missile);

        if (this.lockedMissile === missile) {
            this.lockedMissile = this.targetedMissiles.length === 1 ? this.targetedMissiles[0] : null;
        }

        if (wasTargeted && this.targetedMissiles.length === 0 && this.typedText.length > 0) {
            // All targets gone, clear typing
            this.typedText = '';
            this.errorCount = 0;
            this.updateTypingDisplay();
            this.clearReticles();
        } else if (wasTargeted) {
            this.updateReticles();
        }
    }

    updateReticles() {
        // Ensure we have the right number of reticles for targeted missiles
        const needed = this.targetedMissiles.length;

        // Remove excess reticles
        while (this.reticles.length > needed) {
            const r = this.reticles.pop();
            r.remove();
        }

        // Add needed reticles (clone from the original)
        while (this.reticles.length < needed) {
            const clone = this.reticle.cloneNode(true);
            clone.classList.add('dynamic-reticle');
            this.container.appendChild(clone);
            this.reticles.push(clone);
        }

        // Position all reticles and set active state
        this.targetedMissiles.forEach((missile, i) => {
            const r = this.reticles[i];
            r.classList.add('active');
            r.style.left = (missile.x - 30) + 'px';
            r.style.top = (missile.y - 30) + 'px';

            // Primary target (locked) gets full opacity, others are dimmed
            if (this.targetedMissiles.length === 1 || i === 0) {
                r.classList.add('primary');
                r.classList.remove('secondary');
            } else {
                r.classList.remove('primary');
                r.classList.add('secondary');
            }
        });

        // Hide original reticle (we use clones)
        this.reticle.classList.remove('active');
    }

    gameLoop() {
        if (!this.isRunning) {
            this.animationId = null;
            return;
        }

        const now = Date.now();

        if (!this.isPaused && !this.isGameOver && !this.inWaveTransition) {
            const waveDuration = this.config.timing?.waveDurationMs || 60000;
            const bonusPeriod = this.config.timing?.bonusPeriodMs || 5000;

            const elapsed = now - this.waveTimer;
            const remaining = waveDuration - elapsed;

            const displayTime = Math.max(0, remaining / 1000);
            this.waveTimerEl.textContent = displayTime.toFixed(1);

            const wasInBonus = this.inBonusPeriod;
            this.inBonusPeriod = remaining <= bonusPeriod && remaining > 0;

            if (this.inBonusPeriod && !wasInBonus) {
                this.waveTimerItem.classList.add('bonus-hidden');
                this.bonusIndicator.classList.remove('hidden');
                this.audio.play('bonusStart');
                this.audio.startLoop('bonusCountdown');
            } else if (!this.inBonusPeriod && wasInBonus) {
                this.waveTimerItem.classList.remove('bonus-hidden');
                this.bonusIndicator.classList.add('hidden');
                this.audio.stopLoop('bonusCountdown');
            }

            if (this.inBonusPeriod) {
                this.bonusCountdownEl.textContent = displayTime.toFixed(1);
            }

            if (remaining <= 0) {
                this.endWave();
            } else {
                const spawnConfig = this.config.spawning?.[this.difficulty] || {};
                const spawnInterval = Math.max(
                    spawnConfig.minSpawnIntervalMs || 800,
                    (spawnConfig.baseSpawnIntervalMs || 2500) - (this.wave - 1) * (spawnConfig.spawnIntervalDecreasePerWave || 120)
                );

                if (now - this.lastSpawnTime >= spawnInterval) {
                    this.spawnMissile();
                    this.lastSpawnTime = now;
                }
            }

            const missilesToRemove = [];

            for (const missile of this.missiles) {
                missile.x += missile.vx;
                missile.y += missile.vy;
                missile.element.style.left = missile.x + 'px';
                missile.element.style.top = missile.y + 'px';

                if (missile.type === 'ufo') {
                    if (missile.x < -150 || missile.x > window.innerWidth + 150) {
                        this.removeMissileFromTargeting(missile);
                        this.activeWords.delete(missile.answer);
                        missile.element.remove();
                        missilesToRemove.push(missile);
                        this.audio.stopLoop('ufoHum', missile._id);
                    }
                } else {
                    const targetY = missile.targetLauncher.y;
                    if (missile.y >= targetY - 20) {
                        this.removeMissileFromTargeting(missile);

                        this.createExplosion(missile.x, missile.y);
                        this.activeWords.delete(missile.answer);
                        missile.element.remove();
                        missilesToRemove.push(missile);

                        if (missile.targetLauncher.hp > 0) {
                            this.hitLauncher(missile.targetLauncher);
                        }
                    }
                }
            }

            if (missilesToRemove.length > 0) {
                this.missiles = this.missiles.filter(m => !missilesToRemove.includes(m));
            }

            this.updateReticles();
        }

        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    endWave() {
        this.inWaveTransition = true;
        this.inBonusPeriod = false;
        this.waveTimerItem.classList.remove('bonus-hidden');
        this.bonusIndicator.classList.add('hidden');
        this.audio.play('waveEnd');
        this.audio.stopAllLoops();

        // Clear all targeting
        this.targetedMissiles.forEach(m => m.element.classList.remove('locked', 'targeted'));
        this.targetedMissiles = [];
        this.lockedMissile = null;
        this.typedText = '';
        this.errorCount = 0;
        this.updateTypingDisplay();
        this.clearReticles();

        for (const missile of this.missiles) {
            this.createExplosion(missile.x, missile.y);
            this.activeWords.delete(missile.answer);
            missile.element.remove();
        }
        this.missiles = [];

        setTimeout(() => {
            this.wave++;

            const waveDefs = this.config.waves?.[this.difficulty] || [];
            const waveIndex = Math.min(this.wave - 1, waveDefs.length - 1);
            const waveDef = waveDefs[waveIndex] || { name: "Wave " + this.wave };

            this.waveAnnouncement.textContent = `Wave ${this.wave} Incoming...\n${waveDef.name}`;
            this.waveAnnouncement.classList.add('visible');
            this.audio.nextTrack();

            setTimeout(() => {
                this.waveAnnouncement.classList.remove('visible');
                this.inWaveTransition = false;
                this.maxWaveReached = Math.max(this.maxWaveReached, this.wave);
                this.startWave();
            }, this.config.timing?.waveTransitionMs || 2500);
        }, 500);
    }

    gameOver() {
        this.isGameOver = true;
        this.isRunning = false;
        this.inBonusPeriod = false;
        this.waveTimerItem.classList.remove('bonus-hidden');
        this.bonusIndicator.classList.add('hidden');
        this.audio.stopMusic();
        this.audio.stopAllLoops();
        this.audio.play('gameOver');

        // Calculate accuracy and multiplier
        const accuracy = this.totalKeystrokes > 0
            ? (this.correctKeystrokes / this.totalKeystrokes) * 100
            : 100;
        const accuracyRounded = Math.round(accuracy * 10) / 10;

        const multipliers = this.config.scoring?.accuracyMultipliers || { "100": 10, "99": 5, "98": 3, "97": 2 };
        let multiplier = 1;
        let multiplierText = '';
        if (accuracy >= 100) {
            multiplier = multipliers["100"] || 10;
            multiplierText = `100% = ${multiplier}x`;
        } else if (accuracy >= 99) {
            multiplier = multipliers["99"] || 5;
            multiplierText = `99%+ = ${multiplier}x`;
        } else if (accuracy >= 98) {
            multiplier = multipliers["98"] || 3;
            multiplierText = `98%+ = ${multiplier}x`;
        } else if (accuracy >= 97) {
            multiplier = multipliers["97"] || 2;
            multiplierText = `97%+ = ${multiplier}x`;
        }

        const baseScore = this.score;
        const finalScore = Math.round(this.score * multiplier);
        this.score = finalScore;
        this.updateHUD(); // Update high score if needed

        // Save score to persistent storage
        this.scoreAPI.saveScore(finalScore, this.maxWaveReached, accuracyRounded, this.difficulty)
            .then(result => {
                if (result.best && result.best.score > this.highScore) {
                    this.highScore = result.best.score;
                    this.highScoreWave = result.best.wave || this.maxWaveReached;
                    this.updateHighScoreDisplay();
                }
            })
            .catch(err => console.warn('Failed to save score:', err));

        let scoreText = `Wave ${this.maxWaveReached}\n`;
        scoreText += `Accuracy: ${accuracyRounded}% (${this.correctKeystrokes}/${this.totalKeystrokes})\n`;
        if (multiplier > 1) {
            scoreText += `Base Score: ${baseScore}\n`;
            scoreText += `Accuracy Bonus: ${multiplierText}\n`;
            scoreText += `Final Score: ${finalScore}`;
        } else {
            scoreText += `Score: ${finalScore}`;
        }

        document.getElementById('final-score').textContent = scoreText;
        this.inputArea.classList.add('hidden');
        this.gameOverEl.classList.remove('hidden');
    }

    returnToMenu() {
        this.isRunning = false;
        this.isPaused = false;
        this.audio.stopMusic();
        this.audio.stopAllLoops();
        this.missiles.forEach(m => m.element.remove());
        this.missiles = [];
        this.hideStats();
        this.gameOverEl.classList.add('hidden');
        this.pauseOverlay.classList.add('hidden');
        this.pauseBtn.classList.remove('visible');
        this.mainMenu.classList.remove('hidden');
    }
}

// Initialize game
const game = new TypingCommand();
