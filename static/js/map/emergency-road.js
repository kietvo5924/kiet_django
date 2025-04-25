/* eslint-disable no-undef */

const config = { minZoom: 7, maxZoom: 18, fullscreenControl: true };
const initialZoom = 15;
const clickMarkerZoom = 18;
const defaultLat = 10.7769;
const defaultLng = 106.7009;

const mapContainer = document.getElementById('map');
const map = L.map("map", config);
let routingControl = null;
let startMarker = null;
let endMarker = null;
let currentStartLocation = { lat: defaultLat, lng: defaultLng };
let currentEndLocation = null;
let allFeaturesData = {};
let layers = {};
const layersContainer = document.querySelector(".layers");
const layersButton = "không chọn";
const arrayLayers = ["police", "PCCC", "hospital"];
let selectedLocationForRouting = null;

const startIcon = L.divIcon({ className: "start-marker", html: '<span>S</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const endIcon = L.divIcon({ className: "end-marker", html: '<span>Đ</span>', iconSize: [30, 30], iconAnchor: [15, 15] });

const VietnameseDirections = (function () {
  const getModifierText = (mod) => {
    if (!mod) return ''; mod = mod.toLowerCase();
    if (mod.includes('sharp left')) return 'gắt sang trái'; if (mod.includes('sharp right')) return 'gắt sang phải';
    if (mod.includes('slight left')) return 'chếch sang trái'; if (mod.includes('slight right')) return 'chếch sang phải';
    if (mod.includes('left')) return 'trái'; if (mod.includes('right')) return 'phải';
    if (mod.includes('uturn')) return 'quay đầu'; if (mod.includes('straight')) return 'thẳng';
    return mod;
  };
  const getText = function (instruction) {
    if (!instruction) return ''; const { type, modifier } = instruction; const direction = getModifierText(modifier);
    switch (type) {
      case 'Depart': return `Khởi hành ${direction ? `về hướng ${direction}` : ''}`;
      case 'Head': case 'Continue': return `Tiếp tục đi thẳng ${direction ? `về hướng ${direction}` : ''}`;
      case 'Turn': if (direction === 'quay đầu') return 'Quay đầu'; return `Rẽ ${direction || 'theo hướng không xác định'}`;
      case 'Right': return `Rẽ ${direction || 'phải'}`; case 'Left': return `Rẽ ${direction || 'trái'}`;
      case 'Fork': return `Đi theo nhánh ${direction || 'phải'}`; case 'Merge': return `Nhập làn ${direction || ''}`;
      case 'Roundabout': case 'Rotary': const exitText = instruction.exit ? ` đi theo lối ra thứ ${instruction.exit}` : ''; return `Vào ${type === 'Rotary' ? 'bùng binh' : 'vòng xuyến'}${exitText}`;
      case 'RoundaboutTurn': const turnExitText = instruction.exit ? `lối ra thứ ${instruction.exit}` : 'lối ra'; const locationName = instruction.name ? `tại ${instruction.name}` : `tại ${type === 'Rotary' ? 'bùng binh' : 'vòng xuyến'}`; return `${locationName}, đi theo ${turnExitText} ${direction ? `về hướng ${direction}` : ''}`;
      case 'EndOfRoad': return `Cuối đường, rẽ ${direction || 'theo hướng không xác định'}`;
      case 'NewName': return `Tiếp tục đi vào ${instruction.road || instruction.name || 'đường mới'}`;
      case 'Arrive': return `Đã đến nơi ${direction ? `ở phía ${direction}` : ''}`;
      default: if (type?.toLowerCase() === 'right') return 'Rẽ phải'; if (type?.toLowerCase() === 'left') return 'Rẽ trái'; if (type?.toLowerCase() === 'straight') return 'Đi thẳng'; return `${type || ''} ${modifier || ''}`.trim();
    }
  };
  const getIcon = function (instruction) {
    if (!instruction) return '•'; const { type, modifier } = instruction; const modLower = modifier?.toLowerCase();
    switch (type) {
      case 'Depart': case 'Head': case 'Continue': if (modLower?.includes('left')) return '↖'; if (modLower?.includes('right')) return '↗'; return '↑';
      case 'Turn': case 'Right': case 'Left': case 'Fork': case 'EndOfRoad': if (modLower?.includes('sharp left')) return '↩'; if (modLower?.includes('sharp right')) return '↪'; if (modLower?.includes('slight left') || modLower?.includes('left')) return '←'; if (modLower?.includes('slight right') || modLower?.includes('right')) return '→'; if (modLower?.includes('uturn')) return '⤸'; if (modLower?.includes('straight')) return '↑'; if (type === 'Left') return '←'; if (type === 'Right') return '→'; return '↔';
      case 'Merge': return '⤭'; case 'Roundabout': case 'Rotary': case 'RoundaboutTurn': return '↻';
      case 'NewName': return '→'; case 'Arrive': return '📍'; default: return '•';
    }
  };
  return { getText: getText, getIcon: getIcon };
})();

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') { return ''; }
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180; const Δφ = (lat2 - lat1) * Math.PI / 180; const Δλ = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2); return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const sidebarPopup = document.createElement('div');
sidebarPopup.id = 'sidebar-popup';
sidebarPopup.className = 'sidebar sidebar-left hidden';
if (mapContainer) mapContainer.appendChild(sidebarPopup);

const sidebarRouting = document.createElement('div');
sidebarRouting.id = 'sidebar-routing';
sidebarRouting.className = 'sidebar sidebar-right hidden';
if (mapContainer) mapContainer.appendChild(sidebarRouting);

function adjustControlPositions() {
  // Đảm bảo các sidebars đã được thêm vào DOM và map container tồn tại
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  const sidebarPopup = mapContainer.querySelector('#sidebar-popup');
  const sidebarRouting = mapContainer.querySelector('#sidebar-routing');

  if (!sidebarPopup || !sidebarRouting) {
    // Sidebars chưa sẵn sàng, không thể điều chỉnh vị trí control
    return;
  }

  const isPopupVisible = !sidebarPopup.classList.contains('hidden');
  const isRoutingVisible = !sidebarRouting.classList.contains('hidden');

  // Khoảng cách dịch chuyển khi sidebar mở (bằng chiều rộng sidebar)
  const offset = '310px'; // Dựa trên chiều rộng sidebar bạn thiết lập (~300px) cộng thêm padding nếu cần

  // Điều chỉnh container control bên trái (.leaflet-top.leaflet-left)
  const leftContainer = document.querySelector('.leaflet-top.leaflet-left');
  if (leftContainer) {
    // Di chuyển toàn bộ container bằng thuộc tính 'left'
    const targetLeft = isPopupVisible ? offset : '0px';
    // Chỉ áp dụng style nếu giá trị đích khác với hiện tại để tránh lặp không cần thiết
    if (leftContainer.style.left !== targetLeft) {
      // Thêm transition cho hiệu ứng di chuyển mượt trước khi thay đổi thuộc tính
      leftContainer.style.transition = 'left 0.3s ease-in-out';
      leftContainer.style.left = targetLeft;
    }

    // Tùy chọn: Đặt lại các style inline (margin, position, zIndex, transition)
    // trên các control riêng lẻ nếu chúng còn sót lại từ các lần thử trước,
    // vì giờ đây việc định vị do container đảm nhiệm.
    ['.leaflet-control-zoom', '.leaflet-control-fullscreen', '.leaflet-control-search-recenter', '.leaflet-control-search-zoomfull'].forEach(selector => {
      const control = document.querySelector(selector);
      if (control) {
        control.style.marginLeft = ''; // Đặt lại margin
        control.style.position = ''; // Đặt lại position
        control.style.zIndex = ''; // Đặt lại zIndex
        control.style.transition = ''; // Đặt lại transition
      }
    });
  }

  // Điều chỉnh container control bên phải (.leaflet-top.leaflet-right)
  const rightContainer = document.querySelector('.leaflet-top.leaflet-right');
  if (rightContainer) {
    // Di chuyển toàn bộ container bằng thuộc tính 'right'
    const targetRight = isRoutingVisible ? offset : '0px';
    if (rightContainer.style.right !== targetRight) {
      rightContainer.style.transition = 'right 0.3s ease-in-out';
      rightContainer.style.right = targetRight;
    }
    // Tùy chọn: Đặt lại các style inline trên các control riêng lẻ bên phải
    ['.leaflet-control-current-location', '.leaflet-control-emergency-recenter', '.leaflet-control-emergency-zoomfull'].forEach(selector => {
      const control = document.querySelector(selector);
      if (control) {
        control.style.marginRight = ''; // Đặt lại margin
        control.style.position = ''; // Đặt lại position
        control.style.zIndex = ''; // Đặt lại zIndex
        control.style.transition = ''; // Đặt lại transition
      }
    });
  }
}

function showPopupSidebar(properties, coords) {
  if (!properties || !coords) {
    console.error("Invalid data for popup sidebar.");
    return;
  }

  selectedLocationForRouting = { lat: coords.lat, lng: coords.lng, name: properties.name || "N/A", type: properties.amenity || "N/A" };

  let popupContentHTML = `<h3>Điểm đến:</h3><p><b>${escapeHtml(properties.name || 'Không có tên')}</b></p>`;
  if (properties.address) popupContentHTML += `<p>Địa chỉ: ${escapeHtml(properties.address)}</p>`;
  if (properties.amenity) popupContentHTML += `<p>(${escapeHtml(properties.amenity.toUpperCase())})</p>`;
  if (properties.phone) popupContentHTML += `<p>Điện thoại: <a href="tel:${escapeHtml(properties.phone)}">${escapeHtml(properties.phone)}</a></p>`;
  if (properties.description) popupContentHTML += `<p>Mô tả: ${escapeHtml(properties.description)}</p>`;
  if (properties.image_url && typeof properties.image_url === 'string' && (properties.image_url.startsWith('http://') || properties.image_url.startsWith('https://'))) {
    popupContentHTML += `<p><img src="${escapeHtml(properties.image_url)}" alt="${escapeHtml(properties.name || 'Hình ảnh')}" style="max-width: 100%; max-height: 150px; margin-top: 10px; border-radius: 4px;"></p>`;
  }

  sidebarPopup.innerHTML = `
        <div class="sidebar-content">
            ${popupContentHTML}
            <button class="route-button" id="route-btn-popup">Dẫn đường</button>
            <button class="close-button" id="close-popup">Đóng</button>
        </div>`;
  sidebarPopup.classList.remove('hidden');
  adjustControlPositions();

  document.getElementById('route-btn-popup').onclick = () => {
    if (selectedLocationForRouting) {
      currentEndLocation = { lat: selectedLocationForRouting.lat, lng: selectedLocationForRouting.lng };
      updateRoute(currentStartLocation.lat, currentStartLocation.lng);
      sidebarPopup.classList.add('hidden');
      adjustControlPositions();
      const radioToCheck = document.getElementById(selectedLocationForRouting.type.toLowerCase());
      if (radioToCheck) radioToCheck.checked = true;
    } else {
      console.error("Routing failed: No location selected.");
      alert("Vui lòng chọn lại địa điểm.");
      sidebarPopup.classList.add('hidden'); adjustControlPositions();
    }
    selectedLocationForRouting = null;
  };

  document.getElementById('close-popup').onclick = () => {
    sidebarPopup.classList.add('hidden');
    adjustControlPositions();
    selectedLocationForRouting = null;
  };

  map.flyTo([coords.lat, coords.lng], clickMarkerZoom);
}

function showRoutingSidebar(route) {
  if (!route || !route.summary || !Array.isArray(route.instructions)) {
    console.error("Invalid route data for routing sidebar.");
    sidebarRouting.classList.add('hidden');
    adjustControlPositions();
    return;
  }

  const distance = (route.summary.totalDistance / 1000).toFixed(1);
  const time = Math.round(route.summary.totalTime / 60);
  let instructionsHTML = '<ul class="instructions-list">';

  // Lấy tọa độ từ route.coordinates (mảng các đối tượng LatLng)
  const routeCoordinates = route.coordinates || [];

  route.instructions.forEach((instruction) => {
    const stepDistance = instruction.distance > 0 ? `${Math.round(instruction.distance)} m` : '';
    const directionText = VietnameseDirections.getText(instruction);
    const directionIcon = VietnameseDirections.getIcon(instruction);

    // Lấy tọa độ cho instruction này bằng instruction.index
    const coordIndex = instruction.index;
    let lat = null;
    let lng = null;
    if (typeof coordIndex === 'number' && routeCoordinates[coordIndex]) {
      const coord = routeCoordinates[coordIndex]; // Đối tượng LatLng
      lat = coord.lat;
      lng = coord.lng;
    }

    // Chỉ thêm thuộc tính tọa độ nếu chúng hợp lệ
    const coordAttr = (typeof lat === 'number' && typeof lng === 'number' && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)
      ? `data-lat="${lat}" data-lng="${lng}"`
      : '';

    instructionsHTML += `
            <li class="instruction-item" ${coordAttr}>
                <span class="instruction-icon">${directionIcon}</span>
                <span class="instruction-text">${directionText} ${instruction.road ? `vào <b>${escapeHtml(instruction.road)}</b>` : ''}</span>
                <span class="instruction-distance">${stepDistance}</span>
            </li>`;
  });
  instructionsHTML += '</ul>';

  const content = `
        <h3>Tuyến đường</h3>
        <p>Khoảng cách: <b>${distance} km</b> <br> Thời gian: ~<b>${time} phút</b></p>
        ${instructionsHTML}
        <button class="close-button" id="close-routing">Đóng</button>`;

  sidebarRouting.innerHTML = `<div class="sidebar-content">${content}</div>`;
  sidebarRouting.classList.remove('hidden');
  adjustControlPositions();

  // Thêm sự kiện click cho các instruction-item
  const instructionItems = sidebarRouting.querySelectorAll('.instruction-item');
  instructionItems.forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.getAttribute('data-lat'));
      const lng = parseFloat(item.getAttribute('data-lng'));
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        console.log(`Jumping to instruction location: [${lat}, ${lng}]`);
        map.setView([lat, lng], 18); // Tăng mức zoom lên 18 để phóng to hơn
      } else {
        console.warn('Invalid coordinates for instruction:', item);
      }
    });
  });

  document.getElementById('close-routing').onclick = () => {
    sidebarRouting.classList.add('hidden');
    adjustControlPositions();
  };
}

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

async function fetchDataFromAPI(amenityType) {
  // Lưu ý: Đảm bảo URL này đúng với Django backend của bạn
  const apiUrl = `/maps/api/locations/?amenity=${encodeURIComponent(amenityType)}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      let errorData = null; try { errorData = await response.json(); } catch (e) { /* Ignore */ }
      throw new Error(errorData?.error || response.statusText || `HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data.error) throw new Error(`API Error: ${data.error}`);
    return data;
  } catch (err) {
    console.error(`API Fetch Error (${amenityType}):`, err);
    alert(`Không thể tải dữ liệu ${amenityType}.\nLỗi: ${err.message}`);
    return { type: "FeatureCollection", features: [] };
  }
}

function handleMarkerClick(e, feature) {
  L.DomEvent.stopPropagation(e);
  const properties = feature.properties;
  const geometry = feature.geometry;
  if (!properties || !geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) return;
  const [lat, lng] = geometry.coordinates; // API returns [lat, lng]
  if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
  showPopupSidebar(properties, { lat, lng });
}

const geojsonOpts = {
  pointToLayer: function (feature, latlng_placeholder) {
    const coords = feature.geometry?.coordinates;
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || coords[0] < -90 || coords[0] > 90 || coords[1] < -180 || coords[1] > 180) return null;
    const [sourceLat, sourceLng] = coords;
    const correctLatLng = L.latLng(sourceLat, sourceLng);
    const { amenity } = feature.properties || {};
    const className = typeof amenity === 'string' && arrayLayers.includes(amenity.toLowerCase()) ? amenity.toLowerCase() : 'default-marker';
    const htmlContent = typeof amenity === 'string' && amenity ? amenity[0].toUpperCase() : '?';
    return L.marker(correctLatLng, {
      icon: L.divIcon({ className: `leaflet-marker-icon ${className}`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12], html: `<b>${htmlContent}</b>` }),
    });
  },
  onEachFeature: function (feature, layer) {
    layer.on('click', (e) => handleMarkerClick(e, feature));
  }
};

function findNearest(featureType, currentLat, currentLng) {
  let nearestFeature = null; minDistance = Infinity;
  const featuresToSearch = allFeaturesData[featureType];
  if (!featuresToSearch || featuresToSearch.length === 0) return null;
  featuresToSearch.forEach((feature) => {
    const coords = feature.geometry?.coordinates;
    if (!coords || feature.geometry?.type !== 'Point' || typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || coords[0] < -90 || coords[0] > 90 || coords[1] < -180 || coords[1] > 180) return;
    try { const distance = getDistance(currentLat, currentLng, coords[0], coords[1]); if (distance < minDistance) { minDistance = distance; nearestFeature = feature; } } catch (e) { console.error(`Distance calc error: ${feature?.properties?.name}`, e); }
  });
  if (nearestFeature) {
    const [finalLat, finalLng] = nearestFeature.geometry.coordinates;
    if (typeof finalLng === 'number' && typeof finalLat === 'number' && finalLat >= -90 && finalLat <= 90 && finalLng >= -180 && finalLng <= 180) {
      return { lat: finalLat, lng: finalLng, name: nearestFeature.properties?.name || "N/A" };
    }
  }
  return null;
}

function generateButton(name) {
  if (document.getElementById(name)) return;
  const templateLayer = `<li class="layer-element"><label for="${name}"><input type="radio" id="${name}" name="layer-group" class="item" value="${name}"><span class="layer-icon ${name === layersButton ? 'deselect-icon' : name.toLowerCase()}"></span><span>${name === layersButton ? 'Bỏ chọn' : name.toUpperCase()}</span></label></li>`;
  layersContainer.insertAdjacentHTML("beforeend", templateLayer);
}

async function showOnlyLayer(selectedId) {
  document.body.style.cursor = 'wait';
  sidebarRouting.classList.add('hidden'); adjustControlPositions();
  sidebarPopup.classList.add('hidden'); adjustControlPositions();
  selectedLocationForRouting = null;

  arrayLayers.forEach((id) => { if (layers["layer_" + id] && map.hasLayer(layers["layer_" + id])) map.removeLayer(layers["layer_" + id]); });

  if (selectedId === layersButton || !arrayLayers.includes(selectedId)) {
    document.body.style.cursor = 'default';
    if (routingControl) map.removeControl(routingControl); if (endMarker) map.removeLayer(endMarker);
    routingControl = null; endMarker = null; currentEndLocation = null;
    return;
  }

  try {
    let needsRoutingUpdate = false;
    if (layers["layer_" + selectedId] && allFeaturesData[selectedId]) {
      if (!map.hasLayer(layers["layer_" + selectedId])) map.addLayer(layers["layer_" + selectedId]);
      needsRoutingUpdate = true;
    } else {
      const apiData = await fetchDataFromAPI(selectedId);
      if (apiData?.features?.length > 0) {
        allFeaturesData[selectedId] = apiData.features;
        const newLayer = L.geoJSON(apiData, geojsonOpts);
        layers["layer_" + selectedId] = newLayer; map.addLayer(newLayer);
        needsRoutingUpdate = true;
      } else if (apiData?.features?.length === 0) {
        allFeaturesData[selectedId] = []; layers["layer_" + selectedId] = L.geoJSON({ type: "FeatureCollection", features: [] });
        alert(`Không tìm thấy địa điểm ${selectedId.toUpperCase()} nào.`);
        if (routingControl) map.removeControl(routingControl); if (endMarker) map.removeLayer(endMarker);
        routingControl = null; endMarker = null; currentEndLocation = null;
      }
    }
    if (needsRoutingUpdate && currentEndLocation) updateRoute(currentStartLocation.lat, currentStartLocation.lng);
    else if (!currentEndLocation && routingControl) { map.removeControl(routingControl); routingControl = null; if (endMarker) map.removeLayer(endMarker); endMarker = null; }
  } catch (error) {
    console.error(`Error showing layer ${selectedId}:`, error); alert(`Lỗi hiển thị lớp ${selectedId.toUpperCase()}.`);
  } finally {
    document.body.style.cursor = 'default';
  }
}

function updateRoute(startLat, startLng) {
  if (routingControl) map.removeControl(routingControl); routingControl = null;
  if (endMarker) map.removeLayer(endMarker); endMarker = null;
  sidebarRouting.classList.add('hidden'); adjustControlPositions();

  if (!currentStartLocation || typeof startLat !== 'number' || typeof startLng !== 'number' ||
    !currentEndLocation || typeof currentEndLocation.lat !== 'number' || typeof currentEndLocation.lng !== 'number') {
    return;
  }

  const waypoints = [L.latLng(startLat, startLng), L.latLng(currentEndLocation.lat, currentEndLocation.lng)];
  routingControl = L.Routing.control({
    waypoints: waypoints, routeWhileDragging: false,
    lineOptions: { styles: [{ color: "blue", opacity: 0.8, weight: 6 }] },
    show: false, addWaypoints: false, draggableWaypoints: false, createMarker: () => null
  }).addTo(map);

  routingControl.on('routingerror', (e) => {
    console.error("Routing Error:", e.error); alert(`Không tìm thấy đường đi.\nLỗi: ${e.error?.message || 'Lỗi không xác định'}.`);
    if (routingControl) map.removeControl(routingControl); routingControl = null;
    sidebarRouting.classList.add('hidden'); adjustControlPositions();
  });

  routingControl.on('routesfound', (e) => {
    if (e.routes?.length > 0) {
      showRoutingSidebar(e.routes[0]);
      if (endMarker) map.removeLayer(endMarker);
      endMarker = L.marker([currentEndLocation.lat, currentEndLocation.lng], { icon: endIcon, draggable: false }).addTo(map);
    } else {
      console.error("No routes found."); alert("Không tìm thấy lộ trình hợp lệ.");
      sidebarRouting.classList.add('hidden'); adjustControlPositions();
    }
  });
}

function handleStartMarkerDragEnd(e) {
  const newLatLng = e.target.getLatLng().wrap();
  currentStartLocation = { lat: newLatLng.lat, lng: newLatLng.lng };
  if (currentEndLocation) updateRoute(newLatLng.lat, newLatLng.lng);
}

function returnToCurrentLocation() {
  if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ định vị.");
  document.body.style.cursor = 'wait';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      document.body.style.cursor = 'default';
      const { latitude: lat, longitude: lng } = position.coords;
      map.setView([lat, lng], initialZoom);
      currentStartLocation = { lat, lng };
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.marker([lat, lng], { icon: startIcon, draggable: true }).addTo(map).bindPopup("Vị trí của bạn").openPopup().on('dragend', handleStartMarkerDragEnd);
      if (currentEndLocation) updateRoute(lat, lng);
    },
    (error) => {
      document.body.style.cursor = 'default'; console.error("Geolocation Error:", error);
      alert(`Không thể lấy vị trí.\nLỗi ${error.code}: ${error.message}`);
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

L.Control.CurrentLocation = L.Control.extend({
  options: { position: 'topright' },
  onAdd: function (map) { const container = L.DomUtil.create("div", "leaflet-control-current-location leaflet-bar leaflet-control"); container.innerHTML = '<span title="Về vị trí của tôi" style="font-size: 1.4em; cursor: pointer;">🎯</span>'; container.onclick = (e) => { L.DomEvent.stopPropagation(e); returnToCurrentLocation(); }; L.DomEvent.disableClickPropagation(container); return container; },
});
L.control.currentLocation = (opts) => new L.Control.CurrentLocation(opts);

const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () { const div = L.DomUtil.create("div", "description"); L.DomEvent.disableClickPropagation(div); div.innerHTML = "Click P/F/H để xem chi tiết và dẫn đường. Chọn loại ở dưới để lọc và tìm đường tới điểm gần nhất."; return div; };

function initializeMapAndData(initialLat, initialLng) {
  currentStartLocation = { lat: initialLat, lng: initialLng };
  map.setView([initialLat, initialLng], initialZoom);
  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker([initialLat, initialLng], { icon: startIcon, draggable: true }).addTo(map).bindPopup("Vị trí của bạn (kéo thả)").on('dragend', handleStartMarkerDragEnd);
  const defaultRadio = document.getElementById(layersButton); if (defaultRadio) defaultRadio.checked = true;
  L.control.currentLocation({ position: 'topright' }).addTo(map);
  legend.addTo(map);
  adjustControlPositions();
}

generateButton(layersButton); arrayLayers.forEach(generateButton);

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => initializeMapAndData(pos.coords.latitude, pos.coords.longitude),
    (err) => { console.warn("Geolocation failed, using default.", err.message); initializeMapAndData(defaultLat, defaultLng); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
} else {
  console.error("Geolocation not supported."); initializeMapAndData(defaultLat, defaultLng);
}

document.addEventListener('change', (e) => {
  if (e.target.matches('input[type="radio"].item[name="layer-group"]')) {
    const selectedValue = e.target.value;
    if (selectedValue !== layersButton) {
      showOnlyLayer(selectedValue).then(() => {
        const nearest = findNearest(selectedValue, currentStartLocation.lat, currentStartLocation.lng);
        if (nearest) { currentEndLocation = { lat: nearest.lat, lng: nearest.lng }; updateRoute(currentStartLocation.lat, currentStartLocation.lng); }
        else { if (routingControl) map.removeControl(routingControl); routingControl = null; if (endMarker) map.removeLayer(endMarker); endMarker = null; currentEndLocation = null; }
      });
    } else {
      showOnlyLayer(selectedValue);
    }
  }
});