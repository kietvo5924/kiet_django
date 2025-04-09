/* eslint-disable no-undef */
/**
 * Routing with Nominatim Start and Client-Side Static JSON Search for End (Emergency Locations)
 * Adjusted Control Positions Based on Sidebar Visibility
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
let selectedLocation = null;

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
        console.error(`Workspace Static Error (${url}):`, err);
        throw err;
    }
}

async function loadEmergencyData() {
    const filesToLoad = ['/static/data/hospital.json', '/static/data/PCCC.json', '/static/data/police.json'];
    console.log("Loading emergency locations...");
    const endSearchInput = document.getElementById('end-search');
    if (endSearchInput) { endSearchInput.placeholder = "Đang tải..."; endSearchInput.disabled = true; }
    try {
        const results = await Promise.all(filesToLoad.map(url => fetchStaticData(url)));
        emergencyLocations = results.flat().filter(f => f?.geometry?.coordinates?.length === 2);
        emergencyDataLoaded = true;
        console.log(`Loaded ${emergencyLocations.length} emergency locations.`);
        if (endSearchInput) { endSearchInput.disabled = false; endSearchInput.placeholder = "Tìm BV, PCCC, CA..."; }
    } catch (error) {
        console.error("Failed loading emergency data:", error);
        alert("Lỗi tải dữ liệu điểm đến khẩn cấp.");
        if (endSearchInput) { endSearchInput.placeholder = "Lỗi tải dữ liệu"; endSearchInput.disabled = false; }
        emergencyDataLoaded = false;
    }
}

// --- Sidebar Control ---
const mapContainer = document.getElementById('map');

const sidebarPopup = document.createElement('div');
sidebarPopup.id = 'sidebar-popup';
sidebarPopup.className = 'sidebar sidebar-left hidden';
mapContainer.appendChild(sidebarPopup);

const sidebarRouting = document.createElement('div');
sidebarRouting.id = 'sidebar-routing';
sidebarRouting.className = 'sidebar sidebar-right hidden';
mapContainer.appendChild(sidebarRouting);

// Hàm điều chỉnh vị trí các nút điều khiển
function adjustControlPositions() {
    const isPopupVisible = !sidebarPopup.classList.contains('hidden');
    const isRoutingVisible = !sidebarRouting.classList.contains('hidden');

    // Điều chỉnh vị trí nút zoom và toàn màn hình
    const zoomControl = document.querySelector('.leaflet-control-zoom');
    const fullscreenControl = document.querySelector('.leaflet-control-fullscreen');
    if (isPopupVisible) {
        if (zoomControl) zoomControl.style.marginLeft = '310px';
        if (fullscreenControl) fullscreenControl.style.marginLeft = '310px';
    } else {
        if (zoomControl) zoomControl.style.marginLeft = '10px';
        if (fullscreenControl) fullscreenControl.style.marginLeft = '10px';
    }

    // Điều chỉnh vị trí nút "Trở về vị trí"
    const currentLocationControl = document.querySelector('.leaflet-control-current-location');
    if (isRoutingVisible) {
        if (currentLocationControl) currentLocationControl.style.marginRight = '310px';
    } else {
        if (currentLocationControl) currentLocationControl.style.marginRight = '10px';
    }
}

function showPopupSidebar(content, isStart) {
    sidebarPopup.innerHTML = `
        <div class="sidebar-content">
            ${content}
            <button class="route-button" id="route-btn">Dẫn đường</button>
            <button class="close-button" id="close-popup">Đóng</button>
        </div>
    `;
    sidebarPopup.classList.remove('hidden');
    adjustControlPositions();

    document.getElementById('route-btn').onclick = () => {
        if (isStart) {
            currentStartLocation = selectedLocation;
            if (startMarker) map.removeLayer(startMarker);
            startMarker = L.marker([selectedLocation.lat, selectedLocation.lng], { icon: startIcon, draggable: true })
                .addTo(map).on('dragend', handleStartMarkerDragEnd);
        } else {
            currentEndLocation = selectedLocation;
            if (endMarker) map.removeLayer(endMarker);
            endMarker = L.marker([selectedLocation.lat, selectedLocation.lng], { icon: endIcon, draggable: true })
                .addTo(map).on('dragend', handleEndMarkerDragEnd);
        }
        updateRoute();
    };

    document.getElementById('close-popup').onclick = () => {
        sidebarPopup.classList.add('hidden');
        adjustControlPositions();
    };
}

function showRoutingSidebar(route) {
    const distance = (route.summary.totalDistance / 1000).toFixed(1);
    const time = Math.round(route.summary.totalTime / 60);
    let instructionsHTML = '<ul class="instructions-list">';

    route.instructions.forEach((instruction, index) => {
        const distance = instruction.distance > 0 ? `${Math.round(instruction.distance)} m` : '';
        const direction = getDirectionText(instruction);
        instructionsHTML += `
            <li class="instruction-item">
                <span class="instruction-icon">${getDirectionIcon(instruction)}</span>
                <span class="instruction-text">${direction} ${instruction.road ? `onto ${instruction.road}` : ''}</span>
                <span class="instruction-distance">${distance}</span>
            </li>`;
    });
    instructionsHTML += '</ul>';

    const content = `
        <h3>Tuyến đường</h3>
        <p>Khoảng cách: ${distance} km, Thời gian: ${time} phút</p>
        ${instructionsHTML}
        <button class="close-button" id="close-routing">Đóng</button>
    `;

    sidebarRouting.innerHTML = `<div class="sidebar-content">${content}</div>`;
    sidebarRouting.classList.remove('hidden');
    adjustControlPositions();

    document.getElementById('close-routing').onclick = () => {
        sidebarRouting.classList.add('hidden');
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
        }
        adjustControlPositions();
    };
}

// Hàm chuyển đổi hướng dẫn thành văn bản tiếng Việt
function getDirectionText(instruction) {
    switch (instruction.text.toLowerCase()) {
        case 'head':
        case 'continue':
            return 'Tiếp tục';
        case 'turn left':
            return 'Rẽ trái';
        case 'turn right':
            return 'Rẽ phải';
        case 'enter roundabout':
            return 'Vào vòng xuyến';
        case 'take the 3rd exit':
            return 'Đi theo lối ra thứ 3';
        case 'exit the traffic circle':
            return 'Thoát khỏi vòng xuyến';
        default:
            return instruction.text;
    }
}

// Hàm lấy biểu tượng hướng dẫn
function getDirectionIcon(instruction) {
    const text = instruction.text.toLowerCase();
    if (text.includes('left')) return '←';
    if (text.includes('right')) return '→';
    if (text.includes('continue') || text.includes('head')) return '↑';
    if (text.includes('roundabout') || text.includes('traffic circle')) return '↻';
    return '•';
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
                if (!element.properties) return '';
                const { name, address, amenity, display_name } = element.properties;
                mainDisplay = (name || display_name || "Không rõ").replace(regex, str => `<b>${str}</b>`);
                if (searchType === 'nominatim') {
                    const details = [element.properties.address?.road, element.properties.address?.suburb, element.properties.address?.city].filter(Boolean).join(", ");
                    if (details) detailsDisplay = `<div class="address-details">${details}</div>`;
                } else {
                    if (address && address.toLowerCase() !== (name || '').toLowerCase()) detailsDisplay += `<div class="address-details">${address}</div>`;
                    if (amenity) detailsDisplay += `<div class="place-item ${amenity.toLowerCase()}">(${amenity.toUpperCase()})</div>`;
                }
                try {
                    const resultString = JSON.stringify(resultObject).replace(/'/g, "'").replace(/"/g, "");
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
                    popupContent = `<h3>Điểm bắt đầu:</h3><p>${locationName}</p>`;
                    selectedLocation = { lat, lng };
                    showPopupSidebar(popupContent, true);
                } else {
                    const coords = object.geometry?.coordinates;
                    if (!coords || coords.length !== 2) throw new Error("Invalid coords (JSON)");
                    lng = coords[1]; lat = coords[0];
                    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("Invalid values (JSON)");
                    locationName = object.properties?.name || locationName;
                    popupContent = `<h3>Điểm đến:</h3><p>${locationName}</p>`;
                    const { address, amenity, phone, description, image_url } = object.properties || {};
                    if (address) popupContent += `<p><small>Địa chỉ: ${address}</small></p>`;
                    if (amenity) popupContent += `<p><small>(${amenity.toUpperCase()})</small></p>`;
                    if (phone) popupContent += `<p><small>Điện thoại: ${phone}</small></p>`;
                    if (description) popupContent += `<p><small>Mô tả: ${description}</small></p>`;
                    if (image_url) popupContent += `<p><img src="${image_url}" alt="${locationName}" style="max-width: 100%; max-height: 150px; margin-top: 10px;"></p>`;
                    selectedLocation = { lat, lng };
                    showPopupSidebar(popupContent, false);
                }
                if (input) input.value = locationName;
                map.setView([lat, lng], clickMarkerZoom);
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
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    if (!currentStartLocation || !currentEndLocation) {
        console.log("Route not drawn: Missing start or end location.");
        alert("Vui lòng chọn cả điểm bắt đầu và điểm đến trước khi dẫn đường.");
        return;
    }

    const waypoints = [
        L.latLng(currentStartLocation.lat, currentStartLocation.lng),
        L.latLng(currentEndLocation.lat, currentEndLocation.lng)
    ];

    routingControl = L.Routing.control({
        waypoints,
        routeWhileDragging: false,
        show: false,
        lineOptions: { styles: [{ color: "blue", opacity: 0.8, weight: 6 }] },
        addWaypoints: false,
        draggableWaypoints: false,
        createMarker: () => null,
    }).addTo(map);

    routingControl.on('routingerror', (e) => {
        console.error("Routing Error:", e.error?.message || e.error);
        alert("Không tìm thấy đường đi giữa hai điểm.");
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
        }
    });

    routingControl.on('routesfound', (e) => {
        if (e.routes?.length > 0) {
            const route = e.routes[0];
            showRoutingSidebar(route);
        }
    });
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
            .addTo(map).on('dragend', handleStartMarkerDragEnd);

        document.getElementById('start-search').value = '';
    },
        (error) => {
            document.body.style.cursor = 'default';
            console.error("Geolocation Error:", error.code, error.message);
            alert(`Không thể lấy vị trí.\nLỗi: ${error.message}`);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
}

// --- Custom Controls ---
L.Control.CurrentLocation = L.Control.extend({
    options: { position: 'topright' }, // Mặc định bên phải
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
        const div = L.DomUtil.create("div", "description");
        L.DomEvent.disableClickPropagation(div);
        div.innerHTML = "Tìm điểm bắt đầu (S). Tìm điểm đến khẩn cấp (Đ).";
        return div;
    }
});
L.control.legend = (opts) => new L.Control.Legend(opts);

// --- Adjust Control Positions ---
map.zoomControl.setPosition('topleft'); // Mặc định bên trái
L.control.fullscreen({ position: 'topleft' }).addTo(map); // Mặc định bên trái
L.control.currentLocation({ position: 'topright' }).addTo(map); // Mặc định bên phải
L.control.legend().addTo(map);

// --- Initialization ---
function initializeMapAndData(initialLat, initialLng) {
    console.log(`Initializing map at: [${initialLat.toFixed(5)}, ${initialLng.toFixed(5)}]`);
    currentStartLocation = { lat: initialLat, lng: initialLng };
    currentEndLocation = null;
    map.setView([initialLat, initialLng], initialZoom);

    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routingControl) map.removeControl(routingControl);
    startMarker = endMarker = routingControl = null;
    const startInput = document.getElementById('start-search');
    const endInput = document.getElementById('end-search');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    startMarker = L.marker([initialLat, initialLng], { icon: startIcon, draggable: true })
        .addTo(map).on('dragend', handleStartMarkerDragEnd);

    setupAutocomplete("start-search", 'nominatim');
    setupAutocomplete("end-search", 'clientSide');

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