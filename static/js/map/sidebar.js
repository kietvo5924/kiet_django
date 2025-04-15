/* eslint-disable no-undef */

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
        sidebarPopup.classList.add('hidden');
        adjustControlPositions();
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
        const stepDistance = instruction.distance > 0 ? `${Math.round(instruction.distance)} m` : '';
        // Giả định VietnameseDirections đã được import hoặc có sẵn toàn cục
        const directionText = VietnameseDirections.getText(instruction);
        const directionIcon = VietnameseDirections.getIcon(instruction);
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
        sidebarRouting.classList.add('hidden');
        adjustControlPositions();
        // Việc xóa routingControl đã được loại bỏ
    };
}


export {
    showPopupSidebar,
    showRoutingSidebar,
    adjustControlPositions,
    sidebarPopup,         // Export nếu file chính cần truy cập trực tiếp
    sidebarRouting        // Export nếu file chính cần truy cập trực tiếp
};