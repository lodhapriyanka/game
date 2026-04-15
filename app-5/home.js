
const storageKey = "emojiPongProfile";
const modeKey = "emojiPongMode";
const emojiKey = "emojiPongEmoji";

const emojiOptions = {
	"🎯": { label: "Classic control", ability: "Balanced velocity and stable return" },
	"🔥": { label: "Fire mode", ability: "High speed launch and hotter acceleration" },
	"🧊": { label: "Ice mode", ability: "Temporary time-slow with safer control" },
	"💣": { label: "Bomb mode", ability: "Explosive rebound and heavy spin burst" },
	"🌀": { label: "Spiral mode", ability: "Unpredictable curve and spin chaos" },
	"💎": { label: "Crystal mode", ability: "Higher scoring multiplier and XP gain" }
};

const defaultProfile = {
	highScore: 0,
	xp: 0,
	games: 0,
	bestCombo: 0,
	unlocks: ["🎯"]
};

const modeButtons = document.querySelectorAll("[data-mode]");
const emojiButtons = document.querySelectorAll("[data-emoji]");
const startLink = document.getElementById("startGameLink");
const selectedEmojiLabel = document.getElementById("selectedEmojiLabel");
const modeText = document.getElementById("modeText");
const highScoreText = document.getElementById("highScoreText");
const xpText = document.getElementById("xpText");
const gamesText = document.getElementById("gamesText");
const bestComboText = document.getElementById("bestComboText");
const unlockText = document.getElementById("unlockText");
const unlockStrip = document.getElementById("unlockStrip");
const resetStatsBtn = document.getElementById("resetStatsBtn");
const cursorGlow = document.getElementById("cursorGlow");
const emojiScanner = document.getElementById("emojiScanner");
const bootScreen = document.getElementById("bootScreen");
const bootProgress = document.getElementById("bootProgress");
const miniPreview = document.getElementById("miniPreview");

const counterState = {
	high: 0,
	xp: 0,
	games: 0,
	combo: 0,
	unlocks: 1
};

function loadProfile() {
	try {
		return { ...defaultProfile, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
	} catch {
		return { ...defaultProfile };
	}
}

function animateValue(current, target) {
	return current + (target - current) * 0.16;
}

function renderCounters(profile) {
	counterState.high = animateValue(counterState.high, profile.highScore || 0);
	counterState.xp = animateValue(counterState.xp, profile.xp || 0);
	counterState.games = animateValue(counterState.games, profile.games || 0);
	counterState.combo = animateValue(counterState.combo, profile.bestCombo || 0);
	counterState.unlocks = animateValue(counterState.unlocks, (profile.unlocks || ["🎯"]).length);

	highScoreText.textContent = Math.round(counterState.high);
	xpText.textContent = Math.round(counterState.xp);
	gamesText.textContent = Math.round(counterState.games);
	bestComboText.textContent = Math.round(counterState.combo);
	unlockText.textContent = Math.round(counterState.unlocks);

	if (Math.abs(counterState.high - (profile.highScore || 0)) > 0.5 || Math.abs(counterState.xp - (profile.xp || 0)) > 0.5) {
		window.requestAnimationFrame(() => renderCounters(profile));
	}
}

function updatePreview() {
	const profile = loadProfile();
	renderCounters(profile);
	unlockStrip.innerHTML = (profile.unlocks || ["🎯"])
		.map((emoji) => `<span class="unlock-badge">${emoji}</span>`)
		.join("");
}

function setMode(mode) {
	localStorage.setItem(modeKey, mode);
	modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
	modeText.textContent = mode === "speed" ? "Speed Rush" : mode === "chaos" ? "Chaos Mode" : "Classic";
}

function setEmoji(emoji) {
	localStorage.setItem(emojiKey, emoji);
	emojiButtons.forEach((button) => button.classList.toggle("selected", button.dataset.emoji === emoji));
	const option = emojiOptions[emoji] || emojiOptions["🎯"];
	selectedEmojiLabel.textContent = `Selected emoji: ${emoji} ${option.label}`;
	startLink.href = `game.html?emoji=${encodeURIComponent(emoji)}&mode=${encodeURIComponent(localStorage.getItem(modeKey) || "classic")}`;
}

function installModeCardTilt() {
	modeButtons.forEach((button) => {
		button.addEventListener("mousemove", (event) => {
			const rect = button.getBoundingClientRect();
			const dx = (event.clientX - rect.left) / rect.width - 0.5;
			const dy = (event.clientY - rect.top) / rect.height - 0.5;
			button.style.transform = `perspective(700px) rotateX(${(-dy * 8).toFixed(2)}deg) rotateY(${(dx * 10).toFixed(2)}deg) translateY(-2px)`;
		});
		button.addEventListener("mouseleave", () => {
			button.style.transform = "";
		});
	});
}

function installEmojiScanner() {
	emojiButtons.forEach((button) => {
		button.addEventListener("mouseenter", () => {
			const emoji = button.dataset.emoji;
			const option = emojiOptions[emoji] || emojiOptions["🎯"];
			emojiScanner.textContent = `${emoji} ${option.ability}`;
		});
		button.addEventListener("mouseleave", () => {
			emojiScanner.textContent = "Hover emoji to scan ability";
		});
	});
}

function installCursorAndParallax() {
	window.addEventListener("pointermove", (event) => {
		const x = event.clientX;
		const y = event.clientY;
		cursorGlow.style.transform = `translate(${x}px, ${y}px)`;
		const dx = (x / window.innerWidth - 0.5) * 2;
		const dy = (y / window.innerHeight - 0.5) * 2;
		document.documentElement.style.setProperty("--mx", dx.toFixed(3));
		document.documentElement.style.setProperty("--my", dy.toFixed(3));
	});
}

function installLaunchTransition() {
	startLink.addEventListener("click", (event) => {
		event.preventDefault();
		document.body.classList.add("launch-zoom");
		window.setTimeout(() => {
			window.location.href = startLink.href;
		}, 240);
	});
}

function runBootSequence() {
	let progress = 0;
	const tick = () => {
		progress += 4 + Math.random() * 6;
		bootProgress.style.width = `${Math.min(progress, 100)}%`;
		if (progress < 100) {
			window.requestAnimationFrame(tick);
		} else {
			bootScreen.classList.add("hidden");
		}
	};
	tick();
}

function startMiniPreview() {
	if (!miniPreview) return;
	const ctx = miniPreview.getContext("2d");
	let w = miniPreview.width;
	let h = miniPreview.height;
	let ball = { x: w * 0.3, y: h * 0.35, vx: 2.5, vy: 2.1, r: 12, emoji: "🎯" };
	let paddle = { x: w * 0.5 - 36, y: h - 20, w: 72, h: 7, t: 0 };

	const fit = () => {
		const rect = miniPreview.getBoundingClientRect();
		const ratio = window.devicePixelRatio || 1;
		miniPreview.width = Math.max(320, Math.floor(rect.width * ratio));
		miniPreview.height = Math.max(120, Math.floor(rect.height * ratio));
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		w = rect.width;
		h = rect.height;
		paddle.y = h - 20;
	};

	window.addEventListener("resize", fit);
	fit();

	const loop = () => {
		ctx.clearRect(0, 0, w, h);
		const g = ctx.createLinearGradient(0, 0, w, h);
		g.addColorStop(0, "rgba(0, 240, 255, 0.12)");
		g.addColorStop(1, "rgba(255, 0, 127, 0.08)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);

		paddle.t += 0.03;
		paddle.x = w * 0.5 - paddle.w / 2 + Math.sin(paddle.t) * (w * 0.22);

		ball.x += ball.vx;
		ball.y += ball.vy;
		if (ball.x < ball.r || ball.x > w - ball.r) ball.vx *= -1;
		if (ball.y < ball.r) ball.vy *= -1;
		if (ball.y + ball.r > paddle.y && ball.x > paddle.x && ball.x < paddle.x + paddle.w) {
			ball.vy = -Math.abs(ball.vy);
			ball.vx += (ball.x - (paddle.x + paddle.w / 2)) * 0.03;
		}
		if (ball.y > h + 20) {
			ball.x = w * 0.3;
			ball.y = h * 0.35;
			ball.vy = -2.3;
		}

		ctx.shadowColor = "rgba(0,240,255,0.7)";
		ctx.shadowBlur = 18;
		ctx.fillStyle = "#00F0FF";
		ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
		ctx.shadowBlur = 0;

		ctx.font = `24px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
		ctx.fillText(ball.emoji, ball.x - 12, ball.y + 8);

		window.requestAnimationFrame(loop);
	};

	loop();
}

function animateThemeShift() {
	const tick = (t) => {
		const hue = (Math.sin(t * 0.00022) * 25).toFixed(2);
		document.documentElement.style.setProperty("--themeShift", `${hue}deg`);
		window.requestAnimationFrame(tick);
	};
	window.requestAnimationFrame(tick);
}

emojiButtons.forEach((button) => {
	button.addEventListener("click", () => setEmoji(button.dataset.emoji));
});

modeButtons.forEach((button) => {
	button.addEventListener("click", () => {
		setMode(button.dataset.mode);
		const emoji = localStorage.getItem(emojiKey) || "🎯";
		setEmoji(emoji);
	});
});

resetStatsBtn.addEventListener("click", () => {
	localStorage.removeItem(storageKey);
	localStorage.removeItem(modeKey);
	localStorage.removeItem(emojiKey);
	setMode("classic");
	setEmoji("🎯");
	updatePreview();
});

const savedMode = localStorage.getItem(modeKey) || "classic";
const savedEmoji = localStorage.getItem(emojiKey) || "🎯";
setMode(savedMode);
setEmoji(savedEmoji);
updatePreview();
installModeCardTilt();
installEmojiScanner();
installCursorAndParallax();
installLaunchTransition();
startMiniPreview();
animateThemeShift();
runBootSequence();

