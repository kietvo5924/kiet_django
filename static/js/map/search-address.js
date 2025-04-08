/* eslint-disable no-undef */
/**
 * Routing with Nominatim Start and Client-Side Static JSON Search for End (Emergency Locations)
 * Super Cleaned version.
 */

// --- Configs ---
const config = { minZoom: 7, maxZoom: 18, fullscreenControl: true };
const initialZoom = 15;
const clickMarkerZoom = 18;
const defaultLat = 10.7769;
const defaultLng = 106.7009;

// --- Global Variables ---
const map = L.map("map", config);
let routingControl = null;
let startMarker = null;
let endMarker = null;
let currentStartLocation = { lat: defaultLat, lng: defaultLng };
let currentEndLocation = null;
let emergencyLocations = [];
let emergencyDataLoaded = false;

// --- Icons ---
const startIcon = L.divIcon({ className: "start-marker", html: '<span>S</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const endIcon = L.divIcon({ className: "end-marker", html: '<span>Đ</span>', iconSize: [30, 30], iconAnchor: [15, 15] });

// --- Map Layer ---
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// --- Utility Functions ---
function clickZoom(e) { map.setView(e.target.getLatLng(), clickMarkerZoom); }

// --- Load Static GeoJSON Data ---
async function fetchStaticData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        const data = await response.json();
        return data?.features || [];
    } catch (err) {
        console.error(`Workspace Static Error (${url}):`, err); // Keep critical errors
        throw err;
    }
}

async function loadEmergencyData() {
    const filesToLoad = ['/static/data/hospital.json', '/static/data/PCCC.json', '/static/data/police.json'];
    console.log("Loading emergency locations..."); // Keep important status
    const endSearchInput = document.getElementById('end-search');
    if (endSearchInput) { endSearchInput.placeholder = "Đang tải..."; endSearchInput.disabled = true; }
    try {
        const results = await Promise.all(filesToLoad.map(url => fetchStaticData(url)));
        emergencyLocations = results.flat().filter(f => f?.geometry?.coordinates?.length === 2);
        emergencyDataLoaded = true;
        console.log(`Loaded ${emergencyLocations.length} emergency locations.`); // Keep success log
        if (endSearchInput) { endSearchInput.disabled = false; endSearchInput.placeholder = "Tìm BV, PCCC, CA..."; }
    } catch (error) {
        console.error("Failed loading emergency data:", error); // Keep critical errors
        alert("Lỗi tải dữ liệu điểm đến khẩn cấp.");
        if (endSearchInput) { endSearchInput.placeholder = "Lỗi tải dữ liệu"; endSearchInput.disabled = false; }
        emergencyDataLoaded = false;
    }
}

// --- Autocomplete Setup ---
function setupAutocomplete(inputId, searchType) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) { console.error(`Input #${inputId} not found!`); return; }

    if (searchType === 'clientSide') {
        inputElement.disabled = !emergencyDataLoaded;
        inputElement.placeholder = emergencyDataLoaded ? "Tìm BV, PCCC, CA..." : "Đang tải...";
    }

    new Autocomplete(inputId, {
        delay: 400, selectFirst: true, howManyCharacters: 1,

        onSearch: ({ currentValue }) => {
            if (!currentValue) return [];
            if (searchType === 'nominatim') {
                const query = currentValue.toLowerCase().includes("hồ chí minh") ? currentValue : `${currentValue}, Ho Chi Minh City`;
                const api = `https://nominatim.openstreetmap.org/search?format=geojson&limit=5&q=${encodeURI(query)}&countrycodes=vn&addressdetails=1`;
                return new Promise(async (resolve, reject) => {
                    try {
                        const response = await fetch(api, { headers: { "User-Agent": "MyLeafletApp/1.0" } });
                        if (!response.ok) throw new Error(`Nominatim ${response.statusText}`);
                        const data = await response.json();
                        resolve(data?.features || []);
                    } catch (error) { console.error("Nominatim error:", error); reject(error); }
                });
            } else if (searchType === 'clientSide') {
                if (!emergencyDataLoaded) return [];
                try {
                    const regex = new RegExp(currentValue.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "i");
                    const matches = emergencyLocations.filter(el => el.properties?.name?.match(regex));
                    return matches.sort((a, b) => (a.properties?.name || '').localeCompare(b.properties?.name || ''));
                } catch (e) { console.error("Regex error:", e); return []; }
            }
            return [];
        },

        onResults: ({ currentValue, matches, template }) => {
            if (!matches || matches.length === 0) return template ? template(`<li>Không tìm thấy '${currentValue}'</li>`) : '';
            const regex = new RegExp(currentValue.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "i");
            return matches.map((element) => {
                let mainDisplay = "N/A", detailsDisplay = "", resultObject = element;
                let props = element.properties;
                if (!props) return '';
                const { name, address, amenity, display_name } = props;
                mainDisplay = (name || display_name || "Không rõ").replace(regex, str => `<b>${str}</b>`);
                if (searchType === 'nominatim') {
                    const details = [address?.road, address?.suburb, address?.city].filter(Boolean).join(", ");
                    if (details) detailsDisplay = `<div class="address-details">${details}</div>`;
                } else {
                    if (address && address.toLowerCase() !== (name || '').toLowerCase()) detailsDisplay += `<div class="address-details">${address}</div>`;
                    if (amenity) detailsDisplay += `<div class="place-item ${amenity.toLowerCase()}">(${amenity.toUpperCase()})</div>`;
                }
                try {
                    const resultString = JSON.stringify(resultObject).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                    return `<li role="option" data-result='${resultString}'><div class="address-main">${mainDisplay}</div>${detailsDisplay}</li>`;
                } catch (e) { console.error("Stringify error:", e); return ''; }
            }).join("");
        },

        onSubmit: ({ input, object }) => {
            if (!object) { if (input) input.value = ''; return; }
            let lat, lng, locationName = "Địa điểm", popupContent = "";
            try {
                if (searchType === 'nominatim') {
                    const coords = object.geometry?.coordinates;
                    if (!coords || coords.length !== 2) throw new Error("Invalid coords (Nominatim)");
                    lng = coords[0]; lat = coords[1];
                    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("Invalid values (Nominatim)");
                    locationName = object.properties?.name || object.properties?.display_name || locationName;
                    popupContent = `<b>Điểm bắt đầu:</b><br>${locationName}`;
                    currentStartLocation = { lat, lng };
                    if (startMarker) map.removeLayer(startMarker);
                    startMarker = L.marker([lat, lng], { icon: startIcon, draggable: true }).addTo(map).bindPopup(popupContent).openPopup().on('dragend', handleStartMarkerDragEnd);
                } else {
                    const coords = object.geometry?.coordinates;
                    if (!coords || coords.length !== 2) throw new Error("Invalid coords (JSON)");
                    lat = coords[0]; lng = coords[1]; // JSON is [lat, lng]
                    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("Invalid values (JSON)");
                    locationName = object.properties?.name || locationName;
                    popupContent = `<b>Điểm đến:</b><br>${locationName}`;
                    const { address, amenity } = object.properties || {};
                    if (address) popupContent += `<br><small>${address}</small>`;
                    if (amenity) popupContent += `<br><small>(${amenity.toUpperCase()})</small>`;
                    currentEndLocation = { lat, lng };
                    if (endMarker) map.removeLayer(endMarker);
                    endMarker = L.marker([lat, lng], { icon: endIcon, draggable: true }).addTo(map).bindPopup(popupContent).openPopup().on('dragend', handleEndMarkerDragEnd);
                }
                if (input) input.value = locationName; // Set input text to selected name
                updateRoute();
                if (currentStartLocation && currentEndLocation) map.fitBounds([[currentStartLocation.lat, currentStartLocation.lng], [currentEndLocation.lat, currentEndLocation.lng]], { padding: [50, 50], maxZoom: 16 });
                else map.setView([lat, lng], clickMarkerZoom);
            } catch (error) {
                console.error("Error processing selection:", error, object);
                alert("Lỗi khi chọn địa điểm.");
                if (input) input.value = '';
            }
        },
        noResults: ({ currentValue, template }) => template(`<li>Không tìm thấy '${currentValue}'</li>`),
    });
}

// --- Update/Draw Route ---
function updateRoute() {
    if (routingControl) map.removeControl(routingControl);
    routingControl = null;
    if (currentStartLocation?.lat != null && currentEndLocation?.lat != null) {
        const waypoints = [L.latLng(currentStartLocation.lat, currentStartLocation.lng), L.latLng(currentEndLocation.lat, currentEndLocation.lng)];
        routingControl = L.Routing.control({
            waypoints, routeWhileDragging: false, show: false,
            lineOptions: { styles: [{ color: "blue", opacity: 0.8, weight: 6 }] },
            addWaypoints: false, draggableWaypoints: false, createMarker: () => null,
        }).addTo(map);
        routingControl.on('routingerror', (e) => {
            console.error("Routing Error:", e.error?.message || e.error); // Log only message
            alert(`Không tìm thấy đường đi.`);
            if (routingControl) map.removeControl(routingControl); routingControl = null;
        });
        routingControl.on('routesfound', (e) => {
            if (e.routes?.length > 0) console.log(`Route found: ${(e.routes[0].summary.totalDistance / 1000).toFixed(1)} km`); // Shorter log
        });
    }
}

// --- Event Handlers ---
function handleStartMarkerDragEnd(e) {
    currentStartLocation = e.target.getLatLng().wrap();
    updateRoute();
    document.getElementById('start-search').value = '';
}
function handleEndMarkerDragEnd(e) {
    currentEndLocation = e.target.getLatLng().wrap();
    updateRoute();
    document.getElementById('end-search').value = '';
}
function returnToCurrentLocation() {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ định vị.");
    document.body.style.cursor = 'wait';
    navigator.geolocation.getCurrentPosition((position) => {
        document.body.style.cursor = 'default';
        const { latitude: lat, longitude: lng } = position.coords;
        map.setView([lat, lng], initialZoom);
        currentStartLocation = { lat, lng };
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker([lat, lng], { icon: startIcon, draggable: true })
            .addTo(map).bindPopup("Vị trí của bạn (Điểm bắt đầu)").openPopup().on('dragend', handleStartMarkerDragEnd);
        updateRoute();
        document.getElementById('start-search').value = '';
    },
        (error) => {
            document.body.style.cursor = 'default';
            console.error("Geolocation Error:", error.code, error.message); // Log code and message
            alert(`Không thể lấy vị trí.\nLỗi: ${error.message}`);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
}

// --- Custom Controls ---
L.Control.CurrentLocation = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function (map) {
        const container = L.DomUtil.create("div", "leaflet-control-current-location leaflet-bar leaflet-control");
        container.innerHTML = '<span title="Về vị trí của tôi" style="font-size: 1.4em; cursor: pointer;">🎯</span>';
        container.onclick = (e) => { L.DomEvent.stopPropagation(e); returnToCurrentLocation(); };
        L.DomEvent.disableClickPropagation(container);
        return container;
    },
});
L.control.currentLocation = (opts) => new L.Control.CurrentLocation(opts);

L.Control.Legend = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function (map) {
        const div = L.DomUtil.create("div", "description"); // Ensure this class matches your CSS
        L.DomEvent.disableClickPropagation(div);
        div.innerHTML = "Tìm điểm bắt đầu (S). Tìm điểm đến khẩn cấp (Đ)."; // Shorter legend text
        return div;
    }
});
L.control.legend = (opts) => new L.Control.Legend(opts);

// --- Initialization ---
function initializeMapAndData(initialLat, initialLng) {
    console.log(`Initializing map at: [${initialLat.toFixed(5)}, ${initialLng.toFixed(5)}]`); // Log coords
    currentStartLocation = { lat: initialLat, lng: initialLng };
    currentEndLocation = null;
    map.setView([initialLat, initialLng], initialZoom);

    // Clear previous state
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routingControl) map.removeControl(routingControl);
    startMarker = endMarker = routingControl = null;
    const startInput = document.getElementById('start-search');
    const endInput = document.getElementById('end-search');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    // Create initial start marker
    startMarker = L.marker([initialLat, initialLng], { icon: startIcon, draggable: true })
        .addTo(map).bindPopup("Vị trí bắt đầu (kéo thả)").on('dragend', handleStartMarkerDragEnd);

    // Setup Autocomplete
    setupAutocomplete("start-search", 'nominatim');
    setupAutocomplete("end-search", 'clientSide');

    // Add Controls
    L.control.currentLocation({ position: 'topright' }).addTo(map);
    L.control.legend().addTo(map);
    // L.control.fullscreen().addTo(map); // Optional

    // Load static JSON data
    loadEmergencyData();
}

// --- Main Execution ---
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => initializeMapAndData(pos.coords.latitude, pos.coords.longitude),
        (err) => {
            console.warn(`Geolocation failed (${err.code}): ${err.message}. Using default.`);
            initializeMapAndData(defaultLat, defaultLng);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
} else {
    console.error("Geolocation not supported.");
    initializeMapAndData(defaultLat, defaultLng);
}