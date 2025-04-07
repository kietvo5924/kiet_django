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
let routingControl = null; // Lưu trữ routing control hiện tại
let startMarker = null; // Lưu trữ marker điểm bắt đầu
let endMarker = null; // Lưu trữ marker điểm kết thúc
let currentStartLocation = { lat: defaultLat, lng: defaultLng }; // Lưu vị trí bắt đầu hiện tại
let allFeaturesData = { // Lưu trữ features của tất cả các lớp
  'police': [],
  'PCCC': [],
  'hospital': []
};
let layers = {}; // Lưu trữ các layer Leaflet L.geoJSON
const layersContainer = document.querySelector(".layers");
const layersButton = "không chọn"; // Giá trị của nút radio mặc định
const arrayLayers = ["police", "PCCC", "hospital"]; // Các loại layer hợp lệ

// Icons (định nghĩa một lần)
const startIcon = L.divIcon({
  className: "start-marker",
  html: '<span>S</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Có thể tùy chỉnh icon kết thúc cho từng loại nếu muốn
const endIcon = L.divIcon({
  className: "end-marker", // Class chung
  html: '<span>Đ</span>', // Đích
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});
// Hoặc dùng nhiều icon:
// const endIcons = {
//     'hospital': L.divIcon({ className: "end-marker hospital", html: 'H', iconSize: [30, 30], iconAnchor: [15, 15] }),
//     'police':   L.divIcon({ className: "end-marker police", html: 'P', iconSize: [30, 30], iconAnchor: [15, 15] }),
//     'PCCC':     L.divIcon({ className: "end-marker PCCC", html: 'F', iconSize: [30, 30], iconAnchor: [15, 15] })
// };


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
  const R = 6371e3; const φ1 = lat1 * Math.PI / 180; const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180; const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function clickZoom(e) {
  map.setView(e.target.getLatLng(), clickMarkerZoom);
}

// --- HÀM XỬ LÝ TỌA ĐỘ VÀ TẠO MARKER (ĐÃ SỬA ĐỂ NHẬN [Lat, Lng]) ---
let geojsonOpts = {
  pointToLayer: function (feature, latlng_placeholder) {
    const coords = feature.geometry.coordinates;
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
      console.warn("Tọa độ không hợp lệ trong feature:", feature.properties.name, coords); return null;
    }
    const sourceLat = coords[0]; const sourceLng = coords[1];
    if (sourceLat < -90 || sourceLat > 90 || sourceLng < -180 || sourceLng > 180) {
      console.warn(`Tọa độ đọc từ JSON không hợp lệ cho "${feature.properties.name || 'N/A'}": [Lat ${sourceLat}, Lng ${sourceLng}]`); return null;
    }
    const correctLatLng = L.latLng(sourceLat, sourceLng); // Tạo LatLng đúng

    const amenity = feature.properties.amenity; // Ví dụ: 'hospital', 'police', 'PCCC'
    const name = feature.properties.name || "Không có tên";
    const className = typeof amenity === 'string' && arrayLayers.includes(amenity) ? amenity : 'default-marker'; // Dùng class chuẩn
    const htmlContent = typeof amenity === 'string' && amenity ? amenity[0].toUpperCase() : '?';

    return L.marker(correctLatLng, { // Dùng LatLng đúng
      icon: L.divIcon({ className: className, iconSize: L.point(16, 16), html: htmlContent, popupAnchor: [3, -5] }),
    })
      .bindPopup(`${amenity || 'Địa điểm'}<br><b>${name}</b>`)
      .on("click", clickZoom);
  },
};

// --- HÀM TÌM ĐIỂM GẦN NHẤT (ĐÃ SỬA ĐỂ NHẬN [Lat, Lng] và featureType) ---
function findNearest(featureType, currentLat, currentLng) {
  let nearestFeature = null;
  let minDistance = Infinity;
  const featuresToSearch = allFeaturesData[featureType]; // Lấy danh sách features của loại cần tìm

  if (!featuresToSearch || featuresToSearch.length === 0) {
    console.warn(`Không có dữ liệu features cho loại: ${featureType}`);
    return null;
  }

  console.log(`Bắt đầu tìm ${featureType} gần nhất từ: Lat ${currentLat}, Lng ${currentLng}. Tổng số ${featuresToSearch.length} điểm.`);

  featuresToSearch.forEach((feature, index) => {
    if (!feature?.geometry?.coordinates || feature.geometry.type !== 'Point') {
      console.warn(`Đối tượng ${featureType} ${index} có cấu trúc không hợp lệ.`); return;
    }
    const coords = feature.geometry.coordinates; // [Lat, Lng]
    if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
      console.warn(`${featureType} "${feature.properties.name || 'N/A'}" (${index}) có tọa độ không phải dạng số.`); return;
    }
    const targetLat = coords[0]; const targetLng = coords[1];
    if (targetLat < -90 || targetLat > 90 || targetLng < -180 || targetLng > 180) {
      console.warn(`Tọa độ JSON ${featureType} "${feature.properties.name || 'N/A'}" (${index}) không hợp lệ: [Lat ${targetLat}, Lng ${targetLng}]`); return;
    }

    try {
      const distance = getDistance(currentLat, currentLng, targetLat, targetLng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestFeature = feature;
        // Không log nhiều ở đây nữa trừ khi debug
      }
    } catch (e) { console.error(`Lỗi khi tính khoảng cách cho ${featureType} ${index}:`, e); }
  });

  if (nearestFeature) {
    const finalCoords = nearestFeature.geometry.coordinates;
    const finalLat = finalCoords[0]; const finalLng = finalCoords[1];
    if (typeof finalLng === 'number' && typeof finalLat === 'number' && finalLat >= -90 && finalLat <= 90 && finalLng >= -180 && finalLng <= 180) {
      console.log(`${featureType} gần nhất được chọn: "${nearestFeature.properties.name || 'N/A'}". Trả về Lat: ${finalLat}, Lng: ${finalLng}`);
      return { lat: finalLat, lng: finalLng, name: nearestFeature.properties.name || "Không có tên" }; // Trả về cả tên
    } else {
      console.error(`Tọa độ của ${featureType} gần nhất được chọn không hợp lệ:`, nearestFeature.properties.name, finalCoords); return null;
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
  // Xử lý "không chọn"
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

  // Xóa tuyến đường và marker đích cũ
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
  if (endMarker) {
    map.removeLayer(endMarker);
    endMarker = null;
  }

  // Nếu chọn "không chọn" hoặc loại không hợp lệ thì dừng
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
      routeWhileDragging: false, // Kéo thả marker bắt đầu sẽ tự cập nhật
      lineOptions: { styles: [{ color: "red", opacity: 0.7, weight: 8 }] },
      show: true, // Hiển thị bảng chỉ dẫn
      addWaypoints: false, // Không cho thêm điểm trung gian
      draggableWaypoints: false, // Marker S và Đ đã tự quản lý
      createMarker: () => null, // Không để routing control tự tạo marker
      // serviceUrl: '...'
    }).addTo(map);

    routingControl.on('routingerror', function (e) {
      console.error("Lỗi Routing Control:", e.error);
      alert(`Không thể tìm thấy đường đi: ${e.error ? e.error.message : 'Lỗi không xác định'}.`);
      if (routingControl) map.removeControl(routingControl); routingControl = null;
      if (endMarker) map.removeLayer(endMarker); endMarker = null; // Xóa marker đích nếu lỗi
    });
    routingControl.on('routesfound', function (e) { console.log('Tìm thấy tuyến đường.'); });

    // Tạo marker điểm đích (không cho kéo thả)
    // const targetIcon = endIcons[selectedType] || endIcon; // Lấy icon tương ứng nếu dùng object endIcons
    endMarker = L.marker([nearestTarget.lat, nearestTarget.lng], {
      icon: endIcon, // Dùng icon chung hoặc targetIcon
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
  currentStartLocation = { lat: newLatLng.lat, lng: newLatLng.lng }; // Cập nhật vị trí bắt đầu

  // Cập nhật lại tuyến đường dựa trên vị trí mới và lựa chọn radio hiện tại
  updateRoute(newLatLng.lat, newLatLng.lng);
}


// --- HÀM KHỞI TẠO BAN ĐẦU ---
function initializeMapAndData(initialLat, initialLng) {
  console.log(`Khởi tạo bản đồ tại: Lat ${initialLat}, Lng ${initialLng}`);
  currentStartLocation = { lat: initialLat, lng: initialLng }; // Lưu vị trí ban đầu
  map.setView([initialLat, initialLng], initialZoom);

  // Thêm marker điểm bắt đầu (chỉ marker, chưa có route)
  if (startMarker) map.removeLayer(startMarker); // Xóa nếu có từ lần load trước (ít xảy ra)
  startMarker = L.marker([initialLat, initialLng], {
    icon: startIcon,
    draggable: true
  }).addTo(map).bindPopup("Vị trí của bạn (kéo thả để cập nhật)");

  // Gắn sự kiện kéo thả
  startMarker.on('dragend', handleStartMarkerDragEnd);

  // Đặt nút radio "không chọn" làm mặc định
  const defaultRadio = document.getElementById(layersButton);
  if (defaultRadio) {
    defaultRadio.checked = true;
    console.log("Đã đặt radio 'không chọn' làm mặc định.");
  } else {
    console.error("Không tìm thấy nút radio 'không chọn'!");
  }

  // Không tự động vẽ đường đi khi khởi tạo
  console.log("Khởi tạo bản đồ hoàn tất. Chờ người dùng chọn loại địa điểm.");
}

// === QUÁ TRÌNH TẢI DỮ LIỆU VÀ KHỞI TẠO ===

// 1. Tạo nút "không chọn" trước
generateButton(layersButton);

// 2. Tải tất cả dữ liệu JSON
Promise.all(
  arrayLayers.map(json =>
    fetchData(`/static/data/${json}.json`).then(data => {
      if (data && data.features) {
        // Lưu trữ features vào cấu trúc dữ liệu chung
        allFeaturesData[json] = data.features;
        // Tạo và lưu trữ layer Leaflet (sử dụng geojsonOpts đã sửa)
        layers["layer_" + json] = L.geoJSON(data, geojsonOpts);
        console.log(`Đã xử lý ${data.features.length} features cho lớp ${json}.`);
        // Tạo nút radio cho lớp này
        generateButton(json);
      } else {
        console.warn(`Không có dữ liệu hoặc features hợp lệ cho lớp: ${json}`);
        // Vẫn tạo nút nhưng không có dữ liệu
        generateButton(json);
        layers["layer_" + json] = L.geoJSON({ type: "FeatureCollection", features: [] }, geojsonOpts); // Layer rỗng
        allFeaturesData[json] = []; // Mảng rỗng
      }
    })
  )
).then(() => {
  console.log("Tất cả dữ liệu GeoJSON đã được tải và xử lý.");

  // 3. Sau khi có dữ liệu, lấy vị trí người dùng và khởi tạo bản đồ
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
  // Có thể thử khởi tạo với mặc định dù lỗi data
  initializeMapAndData(defaultLat, defaultLng);
});

// === GẮN SỰ KIỆN CHO RADIO BUTTON ===
document.addEventListener('change', (e) => {
  const target = e.target;
  // Chỉ xử lý nếu là input radio thuộc nhóm layer-group
  if (target.matches('input[type="radio"].item[name="layer-group"]')) {
    console.log(`Radio button thay đổi: ${target.value}`);
    showOnlyLayer(target.value); // Hiển thị/ẩn marker tương ứng

    // Cập nhật tuyến đường dựa trên lựa chọn mới và vị trí hiện tại của marker S
    if (startMarker) {
      const currentStartLatLng = startMarker.getLatLng();
      updateRoute(currentStartLatLng.lat, currentStartLatLng.lng);
    } else {
      // Nếu chưa có marker S (trường hợp hiếm), dùng vị trí đã lưu
      updateRoute(currentStartLocation.lat, currentStartLocation.lng);
    }
  }
});

// Add legend - Không đổi
const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () {
  let div = L.DomUtil.create("div", "description");
  L.DomEvent.disableClickPropagation(div);
  const text = "Chọn loại địa điểm (Police, PCCC, Hospital) để tìm đường đi ngắn nhất từ vị trí của bạn (S)."; // Cập nhật mô tả
  div.insertAdjacentHTML("beforeend", text);
  return div;
};
legend.addTo(map);