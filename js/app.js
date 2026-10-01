/* ============================================================
   SYMPHONY OF TOUCH — JavaScript
   Acıbadem International · Breast Cancer Awareness Month
   ============================================================ */

'use strict';

// ─── STATE ───────────────────────────────────────────────────
let currentStep = 0;
const TOTAL_STEPS = 10;
let soundEnabled = true;
let audioCtx = null;
let quizAnswers = { 1: null, 2: null, 3: null };
let quizScore = 0;
let statsAnimated = false;

// ─── TONE.JS SAMPLER (Salamander Grand Piano) ─────────────────
let piano = null;
let pianoLoaded = false;

async function initPiano() {
    if (piano || typeof Tone === 'undefined') return;
    try {
        await Tone.start();
        piano = new Tone.Sampler({
            urls: {
                'C4': 'C4.mp3',
                'E4': 'E4.mp3',
                'G4': 'G4.mp3',
                'A4': 'A4.mp3',
                'C5': 'C5.mp3',
            },
            baseUrl: 'https://tonejs.github.io/audio/salamander/',
            release: 2.0,
            onload: () => {
                pianoLoaded = true;
                console.log('🎹 Salamander Grand Piano loaded!');
            }
        }).toDestination();
    } catch(e) {
        console.warn('Tone.js Sampler failed, falling back to oscillator.', e);
        piano = null;
    }
}

// ─── AMBIENT SCALE FOR SLIDE CLICKS (C Major rising arpeggio) ─
const AMBIENT_SCALE = [
    'C4','D4','E4','F4','G4','A4','B4','C5','D5','E5'
];

// Fallback frequencies when Tone.js unavailable
const AMBIENT_SCALE_FREQ = [
    261.63, 293.66, 329.63, 349.23, 392.00,
    440.00, 493.88, 523.25, 587.33, 659.25
];

// ─── LA VIE EN ROSE — Correct Chorus Melody (C Major) ────────
// "Quand il me prend dans ses bras / Il me parle tout bas / Je vois la vie en rose"
// Research-verified syllable-by-syllable transcription (Zaz version, ♩≈80 BPM)
const LA_VIE_EN_ROSE_NOTES = [
    // --- Quand il me prend dans ses bras ---
    { note: 'E4', freq: 329.63, time: 0 },       // Quand
    { note: 'E4', freq: 329.63, time: 350 },      // il
    { note: 'E4', freq: 329.63, time: 700 },      // me
    { note: 'E4', freq: 329.63, time: 1050 },     // prend
    { note: 'D4', freq: 293.66, time: 1400 },     // dans
    { note: 'C4', freq: 261.63, time: 1750 },     // ses
    { note: 'D4', freq: 293.66, time: 2100 },     // bras (D)
    { note: 'E4', freq: 329.63, time: 2400 },     // bras~ (E, süsleme)

    // --- Il me parle tout bas ---
    { note: 'E4', freq: 329.63, time: 3300 },     // Il
    { note: 'F4', freq: 349.23, time: 3650 },     // me
    { note: 'G4', freq: 392.00, time: 4000 },     // par-
    { note: 'G4', freq: 392.00, time: 4350 },     // -le
    { note: 'G4', freq: 392.00, time: 4700 },     // tout
    { note: 'F4', freq: 349.23, time: 5050 },     // bas~
    { note: 'E4', freq: 329.63, time: 5300 },     // bas~
    { note: 'D4', freq: 293.66, time: 5550 },     // bas~

    // --- Je vois la vie en rose ---
    { note: 'D4', freq: 293.66, time: 6400 },     // Je
    { note: 'E4', freq: 329.63, time: 6750 },     // vois
    { note: 'F4', freq: 349.23, time: 7100 },     // la
    { note: 'F4', freq: 349.23, time: 7450 },     // vie
    { note: 'E4', freq: 329.63, time: 7800 },     // en
    { note: 'D4', freq: 293.66, time: 8150 },     // ro-
    { note: 'C4', freq: 261.63, time: 8500 },     // -se (long)

    // --- Final Cmaj7 arpej ---
    { note: 'C4', freq: 261.63, time: 9600 },
    { note: 'E4', freq: 329.63, time: 9660 },
    { note: 'G4', freq: 392.00, time: 9720 },
    { note: 'B4', freq: 493.88, time: 9780 },
];

// ─── AUDIO INIT (oscillator fallback) ────────────────────────
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    initPiano(); // async, non-blocking
}

// ─── PLAY VIA TONE.JS SAMPLER ─────────────────────────────────
function playViaTone(noteName, duration = '2n') {
    if (piano && pianoLoaded) {
        try {
            piano.triggerAttackRelease(noteName, duration);
            return true;
        } catch(e) { return false; }
    }
    return false;
}

// ─── PLAY VIA OSCILLATOR (fallback) ───────────────────────────
function playViaOscillator(freq) {
    if (!audioCtx) return;
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.32, audioCtx.currentTime + 0.03);
    masterGain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.4);
    masterGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.2);
    masterGain.connect(audioCtx.destination);

    const osc1 = audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = freq;
    osc1.connect(masterGain);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 2.2);

    const osc2 = audioCtx.createOscillator();
    const hg = audioCtx.createGain();
    hg.gain.value = 0.1;
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    osc2.connect(hg);
    hg.connect(masterGain);
    osc2.start(audioCtx.currentTime);
    osc2.stop(audioCtx.currentTime + 1.0);
}

// ─── UNIFIED playNote() ───────────────────────────────────────
function playNote(stepIndex, overrideNote = null, overrideFreq = null) {
    if (!soundEnabled) return;

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
function generateKeys() {
    const container = document.getElementById('piano-keys');
    const whiteCount = 32;

    // Black key pattern per octave (which white key positions have black key above them)
    // In a 7-white-key octave: positions 0,1,3,4,5 have black keys above (not 2 and 6)
    const blackPattern = [true, true, false, true, true, true, false];

    for (let i = 0; i < whiteCount; i++) {
        const key = document.createElement('div');
        key.className = 'piano-key';
        key.dataset.keyIndex = i;

        // Add black key above where music theory says so
        const patternPos = i % 7;
        if (blackPattern[patternPos]) {
            const bk = document.createElement('div');
            bk.className = 'piano-black-key';
            key.appendChild(bk);
        }

        container.appendChild(key);
    }
}

/**
 * Highlights the piano key that corresponds to the current melody note.
 * Each note maps to an approximate key position.
 */
function lightKey(noteIndex) {
    const keys = document.querySelectorAll('.piano-key');
    keys.forEach(k => k.classList.remove('lit'));

    // Map melody notes to approximate key positions on our 32-key strip
    const keyMap = [4, 6, 8, 4, 8, 9, 11, 8, 11, 18];
    const idx = keyMap[noteIndex] || 0;
    if (keys[idx]) {
        keys[idx].classList.add('lit');
        setTimeout(() => keys[idx].classList.remove('lit'), 600);
    }
}

// ─── NAVIGATION ──────────────────────────────────────────────
function nextStep() {
    // Don't advance past form, and don't advance if quiz on slide 8 is incomplete
    if (currentStep === 8 && !isQuizComplete()) {
        shakeQuiz();
        return;
    }
    if (currentStep >= TOTAL_STEPS - 1) return;

    // Init & play audio
    initAudio();
    playNote(currentStep);

    // Piano press animation
    const piano = document.querySelector('.piano-shape');
    if (piano) {
        piano.classList.remove('pressed');
        void piano.offsetWidth;
        piano.classList.add('pressed');
        setTimeout(() => piano.classList.remove('pressed'), 350);
    }

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
    if (next) next.classList.add('active');

    updateDots();

    // Trigger stats animation on slide 3
    if (currentStep === 3 && !statsAnimated) {
        setTimeout(animateStats, 400);
        statsAnimated = true;
    }

    // Set personalised form title from quiz (slide 9)
    if (currentStep === 9) {
        personaliseForm();
    }
}

function goToStep(index) {
    if (index === currentStep || index < 0 || index >= TOTAL_STEPS) return;
    const cur = document.getElementById(`step-${currentStep}`);
    if (cur) { cur.classList.remove('active'); cur.classList.add('out'); setTimeout(() => cur.classList.remove('out'), 800); }
    currentStep = index;
    const next = document.getElementById(`step-${currentStep}`);
    if (next) next.classList.add('active');
    updateDots();
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

// ─── FORM SUBMIT ──────────────────────────────────────────────
function submitForm(event) {
    event.preventDefault();
    initAudio();
    
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
(function initSwipe() {
    let startY = 0;
    const pianoCol = document.getElementById('pianoColumn');

    document.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const endY = e.changedTouches[0].clientY;
        const deltaY = startY - endY;
        // Swipe UP = next slide (threshold: 50px)
        if (deltaY > 50 && currentStep < TOTAL_STEPS - 1) {
            // Don't advance if tap was on the piano column (handled by onclick)
            nextStep();
        }
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
});
