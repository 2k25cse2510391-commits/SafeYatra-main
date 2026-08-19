/**
 * SafeYatra AI - 1-KM Proximity SOS Emergency Broadcast System
 * 
 * Features:
 * 1. Broadcasts SOS alerts with live GPS, Name & Phone to Firebase Firestore.
 * 2. Real-time Proximity Listener with Haversine distance calculation (1 km radius).
 * 3. Permanent Unique Broadcast ID Blacklisting on Helper "Accept" or "Reject".
 * 4. DND (Do Not Disturb) mode support to suppress all incoming alerts.
 * 5. Direct Google Maps Navigation & Telephone Calling integration.
 * 6. Audio synthesizer & haptic vibration alarm engine.
 * 7. Built-in Proximity Simulator for effortless testing and demonstrations.
 */

const SafeYatraSOSBroadcast = {
    STORAGE_KEYS: {
        BLACKLIST: 'safeyatra_sos_blacklist_v1',
        DND: 'safeyatra_sos_dnd',
        ACTIVE_BROADCAST_ID: 'safeyatra_active_sos_id'
    },

    activeModalAlertId: null,
    audioCtx: null,
    alarmInterval: null,
    unsubscribeListener: null,

    // ==========================================
    // 1. DND (Do Not Disturb) State Management
    // ==========================================
    isDNDEnabled: function () {
        return localStorage.getItem(this.STORAGE_KEYS.DND) === 'true';
    },

    setDND: function (enabled) {
        localStorage.setItem(this.STORAGE_KEYS.DND, enabled ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('safeyatra-dnd-changed', { detail: { dnd: enabled } }));
        this.updateDNDIndicator();
    },

    toggleDND: function () {
        const nextState = !this.isDNDEnabled();
        this.setDND(nextState);
        return nextState;
    },

    updateDNDIndicator: function () {
        const isDND = this.isDNDEnabled();
        let indicator = document.getElementById('dndGlobalToast');

        if (isDND) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'dndGlobalToast';
                indicator.className = 'dnd-status-toast';
                indicator.innerHTML = '<i class="fa-solid fa-bell-slash"></i> DND Active';
                document.body.appendChild(indicator);
            }
            indicator.style.display = 'flex';
        } else if (indicator) {
            indicator.style.display = 'none';
        }
    },

    // ==========================================
    // 2. Database-Backed 1-Hour Blacklist Engine
    // (Stores in Firestore Collection 'sos_blacklists')
    // ==========================================
    databaseBlacklistCache: {},

    getLocalBlacklistBackup: function () {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEYS.BLACKLIST);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    },

    saveLocalBlacklistBackup: function (blacklistObj) {
        try {
            localStorage.setItem(this.STORAGE_KEYS.BLACKLIST, JSON.stringify(blacklistObj));
        } catch (e) { }
    },

    syncBlacklistFromDatabase: function () {
        // Initialize from local backup first for instant readiness
        this.databaseBlacklistCache = { ...this.getLocalBlacklistBackup() };

        const db = (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getFirestore) ? SafeYatraDB.getFirestore() : null;
        const helperMobile = (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getLoggedInMobile()) ? SafeYatraDB.getLoggedInMobile().replace(/\s+/g, '') : "";

        if (db && helperMobile) {
            try {
                // Real-time synchronization from Firestore Database
                db.collection('sos_blacklists')
                    .where('helperMobile', '==', helperMobile)
                    .onSnapshot((snapshot) => {
                        snapshot.forEach((doc) => {
                            const data = doc.data();
                            if (data && data.broadcastId) {
                                this.databaseBlacklistCache[data.broadcastId] = data;
                            }
                        });
                        this.saveLocalBlacklistBackup(this.databaseBlacklistCache);
                    }, (err) => {
                        console.warn("Database Blacklist sync notice:", err.message);
                    });
            } catch (err) {
                console.warn("Could not start Firestore Blacklist sync:", err);
            }
        }
    },

    blacklistAlertInDatabase: async function (broadcastId, actionType = 'REJECTED') {
        if (!broadcastId) return;

        const db = (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getFirestore) ? SafeYatraDB.getFirestore() : null;
        const helperMobile = (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getLoggedInMobile()) ? SafeYatraDB.getLoggedInMobile().replace(/\s+/g, '') : "guest_helper";
        const currentTime = Date.now();

        const blacklistRecord = {
            broadcastId: broadcastId,
            helperMobile: helperMobile,
            action: actionType, // 'REJECTED' or 'ACCEPTED'
            rejectedAt: new Date().toISOString(),
            rejectedTimestamp: currentTime, // Current time when rejected in DB
            permanent: true,
            updatedAt: new Date().toISOString()
        };

        // 1. Update In-Memory cache & Local backup
        this.databaseBlacklistCache[broadcastId] = blacklistRecord;
        this.saveLocalBlacklistBackup(this.databaseBlacklistCache);

        // 2. Persist to Firestore Database Collection 'sos_blacklists' permanently
        if (db) {
            try {
                const docId = `${helperMobile}_${broadcastId}`;
                await db.collection('sos_blacklists').doc(docId).set(blacklistRecord, { merge: true });
                console.log(`[Database Blacklist] Saved Alert [${broadcastId}] PERMANENTLY for helper [${helperMobile}]`);
            } catch (err) {
                console.error("Database Blacklist Write Error:", err);
            }
        }
    },

    isAlertBlacklisted: function (broadcastId) {
        if (!broadcastId) return false;

        const helperMobile = (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getLoggedInMobile()) ? SafeYatraDB.getLoggedInMobile().replace(/\s+/g, '') : "guest_helper";
        const entry = this.databaseBlacklistCache[broadcastId] || this.getLocalBlacklistBackup()[broadcastId];

        // If the broadcast ID exists in the blacklist, reject forever
        if (entry) {
            console.log(`[Database Blacklist Check] Alert [${broadcastId}] is PERMANENTLY blacklisted in Database for helper [${helperMobile}]. Ignoring alert.`);
            return true; // BLACKLISTED FOREVER - DO NOT SHOW
        }

        return false; // Not blacklisted
    },

    // ==========================================
    // 3. Haversine Distance Calculation (1 KM Radius)
    // ==========================================
    calculateDistanceMeters: function (lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    },

    formatDistance: function (meters) {
        if (meters < 1000) {
            return `${Math.round(meters)} meters away`;
        }
        return `${(meters / 1000).toFixed(2)} km away`;
    },

    // ==========================================
    // 4. Publish SOS to Firestore Database
    // ==========================================
    publishSOS: async function (userProfile, coords) {
        const db = (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getFirestore) ? SafeYatraDB.getFirestore() : null;
        const mobile = (userProfile?.mobile || SafeYatraDB?.getLoggedInMobile() || "Anonymous").replace(/\s+/g, '');
        const name = (userProfile?.name && userProfile.name.trim()) ? userProfile.name.trim() : "Traveler in Distress";
        const emergencyContact = userProfile?.emergencyContact || "1234567890";
        const bloodGroup = userProfile?.bloodGroup || "O+";

        const broadcastId = `sos_${mobile}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const lat = parseFloat(coords.latitude || coords.lat || 28.613939);
        const lng = parseFloat(coords.longitude || coords.lng || 77.209021);

        const alertData = {
            id: broadcastId,
            senderMobile: mobile,
            userName: name,
            userPhone: mobile !== "Anonymous" ? mobile : emergencyContact,
            emergencyContact: emergencyContact,
            bloodGroup: bloodGroup,
            latitude: lat,
            longitude: lng,
            status: 'ACTIVE',
            timestamp: new Date().toISOString(),
            createdAt: firebase?.firestore?.FieldValue?.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
        };

        // Save active broadcast ID locally
        localStorage.setItem(this.STORAGE_KEYS.ACTIVE_BROADCAST_ID, broadcastId);

        if (db) {
            try {
                await db.collection('emergency_broadcasts').doc(broadcastId).set(alertData);
                console.log("Real-time Emergency SOS Broadcast published successfully:", broadcastId);
            } catch (err) {
                console.error("Firestore SOS Broadcast Error:", err);
            }
        }

        // Also broadcast via BroadcastChannel for instant local multi-tab sync
        if ('BroadcastChannel' in window) {
            try {
                const bc = new BroadcastChannel('safeyatra_sos_channel');
                bc.postMessage({ type: 'NEW_SOS_ALERT', data: alertData });
            } catch (e) { }
        }

        return broadcastId;
    },

    // ==========================================
    // 5. Cancel / Resolve Active SOS Broadcast
    // ==========================================
    resolveSOS: async function (broadcastId) {
        const targetId = broadcastId || localStorage.getItem(this.STORAGE_KEYS.ACTIVE_BROADCAST_ID);
        if (!targetId) return;

        const db = (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getFirestore) ? SafeYatraDB.getFirestore() : null;
        if (db) {
            try {
                await db.collection('emergency_broadcasts').doc(targetId).update({
                    status: 'RESOLVED',
                    resolvedAt: new Date().toISOString()
                });
                console.log("Emergency SOS Broadcast marked as RESOLVED:", targetId);
            } catch (err) {
                console.warn("Error resolving SOS broadcast:", err.message);
            }
        }

        localStorage.removeItem(this.STORAGE_KEYS.ACTIVE_BROADCAST_ID);

        if ('BroadcastChannel' in window) {
            try {
                const bc = new BroadcastChannel('safeyatra_sos_channel');
                bc.postMessage({ type: 'RESOLVE_SOS_ALERT', alertId: targetId });
            } catch (e) { }
        }
    },

    // ==========================================
    // 6. Sound & Vibration Alarm Effects
    // ==========================================
    startAlarmSound: function () {
        try {
            if (!this.audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContext();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            if (this.alarmInterval) return;

            const playChime = () => {
                if (!this.audioCtx) return;
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5
                osc.frequency.exponentialRampToValueAtTime(440, this.audioCtx.currentTime + 0.4); // A4
                gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.45);
            };

            playChime();
            this.alarmInterval = setInterval(playChime, 1800);

            // Haptic vibration pattern
            if (navigator.vibrate) {
                navigator.vibrate([300, 200, 300, 200, 500]);
            }
        } catch (e) {
            console.warn("Audio alarm notice:", e.message);
        }
    },

    stopAlarmSound: function () {
        if (this.alarmInterval) {
            clearInterval(this.alarmInterval);
            this.alarmInterval = null;
        }
    },

    // ==========================================
    // 7. Inject & Render Proximity SOS Modal
    // ==========================================
    createModalDOM: function () {
        if (document.getElementById('proximitySosModalOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'proximitySosModalOverlay';
        overlay.className = 'proximity-sos-overlay';

        overlay.innerHTML = `
            <div class="proximity-sos-card" role="dialog" aria-labelledby="proximityModalTitle">
                <!-- Header -->
                <div class="proximity-sos-header">
                    <div class="proximity-sos-header-left">
                        <div class="proximity-beacon-icon">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <div>
                            <h3 id="proximityModalTitle">EMERGENCY SOS NEARBY</h3>
                            <p>Tourist In Distress Within 1 KM Radius</p>
                        </div>
                    </div>
                    <button id="proximityModalCloseX" class="proximity-sos-close-btn" title="Close alert">&times;</button>
                </div>

                <!-- Body -->
                <div class="proximity-sos-body">
                    <!-- Distance Badge -->
                    <div class="proximity-distance-pill" id="proximityDistancePill">
                        <i class="fa-solid fa-person-walking"></i>
                        <span id="proximityDistanceText">Calculating Distance...</span>
                    </div>

                    <!-- Endangered Person Details -->
                    <div class="victim-info-box">
                        <div class="victim-info-row">
                            <div class="victim-avatar-circle">
                                <i class="fa-solid fa-user-shield"></i>
                            </div>
                            <div class="victim-text-details">
                                <span class="victim-label-tag">Endangered Person</span>
                                <h4 class="victim-name-text" id="proximityVictimName">Loading...</h4>
                                <div class="victim-phone-text">
                                    <i class="fa-solid fa-phone"></i>
                                    <span id="proximityVictimPhone">Loading...</span>
                                </div>
                            </div>
                        </div>
                        <div class="victim-meta-row">
                            <div class="victim-meta-item">
                                <i class="fa-solid fa-droplet" style="color:#F87171;"></i>
                                <span>Blood Group: <strong id="proximityVictimBlood">O+</strong></span>
                            </div>
                            <div class="victim-meta-item">
                                <i class="fa-solid fa-clock"></i>
                                <span id="proximityVictimTime">Just now</span>
                            </div>
                        </div>
                    </div>

                    <!-- Main Action Buttons -->
                    <div class="proximity-sos-actions">
                        <!-- Direct Call Button -->
                        <a id="proximityCallBtn" href="tel:" class="btn-sos-action btn-sos-call">
                            <i class="fa-solid fa-phone-volume"></i>
                            <span>Call Endangered Person</span>
                        </a>

                        <!-- Google Maps Navigation Button -->
                        <a id="proximityMapsBtn" href="https://maps.google.com" target="_blank" rel="noopener noreferrer" class="btn-sos-action btn-sos-maps">
                            <i class="fa-solid fa-location-arrow"></i>
                            <span>Open in Google Maps Navigation</span>
                        </a>

                        <!-- Accept / Reject Split Controls (1-Hour Blacklist Action) -->
                        <div class="proximity-action-split-row">
                            <button id="proximityAcceptBtn" class="btn-sos-accept">
                                <i class="fa-solid fa-circle-check"></i> Accept & Help
                            </button>
                            <button id="proximityRejectBtn" class="btn-sos-reject">
                                <i class="fa-solid fa-circle-xmark"></i> Reject Alert
                            </button>
                        </div>
                        <p class="blacklist-note-text">Clicking Accept or Reject dismisses this emergency broadcast permanently.</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Bind Button Actions
        const closeX = document.getElementById('proximityModalCloseX');
        const acceptBtn = document.getElementById('proximityAcceptBtn');
        const rejectBtn = document.getElementById('proximityRejectBtn');

        const dismissWithDatabaseBlacklist = async (actionType = 'REJECTED') => {
            if (this.activeModalAlertId) {
                await this.blacklistAlertInDatabase(this.activeModalAlertId, actionType);
            }
            this.hideNearbyEmergencyModal();
        };

        if (closeX) closeX.addEventListener('click', () => dismissWithDatabaseBlacklist('REJECTED'));
        if (rejectBtn) rejectBtn.addEventListener('click', () => dismissWithDatabaseBlacklist('REJECTED'));
        if (acceptBtn) {
            acceptBtn.addEventListener('click', async () => {
                if (this.activeModalAlertId) {
                    await this.blacklistAlertInDatabase(this.activeModalAlertId, 'ACCEPTED');
                }
                this.hideNearbyEmergencyModal();
                // If on mobile, helper can proceed with direct call or maps
                const phone = document.getElementById('proximityVictimPhone')?.textContent;
                if (phone && phone !== "Loading...") {
                    window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
                }
            });
        }
    },

    showNearbyEmergencyModal: function (alertData, distanceMeters) {
        this.createModalDOM();
        this.activeModalAlertId = alertData.id;

        const overlay = document.getElementById('proximitySosModalOverlay');
        const nameEl = document.getElementById('proximityVictimName');
        const phoneEl = document.getElementById('proximityVictimPhone');
        const bloodEl = document.getElementById('proximityVictimBlood');
        const timeEl = document.getElementById('proximityVictimTime');
        const distanceEl = document.getElementById('proximityDistanceText');
        const callBtn = document.getElementById('proximityCallBtn');
        const mapsBtn = document.getElementById('proximityMapsBtn');

        const victimName = alertData.userName || "Endangered Tourist";
        const victimPhone = alertData.userPhone || alertData.emergencyContact || "1234567890";
        const lat = alertData.latitude;
        const lng = alertData.longitude;

        if (nameEl) nameEl.textContent = victimName;
        if (phoneEl) phoneEl.textContent = victimPhone;
        if (bloodEl) bloodEl.textContent = alertData.bloodGroup || "O+";
        if (timeEl) timeEl.textContent = "Within 1 KM Radius";
        if (distanceEl) distanceEl.textContent = this.formatDistance(distanceMeters);

        // Configure Direct Call Link
        if (callBtn) {
            callBtn.href = `tel:${victimPhone.replace(/\s+/g, '')}`;
        }

        // Configure Google Maps Turn-by-Turn Navigation URL
        if (mapsBtn) {
            mapsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        }

        // Show Modal and play Alarm
        if (overlay) {
            overlay.classList.add('active');
        }

        this.startAlarmSound();
    },

    hideNearbyEmergencyModal: function () {
        const overlay = document.getElementById('proximitySosModalOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        this.stopAlarmSound();
        this.activeModalAlertId = null;
    },

    // ==========================================
    // 8. Real-time Emergency Listener Core Engine
    // ==========================================
    initEmergencyListener: function () {
        this.syncBlacklistFromDatabase();
        this.updateDNDIndicator();

        const db = (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getFirestore) ? SafeYatraDB.getFirestore() : null;
        const currentMobile = (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getLoggedInMobile()) ? SafeYatraDB.getLoggedInMobile().replace(/\s+/g, '') : "";

        // Helper coordinates cache
        let helperLat = 28.613939;
        let helperLng = 77.209021;

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    helperLat = pos.coords.latitude;
                    helperLng = pos.coords.longitude;
                },
                () => { },
                { enableHighAccuracy: true, timeout: 6000 }
            );

            navigator.geolocation.watchPosition(
                (pos) => {
                    helperLat = pos.coords.latitude;
                    helperLng = pos.coords.longitude;
                },
                () => { },
                { enableHighAccuracy: true, maximumAge: 10000 }
            );
        }

        // Handler for evaluating incoming broadcast
        const handleIncomingAlert = (alertData) => {
            if (!alertData || alertData.status !== 'ACTIVE') {
                if (this.activeModalAlertId && alertData && alertData.id === this.activeModalAlertId) {
                    this.hideNearbyEmergencyModal();
                }
                return;
            }

            // 1. Check DND Mode: If DND is enabled, suppress all alerts
            if (this.isDNDEnabled()) {
                console.log("SOS Broadcast suppressed: DND Mode is Active.");
                return;
            }

            // 2. Sender check: Do NOT alert the endangered person on their own device
            if (currentMobile && alertData.senderMobile && alertData.senderMobile.replace(/\s+/g, '') === currentMobile) {
                return;
            }

            // 3. 1-Hour Blacklist check: If helper already accepted/rejected this alert ID, suppress
            if (this.isAlertBlacklisted(alertData.id)) {
                console.log(`SOS Broadcast [${alertData.id}] skipped (Blacklisted for 1hr).`);
                return;
            }

            // 4. Calculate Haversine Distance
            const victimLat = parseFloat(alertData.latitude);
            const victimLng = parseFloat(alertData.longitude);
            const distance = this.calculateDistanceMeters(helperLat, helperLng, victimLat, victimLng);

            console.log(`SOS Alert from ${alertData.userName}. Distance to Helper: ${Math.round(distance)}m`);

            // 5. Proximity Threshold: <= 1000 meters (1 KM)
            if (distance <= 1000) {
                this.showNearbyEmergencyModal(alertData, distance);
            } else {
                console.log(`SOS Alert outside 1 KM radius (${(distance / 1000).toFixed(2)} km). Ignoring.`);
            }
        };

        // Listen via Firestore onSnapshot
        if (db) {
            try {
                this.unsubscribeListener = db.collection('emergency_broadcasts')
                    .where('status', '==', 'ACTIVE')
                    .onSnapshot((snapshot) => {
                        snapshot.docChanges().forEach((change) => {
                            if (change.type === 'added' || change.type === 'modified') {
                                const data = change.doc.data();
                                handleIncomingAlert({ id: change.doc.id, ...data });
                            } else if (change.type === 'removed') {
                                if (this.activeModalAlertId === change.doc.id) {
                                    this.hideNearbyEmergencyModal();
                                }
                            }
                        });
                    }, (err) => {
                        console.warn("Firestore Real-time Listener note:", err.message);
                    });
            } catch (err) {
                console.warn("Could not start Firestore SOS listener:", err);
            }
        }

        // Listen via BroadcastChannel for multi-tab testing
        if ('BroadcastChannel' in window) {
            try {
                const bc = new BroadcastChannel('safeyatra_sos_channel');
                bc.onmessage = (event) => {
                    if (event.data && event.data.type === 'NEW_SOS_ALERT') {
                        handleIncomingAlert(event.data.data);
                    } else if (event.data && event.data.type === 'RESOLVE_SOS_ALERT') {
                        if (this.activeModalAlertId === event.data.alertId) {
                            this.hideNearbyEmergencyModal();
                        }
                    }
                };
            } catch (e) { }
        }
    },

    // ==========================================
    // 9. Interactive Simulator for Demo & Testing
    // ==========================================
    simulateNearbySOS: function (distanceMeters = 350, customName = "Priya Verma", customPhone = "+91 9876543210") {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const helperLat = pos.coords.latitude;
                    const helperLng = pos.coords.longitude;

                    // Offset coordinates approximately by distanceMeters (1 deg lat ~= 111,320 meters)
                    const offsetLat = distanceMeters / 111320;
                    const victimLat = helperLat + offsetLat;
                    const victimLng = helperLng;

                    const mockAlert = {
                        id: `sim_sos_${Date.now()}`,
                        userName: customName,
                        userPhone: customPhone,
                        bloodGroup: 'B+',
                        latitude: victimLat,
                        longitude: victimLng,
                        status: 'ACTIVE',
                        senderMobile: 'SIMULATED_SENDER_000',
                        timestamp: new Date().toISOString()
                    };

                    this.showNearbyEmergencyModal(mockAlert, distanceMeters);
                },
                () => {
                    // Fallback simulation
                    const mockAlert = {
                        id: `sim_sos_${Date.now()}`,
                        userName: customName,
                        userPhone: customPhone,
                        bloodGroup: 'B+',
                        latitude: 28.6142,
                        longitude: 77.2095,
                        status: 'ACTIVE',
                        senderMobile: 'SIMULATED_SENDER_000',
                        timestamp: new Date().toISOString()
                    };
                    this.showNearbyEmergencyModal(mockAlert, distanceMeters);
                },
                { timeout: 4000 }
            );
        }
    }
};

// Global Initialization
window.SafeYatraSOSBroadcast = SafeYatraSOSBroadcast;

document.addEventListener('DOMContentLoaded', () => {
    // Start listening on all pages
    SafeYatraSOSBroadcast.initEmergencyListener();
});
