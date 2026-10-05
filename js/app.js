/* ============================================================
   SYMPHONY OF TOUCH — JavaScript
   Acıbadem International · Breast Cancer Awareness Month
   ============================================================ */

'use strict';

// ─── STATE ───────────────────────────────────────────────────
let currentStep = 0;
const TOTAL_STEPS = 13;
const STATS_STEP = 3;   // Early Detection Saves Lives (count-up stats)
const QUIZ_STEP = 11;   // One Touch Away
const FORM_STEP = 12;   // Take Action Today
let soundEnabled = true;
let audioCtx = null;
let quizAnswers = { 1: null, 2: null, 3: null };
let quizScore = 0;
let statsAnimated = false;

// ─── TONE.JS SAMPLER (Salamander Grand Piano) ─────────────────
// Samples are bundled with the site (audio/piano, CC BY 3.0, see README there)
// so the real piano is ready almost at once and never depends on a third-party host.
// Every melody note is at most one semitone away from a sample, so nothing is
// pitch-shifted far enough to sound synthetic.
let piano = null;
let pianoLoaded = false;
let fallbackSynth = null;

function initPiano() {
    if (typeof Tone === 'undefined') return;

    // A touch of hall reverb makes the dry samples sound like a piano in a room
    const reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.02, wet: 0.28 }).toDestination();

    // Percussive, piano-like tone (struck, then decaying, no organ-style sustain)
    // used only for the moment before the samples have finished loading
    fallbackSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'custom', partials: [1, 0.42, 0.2, 0.1, 0.05, 0.025] },
        envelope: { attack: 0.004, decay: 1.6, sustain: 0, release: 1.2 },
        volume: -10
    }).connect(reverb);

    piano = new Tone.Sampler({
        urls: {
            'C4': 'C4.mp3',
            'D#4': 'Ds4.mp3',
            'F#4': 'Fs4.mp3',
            'A4': 'A4.mp3',
            'C5': 'C5.mp3',
            'D#5': 'Ds5.mp3',
        },
        baseUrl: 'audio/piano/',
        release: 1.6,
        volume: 6,
        onload: () => {
            pianoLoaded = true;
        }
    }).connect(reverb);
}

// ─── MELODY SPLIT FOR SLIDES & FORM ───────────────────────────
// The user explicitly requested:
// "10 slayt için La Vie En Rose'un en ama en bilindik kısmındaki notaları kullanalım"

// Part 1: First 10 notes, one per slide click up to the Myth/Fact slide
// Visual Notes: DO si la sol mi DO si (7) + la sol mi (3) = 10 notes
const AMBIENT_SCALE = [
    'C5', // 1. Quand (DO)
    'B4', // 2. il (si)
    'A4', // 3. me (la)
    'G4', // 4. prend (sol)
    'E4', // 5. dans (mi)
    'C5', // 6. ses (DO)
    'B4', // 7. bras (si)
    'A4', // 8. Il (la)
    'G4', // 9. me (sol)
    'E4'  // 10. par- (mi)
];

const AMBIENT_SCALE_FREQ = [
    523.25, 493.88, 440.00, 392.00, 329.63,
    523.25, 493.88, 440.00, 392.00, 329.63
];

// Part 2: Just G, A, B, C for the form submit ("la vieeee eeeeen roooseee")
const LA_VIE_EN_ROSE_NOTES = [
    { note: 'G4', freq: 392.00, time: 0 },
    { note: 'A4', freq: 440.00, time: 500 },
    { note: 'B4', freq: 493.88, time: 1000 },
    { note: 'C5', freq: 523.25, time: 1600 }
];

// ─── SAFARI AUDIO UNLOCK ──────────────────────────────────────
async function unlockAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
    if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
        await Tone.start();
    }
}

// ─── PLAY VIA TONE.JS SAMPLER / SYNTH ─────────────────────────
function playViaTone(noteName, duration = 2.4) {
    if (typeof Tone === 'undefined' || Tone.context.state !== 'running') return false;
    // Slightly varied touch, like a pianist's hand
    const velocity = 0.68 + Math.random() * 0.14;
    const instrument = piano && pianoLoaded ? piano : fallbackSynth;
    if (!instrument) return false;
    try {
        instrument.triggerAttackRelease(noteName, duration, undefined, velocity);
        return true;
    } catch (e) {
        return false;
    }
}

// ─── PLAY VIA OSCILLATOR (fallback when Tone.js is unavailable) ───
// A struck-string envelope: a fast attack, then the tone decays away, with the
// brighter overtones fading first, as on a real piano.
function playViaOscillator(freq) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.value = 0.28;
    master.connect(audioCtx.destination);

    [[1, 1, 2.4], [2, 0.4, 1.2], [3, 0.18, 0.7], [4, 0.08, 0.45]].forEach(([mult, level, decay]) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * mult;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(level, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0005, now + decay);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + decay + 0.05);
    });
}

// ─── UNIFIED playNote() ───────────────────────────────────────
async function playNote(stepIndex, overrideNote = null, overrideFreq = null) {
    if (!soundEnabled) return;
    
    // Mute transitions into the Quiz and the Form to create a dramatic silence gap
    if (stepIndex >= QUIZ_STEP - 1 && !overrideNote) return;

    await unlockAudio();

    const noteName = overrideNote || AMBIENT_SCALE[stepIndex] || 'C5';
    const freq = overrideFreq || AMBIENT_SCALE_FREQ[stepIndex] || 523.25;

    if (!playViaTone(noteName)) {
        playViaOscillator(freq);
    }
    if (stepIndex !== null) lightKey(stepIndex);
}


function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundOnIcon').classList.toggle('hidden', !soundEnabled);
    document.getElementById('soundOffIcon').classList.toggle('hidden', soundEnabled);
}


// ─── PIANO KEYS GENERATION ───────────────────────────────────
// Keys are drawn inside the piano SVG (viewBox 300x560) so they always span
// exactly the body's height, whatever the screen size.
const KEYS_X = 229;       // left edge of the key strip
const KEYS_WIDTH = 66;    // up to the body's right edge (x = 295)
const KEYS_HEIGHT = 555;  // body height

function generateKeys() {
    const container = document.getElementById('piano-keys');
    const svgNS = 'http://www.w3.org/2000/svg';
    const whiteCount = 32;
    const keyH = KEYS_HEIGHT / whiteCount;

    // Black key pattern per octave (which white key positions have black key above them)
    // In a 7-white-key octave: positions 0,1,3,4,5 have black keys above (not 2 and 6)
    const blackPattern = [true, true, false, true, true, true, false];

    const rect = (cls, x, y, w, h) => {
        const r = document.createElementNS(svgNS, 'rect');
        r.setAttribute('class', cls);
        r.setAttribute('x', x);
        r.setAttribute('y', y);
        r.setAttribute('width', w);
        r.setAttribute('height', h);
        return r;
    };

    for (let i = 0; i < whiteCount; i++) {
        const key = rect('piano-key', KEYS_X, i * keyH, KEYS_WIDTH, keyH);
        key.dataset.keyIndex = i;
        container.appendChild(key);
    }

    // Black keys sit between two white keys, drawn on top of them
    const blackH = keyH * 0.58;
    for (let i = 0; i < whiteCount - 1; i++) {
        if (!blackPattern[i % 7]) continue;
        const bk = rect('piano-black-key', KEYS_X, (i + 1) * keyH - blackH / 2, KEYS_WIDTH * 0.62, blackH);
        bk.setAttribute('rx', 1.5);
        container.appendChild(bk);
    }

    // Dark rail between the body and the keys
    const rail = rect('piano-key-rail', KEYS_X - 1.5, 0, 3, KEYS_HEIGHT);
    container.appendChild(rail);
}

// Map melody notes to approximate key positions on our 32-key strip
const KEY_MAP = [4, 6, 8, 4, 8, 9, 11, 8, 11, 18];
function keyIndexFor(step) {
    return KEY_MAP[step] ?? 16;
}

/**
 * Highlights the piano key that corresponds to the current melody note.
 * Each note maps to an approximate key position.
 */
function lightKey(noteIndex) {
    const keys = document.querySelectorAll('.piano-key');
    keys.forEach(k => k.classList.remove('lit'));

    const idx = keyIndexFor(noteIndex);
    if (keys[idx]) {
        keys[idx].classList.add('lit');
        setTimeout(() => keys[idx].classList.remove('lit'), 600);
    }
}

// ─── SOUND WAVE VISUAL ───────────────────────────────────────
// Rings pulse out from the struck key while a string-like waveform vibrates
// across the body, its wavelength following the note's pitch. All in SVG
// coordinates (viewBox 300x560) and clipped to the piano shape.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function emitSoundWave(keyIdx, freq) {
    const group = document.getElementById('svg-ripples');
    if (!group) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const keyH = KEYS_HEIGHT / 32;
    const x0 = KEYS_X;
    const y0 = keyIdx * keyH + keyH / 2;

    const rings = reduceMotion.matches ? [0] : [0, 0.14, 0.28];
    rings.forEach(delay => {
        const ring = document.createElementNS(svgNS, 'circle');
        ring.setAttribute('class', 'sound-ring');
        ring.setAttribute('cx', x0);
        ring.setAttribute('cy', y0);
        ring.setAttribute('r', 12);
        ring.style.animationDelay = `${delay}s`;
        group.appendChild(ring);
        setTimeout(() => ring.remove(), 1700 + delay * 1000);
    });

    if (reduceMotion.matches) return;

    const wave = document.createElementNS(svgNS, 'g');
    const glow = document.createElementNS(svgNS, 'path');
    const core = document.createElementNS(svgNS, 'path');
    glow.setAttribute('class', 'sound-wave sound-wave-glow');
    core.setAttribute('class', 'sound-wave sound-wave-core');
    wave.append(glow, core);
    group.appendChild(wave);

    const DURATION = 1500;            // ms the string keeps ringing
    const SPEED = 0.45;               // svg units per ms the wave front travels
    const wavelength = 34 * 440 / freq;
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * 0.006; // ~6 oscillations per second
    const start = performance.now();

    function frame(now) {
        const t = now - start;
        if (t >= DURATION) { wave.remove(); return; }
        const life = 1 - t / DURATION;
        const front = Math.min(x0, t * SPEED);
        let d = `M${x0},${y0}`;
        for (let dist = 2; dist <= front; dist += 2) {
            // Anchored at the key, swelling, then fading with distance and time;
            // tapered at the travelling front so it doesn't end in a hard edge.
            const env = (1 - Math.exp(-dist / 18)) * Math.exp(-dist / 260) * Math.min(1, (front - dist) / 24 + 0.15);
            const y = y0 + 20 * life * life * env * Math.sin(k * dist - omega * t);
            d += `L${(x0 - dist).toFixed(1)},${y.toFixed(1)}`;
        }
        glow.setAttribute('d', d);
        core.setAttribute('d', d);
        wave.setAttribute('opacity', Math.min(1, life * 1.6).toFixed(2));
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// ─── DANCING MUSIC NOTES ─────────────────────────────────────
const NOTE_SYMBOLS = ['#note-eighth', '#note-beamed'];
const NOTE_COLORS = ['#ffffff', '#ffd6e7'];

// Animated by JS through SVG attributes (not CSS keyframes) so it plays the
// same in every browser, Safari included. With "reduce motion" switched on the
// notes still appear, but only rise gently and fade, without swaying or spinning.
function emitMusicNotes(keyIdx) {
    const group = document.getElementById('svg-notes');
    if (!group) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const keyH = KEYS_HEIGHT / 32;
    const y0 = keyIdx * keyH + keyH / 2;
    const calm = reduceMotion.matches;

    for (let i = 0; i < 3; i++) {
        const size = 30 + Math.random() * 12;
        const note = document.createElementNS(svgNS, 'use');
        note.setAttribute('href', NOTE_SYMBOLS[(i + keyIdx) % NOTE_SYMBOLS.length]);
        note.setAttribute('x', -size / 2);
        note.setAttribute('y', -size / 2);
        note.setAttribute('width', size);
        note.setAttribute('height', size);
        note.setAttribute('fill', NOTE_COLORS[i % NOTE_COLORS.length]);
        note.setAttribute('opacity', 0);
        group.appendChild(note);

        // Start on the keys, drift left over the dark body while rising
        const x = KEYS_X + 4 + Math.random() * 26;
        const y = y0 + (Math.random() - 0.5) * 20;
        const dx = calm ? 0 : -(60 + Math.random() * 70);
        // Keep them inside the picture when the key is near the top of the piano
        const rise = Math.min(calm ? 30 : 80 + Math.random() * 30, y - 28);
        const sway = calm ? 0 : 8 + Math.random() * 8;
        const spin = calm ? 0 : 12 + Math.random() * 8;
        const phase = Math.random() * Math.PI;
        const delay = i * 140;
        const DURATION = 1800;
        const start = performance.now() + delay;

        function frame(now) {
            const t = (now - start) / DURATION;
            if (t < 0) { requestAnimationFrame(frame); return; }
            if (t >= 1) { note.remove(); return; }
            const ease = 1 - Math.pow(1 - t, 2);
            const wobble = Math.sin(t * Math.PI * 3 + phase);
            const px = x + dx * ease + sway * wobble;
            const py = y - rise * ease;
            const pop = t < 0.15 ? 0.4 + (t / 0.15) * 0.75 : 1.15 - Math.min(0.25, (t - 0.15) * 0.6);
            const opacity = t < 0.12 ? t / 0.12 : t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
            note.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(spin * wobble).toFixed(1)}) scale(${pop.toFixed(3)})`);
            note.setAttribute('opacity', opacity.toFixed(2));
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }
}

// ─── NAVIGATION ──────────────────────────────────────────────
function nextStep() {
    // Don't advance past form, and don't advance if the quiz is incomplete
    if (currentStep === QUIZ_STEP && !isQuizComplete()) {
        shakeQuiz();
        return;
    }
    if (currentStep >= TOTAL_STEPS - 1) return;

    // Init & play audio
    playNote(currentStep);

    // Sound waves leave the struck key and travel across the piano body
    emitSoundWave(keyIndexFor(currentStep), AMBIENT_SCALE_FREQ[currentStep] || 440);
    // Music notes dance out of the key, on every melody step
    if (currentStep < QUIZ_STEP - 1) emitMusicNotes(keyIndexFor(currentStep));

    // Hide tap hint after first interaction
    if (currentStep === 0) {
        const hint = document.getElementById('tapHint');
        if (hint) hint.style.display = 'none';
    }

    // Slide out current
    const cur = document.getElementById(`step-${currentStep}`);
    if (cur) {
        cur.classList.remove('active');
        cur.classList.add('out');
        setTimeout(() => cur.classList.remove('out'), 800);
    }

    currentStep++;

    // Slide in next
    const next = document.getElementById(`step-${currentStep}`);
    if (next) { next.scrollTop = 0; next.classList.add('active'); }

    updateDots();
    onStepEnter();
}

// Shared by tap/swipe navigation and the progress dots
function onStepEnter() {
    if (currentStep > 0) {
        const hint = document.getElementById('tapHint');
        if (hint) hint.style.display = 'none';
    }

    // Trigger stats animation on the statistics slide
    if (currentStep === STATS_STEP && !statsAnimated) {
        setTimeout(animateStats, 400);
        statsAnimated = true;
    }

    // Set personalised form title from quiz
    if (currentStep === FORM_STEP) {
        personaliseForm();
    }
}

function goToStep(index) {
    if (index === currentStep || index < 0 || index >= TOTAL_STEPS) return;
    const cur = document.getElementById(`step-${currentStep}`);
    if (cur) { cur.classList.remove('active'); cur.classList.add('out'); setTimeout(() => cur.classList.remove('out'), 800); }
    currentStep = index;
    const next = document.getElementById(`step-${currentStep}`);
    if (next) { next.scrollTop = 0; next.classList.add('active'); }
    updateDots();
    onStepEnter();
}

// ─── PROGRESS DOTS ───────────────────────────────────────────
function buildDots() {
    const container = document.getElementById('progressDots');
    for (let i = 0; i < TOTAL_STEPS; i++) {
        const dot = document.createElement('div');
        dot.className = 'progress-dot' + (i === 0 ? ' active' : '');
        dot.title = `Slide ${i + 1}`;
        dot.onclick = () => goToStep(i);
        container.appendChild(dot);
    }
}

function updateDots() {
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === currentStep));

    const restart = document.getElementById('restartBtn');
    if (restart) {
        restart.classList.toggle('visible', currentStep > 0);
        restart.tabIndex = currentStep > 0 ? 0 : -1;
    }
}

// ─── RESTART ──────────────────────────────────────────────────
// Brings the experience back to the first slide with every interaction cleared,
// so the next visitor (e.g. on a kiosk or a shared screen) starts fresh.
let formDefaults = null;

function restartExperience() {
    quizAnswers = { 1: null, 2: null, 3: null };
    quizScore = 0;
    statsAnimated = false;
    document.querySelectorAll('.stat-number[data-target]').forEach(el => { el.textContent = '0'; });
    document.querySelectorAll('.quiz-btn').forEach(b => b.classList.remove('selected-yes', 'selected-no'));
    document.getElementById('quiz-result').classList.add('hidden');
    document.getElementById('quizScoreInput').value = '';

    document.querySelectorAll('.myth-card').forEach(card => {
        card.classList.remove('revealed');
        card.setAttribute('aria-pressed', 'false');
        card.querySelector('.myth-tag').textContent = 'Myth';
    });

    const formEl = document.getElementById('leadForm');
    formEl.reset();
    formEl.style.display = '';
    formEl.style.opacity = '';
    document.getElementById('successMessage').classList.add('hidden');
    if (formDefaults) {
        document.getElementById('formTitle').textContent = formDefaults.title;
        document.getElementById('formSubtitle').textContent = formDefaults.subtitle;
    }

    const hint = document.getElementById('tapHint');
    if (hint) hint.style.display = '';

    goToStep(0);
    document.getElementById('restartBtn').blur();
}

// ─── STAT COUNT-UP ───────────────────────────────────────────
function animateStats() {
    const elements = document.querySelectorAll('.stat-number[data-target]');
    elements.forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        const duration = 1200;
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
}

// ─── QUIZ ─────────────────────────────────────────────────────
function answerQ(qNum, value) {
    quizAnswers[qNum] = value;

    // Update button states
    const btns = document.querySelectorAll(`.quiz-btn[data-q="${qNum}"]`);
    btns.forEach(btn => {
        btn.classList.remove('selected-yes', 'selected-no');
        if (btn.dataset.v === value) {
            btn.classList.add(value === 'yes' ? 'selected-yes' : 'selected-no');
        }
    });

    // Check if all answered
    if (isQuizComplete()) {
        showQuizResult();
    }
}

function isQuizComplete() {
    return quizAnswers[1] !== null && quizAnswers[2] !== null && quizAnswers[3] !== null;
}

function showQuizResult() {
    quizScore = [quizAnswers[1], quizAnswers[2], quizAnswers[3]].filter(a => a === 'yes').length;

    const messages = [
        "Great awareness! Keep it up — stay on track with your annual screening and monthly self-exams.",
        "We recommend scheduling a screening soon. Our team can guide you through the right next steps.",
        "Please don't delay. Our breast health specialists are ready to support you with compassion and expertise."
    ];

    const idx = quizScore === 0 ? 0 : quizScore <= 2 ? 1 : 2;
    const resultEl = document.getElementById('quiz-result');
    const textEl = document.getElementById('quiz-result-text');
    textEl.textContent = messages[idx];
    resultEl.classList.remove('hidden');

    document.getElementById('quizScoreInput').value = quizScore;
}

function shakeQuiz() {
    const qContainer = document.getElementById('quiz-questions');
    qContainer.style.animation = 'none';
    void qContainer.offsetWidth;
    qContainer.style.animation = 'shake 0.4s ease';
}

function personaliseForm() {
    if (quizScore === 0) return; // default text is fine
    const titles = [
        null,
        "Schedule Your Screening",
        "Our Experts Are Here For You",
        "Don't Wait — We're Ready For You"
    ];
    const subtitles = [
        null,
        "Based on your answers, a screening appointment at Acıbadem could be the right next step.",
        "Our specialists are ready to assess your situation with care and expertise.",
        "Please reach out — early assessment can make all the difference."
    ];
    if (titles[quizScore]) document.getElementById('formTitle').textContent = titles[quizScore];
    if (subtitles[quizScore]) document.getElementById('formSubtitle').textContent = subtitles[quizScore];
}

// ─── MYTH OR FACT ─────────────────────────────────────────────
function flipMyth(card) {
    const revealed = card.classList.toggle('revealed');
    card.setAttribute('aria-pressed', revealed);
    card.querySelector('.myth-tag').textContent = revealed ? 'Fact' : 'Myth';
}

// ─── FORM SUBMIT ──────────────────────────────────────────────
async function submitForm(event) {
    event.preventDefault();
    await unlockAudio();

    
    // Play the iconic La Vie En Rose chorus in perfect tempo!
    LA_VIE_EN_ROSE_NOTES.forEach(item => {
        setTimeout(() => playNote(null, item.note, item.freq), item.time);
    });

    const form = event.target;
    const formEl = document.getElementById('leadForm');
    const successEl = document.getElementById('successMessage');

    // --- In production: POST to mail_handler.php ---
    // const data = new FormData(form);
    // fetch('mail_handler.php', { method: 'POST', body: data })
    //   .then(r => r.json())
    //   .then(d => { if(d.success) showSuccess(); })
    //   .catch(() => showSuccess()); // fail open for now

    // For now (prototype): always show success
    formEl.style.transition = 'opacity 0.3s';
    formEl.style.opacity = '0';
    setTimeout(() => {
        formEl.style.display = 'none';
        successEl.classList.remove('hidden');
    }, 300);
}

// ─── SWIPE SUPPORT (Mobile) ───────────────────────────────────
// Swipe up = next slide, swipe down = previous slide. When a slide is taller
// than the screen, the swipe scrolls it first and only changes slide once the
// reader is already at the bottom (or top).
(function initSwipe() {
    let startX = 0, startY = 0, atTop = true, atBottom = true;

    document.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        const slide = e.target.closest && e.target.closest('.step');
        atTop = !slide || slide.scrollTop <= 1;
        atBottom = !slide || slide.scrollTop + slide.clientHeight >= slide.scrollHeight - 1;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const deltaX = startX - e.changedTouches[0].clientX;
        const deltaY = startY - e.changedTouches[0].clientY;
        if (Math.abs(deltaY) < 50 || Math.abs(deltaY) < Math.abs(deltaX)) return;
        if (deltaY > 0 && atBottom && currentStep < TOTAL_STEPS - 1) nextStep();
        else if (deltaY < 0 && atTop && currentStep > 0) goToStep(currentStep - 1);
    }, { passive: true });
})();

// ─── KEYBOARD NAVIGATION ──────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.code === 'ArrowRight' || e.code === 'Space' || e.code === 'ArrowDown') {
        e.preventDefault();
        nextStep();
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (currentStep > 0) goToStep(currentStep - 1);
    }
});

// ─── SHAKE ANIMATION ──────────────────────────────────────────
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-6px); }
    40%     { transform: translateX(6px); }
    60%     { transform: translateX(-4px); }
    80%     { transform: translateX(4px); }
}`;
document.head.appendChild(shakeStyle);

// ─── INIT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    generateKeys();
    buildDots();
    formDefaults = {
        title: document.getElementById('formTitle').textContent,
        subtitle: document.getElementById('formSubtitle').textContent
    };
    initPiano(); // Start loading samples in the background
});
