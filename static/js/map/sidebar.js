/* eslint-disable no-undef */
/**
 * Sidebar functionality for map routing application
 */

let routingControl = null;
let currentStartLocation = null;
let currentEndLocation = null;
let startMarker = null;
let endMarker = null;
const mapContainer = document.getElementById('map');

// Icons (giả định đã được định nghĩa trong file chính)
const startIcon = L.divIcon({ className: "start-marker", html: '<span>S</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const endIcon = L.divIcon({ className: "end-marker", html: '<span>Đ</span>', iconSize: [30, 30], iconAnchor: [15, 15] });

// Sidebar Elements
const sidebarPopup = document.createElement('div');
sidebarPopup.id = 'sidebar-popup';
sidebarPopup.className = 'sidebar sidebar-left hidden';
mapContainer.appendChild(sidebarPopup);

const sidebarRouting = document.createElement('div');
sidebarRouting.id = 'sidebar-routing';
sidebarRouting.className = 'sidebar sidebar-right hidden';
mapContainer.appendChild(sidebarRouting);

// Điều chỉnh vị trí các nút điều khiển
function adjustControlPositions() {
    const isPopupVisible = !sidebarPopup.classList.contains('hidden');
    const isRoutingVisible = !sidebarRouting.classList.contains('hidden');

    const zoomControl = document.querySelector('.leaflet-control-zoom');
    const fullscreenControl = document.querySelector('.leaflet-control-fullscreen');
    if (isPopupVisible) {
        if (zoomControl) zoomControl.style.marginLeft = '310px';
        if (fullscreenControl) fullscreenControl.style.marginLeft = '310px';
    } else {
        if (zoomControl) zoomControl.style.marginLeft = '10px';
        if (fullscreenControl) fullscreenControl.style.marginLeft = '10px';
    }

    const currentLocationControl = document.querySelector('.leaflet-control-current-location');
    if (isRoutingVisible) {
        if (currentLocationControl) currentLocationControl.style.marginRight = '310px';
    } else {
        if (currentLocationControl) currentLocationControl.style.marginRight = '10px';
    }
}

// Hiển thị sidebar popup
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

// Hiển thị sidebar định tuyến
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

// Chuyển đổi hướng dẫn thành văn bản tiếng Việt
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

// Lấy biểu tượng hướng dẫn
function getDirectionIcon(instruction) {
    const text = instruction.text.toLowerCase();
    if (text.includes('left')) return '←';
    if (text.includes('right')) return '→';
    if (text.includes('continue') || text.includes('head')) return '↑';
    if (text.includes('roundabout') || text.includes('traffic circle')) return '↻';
    return '•';
}

// Cập nhật tuyến đường (phụ thuộc map từ file chính)
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

// Xử lý kéo thả marker
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

// Export các hàm cần thiết
export {
    showPopupSidebar,
    showRoutingSidebar,
    adjustControlPositions,
    updateRoute,
    handleStartMarkerDragEnd,
    handleEndMarkerDragEnd,
    currentStartLocation,
    currentEndLocation,
    startMarker,
    endMarker,
    routingControl
};