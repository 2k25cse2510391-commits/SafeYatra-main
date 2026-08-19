/**
 * SafeYatra AI - Emergency & SOS Hub Script
 * Primary Emergency Contact: +91 1234567890 (Default / Dynamic from logged-in user)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Guard: Enforce Login
    if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.requireAuth) {
        SafeYatraDB.requireAuth();
    }

    // Primary Emergency Contact Config (Default 1234567890)
    let EMERGENCY_CONTACT = "1234567890";

    if (typeof SafeYatraDB !== 'undefined') {
        const userProfile = await SafeYatraDB.getUserProfile();
        if (userProfile && userProfile.emergencyContact) {
            EMERGENCY_CONTACT = userProfile.emergencyContact;
        }
    }

    // State
    let currentLat = null;
    let currentLng = null;
    let locationWatchId = null;
    let holdTimer = null;
    let holdProgressInterval = null;
    let holdStartTime = 0;
    const HOLD_DURATION = 3000; // 3 seconds
    let isSirenPlaying = false;
    let audioCtx = null;
    let sirenOsc = null;
    let sirenGain = null;
    let sirenModInterval = null;
    let countdownInterval = null;

    // DOM Elements
    const sosBtn = document.getElementById('sosBtn');
    const progressCircle = document.getElementById('progressCircle');
    const timerText = document.getElementById('timerText');
    const locationStatusEl = document.getElementById('locationStatus');
    const coordsTextEl = document.getElementById('coordsText');
    const smsPrimaryBtn = document.getElementById('smsPrimaryBtn');
    const callPrimaryBtn = document.getElementById('callPrimaryBtn');

    // Modals & Panels
    const sosModal = document.getElementById('sosModal');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalSmsBtn = document.getElementById('modalSmsBtn');
    const modalCallBtn = document.getElementById('modalCallBtn');
    const modalCountdownEl = document.getElementById('modalCountdown');

    const sirenToggleBtn = document.getElementById('sirenToggleBtn');
    const sirenStatusText = document.getElementById('sirenStatusText');

    const fakeCallBtn = document.getElementById('fakeCallBtn');
    const fakeCallModal = document.getElementById('fakeCallModal');
    const fakeCallDecline = document.getElementById('fakeCallDecline');
    const fakeCallAccept = document.getElementById('fakeCallAccept');
    const fakeCallEnd = document.getElementById('fakeCallEnd');
    const fakeCallActiveScreen = document.getElementById('fakeCallActiveScreen');
    const fakeCallIncomingScreen = document.getElementById('fakeCallIncomingScreen');
    const fakeCallTimerEl = document.getElementById('fakeCallTimer');

    const shareLocBtn = document.getElementById('shareLocBtn');
    const medicalIdBtn = document.getElementById('medicalIdBtn');
    const medicalIdModal = document.getElementById('medicalIdModal');
    const closeMedicalModal = document.getElementById('closeMedicalModal');
    const toastEl = document.getElementById('toast');

    // 1. Initialize Geolocation
    initGeolocation();

    function initGeolocation() {
        if ('geolocation' in navigator) {
            locationWatchId = navigator.geolocation.watchPosition(
                (position) => {
                    currentLat = position.coords.latitude.toFixed(6);
                    currentLng = position.coords.longitude.toFixed(6);
                    const accuracy = Math.round(position.coords.accuracy);

                    if (locationStatusEl) locationStatusEl.textContent = `GPS Active (±${accuracy}m accuracy)`;
                    if (coordsTextEl) coordsTextEl.textContent = `${currentLat}, ${currentLng}`;

                    updateSmsLinks();
                },
                (error) => {
                    console.warn("Geolocation warning/error:", error.message);
                    // Fallback default coordinates (New Delhi)
                    currentLat = "28.613939";
                    currentLng = "77.209021";
                    if (locationStatusEl) locationStatusEl.textContent = "Location estimated";
                    if (coordsTextEl) coordsTextEl.textContent = `${currentLat}, ${currentLng} (Approx)`;
                    updateSmsLinks();
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 5000
                }
            );
        } else {
            if (locationStatusEl) locationStatusEl.textContent = "GPS Not Supported";
            currentLat = "28.613939";
            currentLng = "77.209021";
            updateSmsLinks();
        }
    }

    function getMapsUrl() {
        if (currentLat && currentLng) {
            return `https://maps.google.com/?q=${currentLat},${currentLng}`;
        }
        return `https://maps.google.com`;
    }

    function getSmsMessage() {
        const mapsUrl = getMapsUrl();
        return `EMERGENCY! I need immediate help. My live location: ${mapsUrl} (Sent via TravelSathi Emergency Hub)`;
    }

    function updateSmsLinks() {
        const smsMessage = encodeURIComponent(getSmsMessage());
        const smsUrl = `sms:${EMERGENCY_CONTACT}?body=${smsMessage}`;

        if (smsPrimaryBtn) {
            smsPrimaryBtn.href = smsUrl;
        }
        if (modalSmsBtn) {
            modalSmsBtn.href = smsUrl;
        }
        if (callPrimaryBtn) {
            callPrimaryBtn.href = `tel:${EMERGENCY_CONTACT}`;
        }
        if (modalCallBtn) {
            modalCallBtn.href = `tel:${EMERGENCY_CONTACT}`;
        }

        const modalEmergencyContactText = document.getElementById('modalEmergencyContactText');
        if (modalEmergencyContactText) {
            modalEmergencyContactText.textContent = `+91 ${EMERGENCY_CONTACT}`;
        }
        const primaryContactNumberText = document.getElementById('primaryContactNumberText');
        if (primaryContactNumberText) {
            primaryContactNumberText.textContent = `+91 ${EMERGENCY_CONTACT}`;
        }
    }

    // 2. SOS Button Press and Hold Logic (3 seconds)
    const circumference = 2 * Math.PI * 88; // radius 88px SVG
    if (progressCircle) {
        progressCircle.style.strokeDasharray = `${circumference}`;
        progressCircle.style.strokeDashoffset = `${circumference}`;
    }

    function startHold(e) {
        e.preventDefault();
        holdStartTime = Date.now();

        if (navigator.vibrate) navigator.vibrate(50);

        if (sosBtn) sosBtn.classList.add('holding');

        holdProgressInterval = setInterval(() => {
            const elapsed = Date.now() - holdStartTime;
            const progress = Math.min(elapsed / HOLD_DURATION, 1);
            const offset = circumference - (progress * circumference);

            if (progressCircle) {
                progressCircle.style.strokeDashoffset = offset;
            }

            const secondsLeft = Math.ceil((HOLD_DURATION - elapsed) / 1000);
            if (timerText && secondsLeft > 0) {
                timerText.textContent = `${secondsLeft}s`;
            }

            if (progress >= 1) {
                clearHoldIntervals();
                triggerSOS();
            }
        }, 30);
    }

    function endHold() {
        clearHoldIntervals();
        resetHoldUI();
    }

    function clearHoldIntervals() {
        if (holdProgressInterval) {
            clearInterval(holdProgressInterval);
            holdProgressInterval = null;
        }
    }

    function resetHoldUI() {
        if (sosBtn) sosBtn.classList.remove('holding');
        if (progressCircle) progressCircle.style.strokeDashoffset = `${circumference}`;
        if (timerText) timerText.textContent = "HOLD 3S";
    }

    if (sosBtn) {
        sosBtn.addEventListener('mousedown', startHold);
        sosBtn.addEventListener('touchstart', startHold, { passive: false });

        sosBtn.addEventListener('mouseup', endHold);
        sosBtn.addEventListener('mouseleave', endHold);
        sosBtn.addEventListener('touchend', endHold);
        sosBtn.addEventListener('touchcancel', endHold);
    }

    // 3. Trigger Active SOS State & Broadcast to Database
    async function triggerSOS() {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);

        // Show Modal
        if (sosModal) sosModal.classList.add('active');

        // 3a. Publish Real-time 1-KM SOS Broadcast to Firebase Firestore
        if (typeof SafeYatraSOSBroadcast !== 'undefined' && SafeYatraSOSBroadcast.publishSOS) {
            try {
                const userProf = (typeof SafeYatraDB !== 'undefined') ? await SafeYatraDB.getUserProfile() : null;
                const broadcastId = await SafeYatraSOSBroadcast.publishSOS(userProf, {
                    latitude: currentLat || 28.613939,
                    longitude: currentLng || 77.209021
                });
                console.log("Active SOS Broadcast successfully dispatched to Firestore:", broadcastId);
            } catch (err) {
                console.warn("SOS Broadcast dispatch notice:", err.message);
            }
        }

        // Automatically start emergency siren
        startSiren();

        // Start 10 second countdown before auto-opening SMS link
        let count = 10;
        if (modalCountdownEl) modalCountdownEl.textContent = count;

        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            count--;
            if (modalCountdownEl) modalCountdownEl.textContent = count;

            if (count <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                // Auto trigger SMS link if user hasn't cancelled
                const smsMessage = encodeURIComponent(getSmsMessage());
                window.location.href = `sms:${EMERGENCY_CONTACT}?body=${smsMessage}`;
            }
        }, 1000);
    }

    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', async () => {
            if (sosModal) sosModal.classList.remove('active');
            stopSiren();

            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }

            // Resolve / Cancel active SOS broadcast in Firestore
            if (typeof SafeYatraSOSBroadcast !== 'undefined' && SafeYatraSOSBroadcast.resolveSOS) {
                await SafeYatraSOSBroadcast.resolveSOS();
            }

            showToast("Emergency Alert Cancelled");
        });
    }

    // 4. Web Audio Emergency Siren Synthesizer
    function startSiren() {
        try {
            if (!audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AudioContext();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            if (isSirenPlaying) return;

            sirenOsc = audioCtx.createOscillator();
            sirenGain = audioCtx.createGain();

            sirenOsc.type = 'sawtooth';
            sirenOsc.frequency.setValueAtTime(700, audioCtx.currentTime);

            sirenGain.gain.setValueAtTime(0.3, audioCtx.currentTime);

            sirenOsc.connect(sirenGain);
            sirenGain.connect(audioCtx.destination);

            sirenOsc.start();
            isSirenPlaying = true;

            let high = false;
            sirenModInterval = setInterval(() => {
                if (sirenOsc && audioCtx) {
                    high = !high;
                    const freq = high ? 1050 : 700;
                    sirenOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
                }
            }, 350);

            if (sirenToggleBtn) sirenToggleBtn.classList.add('active');
            if (sirenStatusText) sirenStatusText.textContent = "Siren ON";
            document.body.classList.add('siren-active');

        } catch (e) {
            console.error("Audio API error:", e);
        }
    }

    function stopSiren() {
        if (sirenModInterval) {
            clearInterval(sirenModInterval);
            sirenModInterval = null;
        }
        if (sirenOsc) {
            try {
                sirenOsc.stop();
                sirenOsc.disconnect();
            } catch (e) { }
            sirenOsc = null;
        }
        isSirenPlaying = false;
        if (sirenToggleBtn) sirenToggleBtn.classList.remove('active');
        if (sirenStatusText) sirenStatusText.textContent = "Emergency Siren";
        document.body.classList.remove('siren-active');
    }

    if (sirenToggleBtn) {
        sirenToggleBtn.addEventListener('click', () => {
            if (isSirenPlaying) {
                stopSiren();
                showToast("Siren Stopped");
            } else {
                startSiren();
                showToast("Emergency Siren Activated!");
            }
        });
    }

    // 5. Fake Call Generator Simulator
    let callTimerInterval = null;
    let callDurationSec = 0;

    if (fakeCallBtn) {
        fakeCallBtn.addEventListener('click', () => {
            if (fakeCallModal) fakeCallModal.classList.add('active');
            if (fakeCallIncomingScreen) fakeCallIncomingScreen.style.display = 'flex';
            if (fakeCallActiveScreen) fakeCallActiveScreen.style.display = 'none';

            // Start ringing sound effect
            playRingtone();
        });
    }

    let ringtoneInterval = null;

    function playRingtone() {
        try {
            if (!audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AudioContext();
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();

            ringtoneInterval = setInterval(() => {
                if (!fakeCallModal || !fakeCallModal.classList.contains('active')) return;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 1.2);
            }, 2500);
        } catch (e) { }
    }

    function stopRingtone() {
        if (ringtoneInterval) {
            clearInterval(ringtoneInterval);
            ringtoneInterval = null;
        }
    }

    function closeFakeCall() {
        stopRingtone();
        if (callTimerInterval) {
            clearInterval(callTimerInterval);
            callTimerInterval = null;
        }
        if (fakeCallModal) fakeCallModal.classList.remove('active');
    }

    if (fakeCallDecline) {
        fakeCallDecline.addEventListener('click', closeFakeCall);
    }
    if (fakeCallEnd) {
        fakeCallEnd.addEventListener('click', closeFakeCall);
    }

    if (fakeCallAccept) {
        fakeCallAccept.addEventListener('click', () => {
            stopRingtone();
            if (fakeCallIncomingScreen) fakeCallIncomingScreen.style.display = 'none';
            if (fakeCallActiveScreen) fakeCallActiveScreen.style.display = 'flex';

            callDurationSec = 0;
            if (fakeCallTimerEl) fakeCallTimerEl.textContent = "00:00";

            if (callTimerInterval) clearInterval(callTimerInterval);
            callTimerInterval = setInterval(() => {
                callDurationSec++;
                const mins = String(Math.floor(callDurationSec / 60)).padStart(2, '0');
                const secs = String(callDurationSec % 60).padStart(2, '0');
                if (fakeCallTimerEl) fakeCallTimerEl.textContent = `${mins}:${secs}`;
            }, 1000);
        });
    }

    // 6. Share Live Location
    if (shareLocBtn) {
        shareLocBtn.addEventListener('click', async () => {
            const url = getMapsUrl();
            const shareData = {
                title: 'TravelSathi - Live Location',
                text: `Here is my current live GPS location: ${url}`,
                url: url
            };

            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                    showToast("Location Shared!");
                } catch (e) {
                    copyLocationToClipboard(url);
                }
            } else {
                copyLocationToClipboard(url);
            }
        });
    }

    function copyLocationToClipboard(url) {
        navigator.clipboard.writeText(url).then(() => {
            showToast("Location link copied to clipboard!");
        }).catch(() => {
            showToast("Location: " + url);
        });
    }

    // 7. Medical ID Modal
    if (medicalIdBtn && medicalIdModal) {
        medicalIdBtn.addEventListener('click', () => {
            medicalIdModal.classList.add('active');
        });
    }
    if (closeMedicalModal && medicalIdModal) {
        closeMedicalModal.addEventListener('click', () => {
            medicalIdModal.classList.remove('active');
        });
    }

    // 8. DND (Do Not Disturb) Mode Controls
    const dndToggleCheckbox = document.getElementById('dndToggleCheckbox');
    const dndCard = document.getElementById('dndCard');
    const dndStatusSubtext = document.getElementById('dndStatusSubtext');

    if (typeof SafeYatraSOSBroadcast !== 'undefined') {
        const syncDndUI = () => {
            const isDnd = SafeYatraSOSBroadcast.isDNDEnabled();
            if (dndToggleCheckbox) dndToggleCheckbox.checked = isDnd;
            if (dndCard) {
                if (isDnd) dndCard.classList.add('active');
                else dndCard.classList.remove('active');
            }
            if (dndStatusSubtext) {
                dndStatusSubtext.textContent = isDnd
                    ? "Active: All incoming emergency broadcast popups are muted"
                    : "Mute all incoming proximity emergency broadcast alerts";
            }
        };

        syncDndUI();

        if (dndToggleCheckbox) {
            dndToggleCheckbox.addEventListener('change', (e) => {
                SafeYatraSOSBroadcast.setDND(e.target.checked);
                syncDndUI();
                showToast(e.target.checked ? "DND Mode Activated" : "DND Mode Deactivated");
            });
        }

        window.addEventListener('safeyatra-dnd-changed', () => {
            syncDndUI();
        });
    }

    // 9. Simulator Test Triggers
    const sim350mBtn = document.getElementById('btnSimulate350m');
    const sim800mBtn = document.getElementById('btnSimulate800m');
    const simFarBtn = document.getElementById('btnSimulateFar');

    if (sim350mBtn && typeof SafeYatraSOSBroadcast !== 'undefined') {
        sim350mBtn.addEventListener('click', () => {
            if (SafeYatraSOSBroadcast.isDNDEnabled()) {
                showToast("DND is ON: Alert suppressed (Turn DND off to see popup)");
            }
            SafeYatraSOSBroadcast.simulateNearbySOS(350, "Priya Sharma", "+91 9876543210");
        });
    }

    if (sim800mBtn && typeof SafeYatraSOSBroadcast !== 'undefined') {
        sim800mBtn.addEventListener('click', () => {
            if (SafeYatraSOSBroadcast.isDNDEnabled()) {
                showToast("DND is ON: Alert suppressed (Turn DND off to see popup)");
            }
            SafeYatraSOSBroadcast.simulateNearbySOS(800, "Rahul Deshmukh", "+91 9123456780");
        });
    }

    if (simFarBtn && typeof SafeYatraSOSBroadcast !== 'undefined') {
        simFarBtn.addEventListener('click', () => {
            showToast("Simulating alert 3.5 km away (>1 km)... Check console: Alert filtered out!");
            console.log("Simulator: Dispatching alert at 3500m. Expected behavior: Ignored (outside 1km radius).");
        });
    }

    // Toast helper
    function showToast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        setTimeout(() => {
            toastEl.classList.remove('show');
        }, 3000);
    }
});
