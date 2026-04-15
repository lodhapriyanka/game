
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
	score: document.getElementById("scoreText"),
	combo: document.getElementById("comboText"),
	speed: document.getElementById("speedText"),
	high: document.getElementById("highScoreHud"),
	scoreStat: document.getElementById("scoreStat"),
	comboStat: document.getElementById("comboStat"),
	speedStat: document.getElementById("speedStat"),
	speedMeterFill: document.getElementById("speedMeterFill"),
	feedbackText: document.getElementById("feedbackText"),
	modeBadge: document.getElementById("modeBadge"),
	pauseBtn: document.getElementById("pauseBtn"),
	restartBtn: document.getElementById("restartBtn"),
	soundBtn: document.getElementById("soundBtn"),
	powerBtn: document.getElementById("powerBtn"),
	startOverlay: document.getElementById("startOverlay"),
	pauseOverlay: document.getElementById("pauseOverlay"),
	gameOverOverlay: document.getElementById("gameOverOverlay"),
	overlayTitle: document.getElementById("overlayTitle"),
	overlayCopy: document.getElementById("overlayCopy"),
	playBtn: document.getElementById("playBtn"),
	resumeBtn: document.getElementById("resumeBtn"),
	retryBtn: document.getElementById("retryBtn"),
	gameOverTitle: document.getElementById("gameOverTitle"),
	gameOverCopy: document.getElementById("gameOverCopy"),
	body: document.body
};

const storageKey = "emojiPongProfile";
const modeKey = "emojiPongMode";
const emojiKey = "emojiPongEmoji";
const soundKey = "emojiPongSound";
const unlockThresholds = [
	{ score: 25, emoji: "🔥", name: "Fireball" },
	{ score: 60, emoji: "🧊", name: "Iceball" },
	{ score: 120, emoji: "💣", name: "Bombball" },
	{ score: 200, emoji: "🌀", name: "Spiralball" },
	{ score: 320, emoji: "💎", name: "Gemball" }
];

const audioState = {
	context: null,
	master: null,
	ready: false
};

const emojiPowers = {
	"🎯": { speed: 1, gravity: 0, spin: 0, scoreMult: 1, name: "Classic" },
	"🔥": { speed: 1.16, gravity: 0, spin: 0.02, scoreMult: 1.15, name: "Fire" },
	"🧊": { speed: 0.88, gravity: 0, spin: -0.01, scoreMult: 1.2, name: "Ice" },
	"💣": { speed: 1.04, gravity: 0.02, spin: 0.03, scoreMult: 1.35, name: "Bomb" },
	"🌀": { speed: 1.02, gravity: 0, spin: 0.08, scoreMult: 1.25, name: "Spiral" },
	"💎": { speed: 1.0, gravity: 0, spin: 0.01, scoreMult: 1.5, name: "Crystal" }
};

const paletteModes = ["neon-blue", "royal-gold", "cyber-pink", "ice-luxe"];

const state = {
	mode: "classic",
	emoji: "🎯",
	running: false,
	paused: false,
	over: false,
	score: 0,
	combo: 1,
	maxCombo: 1,
	speedFactor: 1,
	targetSpeedFactor: 1,
	displayScore: 0,
	displaySpeed: 1,
	highScore: 0,
	xp: 0,
	games: 0,
	paddleBoostUntil: 0,
	slowMoEnergy: 100,
	slowMoActive: false,
	powerReady: 100,
	rage: false,
	gravityShiftUntil: 0,
	cloneTriggered: false,
	screenShake: 0,
	highSpeedBlur: 0,
	impactFlash: 0,
	lastSpeedTick: 0,
	lastHitTime: 0,
	slowMotionUntil: 0,
	feedbackUntil: 0,
	lastFeedback: "",
	lastAccuracy: 0,
	paletteIndex: 0,
	nextPaletteSwitchAt: 0,
	audioPulse: 0,
	loopActive: false,
	soundEnabled: true,
	pointerX: 0,
	keys: new Set(),
	touchStart: null,
	audioReady: false,
	balls: [],
	particles: [],
	backgroundNodes: [],
	floatingLabels: [],
	trail: [],
	paddle: { x: 0, y: 0, w: 160, h: 18, targetX: 0, vx: 0, lastX: 0 },
	lastFrame: 0,
	baseWidth: 160,
	baseSpeed: 340
};

function loadProfile() {
	try {
		return JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
	} catch {
		return {};
	}
}

function saveProfile(next) {
	localStorage.setItem(storageKey, JSON.stringify(next));
}

function unlockAudio() {
	const AudioContextClass = window.AudioContext || window.webkitAudioContext;
	if (!AudioContextClass) return;
	if (!audioState.context) {
		audioState.context = new AudioContextClass();
		audioState.master = audioState.context.createGain();
		audioState.master.gain.value = state.soundEnabled ? 0.12 : 0;
		audioState.master.connect(audioState.context.destination);
	}
	if (audioState.context.state === "suspended") {
		audioState.context.resume().catch(() => {});
	}
	audioState.ready = true;
}

function setSoundEnabled(enabled) {
	state.soundEnabled = Boolean(enabled);
	localStorage.setItem(soundKey, state.soundEnabled ? "on" : "off");
	if (audioState.master) {
		audioState.master.gain.setTargetAtTime(state.soundEnabled ? 0.12 : 0, audioState.context.currentTime, 0.02);
	}
	if (ui.soundBtn) {
		ui.soundBtn.textContent = state.soundEnabled ? "Sound On" : "Sound Off";
	}
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
	return min + Math.random() * (max - min);
}

function hashHue(text) {
	let hash = 0;
	for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
	return hash % 360;
}

function setPalette(mode) {
	document.body.classList.remove("theme-neon-blue", "theme-royal-gold", "theme-cyber-pink", "theme-ice-luxe");
	document.body.classList.add(`theme-${mode}`);
}

function cyclePalette(force = false) {
	const now = performance.now();
	if (!force && now < state.nextPaletteSwitchAt) return;
	state.paletteIndex = (state.paletteIndex + 1) % paletteModes.length;
	setPalette(paletteModes[state.paletteIndex]);
	state.nextPaletteSwitchAt = now + 10000 + Math.random() * 5000;
}

function showFeedback(text, accentClass) {
	state.lastFeedback = text;
	state.feedbackUntil = performance.now() + 620;
	ui.feedbackText.textContent = text;
	ui.feedbackText.className = `feedback-text show ${accentClass}`;
	window.setTimeout(() => {
		if (performance.now() > state.feedbackUntil) ui.feedbackText.className = "feedback-text";
	}, 700);
}

function resize() {
	canvas.width = window.innerWidth * devicePixelRatio;
	canvas.height = window.innerHeight * devicePixelRatio;
	canvas.style.width = `${window.innerWidth}px`;
	canvas.style.height = `${window.innerHeight}px`;
	ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
	state.paddle.y = window.innerHeight - 64;
	state.paddle.x = clamp(state.paddle.x || window.innerWidth / 2 - state.paddle.w / 2, 18, window.innerWidth - state.paddle.w - 18);
	if (!state.paddle.targetX) state.paddle.targetX = state.paddle.x;
}

function makeBall(extra = {}) {
	const power = emojiPowers[state.emoji] || emojiPowers["🎯"];
	const baseSpeed = state.baseSpeed * power.speed * (state.mode === "speed" ? 1.15 : 1);
	const angle = rand(-0.65, 0.65) || 0.2;
	return {
		x: window.innerWidth / 2 + rand(-20, 20),
		y: window.innerHeight * 0.28,
		vx: extra.vx ?? baseSpeed * angle,
		vy: extra.vy ?? baseSpeed,
		r: extra.r ?? 22,
		spin: extra.spin ?? power.spin,
		emoji: extra.emoji ?? state.emoji,
		life: 1,
		hue: hashHue(extra.emoji ?? state.emoji)
	};
}

function createParticles(x, y, emoji, strength = 12) {
	for (let i = 0; i < strength; i += 1) {
		state.particles.push({
			x,
			y,
			vx: rand(-180, 180),
			vy: rand(-220, 80),
			life: rand(0.35, 0.9),
			emoji,
			size: rand(10, 22)
		});
	}
}

function createAmbientNodes() {
	state.backgroundNodes = Array.from({ length: 14 }, (_, index) => ({
		x: rand(0, window.innerWidth),
		y: rand(70, window.innerHeight),
		size: rand(1.2, 3.8),
		opacity: rand(0.06, 0.22),
		speed: rand(8, 28) * (index % 2 === 0 ? 1 : -1),
		phase: rand(0, Math.PI * 2),
		color: index % 3 === 0 ? "rgba(0, 240, 255, 0.9)" : index % 3 === 1 ? "rgba(255, 0, 127, 0.9)" : "rgba(255, 215, 0, 0.9)"
	}));
}

function addFloatingLabel(text, x, y, color = "#ffffff") {
	state.floatingLabels.push({
		text,
		x,
		y,
		vy: -38,
		life: 0.85,
		color
	});
}

function pulseBody() {
	document.body.classList.add("screen-shake");
	window.setTimeout(() => document.body.classList.remove("screen-shake"), 120);
}

function playTone(type) {
	if (!audioState.ready || !state.soundEnabled) return;
	const ctxAudio = audioState.context;
	const oscillator = ctxAudio.createOscillator();
	const gain = ctxAudio.createGain();
	const filter = ctxAudio.createBiquadFilter();
	const presets = {
		bounce: [520, 0.08, "triangle", 1800],
		wall: [460, 0.045, "triangle", 1300],
		ui: [680, 0.03, "sine", 2300],
		pause: [320, 0.035, "sine", 900],
		speed: [720, 0.09, "sine", 2400],
		gameover: [160, 0.18, "sawtooth", 900],
		power: [920, 0.12, "square", 3200]
	};
	const [frequency, volume, waveform, cutoff] = presets[type] || presets.bounce;
	oscillator.type = waveform;
	oscillator.frequency.value = frequency;
	filter.type = "lowpass";
	filter.frequency.value = cutoff;
	gain.gain.value = 0.0001;
	gain.gain.exponentialRampToValueAtTime(volume, ctxAudio.currentTime + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, ctxAudio.currentTime + 0.18);
	oscillator.connect(filter);
	filter.connect(gain);
	gain.connect(audioState.master);
	oscillator.start();
	oscillator.stop(ctxAudio.currentTime + 0.2);
}

function setOverlay(overlay, visible) {
	overlay.classList.toggle("hidden", !visible);
}

function updateHud() {
	ui.score.textContent = Math.floor(state.displayScore);
	ui.combo.textContent = `x${state.combo}`;
	ui.speed.textContent = `${state.displaySpeed.toFixed(1)}x`;
	ui.high.textContent = state.highScore;
	const energy = clamp((state.displaySpeed - 1) / 2.8, 0, 1);
	ui.speedMeterFill.style.width = `${Math.round(energy * 100)}%`;
	ui.comboStat.classList.toggle("pulse", state.combo >= 4);
	ui.speedStat.classList.toggle("pulse", state.displaySpeed >= 1.8);
	ui.scoreStat.classList.toggle("pulse", state.rage);
}

function updateModeClasses() {
	document.body.classList.remove("mode-classic", "mode-speed", "mode-chaos", "rage-mode");
	document.body.classList.add(`mode-${state.mode}`);
	if (state.rage) document.body.classList.add("rage-mode");
}

function resetRound(keepProfile = true) {
	const profile = loadProfile();
	state.mode = new URLSearchParams(window.location.search).get("mode") || localStorage.getItem(modeKey) || "classic";
	state.emoji = new URLSearchParams(window.location.search).get("emoji") || localStorage.getItem(emojiKey) || "🎯";
	state.running = false;
	state.paused = false;
	state.over = false;
	state.score = 0;
	state.displayScore = 0;
	state.combo = 1;
	state.maxCombo = 1;
	state.speedFactor = 1;
	state.targetSpeedFactor = 1;
	state.displaySpeed = 1;
	state.paddle.w = state.baseWidth;
	state.paddle.h = 18;
	state.paddleBoostUntil = 0;
	state.slowMoEnergy = 100;
	state.slowMoActive = false;
	state.powerReady = 100;
	state.rage = false;
	state.gravityShiftUntil = 0;
	state.cloneTriggered = false;
	state.screenShake = 0;
	state.highSpeedBlur = 0;
	state.impactFlash = 0;
	state.lastSpeedTick = 0;
	state.lastHitTime = 0;
	state.slowMotionUntil = 0;
	state.feedbackUntil = 0;
	state.lastFeedback = "";
	state.lastAccuracy = 0;
	state.audioPulse = 0;
	state.loopActive = false;
	state.particles = [];
	state.floatingLabels = [];
	state.trail = [];
	state.balls = [makeBall()];
	state.paddle.x = window.innerWidth / 2 - state.paddle.w / 2;
	state.paddle.targetX = state.paddle.x;
	state.paddle.lastX = state.paddle.x;
	state.highScore = profile.highScore || 0;
	state.xp = profile.xp || 0;
	state.games = profile.games || 0;
	ui.modeBadge.textContent = state.mode === "speed" ? "Speed Rush" : state.mode === "chaos" ? "Chaos Mode" : "Classic";
	ui.gameOverOverlay.classList.add("hidden");
	ui.pauseOverlay.classList.add("hidden");
	ui.startOverlay.classList.remove("hidden");
	ui.overlayTitle.textContent = `You are playing with ${state.emoji}.`;
	ui.overlayCopy.textContent = `Keep the emoji alive with your paddle. ${emojiPowers[state.emoji]?.name || "Classic"} mode is active.`;
	if (keepProfile) saveProfile(profile);
	setPalette(paletteModes[state.paletteIndex]);
	state.nextPaletteSwitchAt = performance.now() + 12000;
	createAmbientNodes();
	updateModeClasses();
	updateHud();
	if (ui.pauseBtn) ui.pauseBtn.textContent = "Pause";
}

function startGame() {
	unlockAudio();
	state.running = true;
	state.paused = false;
	setOverlay(ui.startOverlay, false);
	setOverlay(ui.pauseOverlay, false);
	setOverlay(ui.gameOverOverlay, false);
	if (ui.pauseBtn) ui.pauseBtn.textContent = "Pause";
	if (!state.loopActive) {
		state.loopActive = true;
		window.requestAnimationFrame(frame);
	}
}

function pauseGame(force) {
	if (state.over || !state.running) return;
	state.paused = typeof force === "boolean" ? force : !state.paused;
	if (ui.pauseBtn) ui.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
	playTone("pause");
	setOverlay(ui.pauseOverlay, state.paused);
}

function gameOver() {
	if (state.over) return;
	state.over = true;
	state.running = false;
	state.paused = false;
	if (ui.pauseBtn) ui.pauseBtn.textContent = "Pause";
	const profile = loadProfile();
	profile.games = (profile.games || 0) + 1;
	profile.xp = (profile.xp || 0) + Math.floor(state.score * 1.1 + state.combo * 5);
	profile.highScore = Math.max(profile.highScore || 0, Math.floor(state.score));
	profile.bestCombo = Math.max(profile.bestCombo || 0, state.maxCombo || state.combo || 1);
	const unlocked = new Set(profile.unlocks || ["🎯"]);
	unlockThresholds.forEach((entry) => {
		if (state.score >= entry.score) unlocked.add(entry.emoji);
	});
	profile.unlocks = Array.from(unlocked);
	saveProfile(profile);
	state.highScore = profile.highScore;
	state.xp = profile.xp;
	state.games = profile.games;
	updateHud();
	playTone("gameover");
	ui.gameOverTitle.textContent = `Score ${Math.floor(state.score)} reached.`;
	ui.gameOverCopy.textContent = `High score ${state.highScore}. XP ${state.xp}. Unlocks ${profile.unlocks.length}.`;
	setOverlay(ui.gameOverOverlay, true);
}

function triggerPower() {
	if (state.powerReady < 100 || !state.running || state.paused || state.over) return;
	const power = emojiPowers[state.emoji] || emojiPowers["🎯"];
	state.powerReady = 0;
	state.paddleBoostUntil = performance.now() + 4500;
	createParticles(state.paddle.x + state.paddle.w / 2, state.paddle.y, state.emoji, 16);
	playTone("power");
	if (state.emoji === "🔥") {
		state.speedFactor *= 1.15;
	} else if (state.emoji === "🧊") {
		state.slowMoEnergy = Math.min(100, state.slowMoEnergy + 35);
		state.slowMoActive = true;
	} else if (state.emoji === "💣") {
		state.balls.forEach((ball) => {
			ball.vx *= 1.1;
			ball.vy *= 0.85;
			ball.spin += 0.05;
		});
	} else if (state.emoji === "🌀") {
		state.balls.forEach((ball, index) => {
			ball.spin += index % 2 === 0 ? 0.14 : -0.14;
		});
	} else if (state.emoji === "💎") {
		state.combo += 2;
		state.score += 10;
	}
}

function handlePaddleMovement(x) {
	state.paddle.targetX = clamp(x - state.paddle.w / 2, 16, window.innerWidth - state.paddle.w - 16);
}

function addTrail(ball) {
	const speed = Math.hypot(ball.vx, ball.vy);
	const life = clamp(0.38 + speed / 950, 0.36, 0.98);
	const size = ball.r * clamp(0.86 + speed / 1600, 0.9, 1.45);
	state.trail.push({
		x: ball.x,
		y: ball.y,
		emoji: ball.emoji,
		life,
		size
	});
	const maxTrail = Math.round(clamp(80 + speed / 8, 90, 180));
	if (state.trail.length > maxTrail) state.trail.shift();
}

function bounceFromPaddle(ball) {
	const paddleCenter = state.paddle.x + state.paddle.w / 2;
	const hitPos = (ball.x - paddleCenter) / (state.paddle.w / 2);
	const clampedHit = clamp(hitPos, -1, 1);
	const bounceAngle = clampedHit * 1.08;
	const paddleMotion = clamp(state.paddle.vx * 0.0046, -1.2, 1.2);
	const angleNoise = rand(-0.05, 0.05);
	const power = emojiPowers[ball.emoji] || emojiPowers["🎯"];
	const speedBase = Math.hypot(ball.vx, ball.vy);
	const speedBoost = 1.015 + Math.abs(clampedHit) * 0.04 + Math.min(Math.abs(paddleMotion) * 0.03, 0.05);
	const hitSpeed = speedBase * speedBoost;
	const launchAngle = bounceAngle + paddleMotion + angleNoise;
	ball.vx = hitSpeed * launchAngle + ball.spin * 240;
	ball.vy = -Math.abs(hitSpeed * (1 - Math.abs(launchAngle) * 0.22));
	ball.spin += launchAngle * 0.02 + power.spin + paddleMotion * 0.02;
	ball.y = state.paddle.y - ball.r - 1;
	ball.x += launchAngle * 8;
	state.score += (1 + Math.max(1, state.combo)) * (state.rage ? 2 : 1) * power.scoreMult;
	state.score = Math.round(state.score * 100) / 100;
	state.combo = clamp(state.combo + 1, 1, 99);
	state.maxCombo = Math.max(state.maxCombo, state.combo);
	state.powerReady = clamp(state.powerReady + 16, 0, 100);
	if (performance.now() - state.lastHitTime < 380) state.combo += 1;
	state.maxCombo = Math.max(state.maxCombo, state.combo);
	const accuracy = 1 - Math.abs(clampedHit);
	state.lastAccuracy = accuracy;
	if (accuracy > 0.9) {
		state.slowMotionUntil = performance.now() + 500;
		state.impactFlash = 0.95;
		showFeedback("PERFECT", "accent-gold");
		state.combo += 1;
	} else if (accuracy > 0.72) {
		showFeedback("GREAT", "accent-cyan");
	} else if (accuracy > 0.45) {
		showFeedback("GOOD", "accent-pink");
	} else if (state.combo > 8) {
		showFeedback("INSANE", "accent-gold");
	}
	state.lastHitTime = performance.now();
	state.screenShake = Math.max(state.screenShake, hitSpeed > 650 ? 3.2 : 1.4);
	state.highSpeedBlur = Math.max(state.highSpeedBlur, hitSpeed > 680 ? 0.7 : 0.2);
	state.audioPulse = Math.max(state.audioPulse, 0.9);
	addFloatingLabel(`+${Math.round(state.score)}`, ball.x, ball.y - 20, power.name === "Classic" ? "#00F0FF" : "#FFD700");
	pulseBody();
	state.particles.push(...Array.from({ length: 8 }, () => ({
		x: ball.x,
		y: ball.y,
		vx: rand(-120, 120),
		vy: rand(-180, -20),
		life: rand(0.2, 0.5),
		emoji: ball.emoji,
		size: rand(12, 20)
	})));
	playTone("bounce");
}

function maybeCloneBall() {
	if (state.cloneTriggered || state.score < 18) return;
	state.cloneTriggered = true;
	const source = state.balls[0];
	state.balls.push({
		...makeBall({ emoji: source.emoji, vx: -source.vx * 0.92, vy: source.vy * 0.96, r: source.r - 2 }),
		life: 1
	});
}

function applyDifficulty(dt) {
	if (state.paused || !state.running || state.over) return;
	const now = performance.now();
	const skillFactor = clamp((state.combo / 20) + (state.score / 420), 0, 1.4);
	const modeRamp = state.mode === "speed" ? 0.14 : state.mode === "chaos" ? 0.11 : 0.085;
	state.targetSpeedFactor += dt * (modeRamp + skillFactor * 0.03);
	state.targetSpeedFactor = clamp(state.targetSpeedFactor, 1, state.rage ? 4.3 : 3.3);
	state.speedFactor += (state.targetSpeedFactor - state.speedFactor) * clamp(dt * 2.5, 0.02, 1);

	if (now - state.lastSpeedTick > (state.mode === "speed" ? 1800 : 3200)) {
		state.lastSpeedTick = now;
		state.targetSpeedFactor *= state.mode === "speed" ? 1.05 : 1.03;
		state.paddle.w = Math.max(92, state.paddle.w - (state.mode === "chaos" ? 1.8 : 1));
		state.balls.forEach((ball) => {
			const growth = state.mode === "chaos" ? 1.08 : 1.04;
			ball.vx *= growth;
			ball.vy *= growth;
			ball.spin += rand(-0.02, 0.02);
		});
		state.powerReady = clamp(state.powerReady + 6, 0, 100);
		playTone("speed");
		if (state.speedFactor > 2.1) state.rage = true;
		if (state.mode === "chaos") {
			state.gravityShiftUntil = now + 2800;
		}
	}
	if (Math.floor(state.score) > 0 && Math.floor(state.score) % 45 === 0) {
		cyclePalette();
	}
	if (state.rage && now > state.nextPaletteSwitchAt - 5000) {
		cyclePalette(true);
	}
	if (now > state.nextPaletteSwitchAt) {
		cyclePalette(true);
	}
	if (now < state.gravityShiftUntil) {
		document.body.classList.add("rage-mode");
	}
	if (state.paddleBoostUntil > now) {
		state.paddle.w = Math.min(200, state.baseWidth + 42);
	} else {
		state.paddle.w += (state.baseWidth - state.paddle.w) * 0.06;
	}
	if (state.slowMoActive && state.slowMoEnergy > 0) {
		state.slowMoEnergy = Math.max(0, state.slowMoEnergy - dt * 12);
	} else if (!state.slowMoActive) {
		state.slowMoEnergy = Math.min(100, state.slowMoEnergy + dt * 6);
	}
	if (state.powerReady < 100) state.powerReady = Math.min(100, state.powerReady + dt * 5);
	state.displaySpeed += (state.speedFactor - state.displaySpeed) * clamp(dt * 6, 0.12, 1);
	state.highSpeedBlur = Math.max(0, state.highSpeedBlur - dt * 0.9);
	state.impactFlash = Math.max(0, state.impactFlash - dt * 2.1);
	state.audioPulse = Math.max(0, state.audioPulse - dt * 1.8);
}

function updatePhysics(dt) {
	if (!state.running || state.paused || state.over) return;
	const perfectSlow = performance.now() < state.slowMotionUntil;
	const slowFactor = perfectSlow ? 0.48 : state.slowMoActive && state.slowMoEnergy > 1 ? 0.55 : 1;
	const gravityActive = performance.now() < state.gravityShiftUntil || state.mode === "chaos";
	const gravity = gravityActive ? 260 : 0;

	const keyboardTarget = state.keys.has("ArrowLeft") ? state.paddle.x - 14 : state.keys.has("ArrowRight") ? state.paddle.x + 14 : state.pointerX - state.paddle.w / 2;
	state.paddle.targetX = clamp(isFinite(keyboardTarget) ? keyboardTarget : state.paddle.targetX, 16, window.innerWidth - state.paddle.w - 16);
	state.paddle.lastX = state.paddle.x;
	state.paddle.x += (state.paddle.targetX - state.paddle.x) * clamp(dt * 12, 0.1, 1);
	state.paddle.x = clamp(state.paddle.x, 16, window.innerWidth - state.paddle.w - 16);
	state.paddle.vx = (state.paddle.x - state.paddle.lastX) / Math.max(0.0001, dt);

	state.balls.forEach((ball) => {
		addTrail(ball);
		ball.vy += gravity * dt * 0.01 * slowFactor;
		ball.x += ball.vx * dt * slowFactor;
		ball.y += ball.vy * dt * slowFactor;
		ball.spin *= 0.995;
		ball.vx += ball.spin * 24 * dt * slowFactor;

		if (ball.x - ball.r < 0) {
			ball.x = ball.r;
			ball.vx = Math.abs(ball.vx) * (0.965 + rand(-0.015, 0.02));
			ball.spin *= -0.7;
			createParticles(ball.x, ball.y, ball.emoji, 6);
			playTone("wall");
		}
		if (ball.x + ball.r > window.innerWidth) {
			ball.x = window.innerWidth - ball.r;
			ball.vx = -Math.abs(ball.vx) * (0.965 + rand(-0.015, 0.02));
			ball.spin *= -0.7;
			createParticles(ball.x, ball.y, ball.emoji, 6);
			playTone("wall");
		}
		if (ball.y - ball.r < 76) {
			ball.y = 76 + ball.r;
			ball.vy = Math.abs(ball.vy) * (1 + rand(0, 0.025));
			ball.spin += rand(-0.04, 0.04);
			createParticles(ball.x, ball.y, ball.emoji, 7);
			playTone("wall");
		}

		const paddleTop = state.paddle.y;
		const paddleLeft = state.paddle.x;
		const paddleRight = state.paddle.x + state.paddle.w;
		const intersects = ball.y + ball.r >= paddleTop && ball.y + ball.r <= paddleTop + state.paddle.h + 12 && ball.x >= paddleLeft - ball.r && ball.x <= paddleRight + ball.r && ball.vy > 0;

		if (intersects) {
			bounceFromPaddle(ball);
			maybeCloneBall();
			if (state.mode === "chaos" && Math.random() < 0.13) state.gravityShiftUntil = performance.now() + 2200;
			if (state.score > 40 && !state.rage) state.rage = true;
		}

		if (ball.y - ball.r > window.innerHeight + 30) {
			ball.life = 0;
		}
	});

	if (state.rage) {
		document.body.classList.add("rage-mode");
	}

	state.balls = state.balls.filter((ball) => ball.life > 0);
	if (state.balls.length === 0) {
		gameOver();
	}
}

function updateParticles(dt) {
	state.particles.forEach((particle) => {
		particle.x += particle.vx * dt;
		particle.y += particle.vy * dt;
		particle.vy += 360 * dt;
		particle.life -= dt;
	});
	state.particles = state.particles.filter((particle) => particle.life > 0);

	state.floatingLabels.forEach((label) => {
		label.y += label.vy * dt;
		label.life -= dt;
	});
	state.floatingLabels = state.floatingLabels.filter((label) => label.life > 0);

	state.backgroundNodes.forEach((node) => {
		node.x += node.speed * dt * 0.35;
		node.y += Math.sin(performance.now() / 1000 + node.phase) * dt * 10;
		if (node.x < -20) node.x = window.innerWidth + 20;
		if (node.x > window.innerWidth + 20) node.x = -20;
		node.opacity = clamp(node.opacity + Math.sin(performance.now() / 900 + node.phase) * 0.0015, 0.04, 0.25);
	});

	state.trail.forEach((particle) => {
		particle.life -= dt;
	});
	state.trail = state.trail.filter((particle) => particle.life > 0);
}

function drawBackground() {
	const modeHue = state.mode === "speed" ? 330 : state.mode === "chaos" ? 45 : 190;
	const rageBoost = state.rage ? 16 : 0;
	const gradient = ctx.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
	gradient.addColorStop(0, `hsl(${modeHue + rageBoost}, 84%, ${state.rage ? 18 : 9}%)`);
	gradient.addColorStop(0.55, `hsl(${modeHue + 40 + rageBoost}, 72%, ${state.rage ? 16 : 12}%)`);
	gradient.addColorStop(1, `hsl(${modeHue + 88 + rageBoost}, 78%, ${state.rage ? 12 : 10}%)`);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

	const orb = ctx.createRadialGradient(window.innerWidth * 0.28, window.innerHeight * 0.18, 18, window.innerWidth * 0.4, window.innerHeight * 0.25, window.innerWidth * 0.62);
	orb.addColorStop(0, `rgba(0, 240, 255, ${state.rage ? 0.3 : 0.12})`);
	orb.addColorStop(1, "rgba(0, 240, 255, 0)");
	ctx.fillStyle = orb;
	ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

	state.backgroundNodes.forEach((node) => {
		ctx.globalAlpha = node.opacity;
		ctx.beginPath();
		ctx.fillStyle = node.color;
		ctx.shadowColor = node.color;
		ctx.shadowBlur = 18;
		ctx.arc(node.x, node.y, node.size * 3, 0, Math.PI * 2);
		ctx.fill();
	});
	ctx.shadowBlur = 0;
}

function draw() {
	ctx.save();
	if (state.screenShake > 0) {
		const strength = state.screenShake * 1.3;
		ctx.translate(rand(-strength, strength), rand(-strength, strength));
		state.screenShake = Math.max(0, state.screenShake - 0.12);
	}

	drawBackground();

	if (state.highSpeedBlur > 0.05) {
		ctx.globalAlpha = clamp(state.highSpeedBlur * 0.16, 0.04, 0.2);
		ctx.fillStyle = "rgba(255,255,255,0.16)";
		ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
	}

	state.trail.forEach((trail) => {
		ctx.globalAlpha = trail.life * 0.34;
		ctx.font = `${trail.size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
		ctx.fillText(trail.emoji, trail.x, trail.y);
	});

	state.particles.forEach((particle) => {
		ctx.globalAlpha = particle.life;
		ctx.font = `${particle.size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
		ctx.fillText(particle.emoji, particle.x, particle.y);
	});

	state.floatingLabels.forEach((label) => {
		ctx.globalAlpha = label.life;
		ctx.font = `700 18px "Space Grotesk", sans-serif`;
		ctx.fillStyle = label.color;
		ctx.shadowColor = label.color;
		ctx.shadowBlur = 10;
		ctx.fillText(label.text, label.x, label.y);
	});
	ctx.shadowBlur = 0;

	const depthShadow = ctx.createRadialGradient(
		state.paddle.x + state.paddle.w / 2,
		state.paddle.y + 30,
		8,
		state.paddle.x + state.paddle.w / 2,
		state.paddle.y + 30,
		state.paddle.w
	);
	depthShadow.addColorStop(0, "rgba(0,0,0,0.46)");
	depthShadow.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = depthShadow;
	ctx.fillRect(state.paddle.x - 30, state.paddle.y + 6, state.paddle.w + 60, 30);

	const paddleGlow = ctx.createLinearGradient(state.paddle.x, 0, state.paddle.x + state.paddle.w, 0);
	paddleGlow.addColorStop(0, "rgba(0, 240, 255, 0.95)");
	paddleGlow.addColorStop(1, "rgba(138, 43, 226, 0.95)");
	ctx.fillStyle = paddleGlow;
	ctx.shadowColor = `rgba(0, 240, 255, ${clamp(0.45 + state.combo * 0.03, 0.45, 0.9)})`;
	ctx.shadowBlur = clamp(24 + state.combo * 1.1, 24, 48);
	ctx.fillRect(state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h);

	ctx.shadowBlur = 0;
	state.balls.forEach((ball) => {
		const ballSpeed = Math.hypot(ball.vx, ball.vy);
		const glow = clamp(ballSpeed / 22, 10, 34);
		ctx.shadowColor = ballSpeed > 700 ? "rgba(255, 215, 0, 0.85)" : "rgba(0, 240, 255, 0.65)";
		ctx.shadowBlur = glow;
		ctx.globalAlpha = 1;
		ctx.font = `${ball.r * 1.6}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
		ctx.fillText(ball.emoji, ball.x - ball.r, ball.y + ball.r / 2);
	});
	ctx.shadowBlur = 0;

	const powerPct = state.powerReady / 100;
	ctx.fillStyle = "rgba(255,255,255,0.08)";
	ctx.fillRect(24, window.innerHeight - 24, 220, 10);
	ctx.fillStyle = `linear-gradient(90deg, #00F0FF, #8A2BE2)`;
	const grad = ctx.createLinearGradient(24, 0, 24 + 220, 0);
	grad.addColorStop(0, "#00F0FF");
	grad.addColorStop(1, "#8A2BE2");
	ctx.fillStyle = grad;
	ctx.fillRect(24, window.innerHeight - 24, 220 * powerPct, 10);

	ctx.globalAlpha = 0.24 + state.speedFactor * 0.08;
	ctx.fillStyle = state.rage ? "rgba(255, 72, 72, 0.12)" : "rgba(255,255,255,0.06)";
	ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
	if (state.rage) {
		ctx.globalAlpha = 0.12;
		const rageGlow = ctx.createRadialGradient(window.innerWidth / 2, window.innerHeight / 3, 20, window.innerWidth / 2, window.innerHeight / 2, window.innerWidth * 0.75);
		rageGlow.addColorStop(0, "rgba(255, 70, 70, 0.28)");
		rageGlow.addColorStop(1, "rgba(255, 70, 70, 0)");
		ctx.fillStyle = rageGlow;
		ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
	}
	if (state.impactFlash > 0.06) {
		ctx.globalAlpha = state.impactFlash * 0.35;
		ctx.fillStyle = "rgba(255,255,255,0.35)";
		ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
	}

	ctx.restore();
}

function frame(now) {
	if (!state.lastFrame) state.lastFrame = now;
	const dt = clamp((now - state.lastFrame) / 1000, 0, 0.033);
	state.lastFrame = now;

	applyDifficulty(dt);
	updatePhysics(dt);
	updateParticles(dt);
	state.displayScore += (state.score - state.displayScore) * clamp(dt * 10, 0.08, 1);
	if (Math.abs(state.displayScore - state.score) < 0.01) state.displayScore = state.score;
	state.powerReady = clamp(state.powerReady, 0, 100);
	if (performance.now() > state.feedbackUntil && ui.feedbackText.classList.contains("show")) {
		ui.feedbackText.className = "feedback-text";
	}
	document.body.classList.toggle("glitch-pulse", state.rage || state.displaySpeed > 2.35);
	document.body.style.setProperty("--audioPulse", state.audioPulse.toFixed(3));
	draw();
	updateHud();

	if (!state.over) {
		window.requestAnimationFrame(frame);
	} else {
		state.loopActive = false;
	}
}

function onPointerMove(event) {
	const x = event.clientX ?? (event.touches && event.touches[0] ? event.touches[0].clientX : state.pointerX);
	state.pointerX = x;
	if (!state.running || state.over) return;
	handlePaddleMovement(x);
}

function onTouchStart(event) {
	if (!state.running || state.over) return;
	const touch = event.touches[0];
	state.touchStart = { x: touch.clientX, y: touch.clientY, time: performance.now() };
	handlePaddleMovement(touch.clientX);
}

function onTouchMove(event) {
	if (!state.running || state.over) return;
	const touch = event.touches[0];
	handlePaddleMovement(touch.clientX);
}

function onTouchEnd(event) {
	if (!state.running || state.over || !state.touchStart) return;
	const touch = event.changedTouches[0];
	const dx = touch.clientX - state.touchStart.x;
	const dy = touch.clientY - state.touchStart.y;
	const dist = Math.hypot(dx, dy);
	if (dist < 18) {
		state.paddleBoostUntil = performance.now() + 1800;
		state.powerReady = clamp(state.powerReady + 6, 0, 100);
	} else if (dist > 80) {
		state.balls.forEach((ball) => {
			ball.spin += dx > 0 ? 0.12 : -0.12;
			ball.vx += dx * 0.25;
			ball.vy -= Math.abs(dy) * 0.05;
		});
		state.combo += 1;
		state.maxCombo = Math.max(state.maxCombo, state.combo);
		createParticles(touch.clientX, touch.clientY, state.emoji, 12);
	}
	state.touchStart = null;
}

function onKeyDown(event) {
	state.keys.add(event.key);
	if (event.key === " ") {
		event.preventDefault();
		if (!state.running && !state.over) startGame();
		else pauseGame();
	}
	if (event.key.toLowerCase() === "r") {
		resetRound();
		startGame();
	}
	if (event.key.toLowerCase() === "e") triggerPower();
	if (event.key === "Shift") state.slowMoActive = true;
	unlockAudio();
}

function onKeyUp(event) {
	state.keys.delete(event.key);
	if (event.key === "Shift") state.slowMoActive = false;
}

ui.pauseBtn.addEventListener("click", () => {
	if (!state.running && !state.over) {
		startGame();
		playTone("ui");
		return;
	}
	pauseGame();
});
ui.restartBtn.addEventListener("click", () => {
	playTone("ui");
	resetRound();
	startGame();
});
ui.soundBtn.addEventListener("click", () => {
	unlockAudio();
	setSoundEnabled(!state.soundEnabled);
	playTone("ui");
});
ui.powerBtn.addEventListener("click", triggerPower);
ui.playBtn.addEventListener("click", () => {
	playTone("ui");
	startGame();
});
ui.resumeBtn.addEventListener("click", () => {
	playTone("ui");
	pauseGame(false);
});
ui.retryBtn.addEventListener("click", () => {
	playTone("ui");
	resetRound();
	startGame();
});

window.addEventListener("resize", resize);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("touchstart", onTouchStart, { passive: true });
window.addEventListener("touchend", unlockAudio, { passive: true });
window.addEventListener("touchmove", onTouchMove, { passive: true });
window.addEventListener("touchend", onTouchEnd, { passive: true });
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", () => {
	if (state.running && !state.over && !state.paused) pauseGame(true);
});

resize();
setSoundEnabled((localStorage.getItem(soundKey) || "on") !== "off");
resetRound(false);
updateModeClasses();
updateHud();
state.loopActive = true;
window.requestAnimationFrame(frame);

