// --- Cấu hình ---
const config = { minZoom: 7, maxZoom: 18, fullscreenControl: true };
const initialZoom = 15;
const clickMarkerZoom = 18;
const defaultLat = 10.7769; // Trung tâm TP.HCM
const defaultLng = 106.7009;

// --- Biến toàn cục ---
const map = L.map("map", config);
let routingControl = null;
let startMarker = null;
let endMarker = null;
let currentStartLocation = { lat: defaultLat, lng: defaultLng };
let currentEndLocation = null;
let allEmergencyFeatures = []; // Đổi tên cho rõ ràng
let emergencyDataLoaded = false;
let selectedLocation = null;
let policeLayer = null;
let pcccLayer = null;
let hospitalLayer = null;

// --- Biểu tượng (Icons) ---
const startIcon = L.divIcon({ className: "start-marker", html: '<span>S</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const endIcon = L.divIcon({ className: "end-marker", html: '<span>Đ</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const policeIcon = L.divIcon({ className: 'emergency-marker police-marker', html: '<b>P</b>', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });
const pcccIcon = L.divIcon({ className: 'emergency-marker pccc-marker', html: '<b>F</b>', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });
const hospitalIcon = L.divIcon({ className: 'emergency-marker hospital-marker', html: '<b>H</b>', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });

// --- Lớp bản đồ ---
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// --- Hàm tiện ích ---
async function fetchStaticData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        const data = await response.json();
        return data?.features || [];
    } catch (err) {
        console.error(`Lỗi khi lấy dữ liệu tĩnh (${url}):`, err);
        throw err; // Ném lại lỗi để được bắt bởi loadEmergencyData
    }
}

// --- Tải dữ liệu và hiển thị Lớp ---
async function loadEmergencyData() {
    const filesToLoad = ['/static/data/hospital.json', '/static/data/PCCC.json', '/static/data/police.json'];
    const endSearchInput = document.getElementById('end-search');
    if (endSearchInput) { endSearchInput.placeholder = "Đang tải..."; endSearchInput.disabled = true; }

    try {
        const results = await Promise.all(filesToLoad.map(fetchStaticData));
        allEmergencyFeatures = results.flat().filter(f =>
            f?.geometry?.type === 'Point' &&
            Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length === 2 &&
            typeof f.geometry.coordinates[0] === 'number' && typeof f.geometry.coordinates[1] === 'number'
        );
        emergencyDataLoaded = true;
        console.log(`Đã tải và lọc ${allEmergencyFeatures.length} địa điểm khẩn cấp hợp lệ.`);
        if (endSearchInput) { endSearchInput.disabled = false; endSearchInput.placeholder = "Tìm BV, PCCC, CA..."; }
        displayEmergencyLayers();
    } catch (error) {
        console.error("Không thể tải dữ liệu khẩn cấp:", error);
        alert("Lỗi tải dữ liệu điểm đến khẩn cấp.");
        if (endSearchInput) { endSearchInput.placeholder = "Lỗi tải dữ liệu"; endSearchInput.disabled = false; }
        emergencyDataLoaded = false;
    }
}

// Hàm hỗ trợ tạo từng lớp khẩn cấp
function createEmergencyLayer(features, icon, mapInstance, clickHandler) {
    if (!features || features.length === 0) return null;
    return L.geoJSON({ type: "FeatureCollection", features: features }, {
        pointToLayer: (feature, latlng) => {
            // **KIỂM TRA THỨ TỰ TỌA ĐỘ TRONG JSON!** Giả sử là [Lat, Lng]
            const coords = feature.geometry.coordinates;
            if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
                console.warn("Tọa độ không hợp lệ trong feature:", feature);
                return null; // Bỏ qua điểm không hợp lệ
            }
            const correctLatLng = L.latLng(coords[0], coords[1]);
            return L.marker(correctLatLng, { icon: icon });
        },
        onEachFeature: (feature, layer) => {
            layer.on('click', (e) => clickHandler(e, feature));
        }
    }).addTo(mapInstance);
}

// Hiển thị tất cả các lớp khẩn cấp
function displayEmergencyLayers() {
    // Xóa các lớp hiện có
    [policeLayer, pcccLayer, hospitalLayer].forEach(layer => {
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
    policeLayer = pcccLayer = hospitalLayer = null;

    if (!emergencyDataLoaded || allEmergencyFeatures.length === 0) {
        console.warn("Không có dữ liệu khẩn cấp để hiển thị.");
        return;
    }

    // Lọc dữ liệu - Khớp giá trị `amenity` trong JSON mới nhất (không phân biệt hoa thường)
    const policeData = allEmergencyFeatures.filter(f => f.properties?.amenity?.toLowerCase() === 'police');
    const pcccData = allEmergencyFeatures.filter(f => f.properties?.amenity?.toLowerCase() === 'pccc'); // ĐÃ SỬA
    const hospitalData = allEmergencyFeatures.filter(f => f.properties?.amenity?.toLowerCase() === 'hospital');

    // Tạo lớp bằng hàm hỗ trợ
    policeLayer = createEmergencyLayer(policeData, policeIcon, map, handleEmergencyMarkerClick);
    pcccLayer = createEmergencyLayer(pcccData, pcccIcon, map, handleEmergencyMarkerClick);
    hospitalLayer = createEmergencyLayer(hospitalData, hospitalIcon, map, handleEmergencyMarkerClick);

    if (policeLayer) console.log(`Đã thêm ${policeData.length} điểm Công an.`); else console.warn("Không tìm thấy dữ liệu 'police' hợp lệ.");
    if (pcccLayer) console.log(`Đã thêm ${pcccData.length} điểm PCCC.`); else console.warn("Không tìm thấy dữ liệu 'PCCC' hợp lệ.");
    if (hospitalLayer) console.log(`Đã thêm ${hospitalData.length} điểm Bệnh viện.`); else console.warn("Không tìm thấy dữ liệu 'hospital' hợp lệ.");
}

// --- Xử lý sự kiện click marker ---
function handleEmergencyMarkerClick(event, feature) {
    L.DomEvent.stopPropagation(event);

    const properties = feature.properties;
    const geometry = feature.geometry;

    if (!properties || !geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) {
        console.warn("Dữ liệu marker không hợp lệ:", feature); return;
    }

    // **KIỂM TRA THỨ TỰ TỌA ĐỘ TRONG JSON!** Giả sử là [Lat, Lng]
    const lat = geometry.coordinates[0];
    const lng = geometry.coordinates[1];

    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn("Giá trị tọa độ không hợp lệ từ marker:", feature); return;
    }

    const locationName = properties.name || "Địa điểm khẩn cấp";
    let popupContent = `<h3>Điểm đến:</h3><p><b>${locationName}</b></p>`;
    const { address, amenity, phone, description, image_url } = properties;
    if (address) popupContent += `<p><small>Địa chỉ: ${address}</small></p>`;
    if (amenity) popupContent += `<p><small>(${amenity.toUpperCase()})</small></p>`;
    if (phone) popupContent += `<p><small>Điện thoại: <a href="tel:${phone}">${phone}</a></small></p>`;
    if (description) popupContent += `<p><small>Mô tả: ${description}</small></p>`;
    if (image_url && image_url.startsWith('http')) {
        popupContent += `<p><img src="${image_url}" alt="${locationName}" style="max-width: 100%; max-height: 150px; margin-top: 10px; border-radius: 4px;"></p>`;
    }

    selectedLocation = { lat, lng };
    showPopupSidebar(popupContent, false); // Hiển thị sidebar cho điểm Đến
    map.flyTo([lat, lng], clickMarkerZoom);
}

// --- Điều khiển Sidebar ---
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
            console.warn("Nhấn nút Dẫn đường nhưng không có selectedLocation.");
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
        selectedLocation = null; // Đặt lại lựa chọn tạm thời
    };

    document.getElementById('close-popup').onclick = () => {
        sidebarPopup.classList.add('hidden'); adjustControlPositions();
        selectedLocation = null; // Đặt lại nếu đóng mà không dẫn đường
    };
}

function showRoutingSidebar(route) {
    const distance = (route.summary.totalDistance / 1000).toFixed(1);
    const time = Math.round(route.summary.totalTime / 60);
    let instructionsHTML = '<ul class="instructions-list">';
    route.instructions.forEach((instruction) => {
        const stepDistance = instruction.distance > 0 ? `${Math.round(instruction.distance)} m` : '';
        // --- SỬ DỤNG MODULE ĐÃ TÁCH ---
        const directionText = VietnameseDirections.getText(instruction);
        const directionIcon = VietnameseDirections.getIcon(instruction);
        // --- KẾT THÚC SỬ DỤNG MODULE ---
        instructionsHTML += `
            <li class="instruction-item">
                <span class="instruction-icon">${directionIcon}</span>
                <span class="instruction-text">${directionText} ${instruction.road ? `vào ${instruction.road}` : ''}</span>
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

// --- Thiết lập Autocomplete ---
function setupAutocomplete(inputId, searchType) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) { console.error(`Không tìm thấy Input #${inputId}!`); return; }

    if (searchType === 'clientSide') {
        inputElement.disabled = !emergencyDataLoaded;
        inputElement.placeholder = emergencyDataLoaded ? "Tìm BV, PCCC, CA..." : "Đang tải...";
    }

    new Autocomplete(inputId, {
        delay: 400, selectFirst: true, howManyCharacters: 1,

        onSearch: ({ currentValue }) => {
            const query = currentValue.trim();
            if (!query) return [];

            if (searchType === 'nominatim') {
                const nominatimQuery = query.toLowerCase().includes("hồ chí minh") ? query : `${query}, Ho Chi Minh City`;
                const api = `https://nominatim.openstreetmap.org/search?format=geojson&limit=5&q=${encodeURI(nominatimQuery)}&countrycodes=vn&addressdetails=1&accept-language=vi`;
                return fetch(api, { headers: { "User-Agent": "SOSMapApp/1.0 (non-commercial use)" } })
                    .then(response => response.ok ? response.json() : Promise.reject(`Nominatim ${response.statusText}`))
                    .then(data => data?.features || [])
                    .catch(error => { console.error("Lỗi Nominatim:", error); return []; });
            } else if (searchType === 'clientSide') {
                if (!emergencyDataLoaded) return [];
                try {
                    const regex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "i");
                    return allEmergencyFeatures
                        .filter(el => el.properties?.name?.match(regex) || el.properties?.amenity?.match(regex))
                        .sort((a, b) => (a.properties?.name || '').localeCompare(b.properties?.name || ''));
                } catch (e) { console.error("Lỗi Regex:", e); return []; }
            }
            return [];
        },

        onResults: ({ currentValue, matches, template }) => {
            if (!matches || matches.length === 0) return template ? template(`<li>Không tìm thấy '${currentValue}'</li>`) : '';
            const regex = new RegExp(currentValue.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "i");
            return matches.map((element) => {
                let mainDisplay = "N/A", detailsDisplay = "";
                if (!element?.properties) return '';
                const { name, address, amenity, display_name } = element.properties;
                mainDisplay = (name || display_name || "Không rõ").replace(regex, str => `<b>${str}</b>`);
                if (searchType === 'nominatim') {
                    const details = [element.properties.address?.road, element.properties.address?.suburb, element.properties.address?.city].filter(Boolean).join(", ");
                    if (details) detailsDisplay = `<div class="address-details">${details}</div>`;
                } else {
                    if (address && address.toLowerCase() !== (name || '').toLowerCase()) detailsDisplay += `<div class="address-details">${address}</div>`;
                    const amenityDisplay = amenity ? amenity.replace(regex, str => `<b>${str}</b>`) : '';
                    if (amenityDisplay) detailsDisplay += `<div class="place-item ${amenity.toLowerCase()}">(${amenityDisplay.toUpperCase()})</div>`;
                }
                try {
                    // Sử dụng JSON.stringify trong thuộc tính data cần escape/encoding cẩn thận
                    const resultString = JSON.stringify(element).replace(/'/g, "&apos;"); // Escape cơ bản dấu nháy đơn
                    return `<li role="option" data-result='${resultString}'><div class="address-main">${mainDisplay}</div>${detailsDisplay}</li>`;
                } catch (e) { console.error("Lỗi stringify:", e, element); return ''; }
            }).join("");
        },

        onSubmit: ({ input, object }) => {
            if (!object) { console.warn("onSubmit thiếu object."); return; }
            let lat, lng, locationName = "Địa điểm", popupContent = "";
            try {
                if (searchType === 'nominatim') {
                    const coords = object.geometry?.coordinates;
                    if (!coords || coords.length !== 2) throw new Error("Tọa độ Nominatim không hợp lệ");
                    lng = coords[0]; lat = coords[1];
                    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("Giá trị tọa độ Nominatim không hợp lệ");
                    locationName = object.properties?.name || object.properties?.display_name || locationName;
                    popupContent = `<h3>Điểm bắt đầu:</h3><p><b>${locationName}</b></p>`;
                    const details = [object.properties.address?.road, object.properties.address?.suburb, object.properties.address?.city].filter(Boolean).join(", ");
                    if (details) popupContent += `<p><small>${details}</small></p>`;
                    selectedLocation = { lat, lng };
                    showPopupSidebar(popupContent, true); // isStart = true
                } else { // clientSide (Địa điểm khẩn cấp)
                    const coords = object.geometry?.coordinates;
                    if (!coords || coords.length !== 2) throw new Error("Tọa độ JSON không hợp lệ");
                    // **GIẢ SỬ TỌA ĐỘ JSON LÀ [Lat, Lng]** - KIỂM TRA LẠI FILE JSON!
                    lat = coords[0]; lng = coords[1];
                    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("Giá trị tọa độ JSON không hợp lệ");
                    locationName = object.properties?.name || locationName;
                    popupContent = `<h3>Điểm đến:</h3><p><b>${locationName}</b></p>`;
                    const { address, amenity, phone, description, image_url } = object.properties || {};
                    if (address) popupContent += `<p><small>Địa chỉ: ${address}</small></p>`;
                    if (amenity) popupContent += `<p><small>(${amenity.toUpperCase()})</small></p>`;
                    if (phone) popupContent += `<p><small>Điện thoại: <a href="tel:${phone}">${phone}</a></small></p>`;
                    if (description) popupContent += `<p><small>Mô tả: ${description}</small></p>`;
                    if (image_url && image_url.startsWith('http')) {
                        popupContent += `<p><img src="${image_url}" alt="${locationName}" style="max-width: 100%; max-height: 150px; margin-top: 10px; border-radius: 4px;"></p>`;
                    }
                    selectedLocation = { lat, lng };
                    showPopupSidebar(popupContent, false); // isStart = false
                }
                if (input) input.value = locationName;
                map.flyTo([lat, lng], clickMarkerZoom);
            } catch (error) {
                console.error("Lỗi xử lý lựa chọn autocomplete:", error, object);
                alert("Lỗi khi chọn địa điểm.");
                if (input) input.value = '';
                selectedLocation = null;
            }
        },
        noResults: ({ currentValue, template }) => template(`<li>Không tìm thấy '${currentValue}'</li>`),
    });
}


// --- Cập nhật/Vẽ lộ trình ---
function updateRoute() {
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    if (!currentStartLocation || !currentEndLocation) {
        // Không vẽ nếu thiếu điểm (ví dụ: khi khởi tạo hoặc sau khi xóa)
        return;
    }
    const waypoints = [
        L.latLng(currentStartLocation.lat, currentStartLocation.lng),
        L.latLng(currentEndLocation.lat, currentEndLocation.lng)
    ];
    routingControl = L.Routing.control({
        waypoints, routeWhileDragging: false, show: false, // Ẩn hướng dẫn mặc định
        lineOptions: { styles: [{ color: "blue", opacity: 0.8, weight: 6 }] },
        addWaypoints: false, draggableWaypoints: false, createMarker: () => null, // Sử dụng marker của chúng ta
    }).addTo(map);

    routingControl.on('routingerror', (e) => {
        console.error("Lỗi định tuyến:", e.error?.message || e.error);
        alert(`Không tìm thấy đường đi.\nLỗi: ${e.error?.message || 'Không rõ'}`);
        if (routingControl) { map.removeControl(routingControl); routingControl = null; }
        sidebarRouting.classList.add('hidden'); adjustControlPositions(); // Ẩn sidebar hướng dẫn khi có lỗi
    });
    routingControl.on('routesfound', (e) => {
        if (e.routes?.length > 0) { showRoutingSidebar(e.routes[0]); }
        else {
            alert("Tìm thấy sự kiện đường đi nhưng không có lộ trình.");
            sidebarRouting.classList.add('hidden'); adjustControlPositions();
        }
    });
}

// --- Xử lý sự kiện ---
function handleStartMarkerDragEnd(e) {
    const newLatLng = e.target.getLatLng().wrap();
    currentStartLocation = { lat: newLatLng.lat, lng: newLatLng.lng };
    updateRoute();
    document.getElementById('start-search').value = `[${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)}]`;
}
function handleEndMarkerDragEnd(e) {
    const newLatLng = e.target.getLatLng().wrap();
    currentEndLocation = { lat: newLatLng.lat, lng: newLatLng.lng };
    updateRoute();
    document.getElementById('end-search').value = `[${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)}]`;
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
        updateRoute(); // Cập nhật lộ trình nếu có điểm đến
        document.getElementById('start-search').value = 'Vị trí hiện tại';
    },
        (error) => {
            document.body.style.cursor = 'default';
            console.error("Lỗi Geolocation:", error.code, error.message);
            alert(`Không thể lấy vị trí.\nLỗi ${error.code}: ${error.message}`);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
}

// --- Điều khiển tùy chỉnh ---
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

// --- Điều chỉnh vị trí điều khiển ---
map.zoomControl.setPosition('topleft');
L.control.fullscreen({ position: 'topleft' }).addTo(map);
L.control.currentLocation({ position: 'topright' }).addTo(map);
L.control.legend().addTo(map);

// --- Khởi tạo ---
function initializeMapAndData(initialLat, initialLng) {
    currentStartLocation = { lat: initialLat, lng: initialLng };
    currentEndLocation = null;
    selectedLocation = null;
    map.setView([initialLat, initialLng], initialZoom);

    // Xóa trạng thái trước đó
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routingControl) map.removeControl(routingControl);
    [policeLayer, pcccLayer, hospitalLayer].forEach(layer => {
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
    startMarker = endMarker = routingControl = policeLayer = pcccLayer = hospitalLayer = null;

    // Đặt lại UI
    const startInput = document.getElementById('start-search');
    const endInput = document.getElementById('end-search');
    if (startInput) startInput.value = 'Vị trí hiện tại';
    if (endInput) endInput.value = '';
    sidebarPopup.classList.add('hidden');
    sidebarRouting.classList.add('hidden');
    adjustControlPositions();

    // Đặt marker bắt đầu ban đầu
    startMarker = L.marker([initialLat, initialLng], { icon: startIcon, draggable: true })
        .addTo(map).on('dragend', handleStartMarkerDragEnd);

    // Thiết lập tương tác
    setupAutocomplete("start-search", 'nominatim');
    setupAutocomplete("end-search", 'clientSide'); // Sẽ được bật khi dữ liệu tải xong

    // Tải dữ liệu và hiển thị các lớp khẩn cấp
    loadEmergencyData(); // Hàm này giờ xử lý việc hiển thị các lớp khi thành công
    console.log("Khởi tạo bản đồ hoàn tất.");
}

// --- Thực thi chính ---
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