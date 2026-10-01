/* ============================================================
   SYMPHONY OF TOUCH — JavaScript
   Acıbadem International · Breast Cancer Awareness Month
   ============================================================ */

'use strict';

// ─── STATE ───────────────────────────────────────────────────
let currentStep = 0;
const TOTAL_STEPS = 10; // steps 0-9
let soundEnabled = true;
let audioCtx = null;
let quizAnswers = { 1: null, 2: null, 3: null };
let quizScore = 0;
let statsAnimated = false;

// ─── AMBIENT PIANO SCALE FOR SLIDES ───────────────
// A magical, escalating C-Major arpeggio to build anticipation on clicks
const AMBIENT_SCALE = [
    { freq: 130.81, name: 'C3' },
    { freq: 164.81, name: 'E3' },
    { freq: 196.00, name: 'G3' },
    { freq: 261.63, name: 'C4' },
    { freq: 329.63, name: 'E4' },
    { freq: 392.00, name: 'G4' },
    { freq: 523.25, name: 'C5' },
    { freq: 659.25, name: 'E5' },
    { freq: 783.99, name: 'G5' }
];

// ─── LA VIE EN ROSE FULL CHORUS (FINALE) ───────────────
// "Quand il me prend dans ses bras, il me parle tout bas..."
const LA_VIE_EN_ROSE_FINALE = [
    { note: 392.00, time: 0 },    // Quand (G4)
    { note: 392.00, time: 300 },  // il (G4)
    { note: 329.63, time: 600 },  // me (E4)
    { note: 261.63, time: 900 },  // prend (C4)
    { note: 220.00, time: 1200 }, // dans ses bras (A3)

    { note: 220.00, time: 2200 }, // Il (A3)
    { note: 220.00, time: 2500 }, // me (A3)
    { note: 261.63, time: 2800 }, // parle (C4)
    { note: 246.94, time: 3100 }, // tout (B3)
    { note: 196.00, time: 3400 }, // bas (G3)

    { note: 196.00, time: 4400 }, // Je (G3)
    { note: 220.00, time: 4700 }, // vois (A3)
    { note: 261.63, time: 5000 }, // la (C4)
    { note: 329.63, time: 5300 }, // vie (E4)
    { note: 293.66, time: 5600 }, // en (D4)
    { note: 261.63, time: 5900 }, // ro- (C4)
    { note: 293.66, time: 6200 }, // -se (D4)

    // Resolve with Cmaj7 chord arpeggio
    { note: 261.63, time: 7000 }, // C4
    { note: 329.63, time: 7050 }, // E4
    { note: 392.00, time: 7100 }, // G4
    { note: 493.88, time: 7150 }  // B4
];

// ─── AUDIO ───────────────────────────────────────────────────
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

/**
 * Plays a polyphonic piano-like note.
 * Previous notes are NOT cut — they decay naturally (sustain effect).
 */
function playNote(noteIndex, overrideFreq = null) {
    if (!soundEnabled) return;
    if (!audioCtx) return;

    const note = overrideFreq ? { freq: overrideFreq, name: 'ChordNote' } : (AMBIENT_SCALE[noteIndex] || AMBIENT_SCALE[AMBIENT_SCALE.length - 1]);

    // Master gain (shared output)
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.38, audioCtx.currentTime + 0.03); // sharp attack
    masterGain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.4); // quick decay
    masterGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.2); // long release
    masterGain.connect(audioCtx.destination);

    // Fundamental (triangle — piano-like)
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = note.freq;
    osc1.connect(masterGain);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 2.2);

    // 2nd harmonic (sine at 2× for warmth)
    const osc2 = audioCtx.createOscillator();
    const harmGain = audioCtx.createGain();
    harmGain.gain.value = 0.12;
    osc2.type = 'sine';
    osc2.frequency.value = note.freq * 2;
    osc2.connect(harmGain);
    harmGain.connect(masterGain);
    osc2.start(audioCtx.currentTime);
    osc2.stop(audioCtx.currentTime + 1.0);

    // Light the corresponding piano key
    if (noteIndex !== null) lightKey(noteIndex);
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
    
    // Play the full iconic La Vie En Rose chorus in tempo!
    LA_VIE_EN_ROSE_FINALE.forEach(item => {
        setTimeout(() => playNote(null, item.note), item.time);
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
