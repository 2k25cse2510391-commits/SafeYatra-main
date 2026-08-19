// Constants and Variables
let map = null;
let currentMarker = null;
let accuracyCircle = null;
let searchMarker = null;
let policeMarker = null;
let policeRouteLayer = null;

// Emergency Locations Data (Placeholder array)
const emergencyLocations = [];

// Sample Safe Route
const routePoints = [
    [27.1767, 78.0081],
    [27.1810, 78.0150]
];

document.addEventListener("DOMContentLoaded", () => {
    // Auth Guard: Enforce Login
    if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.requireAuth) {
        SafeYatraDB.requireAuth();
    }

    initializeMap();
    setupSearch();
    setupCurrentLocationBtn();

    // Check URL parameters for emergency request (e.g. ?destination=police or ?targetLat=...&targetLng=...)
    const urlParams = new URLSearchParams(window.location.search);
    const destinationParam = urlParams.get("destination");
    const targetLat = urlParams.get("targetLat");
    const targetLng = urlParams.get("targetLng");
    const targetName = urlParams.get("name") || "Endangered Person";

    if (destinationParam && destinationParam.toLowerCase() === "police") {
        handleEmergencyDestination("police");
    } else if (targetLat && targetLng) {
        handleSosDestination(parseFloat(targetLat), parseFloat(targetLng), targetName);
    } else {
        getCurrentLocation();
    }
});

function handleSosDestination(lat, lng, name) {
    if (!map) return;
    map.setView([lat, lng], 17);
    const sosMarker = L.circleMarker([lat, lng], {
        radius: 14,
        color: "#DC2626",
        weight: 4,
        fillColor: "#EF4444",
        fillOpacity: 0.9
    }).addTo(map);
    sosMarker.bindPopup(`<strong>🚨 EMERGENCY SOS: ${name}</strong><br>Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="color:#2563EB; font-weight:700;">Open Turn-by-Turn Navigation</a>`).openPopup();
}

function initializeMap() {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    // Prevent duplicate map initialization
    if (map !== null) return;

    map = L.map("map").setView([27.1767, 78.0081], 13);
    map.zoomControl.remove();

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    // Draw previous sample route
    L.polyline(routePoints, {
        color: "#16A34A",
        weight: 6
    }).addTo(map);

    addEmergencyMarkers();
}

function getCurrentLocation(callback) {
    if (!navigator.geolocation) {
        const errorMsg = "Geolocation is not supported by your browser.";
        if (callback) callback(null, new Error(errorMsg));
        else alert(errorMsg);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            if (map) {
                map.setView([lat, lng], 16);

                if (currentMarker) map.removeLayer(currentMarker);
                if (accuracyCircle) map.removeLayer(accuracyCircle);

                currentMarker = L.circleMarker([lat, lng], {
                    radius: 10,
                    color: "#FFFFFF",
                    weight: 3,
                    fillColor: "#2563EB",
                    fillOpacity: 1
                }).addTo(map);

                currentMarker.bindPopup("📍 You are here");

                if (accuracy) {
                    accuracyCircle = L.circle([lat, lng], {
                        radius: accuracy,
                        color: "#2563EB",
                        fillColor: "#60A5FA",
                        fillOpacity: 0.15,
                        weight: 2
                    }).addTo(map);
                }
            }

            if (callback) callback({ lat, lng, accuracy }, null);
        },
        (error) => {
            console.warn("Geolocation error:", error);
            let message = "Unknown location error.";
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = "Location permission denied.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = "Location unavailable.";
                    break;
                case error.TIMEOUT:
                    message = "Location request timed out.";
                    break;
            }
            if (callback) {
                callback(null, new Error(message));
            } else {
                alert(message);
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

function setupCurrentLocationBtn() {
    const btn = document.querySelector(".floating-btn");
    if (btn) {
        btn.addEventListener("click", () => {
            getCurrentLocation();
        });
    }
}

// ------------------- POLICE WORKFLOW -------------------

async function handleEmergencyDestination(type) {
    if (type !== "police") return;

    showEmergencyCard("🚔 Nearest Police Station", "Locating your position...", null);

    getCurrentLocation(async (userLoc, err) => {
        if (err || !userLoc) {
            const errorMsg = err ? err.message : "Unable to access your location.";
            showEmergencyCard("⚠️ Location Error", errorMsg, null);
            return;
        }

        await findNearestPoliceStation(userLoc.lat, userLoc.lng);
    });
}

async function findNearestPoliceStation(userLat, userLng) {
    showEmergencyCard("🚔 Nearest Police Station", "Searching nearby police stations...", null);

    try {
        let data = [];
        const deltas = [0.1, 0.25, 0.5]; // ~10km, ~25km, ~50km bounding boxes

        for (const delta of deltas) {
            const viewbox = `${userLng - delta},${userLat + delta},${userLng + delta},${userLat - delta}`;

            // Try amenity=police first
            let url = `https://nominatim.openstreetmap.org/search?amenity=police&format=json&limit=15&viewbox=${viewbox}&bounded=1&lat=${userLat}&lon=${userLng}`;
            let response = await fetch(url);
            if (response.ok) {
                data = await response.json();
            }

            // If empty, try q=police+station with bounded=1
            if (!data || data.length === 0) {
                url = `https://nominatim.openstreetmap.org/search?q=police+station&format=json&limit=15&viewbox=${viewbox}&bounded=1&lat=${userLat}&lon=${userLng}`;
                response = await fetch(url);
                if (response.ok) {
                    data = await response.json();
                }
            }

            if (data && data.length > 0) {
                break;
            }
        }

        // Fallback: search q=police station with lat/lon center bias
        if (!data || data.length === 0) {
            const url = `https://nominatim.openstreetmap.org/search?q=police+station&format=json&limit=15&lat=${userLat}&lon=${userLng}`;
            const response = await fetch(url);
            if (response.ok) {
                data = await response.json();
            }
        }

        if (!data || data.length === 0) {
            showEmergencyCard("🚔 Police Station", "No nearby police station could be found.", null);
            return;
        }

        let nearestStation = null;
        let minDistance = Infinity;

        // STRICT DISTANCE FILTER: Only accept police stations within 100 km
        const MAX_RADIUS_KM = 100;

        data.forEach((item) => {
            const stLat = parseFloat(item.lat);
            const stLng = parseFloat(item.lon);
            if (!isNaN(stLat) && !isNaN(stLng)) {
                const dist = calculateDistance(userLat, userLng, stLat, stLng);
                if (dist <= MAX_RADIUS_KM && dist < minDistance) {
                    minDistance = dist;
                    nearestStation = {
                        name: item.name || item.display_name.split(",")[0] || "Police Station",
                        fullName: item.display_name,
                        lat: stLat,
                        lng: stLng,
                        distanceKm: dist
                    };
                }
            }
        });

        if (!nearestStation) {
            showEmergencyCard("🚔 Police Station", "No police station found within 100 km of your location.", null);
            return;
        }

        await displayPoliceStation(userLat, userLng, nearestStation);

    } catch (error) {
        console.error("Error fetching police stations:", error);
        showEmergencyCard("⚠️ Search Error", "Failed to search for police stations.", null);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function displayPoliceStation(userLat, userLng, station) {
    if (!map) return;

    if (policeMarker) map.removeLayer(policeMarker);

    // Custom Police Station Icon
    const policeIcon = L.divIcon({
        className: 'custom-police-marker',
        html: `<div style="background-color:#1E3A8A; color:white; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:3px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.3); font-size:16px;"><i class="fa-solid fa-shield-halved"></i></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
    });

    policeMarker = L.marker([station.lat, station.lng], { icon: policeIcon }).addTo(map);

    const distText = station.distanceKm < 1
        ? `${Math.round(station.distanceKm * 1000)} m away`
        : `${station.distanceKm.toFixed(1)} km away`;

    const popupContent = `
        <div style="text-align:center; min-width:160px;">
            <strong style="color:#1E3A8A; font-size:14px;">🚔 Police Station</strong>
            <div style="margin:4px 0; font-weight:600; font-size:13px;">${station.name}</div>
            <div style="font-size:12px; color:#64748B;">${distText}</div>
            <button onclick="window.navigateToLocation(${station.lat}, ${station.lng})" style="margin-top:8px; width:100%; padding:6px 10px; background-color:#2563EB; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px; font-weight:600;">
                <i class="fa-solid fa-location-arrow"></i> Navigate
            </button>
        </div>
    `;

    policeMarker.bindPopup(popupContent).openPopup();

    // Fetch and display route
    await displayRoute(userLat, userLng, station.lat, station.lng, station);
}

async function displayRoute(userLat, userLng, destLat, destLng, station) {
    if (policeRouteLayer) map.removeLayer(policeRouteLayer);

    let routeDistKm = station.distanceKm;
    let durationMins = null;

    try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl);

        if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                routeDistKm = route.distance / 1000;
                durationMins = Math.round(route.duration / 60);

                const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

                policeRouteLayer = L.polyline(coords, {
                    color: '#2563EB',
                    weight: 6,
                    opacity: 0.85,
                    lineJoin: 'round'
                }).addTo(map);

                // Fit map bounds to fit both user and station
                const bounds = L.latLngBounds([
                    [userLat, userLng],
                    [destLat, destLng]
                ]);
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    } catch (e) {
        console.warn("OSRM routing failed, fitting bounds to points:", e);
        const bounds = L.latLngBounds([
            [userLat, userLng],
            [destLat, destLng]
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });
    }

    const distFormatted = routeDistKm < 1
        ? `${Math.round(routeDistKm * 1000)} m away`
        : `${routeDistKm.toFixed(1)} km away`;

    const statusText = durationMins
        ? `${distFormatted} • Est. ${durationMins} min route`
        : distFormatted;

    showEmergencyCard(station.name, statusText, { lat: station.lat, lng: station.lng });
}

function showEmergencyCard(title, description, navCoords) {
    const card = document.getElementById("emergencyCard");
    const nameEl = document.getElementById("emergencyStationName");
    const distEl = document.getElementById("emergencyDistanceText");
    const navBtn = document.getElementById("emergencyNavigateBtn");
    const closeBtn = document.getElementById("closeEmergencyCardBtn");

    if (!card) return;

    card.style.display = "block";
    if (nameEl) nameEl.textContent = title;
    if (distEl) distEl.textContent = description;

    if (navBtn) {
        if (navCoords) {
            navBtn.style.display = "flex";
            navBtn.onclick = () => window.navigateToLocation(navCoords.lat, navCoords.lng);
        } else {
            navBtn.style.display = "none";
        }
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            card.style.display = "none";
        };
    }
}

// ------------------- SEARCH WORKFLOW -------------------

function setupSearch() {
    const searchForm = document.getElementById("searchForm");
    if (!searchForm) return;

    searchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const searchInput = document.getElementById("searchInput");
        const query = searchInput.value.trim();

        if (!query) return;

        await searchLocation(query);
    });
}

async function searchLocation(query) {
    const resultsContainer = document.getElementById("searchResults");
    if (!resultsContainer) return;

    try {
        resultsContainer.innerHTML = '<div class="search-result-item">Searching...</div>';
        resultsContainer.style.display = 'block';

        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5`);

        if (!response.ok) throw new Error("Network response was not ok");

        const data = await response.json();

        if (data.length === 0) {
            resultsContainer.innerHTML = '<div class="error-msg">No results found.</div>';
            return;
        }

        displaySearchResults(data, resultsContainer);

    } catch (error) {
        console.error("Search error:", error);
        resultsContainer.innerHTML = '<div class="error-msg">Failed to search. Please try again.</div>';
    }
}

function displaySearchResults(results, container) {
    container.innerHTML = "";

    results.forEach((result) => {
        const item = document.createElement("div");
        item.className = "search-result-item";
        item.textContent = result.display_name;

        item.addEventListener("click", () => {
            selectSearchResult(result);
            container.style.display = "none";
        });

        container.appendChild(item);
    });
}

function selectSearchResult(result) {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (isNaN(lat) || isNaN(lon)) {
        alert("Invalid coordinates for the selected location.");
        return;
    }

    if (map) {
        map.setView([lat, lon], 16);

        if (searchMarker) {
            map.removeLayer(searchMarker);
        }

        searchMarker = L.marker([lat, lon]).addTo(map);

        const name = result.name || result.display_name.split(",")[0];
        const popupContent = `
            <div style="text-align:center;">
                <strong>${name}</strong><br><br>
                <button onclick="window.navigateToLocation(${lat}, ${lon})" style="padding: 6px 12px; background-color: #2563EB; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 5px;">
                    <i class="fa-solid fa-location-arrow"></i> Navigate
                </button>
            </div>
        `;
        searchMarker.bindPopup(popupContent).openPopup();
    }
}

window.navigateToLocation = function (lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
};

function addEmergencyMarkers() {
    if (!map || emergencyLocations.length === 0) return;

    emergencyLocations.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng]).addTo(map);
        const popupContent = `
            <div style="text-align:center;">
                <strong>${loc.name}</strong> (${loc.type})<br><br>
                <button onclick="window.navigateToLocation(${loc.lat}, ${loc.lng})" style="padding: 6px 12px; background-color: #DC2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 5px;">
                    <i class="fa-solid fa-location-arrow"></i> Navigate
                </button>
            </div>
        `;
        marker.bindPopup(popupContent);
    });
}