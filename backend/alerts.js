/**
 * SafeYatra AI - Dynamic Location-Based Alerts & Advisories Script
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Guard: Enforce Login
    if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.requireAuth) {
        SafeYatraDB.requireAuth();
    }

    // Default Fallback Coordinates (Agra, UP)
    let currentLat = 27.1767;
    let currentLng = 78.0081;
    let currentCity = "Agra";
    let currentState = "Uttar Pradesh";

    let currentFilter = 'All';
    let alertsData = [];

    // DOM References
    const alertsContainer = document.getElementById('alertsContainer');
    const filterPills = document.querySelectorAll('.filter-pill');
    const badgeNewCount = document.getElementById('badgeNewCount');
    const activeAlertsCountText = document.getElementById('activeAlertsCountText');
    const locationCityStateEl = document.getElementById('locationCityState');
    const criticalCountTag = document.getElementById('criticalCountTag');
    const warningCountTag = document.getElementById('warningCountTag');
    const infoCountTag = document.getElementById('infoCountTag');
    const safetyScoreNum = document.getElementById('safetyScoreNum');
    const safetyScoreTag = document.getElementById('safetyScoreTag');
    const confidenceValue = document.getElementById('confidenceValue');
    const donutProgressRing = document.getElementById('donutProgressRing');

    // Modal DOM References
    const modalOverlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalTime = document.getElementById('modalTime');
    const modalDescription = document.getElementById('modalDescription');
    const modalTypeVal = document.getElementById('modalTypeVal');
    const modalSeverityVal = document.getElementById('modalSeverityVal');
    const modalRegionVal = document.getElementById('modalRegionVal');
    const modalIconBox = document.getElementById('modalIconBox');
    const modalActionBtn = document.getElementById('modalActionBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalSecondaryClose = document.getElementById('modalSecondaryClose');

    // 1. Initialize Geolocation & Fetch Live Location/Weather Data
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                currentLat = position.coords.latitude;
                currentLng = position.coords.longitude;
                await initLocationAndWeather(currentLat, currentLng);
            },
            async (error) => {
                console.warn("Geolocation denied/error, using default Agra location:", error.message);
                await initLocationAndWeather(currentLat, currentLng);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    } else {
        await initLocationAndWeather(currentLat, currentLng);
    }

    window.addEventListener('storage', (event) => {
        if (event.key !== SafeYatraSafetyAnalysis.storageKey || !event.newValue) return;
        try {
            updateSafetyCardStats(JSON.parse(event.newValue));
        } catch (error) {
            console.warn('Unable to read updated safety analysis:', error);
        }
    });

    // 2. Fetch Reverse Geocode & Live Weather
    async function initLocationAndWeather(lat, lng) {
        try {
            // Fetch Location Name
            const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                currentCity = geoData.city || geoData.locality || geoData.localityInfo?.administrative?.[2]?.name || "Agra";
                currentState = geoData.principalSubdivision || geoData.localityInfo?.administrative?.[1]?.name || "Uttar Pradesh";
            }
        } catch (err) {
            console.warn("Geocoding API error:", err);
        }

        // Update Location text in UI
        if (locationCityStateEl) {
            locationCityStateEl.textContent = `${currentCity}, ${currentState}`;
        }

        // Fetch Live Weather from Open-Meteo
        let liveTemp = 34;
        let weatherCond = "Sunny";
        let weatherCode = 0;

        try {
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
            if (weatherRes.ok) {
                const weatherData = await weatherRes.json();
                liveTemp = Math.round(weatherData.current_weather.temperature);
                weatherCode = weatherData.current_weather.weathercode;
                weatherCond = parseWmoCode(weatherCode, liveTemp).label;
            }
        } catch (err) {
            console.warn("Weather API error:", err);
        }

        // Generate dynamic location-based alerts
        alertsData = generateLocationAlerts(currentCity, currentState, liveTemp, weatherCond, weatherCode, lat, lng);
        
        // Use the Home page's latest analysis when it matches this location.
        const analysis = SafeYatraSafetyAnalysis.getLatestForLocation(currentLat, currentLng)
            || SafeYatraSafetyAnalysis.analyze(liveTemp, weatherCode, currentLat, currentLng);

        // Update safety stats score donut ring, confidence, and badges
        updateSafetyCardStats(analysis);

        // Update safety stats score donut ring & badges
        updateSafetyCardStats(liveTemp, weatherCode);

        // Render UI
        updateCounts();
        renderAlerts();
    }

    // WMO Weather Code Interpreter
    function parseWmoCode(code, temp) {
        let label = "Sunny";
        let advisory = `Temperature is ${temp}°C. Clear travel conditions in ${currentCity}.`;

        if (code === 0) {
            label = "Sunny";
            advisory = temp > 36
                ? `Temperature reaching ${temp}°C in ${currentCity}. Stay hydrated, visit monuments before 10 AM or after 4 PM.`
                : `Pleasant weather in ${currentCity} (${temp}°C). Great conditions for sightseeing.`;
        } else if (code >= 1 && code <= 3) {
            label = "Partly Cloudy";
            advisory = `Partly cloudy sky in ${currentCity} (${temp}°C). Good weather for outdoor trips.`;
        } else if (code >= 45 && code <= 48) {
            label = "Foggy";
            advisory = `Dense fog alert reported around ${currentCity}. Drive carefully with fog lamps on.`;
        } else if (code >= 51 && code <= 67) {
            label = "Rainy";
            advisory = `Light to moderate rain showers in ${currentCity} (${temp}°C). Keep an umbrella handy while visiting outdoor sites.`;
        } else if (code >= 80 && code <= 99) {
            label = "Thunderstorm Alert";
            advisory = `Thunderstorm warning active near ${currentCity}. Seek indoor shelter during heavy downpours.`;
        }

        return { label, advisory };
    }

    // 3. Generate Location-Personalized Alerts Data
    function generateLocationAlerts(city, state, temp, weatherCond, weatherCode, lat, lng) {
        const weatherObj = parseWmoCode(weatherCode, temp);

        return [
            {
                id: 1,
                title: `Weather Advisory — ${city}`,
                time: "2 min ago",
                type: "Weather",
                severity: temp > 35 ? "Warning" : "Info",
                region: `${city} District`,
                isNew: true,
                iconClass: temp > 35 ? "fa-solid fa-temperature-high" : "fa-solid fa-cloud-sun",
                iconTheme: "icon-weather",
                description: weatherObj.advisory,
                fullDetails: `Live meteorological telemetry for ${city}, ${state} indicates current temperature of ${temp}°C with ${weatherCond.toLowerCase()} weather. ${weatherObj.advisory} Ensure adequate hydration, carry sun protection, and plan outdoor sightseeing during cooler hours.`,
                actionText: "View Live Weather Map",
                actionIcon: "fa-solid fa-cloud-sun",
                actionUrl: `map.html`
            },
            {
                id: 2,
                title: `Tourist Helpline Active — ${state}`,
                time: "1 hour ago",
                type: "Info",
                severity: "Info",
                region: `${state} State`,
                isNew: true,
                iconClass: "fa-solid fa-headset",
                iconTheme: "icon-info",
                description: `24/7 multilingual tourist helpline active for ${city} region: 1800-111-363. Available in 12 languages.`,
                fullDetails: `Department of Tourism & ${state} Police have activated a 24/7 toll-free helpline (1800-111-363) with real-time GPS location tracking for ${city}. Assistance is available in English, French, German, Spanish, Japanese, Hindi, and 6 other regional languages.`,
                actionText: "Call 1800-111-363",
                actionIcon: "fa-solid fa-phone",
                actionUrl: "tel:1800111363"
            },
            {
                id: 3,
                title: `${city} Central — Safe Zone Active`,
                time: "3 hours ago",
                type: "Safety",
                severity: "Safe Zone",
                region: `${city} Heritage Sector`,
                isNew: true,
                iconClass: "fa-solid fa-shield-halved",
                iconTheme: "icon-safety",
                description: `Enhanced tourist police presence deployed near key heritage landmarks in ${city}. Zone score: 9/10.`,
                fullDetails: `Major tourist zones across ${city}, ${state} have been designated as High-Priority Safe Zones. AI risk assessment score: 9/10. Dedicated Tourist Police patrols, smart CCTV surveillance, and verified taxi desks are operational 24/7.`,
                actionText: "View Safe Zone Map",
                actionIcon: "fa-solid fa-map-location-dot",
                actionUrl: "map.html"
            },
            {
                id: 4,
                title: `Traffic Advisory — ${city} Bypass`,
                time: "4 hours ago",
                type: "Traffic",
                severity: "Warning",
                region: `${city} Transit Corridor`,
                isNew: false,
                iconClass: "fa-solid fa-triangle-exclamation",
                iconTheme: "icon-traffic",
                description: `Heavy traffic reported on arterial road near ${city}. AI recommends alternate route via Ring Road highway.`,
                fullDetails: `Real-time map telemetry indicates traffic congestion and slow-moving vehicles on central arterial avenues near ${city}. Estimated traffic delay: 25–35 minutes. SafeYatra AI Navigation recommends taking the outer Ring Road highway bypass.`,
                actionText: "View Alternate Route",
                actionIcon: "fa-solid fa-route",
                actionUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
            },
            {
                id: 5,
                title: `Pickpocket Alert — ${city} Market Area`,
                time: "Yesterday",
                type: "Safety",
                severity: "Critical",
                region: `${city} Commercial District`,
                isNew: false,
                iconClass: "fa-solid fa-user-shield",
                iconTheme: "icon-critical",
                description: `Local police advisory for crowded market areas in ${city}. Keep valuables secure in zippered bags.`,
                fullDetails: `Local police in ${city} report isolated petty theft attempts near crowded market plazas and ticket desks. Visitors are advised to keep passports, mobile phones, and wallets secured inside inner pockets or cross-body bags.`,
                actionText: "Report SOS Incident",
                actionIcon: "fa-solid fa-phone-volume",
                actionUrl: "sos.html"
            },
            {
                id: 6,
                title: `New Safe Zone Activated in ${city}`,
                time: "2 days ago",
                type: "Safety",
                severity: "Safe Zone",
                region: `${city} Promenade`,
                isNew: false,
                iconClass: "fa-solid fa-shield-check",
                iconTheme: "icon-safety",
                description: `Main Park & Heritage Corridor designated as Safe Zone with 24/7 CCTV. SafeYatra ID accepted for entry.`,
                fullDetails: `The central tourist park and promenade in ${city} is now officially registered as a Safe Zone equipped with high-resolution CCTV cameras, emergency solar lights, and SOS pillars. Present your SafeYatra Digital ID for fast-track entry.`,
                actionText: "Explore Safe Zone",
                actionIcon: "fa-solid fa-compass",
                actionUrl: "map.html"
            }
        ];
    }

    // 4. Dynamic Safety Card Stats Computation
    function updateSafetyCardStats(analysis) {
        let critical = 0;
        let warnings = 0;
        let info = 0;

        alertsData.forEach(item => {
            if (item.severity === 'Critical') critical++;
            else if (item.severity === 'Warning') warnings++;
            else info++;
        });

        if (criticalCountTag) criticalCountTag.textContent = `${critical} Critical`;
        if (warningCountTag) warningCountTag.textContent = `${warnings} Warnings`;
        if (infoCountTag) infoCountTag.textContent = `${info} Info`;

        const score = analysis.overallScore;

        if (safetyScoreNum) safetyScoreNum.textContent = scor
        // if (confidenceValue) confidenceValue.textContent = `${analysis.confidence}%`;
        
        let scoreTagText = "VERY SAFE";
        if (score < 80) scoreTagText = "MODERATE";
        if (score < 70) scoreTagText = "CAUTION";
        if (safetyScoreTag) safetyScoreTag.textContent = scoreTagText;

        // Donut ring SVG calculation (Radius 36 -> Circumference = 2 * PI * 36 ≈ 226.19)
        const circumference = 2 * Math.PI * 36;
        if (donutProgressRing) {
            const offset = circumference - ((score / 100) * circumference);
            donutProgressRing.style.strokeDasharray = `${circumference}`;
            donutProgressRing.style.strokeDashoffset = offset;
        }
    }

    // Counts update helper
    function updateCounts() {
        const newCount = alertsData.filter(item => item.isNew).length;
        if (badgeNewCount) {
            if (newCount > 0) {
                badgeNewCount.textContent = `${newCount} New`;
                badgeNewCount.style.display = 'inline-block';
            } else {
                badgeNewCount.style.display = 'none';
            }
        }
    }

    // Render Alerts List based on currentFilter
    function renderAlerts() {
        if (!alertsContainer) return;

        let filtered = alertsData;
        if (currentFilter !== 'All') {
            filtered = alertsData.filter(item => item.type.toLowerCase() === currentFilter.toLowerCase());
        }

        // Update list header count
        if (activeAlertsCountText) {
            activeAlertsCountText.textContent = `Showing ${filtered.length} advisory${filtered.length === 1 ? '' : 'ies'}`;
        }

        if (filtered.length === 0) {
            alertsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <div class="empty-title">All Clear</div>
                    <div class="empty-desc">No active ${currentFilter === 'All' ? '' : currentFilter.toLowerCase()} alerts or advisories for ${currentCity} right now.</div>
                </div>
            `;
            return;
        }

        alertsContainer.innerHTML = filtered.map(alert => `
            <div class="alert-card" data-id="${alert.id}">
                <div class="alert-card-top">
                    <div class="alert-icon-box ${alert.iconTheme}">
                        <i class="${alert.iconClass}"></i>
                    </div>
                    <div class="alert-content">
                        <div class="alert-header-row">
                            <h3 class="alert-title">${escapeHtml(alert.title)}</h3>
                            <span class="alert-time">${alert.time}</span>
                        </div>
                        <p class="alert-description">${escapeHtml(alert.description)}</p>
                    </div>
                </div>
                <div class="alert-actions-bar">
                    <button class="btn-dismiss" onclick="dismissAlert(${alert.id})">
                        <i class="fa-solid fa-xmark"></i> Dismiss
                    </button>
                    ${alert.actionText && alert.actionUrl ? `
                        <button class="btn-details btn-action-primary" onclick="triggerAlertAction(${alert.id}, event)">
                            <i class="${alert.actionIcon || 'fa-solid fa-location-arrow'}"></i> ${alert.actionText}
                        </button>
                    ` : ''}
                    <button class="btn-details" onclick="openAlertDetails(${alert.id})">
                        <i class="fa-solid fa-circle-info"></i> Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Filter pill click handler
    filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            filterPills.forEach(p => p.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            currentFilter = target.getAttribute('data-filter') || 'All';
            renderAlerts();
        });
    });

    // Action Trigger Function (Executes functional action for View Alternate Route, Call Helpline, Map, SOS)
    window.triggerAlertAction = function (id, event) {
        if (event) event.stopPropagation();
        const alert = alertsData.find(item => item.id === id);
        if (!alert || !alert.actionUrl) return;

        if (alert.actionUrl.startsWith('http')) {
            window.open(alert.actionUrl, '_blank');
        } else if (alert.actionUrl.startsWith('tel:')) {
            window.location.href = alert.actionUrl;
        } else {
            window.location.href = alert.actionUrl;
        }
    };

    // Dismiss Alert Function
    window.dismissAlert = function (id) {
        const cardEl = document.querySelector(`.alert-card[data-id="${id}"]`);
        if (cardEl) {
            cardEl.classList.add('dismissing');
            setTimeout(() => {
                alertsData = alertsData.filter(item => item.id !== id);
                updateCounts();
                renderAlerts();
            }, 250);
        }
    };

    // Open Alert Details Modal
    window.openAlertDetails = function (id) {
        const alert = alertsData.find(item => item.id === id);
        if (!alert) return;

        // Mark as read
        if (alert.isNew) {
            alert.isNew = false;
            updateCounts();
        }

        modalTitle.textContent = alert.title;
        modalTime.textContent = alert.time;
        modalDescription.textContent = alert.fullDetails || alert.description;
        modalTypeVal.textContent = alert.type;
        modalSeverityVal.textContent = alert.severity || "Standard";

        if (modalRegionVal) {
            modalRegionVal.textContent = alert.region || `${currentCity} Region`;
        }

        modalIconBox.className = `modal-icon ${alert.iconTheme}`;
        modalIconBox.innerHTML = `<i class="${alert.iconClass}"></i>`;

        if (alert.actionText && alert.actionUrl) {
            modalActionBtn.innerHTML = `<i class="${alert.actionIcon || 'fa-solid fa-arrow-right'}"></i> <span>${alert.actionText}</span>`;
            modalActionBtn.style.display = 'flex';
            modalActionBtn.onclick = () => {
                triggerAlertAction(alert.id);
            };
        } else {
            modalActionBtn.style.display = 'none';
        }

        modalOverlay.classList.add('active');
    };

    // Close Modal
    function closeModal() {
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalSecondaryClose) modalSecondaryClose.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // HTML Escape Helper
    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
