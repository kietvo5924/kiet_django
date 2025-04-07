/* eslint-disable no-undef */
/**
 * Simple routing with start and end search, default start at current location
 */

// Config map
let config = {
    minZoom: 7,
    maxZoom: 18,
    fullscreenControl: true,
};
const initialZoom = 15;

// Trung tâm TP.HCM làm mặc định
const defaultLat = 10.7769;
const defaultLng = 106.7009;

// Biến toàn cục
const map = L.map("map", config);
let routingControl = null;
let startMarker = null;
let endMarker = null;
let currentStartLocation = { lat: defaultLat, lng: defaultLng };
let currentEndLocation = null;

// Icons
const startIcon = L.divIcon({
    className: "start-marker",
    html: '<span>S</span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
});
const endIcon = L.divIcon({
    className: "end-marker",
    html: '<span>Đ</span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
});

// Tile Layer
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// --- Tìm kiếm địa chỉ với Nominatim ---
function setupAutocomplete(inputId, isStart) {
    new Autocomplete(inputId, {
        delay: 500,
        selectFirst: true,
        howManyCharacters: 2,

        onSearch: function ({ currentValue }) {
            const query = currentValue.includes("Hồ Chí Minh") || currentValue.includes("TP.HCM") || currentValue.includes("Ho Chi Minh")
                ? currentValue
                : `${currentValue}, Ho Chi Minh City`;
            const api = `https://nominatim.openstreetmap.org/search?format=geojson&limit=5&q=${encodeURI(query)}&countrycodes=vn&addressdetails=1`;
            return new Promise((resolve, reject) => {
                fetch(api, { headers: { "User-Agent": "MyLeafletApp/1.0" } })
                    .then((response) => response.json())
                    .then((data) => (data && data.features ? resolve(data.features) : reject(new Error("No data"))))
                    .catch((error) => reject(error));
            });
        },

        onResults: ({ currentValue, matches, template }) => {
            const regex = new RegExp(currentValue, "i");
            return matches.length === 0
                ? template
                : matches
                    .map((element) => {
                        const { display_name, address, name } = element.properties;
                        let mainName = name || display_name;
                        let details = [];

                        if (address) {
                            if (address.road) details.push(address.road);
                            if (address.suburb) details.push(address.suburb);
                            if (address.city && !address.city.includes("Hồ Chí Minh")) details.push(address.city);
                            if (address.state) details.push(address.state);
                            if (address.country) details.push(address.country);
                        }

                        const mainDisplay = mainName.replace(regex, (str) => `<b>${str}</b>`);
                        const detailsDisplay = details.length > 0 ? `<div class="address-details">${details.join(", ")}</div>` : "";
                        return `
                  <li class="loupe" role="option">
                    <div class="address-main">${mainDisplay}</div>
                    ${detailsDisplay}
                  </li>
                `;
                    })
                    .join("");
        },

        onSubmit: ({ object }) => {
            const { display_name, address, name } = object.properties;
            const cord = object.geometry.coordinates;
            const lat = cord[1];
            const lng = cord[0];
            let popupContent = name ? `<b>${name}</b>` : `<b>${display_name}</b>`;
            if (address) {
                const details = [];
                if (address.road) details.push(address.road);
                if (address.suburb) details.push(address.suburb);
                if (address.city) details.push(address.city);
                if (address.state) details.push(address.state);
                if (address.country) details.push(address.country);
                if (details.length > 0) popupContent += "<br>" + details.join("<br>");
            }

            if (isStart) {
                if (startMarker) map.removeLayer(startMarker);
                startMarker = L.marker([lat, lng], { icon: startIcon, draggable: true })
                    .addTo(map)
                    .bindPopup(popupContent)
                    .openPopup();
                currentStartLocation = { lat, lng };
                startMarker.on('dragend', handleStartMarkerDragEnd);
            } else {
                if (endMarker) map.removeLayer(endMarker);
                endMarker = L.marker([lat, lng], { icon: endIcon, draggable: true })
                    .addTo(map)
                    .bindPopup(popupContent)
                    .openPopup();
                currentEndLocation = { lat, lng };
                endMarker.on('dragend', handleEndMarkerDragEnd);
            }

            updateRoute();
        },

        noResults: ({ currentValue, template }) => template(`<li>Không tìm thấy: '${currentValue}'</li>`),
    });
}

// --- Cập nhật tuyến đường ---
function updateRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    if (currentStartLocation && currentEndLocation) {
        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(currentStartLocation.lat, currentStartLocation.lng),
                L.latLng(currentEndLocation.lat, currentEndLocation.lng),
            ],
            routeWhileDragging: false,
            lineOptions: { styles: [{ color: "red", opacity: 0.7, weight: 8 }] },
            show: true,
            addWaypoints: false,
            draggableWaypoints: false,
            createMarker: () => null,
        }).addTo(map);

        routingControl.on('routingerror', (e) => {
            console.error("Lỗi Routing:", e.error);
            alert("Không thể tìm đường đi.");
            if (routingControl) map.removeControl(routingControl);
            routingControl = null;
        });
    }
}

// --- Xử lý kéo thả marker ---
function handleStartMarkerDragEnd(e) {
    const newLatLng = e.target.getLatLng();
    currentStartLocation = { lat: newLatLng.lat, lng: newLatLng.lng };
    updateRoute();
}

function handleEndMarkerDragEnd(e) {
    const newLatLng = e.target.getLatLng();
    currentEndLocation = { lat: newLatLng.lat, lng: newLatLng.lng };
    updateRoute();
}

// --- Trở về vị trí hiện tại ---
function returnToCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                // Di chuyển bản đồ đến vị trí hiện tại
                map.setView([lat, lng], initialZoom);

                // Cập nhật marker điểm bắt đầu (S)
                if (startMarker) map.removeLayer(startMarker);
                startMarker = L.marker([lat, lng], { icon: startIcon, draggable: true })
                    .addTo(map)
                    .bindPopup("Vị trí hiện tại của bạn (kéo thả để cập nhật)")
                    .openPopup();
                startMarker.on('dragend', handleStartMarkerDragEnd);

                // Cập nhật vị trí hiện tại
                currentStartLocation = { lat, lng };

                // Cập nhật tuyến đường nếu có điểm kết thúc
                updateRoute();
            },
            (error) => {
                console.error("Không thể lấy vị trí hiện tại:", error);
                alert("Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí.");
            },
            { enableHighAccuracy: true }
        );
    } else {
        alert("Trình duyệt của bạn không hỗ trợ định vị.");
    }
}

// --- Tạo control tùy chỉnh cho nút "Trở về vị trí của tôi" ---
L.Control.CurrentLocation = L.Control.extend({
    onAdd: function (map) {
        const div = L.DomUtil.create("div", "leaflet-control-current-location");
        div.innerHTML = "Trở về vị trí của tôi";
        div.onclick = function () {
            returnToCurrentLocation();
        };
        return div;
    },

    onRemove: function (map) {
        // Không cần xử lý gì khi xóa control
    },
});

L.control.currentLocation = function (opts) {
    return new L.Control.CurrentLocation(opts);
};

// --- Khởi tạo ---
function initializeMapAndData(initialLat, initialLng) {
    currentStartLocation = { lat: initialLat, lng: initialLng };
    map.setView([initialLat, initialLng], initialZoom);

    startMarker = L.marker([initialLat, initialLng], { icon: startIcon, draggable: true })
        .addTo(map)
        .bindPopup("Vị trí hiện tại của bạn (kéo thả để cập nhật)");
    startMarker.on('dragend', handleStartMarkerDragEnd);

    setupAutocomplete("start-search", true);
    setupAutocomplete("end-search", false);

    // Thêm nút "Trở về vị trí của tôi" vào bản đồ
    L.control.currentLocation({ position: "topright" }).addTo(map);
}

// --- Khởi tạo bản đồ với vị trí hiện tại ---
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => initializeMapAndData(position.coords.latitude, position.coords.longitude),
        () => initializeMapAndData(defaultLat, defaultLng),
        { enableHighAccuracy: true }
    );
} else {
    initializeMapAndData(defaultLat, defaultLng);
}

// --- Thêm legend ---
const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () {
    let div = L.DomUtil.create("div", "description");
    L.DomEvent.disableClickPropagation(div);
    div.innerHTML = "Nhập điểm bắt đầu (S) và điểm kết thúc (Đ) để tìm đường đi trong TP.HCM.";
    return div;
};
legend.addTo(map);