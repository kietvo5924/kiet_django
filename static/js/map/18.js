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
const zoom = 18;

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
    const data = await response.json();
    return data;
  } catch (err) {
    console.error(err);
  }
}

// center map on the clicked marker
function clickZoom(e) {
  map.setView(e.target.getLatLng(), zoom);
}

let geojsonOpts = {
  pointToLayer: function (feature, latlng) {
    return L.marker(latlng, {
      icon: L.divIcon({
        className: feature.properties.amenity,
        iconSize: L.point(16, 16),
        html: feature.properties.amenity[0].toUpperCase(),
        popupAnchor: [3, -5],
      }),
    })
      .bindPopup(
        feature.properties.amenity +
        "<br><b>" +
        feature.properties.name +
        "</b>"
      )
      .on("click", clickZoom);
  },
};

const layersContainer = document.querySelector(".layers");
const layersButton = "all layers";

function generateButton(name) {
  const id = name === layersButton ? "all-layers" : name;
  const templateLayer = `
    <li class="layer-element">
      <label for="${id}">
        <input type="checkbox" id="${id}" name="item" class="item" value="${name}" checked>
        <span>${name}</span>
      </label>
    </li>
  `;
  layersContainer.insertAdjacentHTML("beforeend", templateLayer);
}

generateButton(layersButton);

// add data to geoJSON layer and add to LayerGroup
const arrayLayers = ["bar", "pharmacy", "restaurant", "hospital"];
let allFeatures = [];
let hospitalFeatures = []; // Lưu riêng các bệnh viện

arrayLayers.map((json) => {
  generateButton(json);
  fetchData(`/static/data/${json}.json`).then((data) => {
    window["layer_" + json] = L.geoJSON(data, geojsonOpts).addTo(map);
    if (data.features) {
      allFeatures = allFeatures.concat(data.features);
      // Lưu các feature của bệnh viện
      if (json === "hospital") {
        hospitalFeatures = data.features;
      }
    }
  });
});

// Layer control event listener
document.addEventListener("click", (e) => {
  const target = e.target;
  const itemInput = target.closest(".item");
  if (!itemInput) return;
  showHideLayer(target);
});

function showHideLayer(target) {
  if (target.id === "all-layers") {
    arrayLayers.map((json) => {
      checkedType(json, target.checked);
    });
  } else {
    checkedType(target.id, target.checked);
  }

  const checkedBoxes = document.querySelectorAll("input[name=item]:checked");
  document.querySelector("#all-layers").checked =
    checkedBoxes.length - (document.querySelector("#all-layers").checked === true ? 1 : 0) < 3 ? false : true;
}

function checkedType(id, type) {
  map[type ? "addLayer" : "removeLayer"](window["layer_" + id]);
  map.fitBounds(window[["layer_" + id]].getBounds(), { padding: [50, 50] });
  document.querySelector(`#${id}`).checked = type;
}

// Hàm tính khoảng cách (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Hàm tìm bệnh viện gần nhất
function findNearestHospital(currentLat, currentLng) {
  let nearest = null;
  let minDistance = Infinity;

  hospitalFeatures.forEach(feature => {
    const coords = feature.geometry.coordinates; // [lng, lat]
    const distance = getDistance(currentLat, currentLng, coords[1], coords[0]);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = feature;
    }
  });

  return nearest ? { lat: nearest.geometry.coordinates[1], lng: nearest.geometry.coordinates[0] } : null;
}

// Khởi tạo routing
let routingControl; // Biến toàn cục để lưu routing control

function initializeRouting(startLat, startLng) {
  map.setView([startLat, startLng], zoom);

  const startIcon = L.divIcon({
    className: "start-marker",
    html: '<span>S</span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  const endIcon = L.divIcon({
    className: "end-marker",
    html: '<span>E</span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  // Chờ tất cả dữ liệu JSON được tải
  Promise.all(arrayLayers.map(json => fetchData(`/static/data/${json}.json`))).then(() => {
    const nearestHospital = findNearestHospital(startLat, startLng);

    if (nearestHospital) {
      // Xóa routing control cũ nếu tồn tại
      if (routingControl) {
        map.removeControl(routingControl);
      }

      routingControl = L.Routing.control({
        waypoints: [
          L.latLng(startLat, startLng),
          L.latLng(nearestHospital.lat, nearestHospital.lng)
        ],
        routeWhileDragging: true,
        lineOptions: {
          styles: [{ color: "red", opacity: 0.7, weight: 8 }]
        },
        show: true,
        addWaypoints: true,
        draggableWaypoints: true,
        createMarker: function(i, waypoint, n) {
          if (i === 0) {
            return L.marker(waypoint.latLng, {
              icon: startIcon,
              draggable: true
            }).on('dragend', function(e) {
              const newLatLng = e.target.getLatLng();
              const newNearestHospital = findNearestHospital(newLatLng.lat, newLatLng.lng);
              if (newNearestHospital) {
                // Cập nhật tuyến đường với bệnh viện gần nhất mới
                routingControl.setWaypoints([
                  L.latLng(newLatLng.lat, newLatLng.lng),
                  L.latLng(newNearestHospital.lat, newNearestHospital.lng)
                ]);
              }
            });
          } else {
            return L.marker(waypoint.latLng, {
              icon: endIcon,
              draggable: false
            }).on('dragend', function(e) {
              routingControl.spliceWaypoints(n - 1, 1, e.target.getLatLng());
            });
          }
        }
      }).addTo(map);
    }
  });
}

// Lấy vị trí hiện tại của thiết bị
navigator.geolocation.getCurrentPosition(
  (position) => {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    initializeRouting(userLat, userLng);
  },
  (error) => {
    console.log("Không thể lấy vị trí, sử dụng trung tâm TP.HCM làm mặc định:", error);
    initializeRouting(defaultLat, defaultLng);
  }
);

// Add legend
const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () {
  let div = L.DomUtil.create("div", "description");
  L.DomEvent.disableClickPropagation(div);
  const text = "Hãy thử di chuyển một trong các điểm đánh dấu hoặc điểm lộ trình";
  div.insertAdjacentHTML("beforeend", text);
  return div;
};
legend.addTo(map);