/* eslint-disable no-undef */
/**
 * control layers outside the map with routing
 */

// config map
let config = {
  minZoom: 7,
  maxZoom: 18,
  fullscreenControl: true,
};
const initialZoom = 15;
const clickMarkerZoom = 18;

// Trung tâm TP.HCM làm mặc định
const defaultLat = 10.7769;
const defaultLng = 106.7009;

// Biến toàn cục
const map = L.map("map", config);
let routingControl = null;
let startMarker = null;
let endMarker = null;
let currentStartLocation = { lat: defaultLat, lng: defaultLng };
let allFeaturesData = {
  'police': [],
  'PCCC': [],
  'hospital': []
};
let layers = {};
const layersContainer = document.querySelector(".layers");
const layersButton = "không chọn";
const arrayLayers = ["police", "PCCC", "hospital"];

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

// --- CÁC HÀM TIỆN ÍCH ---

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

async function fetchData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} for ${url}`);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Lỗi khi tải dữ liệu GeoJSON:", err);
    return { type: "FeatureCollection", features: [] };
  }
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function clickZoom(e) {
  map.setView(e.target.getLatLng(), clickMarkerZoom);
}

// --- HÀM XỬ LÝ TỌA ĐỘ VÀ TẠO MARKER ---
let geojsonOpts = {
  pointToLayer: function (feature, latlng_placeholder) {
    const coords = feature.geometry.coordinates;
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
      console.warn("Tọa độ không hợp lệ trong feature:", feature.properties.name, coords);
      return null;
    }
    const sourceLat = coords[0];
    const sourceLng = coords[1];
    if (sourceLat < -90 || sourceLat > 90 || sourceLng < -180 || sourceLng > 180) {
      console.warn(`Tọa độ đọc từ JSON không hợp lệ cho "${feature.properties.name || 'N/A'}": [Lat ${sourceLat}, Lng ${sourceLng}]`);
      return null;
    }
    const correctLatLng = L.latLng(sourceLat, sourceLng);

    const amenity = feature.properties.amenity;
    const name = feature.properties.name || "Không có tên";
    const className = typeof amenity === 'string' && arrayLayers.includes(amenity) ? amenity : 'default-marker';
    const htmlContent = typeof amenity === 'string' && amenity ? amenity[0].toUpperCase() : '?';

    return L.marker(correctLatLng, {
      icon: L.divIcon({ className: className, iconSize: L.point(16, 16), html: htmlContent, popupAnchor: [3, -5] }),
    })
      .bindPopup(`${amenity || 'Địa điểm'}<br><b>${name}</b>`)
      .on("click", clickZoom);
  },
};

// --- HÀM TÌM ĐIỂM GẦN NHẤT ---
function findNearest(featureType, currentLat, currentLng) {
  let nearestFeature = null;
  let minDistance = Infinity;
  const featuresToSearch = allFeaturesData[featureType];

  if (!featuresToSearch || featuresToSearch.length === 0) {
    console.warn(`Không có dữ liệu features cho loại: ${featureType}`);
    return null;
  }

  console.log(`Bắt đầu tìm ${featureType} gần nhất từ: Lat ${currentLat}, Lng ${currentLng}. Tổng số ${featuresToSearch.length} điểm.`);

  featuresToSearch.forEach((feature, index) => {
    if (!feature?.geometry?.coordinates || feature.geometry.type !== 'Point') {
      console.warn(`Đối tượng ${featureType} ${index} có cấu trúc không hợp lệ.`);
      return;
    }
    const coords = feature.geometry.coordinates;
    if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
      console.warn(`${featureType} "${feature.properties.name || 'N/A'}" (${index}) có tọa độ không phải dạng số.`);
      return;
    }
    const targetLat = coords[0];
    const targetLng = coords[1];
    if (targetLat < -90 || targetLat > 90 || targetLng < -180 || targetLng > 180) {
      console.warn(`Tọa độ JSON ${featureType} "${feature.properties.name || 'N/A'}" (${index}) không hợp lệ: [Lat ${targetLat}, Lng ${targetLng}]`);
      return;
    }

    try {
      const distance = getDistance(currentLat, currentLng, targetLat, targetLng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestFeature = feature;
      }
    } catch (e) {
      console.error(`Lỗi khi tính khoảng cách cho ${featureType} ${index}:`, e);
    }
  });

  if (nearestFeature) {
    const finalCoords = nearestFeature.geometry.coordinates;
    const finalLat = finalCoords[0];
    const finalLng = finalCoords[1];
    if (typeof finalLng === 'number' && typeof finalLat === 'number' && finalLat >= -90 && finalLat <= 90 && finalLng >= -180 && finalLng <= 180) {
      console.log(`${featureType} gần nhất được chọn: "${nearestFeature.properties.name || 'N/A'}". Trả về Lat: ${finalLat}, Lng: ${finalLng}`);
      return { lat: finalLat, lng: finalLng, name: nearestFeature.properties.name || "Không có tên" };
    } else {
      console.error(`Tọa độ của ${featureType} gần nhất được chọn không hợp lệ:`, nearestFeature.properties.name, finalCoords);
      return null;
    }
  } else {
    console.log(`Không tìm thấy ${featureType} nào gần đó.`);
    return null;
  }
}

// --- HÀM TẠO NÚT RADIO ---
function generateButton(name) {
  const templateLayer = `
    <li class="layer-element">
      <label for="${name}">
        <input type="radio" id="${name}" name="layer-group" class="item" value="${name}">
        <span>${name}</span>
      </label>
    </li>
  `;
  layersContainer.insertAdjacentHTML("beforeend", templateLayer);
}

// --- HÀM HIỂN THỊ/ẨN LỚP MARKER ---
function showOnlyLayer(selectedId) {
  arrayLayers.forEach((id) => {
    const layer = layers["layer_" + id];
    if (layer) {
      if (id === selectedId) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    } else if (id === selectedId) {
      console.warn(`Layer ${selectedId} chưa được khởi tạo.`);
    }
  });
  if (selectedId === layersButton) {
    arrayLayers.forEach((id) => {
      const layer = layers["layer_" + id];
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
  }
}

// --- HÀM CẬP NHẬT/VẼ TUYẾN ĐƯỜNG ---
function updateRoute(startLat, startLng) {
  const selectedRadio = document.querySelector('input[name="layer-group"]:checked');
  if (!selectedRadio) return;
  const selectedType = selectedRadio.value;

  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
  if (endMarker) {
    map.removeLayer(endMarker);
    endMarker = null;
  }

  if (selectedType === layersButton || !arrayLayers.includes(selectedType)) {
    console.log("Không chọn loại địa điểm hoặc loại không hợp lệ, xóa tuyến đường.");
    return;
  }

  console.log(`Yêu cầu tìm tuyến đường đến ${selectedType} gần nhất từ Lat ${startLat}, Lng ${startLng}`);
  const nearestTarget = findNearest(selectedType, startLat, startLng);

  if (nearestTarget) {
    console.log(`Tìm thấy ${selectedType} gần nhất: ${nearestTarget.name}. Tạo tuyến đường.`);
    const waypoints = [
      L.latLng(startLat, startLng),
      L.latLng(nearestTarget.lat, nearestTarget.lng)
    ];

    routingControl = L.Routing.control({
      waypoints: waypoints,
      routeWhileDragging: false,
      lineOptions: { styles: [{ color: "red", opacity: 0.7, weight: 8 }] },
      show: true,
      addWaypoints: false,
      draggableWaypoints: false,
      createMarker: () => null,
    }).addTo(map);

    routingControl.on('routingerror', function (e) {
      console.error("Lỗi Routing Control:", e.error);
      alert(`Không thể tìm thấy đường đi: ${e.error ? e.error.message : 'Lỗi không xác định'}.`);
      if (routingControl) map.removeControl(routingControl);
      routingControl = null;
      if (endMarker) map.removeLayer(endMarker);
      endMarker = null;
    });
    routingControl.on('routesfound', function (e) {
      console.log('Tìm thấy tuyến đường.');
    });

    endMarker = L.marker([nearestTarget.lat, nearestTarget.lng], {
      icon: endIcon,
      draggable: false
    }).addTo(map).bindPopup(`${selectedType.toUpperCase()}: ${nearestTarget.name}`);
  } else {
    console.error(`Không tìm thấy ${selectedType} nào gần đó.`);
    alert(`Không tìm thấy ${selectedType} nào gần vị trí của bạn.`);
  }
}

// --- HÀM XỬ LÝ KÉO THẢ MARKER BẮT ĐẦU ---
function handleStartMarkerDragEnd(e) {
  const newLatLng = e.target.getLatLng();
  console.log("Điểm bắt đầu mới (kéo thả):", newLatLng);
  currentStartLocation = { lat: newLatLng.lat, lng: newLatLng.lng };

  updateRoute(newLatLng.lat, newLatLng.lng);
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
          .bindPopup("Vị trí của bạn (kéo thả để cập nhật)")
          .openPopup();
        startMarker.on('dragend', handleStartMarkerDragEnd);

        // Cập nhật vị trí hiện tại
        currentStartLocation = { lat, lng };

        // Cập nhật tuyến đường nếu đã chọn loại địa điểm
        updateRoute(lat, lng);
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

// --- HÀM KHỞI TẠO BAN ĐẦU ---
function initializeMapAndData(initialLat, initialLng) {
  console.log(`Khởi tạo bản đồ tại: Lat ${initialLat}, Lng ${initialLng}`);
  currentStartLocation = { lat: initialLat, lng: initialLng };
  map.setView([initialLat, initialLng], initialZoom);

  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker([initialLat, initialLng], {
    icon: startIcon,
    draggable: true
  }).addTo(map).bindPopup("Vị trí của bạn (kéo thả để cập nhật)");

  startMarker.on('dragend', handleStartMarkerDragEnd);

  const defaultRadio = document.getElementById(layersButton);
  if (defaultRadio) {
    defaultRadio.checked = true;
    console.log("Đã đặt radio 'không chọn' làm mặc định.");
  } else {
    console.error("Không tìm thấy nút radio 'không chọn'!");
  }

  console.log("Khởi tạo bản đồ hoàn tất. Chờ người dùng chọn loại địa điểm.");

  // Thêm nút "Trở về vị trí của tôi" vào bản đồ
  L.control.currentLocation({ position: "topright" }).addTo(map);
}

// === QUÁ TRÌNH TẢI DỮ LIỆU VÀ KHỞI TẠO ===

// 1. Tạo nút "không chọn" trước
generateButton(layersButton);

// 2. Tải tất cả dữ liệu JSON
Promise.all(
  arrayLayers.map(json =>
    fetchData(`/static/data/${json}.json`).then(data => {
      if (data && data.features) {
        allFeaturesData[json] = data.features;
        layers["layer_" + json] = L.geoJSON(data, geojsonOpts);
        console.log(`Đã xử lý ${data.features.length} features cho lớp ${json}.`);
        generateButton(json);
      } else {
        console.warn(`Không có dữ liệu hoặc features hợp lệ cho lớp: ${json}`);
        generateButton(json);
        layers["layer_" + json] = L.geoJSON({ type: "FeatureCollection", features: [] }, geojsonOpts);
        allFeaturesData[json] = [];
      }
    })
  )
).then(() => {
  console.log("Tất cả dữ liệu GeoJSON đã được tải và xử lý.");

  if (navigator.geolocation) {
    console.log("Bắt đầu lấy vị trí người dùng...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Lấy vị trí thành công:", position.coords.latitude, position.coords.longitude);
        initializeMapAndData(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.warn("Không thể lấy vị trí tự động, sử dụng trung tâm TP.HCM:", error);
        initializeMapAndData(defaultLat, defaultLng);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    console.error("Trình duyệt không hỗ trợ Geolocation.");
    initializeMapAndData(defaultLat, defaultLng);
  }
}).catch(error => {
  console.error("Lỗi nghiêm trọng trong quá trình tải dữ liệu:", error);
  alert("Không thể tải dữ liệu bản đồ cần thiết. Vui lòng tải lại trang.");
  initializeMapAndData(defaultLat, defaultLng);
});

// === GẮN SỰ KIỆN CHO RADIO BUTTON ===
document.addEventListener('change', (e) => {
  const target = e.target;
  if (target.matches('input[type="radio"].item[name="layer-group"]')) {
    console.log(`Radio button thay đổi: ${target.value}`);
    showOnlyLayer(target.value);

    if (startMarker) {
      const currentStartLatLng = startMarker.getLatLng();
      updateRoute(currentStartLatLng.lat, currentStartLatLng.lng);
    } else {
      updateRoute(currentStartLocation.lat, currentStartLocation.lng);
    }
  }
});

// Add legend
const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () {
  let div = L.DomUtil.create("div", "description");
  L.DomEvent.disableClickPropagation(div);
  const text = "Chọn loại địa điểm (Police, PCCC, Hospital) để tìm đường đi ngắn nhất từ vị trí của bạn (S).";
  div.insertAdjacentHTML("beforeend", text);
  return div;
};
legend.addTo(map);