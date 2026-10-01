// Audio Context (Initialize on first user interaction)
let audioCtx = null;

// La Vie En Rose initial notes frequencies (approximate)
// C4 (Do), D4 (Re), E4 (Mi), G4 (Sol)
const NOTES = [261.63, 293.66, 329.63, 392.00];

let currentStep = 0;
const totalSteps = 4; // 0, 1, 2, 3

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playNote(stepIndex) {
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // Triangle wave sounds slightly more like a piano/soft synth than a harsh square/sawtooth
    osc.type = 'triangle';
    
    // Pick frequency based on step (loop if more steps than notes)
    osc.frequency.value = NOTES[stepIndex % NOTES.length];
    
    // Envelope for a gentle tap sound
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05); // attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5); // decay
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 1.5);
}

function generateKeys() {
    const keysContainer = document.getElementById('piano-keys');
    const numberOfWhiteKeys = 35; // Enough to fill the height
    
    // Standard piano pattern for black keys (2, 3, 2, 3...)
    const hasBlackKey = (index) => {
        const pattern = [1, 1, 0, 1, 1, 1, 0];
        return pattern[index % 7] === 1;
    };

    for (let i = 0; i < numberOfWhiteKeys; i++) {
        const key = document.createElement('div');
        key.className = 'piano-key';
        
        if (hasBlackKey(i)) {
            const blackKey = document.createElement('div');
            blackKey.className = 'black-key';
            key.appendChild(blackKey);
        }
        
        keysContainer.appendChild(key);
    }
}

function nextStep() {
    if (currentStep >= totalSteps - 1) return; // Don't proceed past form

    // Initialize audio on first tap (browser autoplay policy)
    initAudio();
    
    // Play the assigned note
    playNote(currentStep);

    // Visual piano press feedback
    const pianoShape = document.querySelector('.piano-shape');
    pianoShape.classList.add('tapped');
    setTimeout(() => pianoShape.classList.remove('tapped'), 150);

    // Light up random keys for visual effect
    const keys = document.querySelectorAll('.piano-key');
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    randomKey.classList.add('active-key');
    setTimeout(() => randomKey.classList.remove('active-key'), 200);

    // Handle Slide Transitions
    const currentSlide = document.getElementById(`step-${currentStep}`);
    currentSlide.classList.remove('active');
    currentSlide.classList.add('out');
    
    currentStep++;
    
    const nextSlide = document.getElementById(`step-${currentStep}`);
    nextSlide.classList.add('active');
}

function submitForm(event) {
    event.preventDefault(); // Prevent page reload
    
    // Play final chord/note
    initAudio();
    playNote(3);
    playNote(0); // Play two notes together for a success sound
    
    const form = document.getElementById('leadForm');
    const successMsg = document.getElementById('successMessage');
    
    form.style.display = 'none';
    successMsg.classList.remove('hidden');
}

// Initialize piano keys on load
document.addEventListener('DOMContentLoaded', generateKeys);
