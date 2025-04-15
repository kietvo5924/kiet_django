const config = { minZoom: 7, maxZoom: 18, fullscreenControl: true };
const initialZoom = 15;
const clickMarkerZoom = 18;
const defaultLat = 10.7769;
const defaultLng = 106.7009;

const map = L.map("map", config);
let routingControl = null;
let startMarker = null;
let endMarker = null;
let currentStartLocation = { lat: defaultLat, lng: defaultLng };
let currentEndLocation = null;
let allEmergencyFeatures = [];
let emergencyDataLoaded = false;
let selectedLocation = null;
let policeLayer = null;
let pcccLayer = null;
let hospitalLayer = null;

const startIcon = L.divIcon({ className: "start-marker", html: '<span>S</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const endIcon = L.divIcon({ className: "end-marker", html: '<span>Đ</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const policeIcon = L.divIcon({ className: 'emergency-marker police-marker', html: '<b>P</b>', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });
const pcccIcon = L.divIcon({ className: 'emergency-marker pccc-marker', html: '<b>F</b>', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });
const hospitalIcon = L.divIcon({ className: 'emergency-marker hospital-marker', html: '<b>H</b>', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

async function fetchApiData(amenityType) {
    const apiUrl = `/maps/api/locations/?amenity=${encodeURIComponent(amenityType)}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status} for ${apiUrl}: ${errorText}`);
        }
        const data = await response.json();
        if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
            throw new Error(`Dữ liệu API không hợp lệ cho ${amenityType}`);
        }
        return data.features;
    } catch (err) {
        console.error(`Lỗi khi lấy dữ liệu API (${amenityType}):`, err);
        throw err;
    }
}

async function loadEmergencyData() {
    const amenitiesToLoad = ['hospital', 'PCCC', 'police'];
    const endSearchInput = document.getElementById('end-search');
    if (endSearchInput) { endSearchInput.placeholder = "Đang tải..."; endSearchInput.disabled = true; }

    try {
        const results = await Promise.all(amenitiesToLoad.map(fetchApiData));
        allEmergencyFeatures = results.flat().filter(f =>
            f?.geometry?.type === 'Point' &&
            Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length === 2 &&
            typeof f.geometry.coordinates[0] === 'number' && typeof f.geometry.coordinates[1] === 'number'
        );
        emergencyDataLoaded = true;
        if (endSearchInput) { endSearchInput.disabled = false; endSearchInput.placeholder = "Tìm BV, PCCC, CA..."; }
        displayEmergencyLayers();
    } catch (error) {
        console.error("Không thể tải dữ liệu khẩn cấp từ API:", error);
        alert("Lỗi tải dữ liệu điểm đến khẩn cấp từ máy chủ.");
        if (endSearchInput) { endSearchInput.placeholder = "Lỗi tải dữ liệu"; endSearchInput.disabled = false; }
        emergencyDataLoaded = false;
    } finally {
        setupAutocomplete("end-search", 'backendSearch');
    }
}

function createEmergencyLayer(features, icon, mapInstance, clickHandler) {
    if (!features || features.length === 0) return null;
    return L.geoJSON({ type: "FeatureCollection", features: features }, {
        pointToLayer: (feature, latlng) => {
            const coords = feature.geometry.coordinates;
            if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
                return null;
            }
            const correctLatLng = L.latLng(coords[0], coords[1]);
            return L.marker(correctLatLng, { icon: icon });
        },
        onEachFeature: (feature, layer) => {
            layer.on('click', (e) => clickHandler(e, feature));
        }
    }).addTo(mapInstance);
}

function displayEmergencyLayers() {
    [policeLayer, pcccLayer, hospitalLayer].forEach(layer => {
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
    policeLayer = pcccLayer = hospitalLayer = null;

    if (!emergencyDataLoaded || allEmergencyFeatures.length === 0) {
        return;
    }

    const policeData = allEmergencyFeatures.filter(f => f.properties?.amenity?.toLowerCase() === 'police');
    const pcccData = allEmergencyFeatures.filter(f => f.properties?.amenity?.toLowerCase() === 'pccc');
    const hospitalData = allEmergencyFeatures.filter(f => f.properties?.amenity?.toLowerCase() === 'hospital');

    policeLayer = createEmergencyLayer(policeData, policeIcon, map, handleEmergencyMarkerClick);
    pcccLayer = createEmergencyLayer(pcccData, pcccIcon, map, handleEmergencyMarkerClick);
    hospitalLayer = createEmergencyLayer(hospitalData, hospitalIcon, map, handleEmergencyMarkerClick);
}

function handleEmergencyMarkerClick(event, feature) {
    L.DomEvent.stopPropagation(event);

    const properties = feature.properties;
    const geometry = feature.geometry;

    if (!properties || !geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) {
        return;
    }

    const lat = geometry.coordinates[0];
    const lng = geometry.coordinates[1];

    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return;
    }

    const locationName = properties.name || "Địa điểm khẩn cấp";
    let popupContent = `<h3>Điểm đến:</h3><p><b>${escapeHtml(locationName)}</b></p>`;
    const { address, amenity, phone, description, image_url } = properties;
    if (address) popupContent += `<p><small>Địa chỉ: ${escapeHtml(address)}</small></p>`;
    if (amenity) popupContent += `<p><small>(${escapeHtml(amenity.toUpperCase())})</small></p>`;
    if (phone) popupContent += `<p><small>Điện thoại: <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></small></p>`;
    if (description) popupContent += `<p><small>Mô tả: ${escapeHtml(description)}</small></p>`;
    if (image_url && typeof image_url === 'string' && (image_url.startsWith('http://') || image_url.startsWith('https://'))) {
        popupContent += `<p><img src="${escapeHtml(image_url)}" alt="${escapeHtml(locationName)}" style="max-width: 100%; max-height: 150px; margin-top: 10px; border-radius: 4px;"></p>`;
    }

    selectedLocation = { lat, lng };
    showPopupSidebar(popupContent, false);
    map.flyTo([lat, lng], clickMarkerZoom);
}

const mapContainer = document.getElementById('map');
const sidebarPopup = document.createElement('div');
sidebarPopup.id = 'sidebar-popup';
sidebarPopup.className = 'sidebar sidebar-left hidden';
mapContainer.appendChild(sidebarPopup);
const sidebarRouting = document.createElement('div');
sidebarRouting.id = 'sidebar-routing';
sidebarRouting.className = 'sidebar sidebar-right hidden';
mapContainer.appendChild(sidebarRouting);

function adjustControlPositions() {
    const isPopupVisible = !sidebarPopup.classList.contains('hidden');
    const isRoutingVisible = !sidebarRouting.classList.contains('hidden');
    const zoomControl = document.querySelector('.leaflet-control-zoom');
    const fullscreenControl = document.querySelector('.leaflet-control-fullscreen');
    const leftMargin = isPopupVisible ? '310px' : '10px';
    if (zoomControl) zoomControl.style.marginLeft = leftMargin;
    if (fullscreenControl) fullscreenControl.style.marginLeft = leftMargin;
    const currentLocationControl = document.querySelector('.leaflet-control-current-location');
    const rightMargin = isRoutingVisible ? '310px' : '10px';
    if (currentLocationControl) currentLocationControl.style.marginRight = rightMargin;
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
        if (!selectedLocation) {
            alert("Vui lòng chọn lại địa điểm.");
            sidebarPopup.classList.add('hidden'); adjustControlPositions(); return;
        }

        if (isStart) {
            currentStartLocation = { lat: selectedLocation.lat, lng: selectedLocation.lng };
            if (startMarker) map.removeLayer(startMarker);
            startMarker = L.marker([currentStartLocation.lat, currentStartLocation.lng], { icon: startIcon, draggable: true })
                .addTo(map).on('dragend', handleStartMarkerDragEnd);
        } else {
            currentEndLocation = { lat: selectedLocation.lat, lng: selectedLocation.lng };
            if (endMarker) map.removeLayer(endMarker);
            endMarker = L.marker([currentEndLocation.lat, currentEndLocation.lng], { icon: endIcon, draggable: true })
                .addTo(map).on('dragend', handleEndMarkerDragEnd);
        }
        updateRoute();
        sidebarPopup.classList.add('hidden'); adjustControlPositions();
        selectedLocation = null;
    };

    document.getElementById('close-popup').onclick = () => {
        sidebarPopup.classList.add('hidden'); adjustControlPositions();
        selectedLocation = null;
    };
}

function showRoutingSidebar(route) {
    const distance = (route.summary.totalDistance / 1000).toFixed(1);
    const time = Math.round(route.summary.totalTime / 60);
    let instructionsHTML = '<ul class="instructions-list">';
    route.instructions.forEach((instruction) => {
        const stepDistance = instruction.distance > 0 ? `${Math.round(instruction.distance)} m` : '';
        const directionText = VietnameseDirections.getText(instruction);
        const directionIcon = VietnameseDirections.getIcon(instruction);
        instructionsHTML += `
            <li class="instruction-item">
                <span class="instruction-icon">${directionIcon}</span>
                <span class="instruction-text">${directionText} ${instruction.road ? `vào ${escapeHtml(instruction.road)}` : ''}</span>
                <span class="instruction-distance">${stepDistance}</span>
            </li>`;
    });
    instructionsHTML += '</ul>';
    const content = `
        <h3>Tuyến đường</h3>
        <p>Khoảng cách: ${distance} km, Thời gian: ~${time} phút</p>
        ${instructionsHTML}
        <button class="close-button" id="close-routing">Đóng</button>
    `;
    sidebarRouting.innerHTML = `<div class="sidebar-content">${content}</div>`;
    sidebarRouting.classList.remove('hidden');
    adjustControlPositions();
    document.getElementById('close-routing').onclick = () => {
        sidebarRouting.classList.add('hidden'); adjustControlPositions();
    };
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return '';
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setupAutocomplete(inputId, searchType) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) {
        console.error(`Không tìm thấy Input #${inputId}!`);
        return;
    }

    if (searchType === 'backendSearch' && !emergencyDataLoaded) {
        inputElement.placeholder = "Đang tải...";
        inputElement.disabled = true;
    } else if (searchType === 'backendSearch') {
        inputElement.placeholder = "Tìm BV, PCCC, CA...";
        inputElement.disabled = false;
    }

    let lastMatches = []; // Lưu trữ danh sách kết quả tìm kiếm cuối cùng

    new Autocomplete(inputId, {
        delay: 400,
        selectFirst: false, // Đảm bảo không tự động chọn mục đầu tiên
        howManyCharacters: 1,

        onSearch: ({ currentValue }) => {
            const query = currentValue.trim().toLowerCase();
            if (!query) return Promise.resolve([]);

            if (searchType === 'nominatim') {
                const nominatimQuery = query.includes("hồ chí minh") ? query : `${query}, Ho Chi Minh City`;
                const api = `https://nominatim.openstreetmap.org/search?format=geojson&limit=5&q=${encodeURI(nominatimQuery)}&countrycodes=vn&addressdetails=1&accept-language=vi`;
                return fetch(api, { headers: { "User-Agent": "SOSMapApp/1.0 (non-commercial use)" } })
                    .then(response => response.ok ? response.json() : Promise.reject(`Nominatim ${response.statusText}`))
                    .then(data => data?.features || [])
                    .catch(error => {
                        console.error("Lỗi Nominatim:", error);
                        return [];
                    });
            } else if (searchType === 'backendSearch') {
                const apiUrl = `/maps/api/search-locations/?query=${encodeURIComponent(query)}`;
                return fetch(apiUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Lỗi API Backend ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (!Array.isArray(data)) {
                            console.error("API backend không trả về một mảng:", data);
                            return [];
                        }
                        return data;
                    })
                    .catch(error => {
                        console.error("Lỗi khi gọi API tìm kiếm backend:", error);
                        return [];
                    });
            }
        },

        onResults: ({ currentValue, matches, template }) => {
            if (!matches || matches.length === 0) {
                return template ? template(`<li>Không tìm thấy kết quả nào cho '${escapeHtml(currentValue)}'</li>`) : '';
            }

            lastMatches = matches; // Lưu trữ danh sách matches để sử dụng trong onSubmit

            const regex = new RegExp(currentValue.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "i");

            return `<ul class="autocomplete-list">` + matches.map((element, index) => {
                let mainDisplay = "N/A", detailsDisplay = "";
                if (!element || typeof element !== 'object') return '';

                if (searchType === 'nominatim') {
                    const { name, display_name } = element.properties || {};
                    mainDisplay = (name || display_name || "Không rõ").replace(regex, str => `<b>${str}</b>`);
                    const details = [element.properties?.address?.road, element.properties?.address?.suburb, element.properties?.address?.city].filter(Boolean).join(", ");
                    if (details) detailsDisplay = `<div class="address-details">${escapeHtml(details)}</div>`;
                } else {
                    const { name, address, amenity } = element;
                    if (!name) return '';
                    mainDisplay = escapeHtml(name).replace(regex, str => `<b>${str}</b>`);
                    if (address && address.toLowerCase() !== name.toLowerCase()) {
                        detailsDisplay += `<div class="address-details">${escapeHtml(address)}</div>`;
                    }
                    const amenityDisplay = amenity ? escapeHtml(amenity).replace(regex, str => `<b>${str}</b>`) : '';
                    if (amenityDisplay) detailsDisplay += `<div class="place-item ${escapeHtml(amenity.toLowerCase())}">(${amenityDisplay.toUpperCase()})</div>`;
                }

                try {
                    const resultString = JSON.stringify(element).replace(/'/g, "\\'");
                    return `<li role="option" id="autocomplete-item-${index}" data-result='${resultString}'><div class="address-main">${mainDisplay}</div>${detailsDisplay}</li>`;
                } catch (e) {
                    console.error("Lỗi stringify:", e, element);
                    return '';
                }
            }).join("") + `</ul>`;
        },

        onSubmit: ({ element, object }) => {
            console.log("onSubmit triggered:", { element, object }); // Ghi log để kiểm tra

            const inputElement = document.getElementById(inputId);
            if (!inputElement) {
                console.error(`Không tìm thấy input #${inputId} trong onSubmit`);
                alert("Lỗi hệ thống. Vui lòng thử lại.");
                return;
            }

            let selectedObject = null;

            // Nếu thư viện cung cấp object trực tiếp
            if (object) {
                selectedObject = object;
            } else {
                // Nếu không, tìm trong lastMatches dựa trên giá trị input
                const inputValue = inputElement.value.trim();
                if (!inputValue) {
                    console.error("Giá trị input rỗng");
                    alert("Vui lòng chọn một địa điểm hợp lệ.");
                    return;
                }

                selectedObject = lastMatches.find(match => {
                    if (searchType === 'nominatim') {
                        const { name, display_name } = match.properties || {};
                        return (name || display_name || "Không rõ") === inputValue;
                    } else {
                        return match.name === inputValue;
                    }
                });

                if (!selectedObject) {
                    console.error("Không tìm thấy mục tương ứng trong lastMatches:", inputValue, lastMatches);
                    alert("Vui lòng chọn một địa điểm hợp lệ.");
                    return;
                }
            }

            console.log("Địa điểm được chọn:", selectedObject);

            let lat, lng, locationName = "Địa điểm", popupContent = "";
            try {
                if (searchType === 'nominatim') {
                    const coords = selectedObject.geometry?.coordinates;
                    if (!coords || coords.length !== 2) throw new Error("Tọa độ Nominatim không hợp lệ");
                    lng = coords[0];
                    lat = coords[1];
                    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                        throw new Error("Giá trị tọa độ Nominatim không hợp lệ");
                    }
                    locationName = selectedObject.properties?.name || selectedObject.properties?.display_name || locationName;
                    popupContent = `<h3>Điểm bắt đầu:</h3><p><b>${escapeHtml(locationName)}</b></p>`;
                    const details = [selectedObject.properties.address?.road, selectedObject.properties.address?.suburb, selectedObject.properties.address?.city].filter(Boolean).join(", ");
                    if (details) popupContent += `<p><small>${escapeHtml(details)}</small></p>`;
                    selectedLocation = { lat, lng };
                    showPopupSidebar(popupContent, true);
                } else {
                    lat = selectedObject.latitude;
                    lng = selectedObject.longitude;
                    locationName = selectedObject.name || locationName;

                    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                        throw new Error(`Giá trị tọa độ API không hợp lệ: lat=${lat}, lng=${lng}`);
                    }

                    popupContent = `<h3>Điểm đến:</h3><p><b>${escapeHtml(locationName)}</b></p>`;
                    const { address, amenity, phone, description, image_url } = selectedObject;
                    if (address) popupContent += `<p><small>Địa chỉ: ${escapeHtml(address)}</small></p>`;
                    if (amenity) popupContent += `<p><small>(${escapeHtml(amenity.toUpperCase())})</small></p>`;
                    if (phone) popupContent += `<p><small>Điện thoại: <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></small></p>`;
                    if (description) popupContent += `<p><small>Mô tả: ${escapeHtml(description)}</small></p>`;
                    if (image_url && typeof image_url === 'string' && (image_url.startsWith('http://') || image_url.startsWith('https://'))) {
                        popupContent += `<p><img src="${escapeHtml(image_url)}" alt="${escapeHtml(locationName)}" style="max-width: 100%; max-height: 150px; margin-top: 10px; border-radius: 4px;"></p>`;
                    }
                    selectedLocation = { lat, lng };
                    showPopupSidebar(popupContent, false);
                }

                inputElement.value = locationName;

                console.log(`Chuẩn bị flyTo: Lat=${lat}, Lng=${lng}, Zoom=${clickMarkerZoom}`);
                map.flyTo([lat, lng], clickMarkerZoom);

            } catch (error) {
                console.error("Lỗi xử lý lựa chọn autocomplete (onSubmit):", error, selectedObject);
                alert("Lỗi khi chọn địa điểm. Vui lòng thử lại.");
                inputElement.value = '';
                selectedLocation = null;
            }
        },

        noResults: ({ currentValue, template }) => template(`<li>Không tìm thấy '${escapeHtml(currentValue)}'</li>`),
    });
}

function updateRoute() {
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    if (!currentStartLocation || !currentEndLocation) {
        return;
    }
    const waypoints = [
        L.latLng(currentStartLocation.lat, currentStartLocation.lng),
        L.latLng(currentEndLocation.lat, currentEndLocation.lng)
    ];
    routingControl = L.Routing.control({
        waypoints, routeWhileDragging: false, show: false,
        lineOptions: { styles: [{ color: "blue", opacity: 0.8, weight: 6 }] },
        addWaypoints: false, draggableWaypoints: false, createMarker: () => null,
    }).addTo(map);

    routingControl.on('routingerror', (e) => {
        console.error("Lỗi định tuyến:", e.error?.message || e.error);
        alert(`Không tìm thấy đường đi.\nLỗi: ${e.error?.message || 'Không rõ'}`);
        if (routingControl) { map.removeControl(routingControl); routingControl = null; }
        sidebarRouting.classList.add('hidden'); adjustControlPositions();
    });
    routingControl.on('routesfound', (e) => {
        if (e.routes?.length > 0) { showRoutingSidebar(e.routes[0]); }
        else {
            alert("Tìm thấy sự kiện đường đi nhưng không có lộ trình.");
            sidebarRouting.classList.add('hidden'); adjustControlPositions();
        }
    });
}

function handleStartMarkerDragEnd(e) {
    const newLatLng = e.target.getLatLng().wrap();
    currentStartLocation = { lat: newLatLng.lat, lng: newLatLng.lng };
    updateRoute();
    const startInput = document.getElementById('start-search');
    if (startInput) startInput.value = `[${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)}]`;
}
function handleEndMarkerDragEnd(e) {
    const newLatLng = e.target.getLatLng().wrap();
    currentEndLocation = { lat: newLatLng.lat, lng: newLatLng.lng };
    updateRoute();
    const endInput = document.getElementById('end-search');
    if (endInput) endInput.value = `[${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)}]`;
}
function returnToCurrentLocation() {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ định vị.");
    document.body.style.cursor = 'wait';
    navigator.geolocation.getCurrentPosition((position) => {
        document.body.style.cursor = 'default';
        const { latitude: lat, longitude: lng } = position.coords;
        map.flyTo([lat, lng], initialZoom);
        currentStartLocation = { lat, lng };
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker([lat, lng], { icon: startIcon, draggable: true })
            .addTo(map).on('dragend', handleStartMarkerDragEnd);
        updateRoute();
        const startInput = document.getElementById('start-search');
        if (startInput) startInput.value = 'Vị trí hiện tại';
    },
        (error) => {
            document.body.style.cursor = 'default';
            console.error("Lỗi Geolocation:", error.code, error.message);
            alert(`Không thể lấy vị trí.\nLỗi ${error.code}: ${error.message}`);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
}

L.Control.CurrentLocation = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function (map) {
        const container = L.DomUtil.create("div", "leaflet-control-current-location leaflet-bar leaflet-control");
        container.innerHTML = '<span title="Về vị trí của tôi" style="font-size: 1.4em; cursor: pointer;">🎯</span>';
        L.DomEvent.disableClickPropagation(container).on(container, 'click', returnToCurrentLocation);
        return container;
    },
    onRemove: function (map) { L.DomEvent.off(this._container, 'click', returnToCurrentLocation); }
});
L.control.currentLocation = (opts) => new L.Control.CurrentLocation(opts);

L.Control.Legend = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function (map) {
        const div = L.DomUtil.create("div", "description");
        L.DomEvent.disableClickPropagation(div);
        div.innerHTML = "Tìm điểm bắt đầu (S), điểm đến khẩn cấp (Đ). Click P/F/H để chọn.";
        return div;
    }
});
L.control.legend = (opts) => new L.Control.Legend(opts);

map.zoomControl.setPosition('topleft');
L.control.fullscreen({ position: 'topleft' }).addTo(map);
L.control.currentLocation({ position: 'topright' }).addTo(map);
L.control.legend().addTo(map);

function initializeMapAndData(initialLat, initialLng) {
    currentStartLocation = { lat: initialLat, lng: initialLng };
    currentEndLocation = null;
    selectedLocation = null;
    map.setView([initialLat, initialLng], initialZoom);

    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routingControl) map.removeControl(routingControl);
    [policeLayer, pcccLayer, hospitalLayer].forEach(layer => {
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
    startMarker = endMarker = routingControl = policeLayer = pcccLayer = hospitalLayer = null;

    const startInput = document.getElementById('start-search');
    const endInput = document.getElementById('end-search');
    if (startInput) startInput.value = 'Vị trí hiện tại';
    if (endInput) endInput.value = '';
    sidebarPopup.classList.add('hidden');
    sidebarRouting.classList.add('hidden');
    adjustControlPositions();

    startMarker = L.marker([initialLat, initialLng], { icon: startIcon, draggable: true })
        .addTo(map).on('dragend', handleStartMarkerDragEnd);

    setupAutocomplete("start-search", 'nominatim');
    loadEmergencyData();
}

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => { initializeMapAndData(pos.coords.latitude, pos.coords.longitude); },
        (err) => {
            console.warn(`Định vị ban đầu thất bại (${err.code}): ${err.message}. Sử dụng vị trí mặc định.`);
            initializeMapAndData(defaultLat, defaultLng);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
} else {
    console.warn("Geolocation không được hỗ trợ bởi trình duyệt này. Sử dụng vị trí mặc định.");
    initializeMapAndData(defaultLat, defaultLng);
}