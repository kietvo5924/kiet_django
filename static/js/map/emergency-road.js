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
// zoom mặc định khi bản đồ khởi tạo hoặc khi click vào marker
const initialZoom = 15; // Có thể điều chỉnh mức zoom ban đầu này
const clickMarkerZoom = 18; // Zoom khi click vào marker

// Trung tâm TP.HCM làm mặc định nếu không lấy được vị trí
const defaultLat = 10.7769;
const defaultLng = 106.7009;

// calling map
const map = L.map("map", config);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// async function to load geojson
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
    // Trả về cấu trúc rỗng để Promise.all không bị lỗi hoàn toàn
    return { type: "FeatureCollection", features: [] };
  }
}

// center map on the clicked marker
function clickZoom(e) {
  // getLatLng() của marker giờ sẽ trả về LatLng đúng do đã sửa trong pointToLayer
  map.setView(e.target.getLatLng(), clickMarkerZoom);
}

// ============================================================
// SỬA LẠI geojsonOpts ĐỂ XỬ LÝ TỌA ĐỘ [Lat, Lng] TỪ JSON
// ============================================================
let geojsonOpts = {
  pointToLayer: function (feature, latlng_placeholder) { // Đổi tên tham số để biết ta sẽ không dùng nó trực tiếp
    // --- BẮT ĐẦU THAY ĐỔI ---
    // Lấy tọa độ gốc từ feature (đang là [Lat, Lng])
    const coords = feature.geometry.coordinates;

    // Kiểm tra xem tọa độ có hợp lệ không
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
      console.warn("Tọa độ không hợp lệ trong feature:", feature.properties.name, coords);
      return null; // Không tạo marker nếu tọa độ gốc lỗi
    }

    const sourceLat = coords[0]; // Lấy Lat từ vị trí 0
    const sourceLng = coords[1]; // Lấy Lng từ vị trí 1

    // Kiểm tra phạm vi Lat/Lng đọc từ JSON
    if (sourceLat < -90 || sourceLat > 90 || sourceLng < -180 || sourceLng > 180) {
      console.warn(`Tọa độ đọc từ JSON không hợp lệ cho "${feature.properties.name || 'N/A'}": [Lat ${sourceLat}, Lng ${sourceLng}]`);
      return null; // Không tạo marker
    }

    // Tạo đối tượng L.LatLng ĐÚNG (L.latLng yêu cầu lat trước, lng sau)
    const correctLatLng = L.latLng(sourceLat, sourceLng);
    // --- KẾT THÚC THAY ĐỔI ---

    // Các phần còn lại giữ nguyên nhưng sử dụng correctLatLng
    const amenity = feature.properties.amenity; // Đã sửa thành 'hospital' trong JSON
    const name = feature.properties.name || "Không có tên"; // Tên mặc định
    const className = typeof amenity === 'string' && amenity ? amenity : 'default-marker'; // Lớp CSS mặc định
    const htmlContent = typeof amenity === 'string' && amenity ? amenity[0].toUpperCase() : '?'; // Nội dung HTML mặc định

    // Sử dụng correctLatLng khi tạo marker
    return L.marker(correctLatLng, { // <-- Sử dụng LatLng đã sửa
      icon: L.divIcon({
        className: className, // Sử dụng lớp CSS đã kiểm tra
        iconSize: L.point(16, 16),
        html: htmlContent, // Sử dụng nội dung HTML đã kiểm tra
        popupAnchor: [3, -5],
      }),
    })
      .bindPopup(
        (typeof amenity === 'string' && amenity ? amenity : 'Địa điểm') + // Nhãn mặc định
        "<br><b>" +
        name + // Sử dụng tên đã kiểm tra
        "</b>"
      )
      .on("click", clickZoom); // Hàm clickZoom vẫn dùng getLatLng() của marker, giờ đã đúng
  },
};
// ============================================================
// KẾT THÚC SỬA geojsonOpts
// ============================================================


const layersContainer = document.querySelector(".layers");
const layersButton = "không chọn";

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

generateButton(layersButton);

// add data to geoJSON layer and add to LayerGroup
const arrayLayers = ["police", "PCCC", "hospital"];
let allFeatures = [];
let hospitalFeatures = [];
let layers = {}; // Lưu trữ các layer đã tạo

// Sử dụng Promise.all để đảm bảo tất cả dữ liệu được tải trước khi xử lý tiếp
const dataPromises = arrayLayers.map(json =>
  fetchData(`/static/data/${json}.json`).then(data => {
    if (data && data.features) {
      // Tạo layer và lưu trữ - SẼ SỬ DỤNG geojsonOpts ĐÃ SỬA
      layers["layer_" + json] = L.geoJSON(data, geojsonOpts);
      allFeatures = allFeatures.concat(data.features);
      if (json === "hospital") {
        hospitalFeatures = data.features;
        console.log(`Đã tải ${hospitalFeatures.length} bệnh viện.`);
      }
      // Tạo nút sau khi dữ liệu được tải và có features
      generateButton(json);
    } else {
      console.warn(`Không có dữ liệu hoặc features cho layer: ${json}`);
      // Vẫn tạo nút nhưng layer sẽ rỗng
      generateButton(json);
      layers["layer_" + json] = L.geoJSON({ type: "FeatureCollection", features: [] }, geojsonOpts);
    }
  })
);

// Layer control event listener
document.addEventListener("change", (e) => {
  const target = e.target;
  if (!target.classList.contains("item")) return;
  showOnlyLayer(target.value);
});

function showOnlyLayer(selectedId) {
  arrayLayers.forEach((id) => {
    const layer = layers["layer_" + id]; // Lấy layer từ đối tượng đã lưu
    if (layer) { // Kiểm tra xem layer có tồn tại không
      if (id === selectedId) {
        if (!map.hasLayer(layer)) {
          map.addLayer(layer);
        }
        // ĐÃ COMMENT OUT DÒNG NÀY THEO YÊU CẦU: Bỏ tự động zoom khi chọn lớp
        // Nếu muốn bật lại, hãy bỏ dấu // ở đầu dòng dưới
        // try {
        //     if (layer.getBounds().isValid()) { // Chỉ fitBounds nếu layer có dữ liệu và bounds hợp lệ
        //        // map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        //     } else {
        //         console.warn(`Layer ${id} không có bounds hợp lệ để fit.`);
        //     }
        // } catch (error) {
        //     console.error(`Lỗi khi gọi getBounds cho layer ${id}:`, error);
        // }
      } else {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      }
    } else if (id === selectedId) {
      console.warn(`Layer ${selectedId} chưa được khởi tạo hoặc không có dữ liệu.`);
    }
  });
  // Xử lý trường hợp "không chọn"
  if (selectedId === layersButton) {
    arrayLayers.forEach((id) => {
      const layer = layers["layer_" + id];
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
  }
}

// Hàm tính khoảng cách (Haversine formula) - Không đổi
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}


// ============================================================
// SỬA LẠI findNearestHospital ĐỂ XỬ LÝ TỌA ĐỘ [Lat, Lng] TỪ JSON
// ============================================================
function findNearestHospital(currentLat, currentLng) {
  let nearestFeature = null;
  let minDistance = Infinity;

  console.log(`Bắt đầu tìm bệnh viện gần nhất từ: Lat ${currentLat}, Lng ${currentLng}`);
  console.log(`Số lượng bệnh viện trong danh sách: ${hospitalFeatures.length}`);

  hospitalFeatures.forEach((feature, index) => {
    // Kiểm tra cấu trúc geometry và coordinates
    if (!feature || !feature.geometry || !feature.geometry.coordinates || feature.geometry.type !== 'Point') {
      console.warn(`Đối tượng bệnh viện ${index} có cấu trúc không hợp lệ, bỏ qua.`);
      return;
    }

    const coords = feature.geometry.coordinates; // Lấy tọa độ gốc [Lat, Lng]

    // Kiểm tra kiểu dữ liệu
    if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
      console.warn(`Bệnh viện "${feature.properties.name || 'N/A'}" (${index}) có tọa độ không phải dạng số:`, coords);
      return; // Bỏ qua nếu không phải số
    }

    // --- BẮT ĐẦU THAY ĐỔI ---
    const hospitalLat = coords[0]; // Lat ở vị trí 0
    const hospitalLng = coords[1]; // Lng ở vị trí 1

    // Kiểm tra phạm vi Lat/Lng đọc từ JSON
    if (hospitalLat < -90 || hospitalLat > 90 || hospitalLng < -180 || hospitalLng > 180) {
      console.warn(`Tọa độ đọc từ JSON không hợp lệ cho "${feature.properties.name || 'N/A'}": [Lat ${hospitalLat}, Lng ${hospitalLng}]`);
      return; // Bỏ qua nếu giá trị không hợp lệ
    }
    // --- KẾT THÚC THAY ĐỔI ---


    try {
      // --- THAY ĐỔI THAM SỐ TRUYỀN VÀO getDistance ---
      // getDistance yêu cầu (lat1, lon1, lat2, lon2)
      const distance = getDistance(currentLat, currentLng, hospitalLat, hospitalLng);
      // --- KẾT THÚC THAY ĐỔI ---

      if (distance < minDistance) {
        minDistance = distance;
        nearestFeature = feature;
        console.log(
          `   Tìm thấy bệnh viện gần hơn (${index}): "${nearestFeature.properties.name || 'N/A'}", ` +
          `Tọa độ JSON gốc [Lat, Lng]: [${hospitalLat}, ${hospitalLng}], Khoảng cách: ${distance.toFixed(0)}m` // Log tọa độ gốc đọc được
        );
      }
    } catch (e) {
      console.error(`Lỗi khi tính khoảng cách cho bệnh viện ${index}:`, e);
    }
  });

  // Trả về đối tượng {lat, lng} nếu tìm thấy và tọa độ hợp lệ
  if (nearestFeature) {
    const finalCoords = nearestFeature.geometry.coordinates;
    // --- BẮT ĐẦU THAY ĐỔI ---
    const finalLat = finalCoords[0]; // Lat ở vị trí 0
    const finalLng = finalCoords[1]; // Lng ở vị trí 1

    // Kiểm tra lại lần cuối trước khi trả về (đã kiểm tra ở trên nhưng chắc chắn hơn)
    if (typeof finalLng === 'number' && typeof finalLat === 'number' &&
      finalLat >= -90 && finalLat <= 90 && finalLng >= -180 && finalLng <= 180) {
      console.log(`Bệnh viện gần nhất được chọn: "${nearestFeature.properties.name || 'N/A'}". Trả về Lat: ${finalLat}, Lng: ${finalLng}`);
      // Trả về đối tượng với lat, lng đúng theo tên thuộc tính
      return { lat: finalLat, lng: finalLng };
      // --- KẾT THÚC THAY ĐỔI ---
    } else {
      // Trường hợp này ít xảy ra vì đã kiểm tra ở vòng lặp
      console.error("Tọa độ của bệnh viện gần nhất được chọn không hợp lệ:", nearestFeature.properties.name, finalCoords);
      return null;
    }
  } else {
    console.log("Không tìm thấy bệnh viện nào gần đó (có thể do tọa độ JSON lỗi hoặc ở quá xa).");
    return null;
  }
}
// ============================================================
// KẾT THÚC SỬA findNearestHospital
// ============================================================


// Khởi tạo routing - KHÔNG CẦN SỬA HÀM NÀY
let routingControl; // Biến toàn cục để lưu routing control

function initializeRouting(startLat, startLng) {
  console.log(`Khởi tạo routing với điểm bắt đầu: Lat ${startLat}, Lng ${startLng}`);
  // Đặt view ban đầu của bản đồ
  map.setView([startLat, startLng], initialZoom);

  const startIcon = L.divIcon({
    className: "start-marker",
    html: '<span>S</span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  const endIcon = L.divIcon({
    className: "end-marker",
    html: '<span>H</span>', // Đổi thành H cho Hospital
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  // Tìm bệnh viện gần nhất (sử dụng hàm findNearestHospital đã sửa)
  const nearestHospital = findNearestHospital(startLat, startLng);

  // Chỉ tạo routing nếu tìm thấy bệnh viện gần nhất HỢP LỆ
  if (nearestHospital && typeof nearestHospital.lat === 'number' && typeof nearestHospital.lng === 'number') {
    console.log(`Đã tìm thấy bệnh viện gần nhất hợp lệ: Lat ${nearestHospital.lat}, Lng ${nearestHospital.lng}. Bắt đầu tạo tuyến đường.`);

    // Xóa routing control cũ nếu tồn tại
    if (routingControl) {
      console.log("Xóa routing control cũ.");
      map.removeControl(routingControl);
      routingControl = null; // Đảm bảo biến được reset
    }

    try {
      // Waypoints sử dụng đối tượng {lat, lng} đã đúng
      const waypoints = [
        L.latLng(startLat, startLng),
        L.latLng(nearestHospital.lat, nearestHospital.lng) // L.latLng(lat, lng)
      ];
      console.log("Waypoints đã tạo:", waypoints);

      routingControl = L.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: true, // Cho phép vẽ lại đường khi kéo thả marker
        lineOptions: {
          styles: [{ color: "red", opacity: 0.7, weight: 8 }]
        },
        show: true, // Hiển thị hướng dẫn đường đi
        addWaypoints: true, // Cho phép thêm điểm trên đường
        draggableWaypoints: true, // Cho phép kéo thả điểm bắt đầu/kết thúc
        createMarker: function (i, waypoint, n) {
          // Kiểm tra tọa độ của waypoint trước khi tạo marker
          if (!waypoint || !waypoint.latLng || typeof waypoint.latLng.lat !== 'number' || typeof waypoint.latLng.lng !== 'number') {
            console.error(`Waypoint ${i} không hợp lệ:`, waypoint);
            return null; // Không tạo marker nếu waypoint không hợp lệ
          }
          console.log(`Tạo marker cho waypoint ${i}:`, waypoint.latLng);

          if (i === 0) { // Điểm bắt đầu (Người dùng)
            return L.marker(waypoint.latLng, {
              icon: startIcon,
              draggable: true
            }).bindPopup("Vị trí của bạn (có thể kéo thả)")
              .on('dragend', function (e) {
                const newLatLng = e.target.getLatLng(); // getLatLng() trả về LatLng đúng
                console.log("Điểm bắt đầu mới (kéo thả):", newLatLng);
                // Tìm bệnh viện gần nhất từ vị trí mới
                const newNearestHospital = findNearestHospital(newLatLng.lat, newLatLng.lng); // Dùng hàm đã sửa
                console.log("Bệnh viện gần nhất mới:", newNearestHospital);

                if (newNearestHospital && typeof newNearestHospital.lat === 'number' && typeof newNearestHospital.lng === 'number') {
                  // Cập nhật tuyến đường với bệnh viện gần nhất mới
                  console.log("Cập nhật waypoints sau khi kéo thả.");
                  routingControl.setWaypoints([
                    L.latLng(newLatLng.lat, newLatLng.lng),
                    L.latLng(newNearestHospital.lat, newNearestHospital.lng)
                  ]);
                } else {
                  console.error("Không tìm thấy bệnh viện gần nhất hợp lệ cho vị trí mới sau khi kéo thả.");
                  alert("Không tìm thấy bệnh viện gần vị trí mới.");
                  if (routingControl) {
                    map.removeControl(routingControl);
                    routingControl = null;
                  }
                }
              });
          } else { // Điểm kết thúc (Bệnh viện)
            return L.marker(waypoint.latLng, { // waypoint.latLng giờ đã đúng
              icon: endIcon,
              draggable: false
            }).bindPopup("Bệnh viện gần nhất");
          }
        },
        // serviceUrl: 'https://router.project-osrm.org/route/v1' // Mặc định là OSRM
      }).addTo(map);

      // Thêm xử lý lỗi chi tiết từ routing control
      routingControl.on('routingerror', function (e) {
        console.error("Lỗi chi tiết từ Routing Control:", e.error);
        alert(`Không thể tìm thấy đường đi: ${e.error ? e.error.message : 'Lỗi không xác định'}. Vui lòng kiểm tra lại tọa độ hoặc thử lại.`);
        if (routingControl) {
          map.removeControl(routingControl);
          routingControl = null;
        }
      });

      routingControl.on('routesfound', function (e) {
        console.log('Tìm thấy tuyến đường:', e.routes[0]);
        // Ví dụ: map.fitBounds(e.routes[0].bounds); // Tự động zoom vào tuyến đường nếu muốn
      });

      console.log("Đã thêm Routing Control vào bản đồ.");

    } catch (error) {
      console.error("Lỗi khi khởi tạo L.Routing.control:", error);
      alert("Đã xảy ra lỗi khi khởi tạo chức năng tìm đường.");
      if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
      }
    }

  } else {
    console.error("Không tìm thấy bệnh viện gần nhất hoặc tọa độ không hợp lệ. Không thể tạo tuyến đường.", nearestHospital);
    alert("Không tìm thấy bệnh viện gần vị trí của bạn để tạo đường đi.");
    if (routingControl) {
      map.removeControl(routingControl);
      routingControl = null;
    }
  }
}

// === KHỞI CHẠY ===

// Đảm bảo tất cả dữ liệu JSON đã được tải và xử lý XONG trước khi lấy vị trí và khởi tạo routing
Promise.all(dataPromises).then(() => {
  console.log("Tất cả dữ liệu GeoJSON đã được xử lý.");
  // Lấy vị trí hiện tại của thiết bị SAU KHI có dữ liệu bệnh viện
  if (navigator.geolocation) {
    console.log("Bắt đầu lấy vị trí người dùng...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        console.log("Lấy vị trí thành công:", userLat, userLng);
        initializeRouting(userLat, userLng);
      },
      (error) => {
        console.warn("Không thể lấy vị trí tự động, sử dụng trung tâm TP.HCM làm mặc định:", error);
        initializeRouting(defaultLat, defaultLng);
      },
      { // Tùy chọn cho getCurrentPosition
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    console.error("Trình duyệt không hỗ trợ Geolocation.");
    initializeRouting(defaultLat, defaultLng);
  }
}).catch(error => {
  console.error("Lỗi trong quá trình tải dữ liệu ban đầu:", error);
  alert("Không thể tải dữ liệu bản đồ cần thiết. Vui lòng tải lại trang.");
  initializeRouting(defaultLat, defaultLng);
});


// Add legend - Không đổi
const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () {
  let div = L.DomUtil.create("div", "description");
  L.DomEvent.disableClickPropagation(div);
  const text = "Chọn loại địa điểm hoặc kéo thả điểm bắt đầu (S) để tìm đường."; // Cập nhật mô tả
  div.insertAdjacentHTML("beforeend", text);
  return div;
};
legend.addTo(map);