/* eslint-disable no-undef */
/**
 * control layers outside the map with routing - Updated for API Data (Cleaned)
 */

// --- Configs ---
const config = { minZoom: 7, maxZoom: 18, fullscreenControl: true };
const initialZoom = 15;
const clickMarkerZoom = 18;
const defaultLat = 10.7769;
const defaultLng = 106.7009;

// --- Global Variables ---
const map = L.map("map", config);
let routingControl = null;
let startMarker = null;
let endMarker = null;
let currentStartLocation = { lat: defaultLat, lng: defaultLng };
let allFeaturesData = {}; // Cache for API data { amenityType: [features...] }
let layers = {}; // Cache for L.geoJSON layers { layer_amenityType: layer }
const layersContainer = document.querySelector(".layers");
const layersButton = "không chọn";
const arrayLayers = ["police", "PCCC", "hospital"];

// --- Icons ---
const startIcon = L.divIcon({ className: "start-marker", html: '<span>S</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const endIcon = L.divIcon({ className: "end-marker", html: '<span>Đ</span>', iconSize: [30, 30], iconAnchor: [15, 15] });

// --- Map Layer ---
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// --- Utility Functions ---
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clickZoom(e) {
  map.setView(e.target.getLatLng(), clickMarkerZoom);
}

// --- API Data Fetching ---
async function fetchDataFromAPI(amenityType) {
  // *** IMPORTANT: Adjust this URL to match your Django URL setup ***
  const apiUrl = `/maps/api/locations/?amenity=${encodeURIComponent(amenityType)}`;
  console.log(`Workspaceing: ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      let errorData = null;
      try { errorData = await response.json(); } catch (e) { /* Ignore if body not JSON */ }
      throw new Error(errorData?.error || response.statusText || `HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data.error) throw new Error(`API Error: ${data.error}`);
    console.log(`Received ${data?.features?.length || 0} features for ${amenityType}.`);
    return data;
  } catch (err) {
    console.error(`API Fetch Error (${amenityType}):`, err);
    alert(`Không thể tải dữ liệu ${amenityType}.\nLỗi: ${err.message}`);
    return { type: "FeatureCollection", features: [] }; // Return empty structure on error
  }
}

// --- GeoJSON Marker Creation ---
const geojsonOpts = {
  pointToLayer: function (feature, latlng_placeholder) {
    const coords = feature.geometry?.coordinates; // API returns [latitude, longitude]
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || coords[0] < -90 || coords[0] > 90 || coords[1] < -180 || coords[1] > 180) {
      console.warn("Invalid coordinates in feature:", feature.properties?.name, coords);
      return null;
    }
    const [sourceLat, sourceLng] = coords;
    const correctLatLng = L.latLng(sourceLat, sourceLng);
    const { amenity, name = "Không có tên", address = "" } = feature.properties || {};
    const className = typeof amenity === 'string' && arrayLayers.includes(amenity.toLowerCase()) ? amenity.toLowerCase() : 'default-marker';
    const htmlContent = typeof amenity === 'string' && amenity ? amenity[0].toUpperCase() : '?';

    return L.marker(correctLatLng, {
      icon: L.divIcon({ className: className, iconSize: L.point(16, 16), html: htmlContent, popupAnchor: [0, -10] }),
    })
      .bindPopup(`<b>${name}</b><br>${amenity || 'Địa điểm'}<br><small>${address}</small>`)
      .on("click", clickZoom);
  },
};

// --- Find Nearest Point ---
function findNearest(featureType, currentLat, currentLng) {
  let nearestFeature = null;
  let minDistance = Infinity;
  const featuresToSearch = allFeaturesData[featureType];

  if (!featuresToSearch || featuresToSearch.length === 0) {
    // console.warn(`No features data available for ${featureType} to find nearest.`);
    return null;
  }

  featuresToSearch.forEach((feature) => {
    const coords = feature.geometry?.coordinates; // API returns [latitude, longitude]
    if (!coords || feature.geometry?.type !== 'Point' || typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || coords[0] < -90 || coords[0] > 90 || coords[1] < -180 || coords[1] > 180) {
      return; // Skip invalid features silently or add minimal log: console.warn('Skipping invalid feature in findNearest:', feature?.properties?.name);
    }
    try {
      const distance = getDistance(currentLat, currentLng, coords[0], coords[1]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestFeature = feature;
      }
    } catch (e) {
      console.error(`Distance calculation error for ${feature?.properties?.name}:`, e);
    }
  });

  if (nearestFeature) {
    const finalCoords = nearestFeature.geometry.coordinates; // [lat, lon]
    const [finalLat, finalLng] = finalCoords;
    if (typeof finalLng === 'number' && typeof finalLat === 'number' && finalLat >= -90 && finalLat <= 90 && finalLng >= -180 && finalLng <= 180) {
      console.log(`${featureType} nearest: "${nearestFeature.properties?.name || 'N/A'}" (${minDistance.toFixed(0)}m)`);
      return { lat: finalLat, lng: finalLng, name: nearestFeature.properties?.name || "Không có tên" };
    }
  }
  console.log(`No nearby ${featureType} found.`);
  return null;
}

// --- Radio Button Generation ---
function generateButton(name) {
  if (document.getElementById(name)) return;
  const templateLayer = `
    <li class="layer-element">
      <label for="${name}">
        <input type="radio" id="${name}" name="layer-group" class="item" value="${name}">
        <span>${name === layersButton ? 'Bỏ chọn' : name.toUpperCase()}</span>
      </label>
    </li>`;
  layersContainer.insertAdjacentHTML("beforeend", templateLayer);
}

// --- Show/Hide/Fetch Layers ---
async function showOnlyLayer(selectedId) {
  document.body.style.cursor = 'wait';

  // Hide all layers first
  arrayLayers.forEach((id) => {
    if (layers["layer_" + id] && map.hasLayer(layers["layer_" + id])) {
      map.removeLayer(layers["layer_" + id]);
    }
  });

  if (selectedId === layersButton || !arrayLayers.includes(selectedId)) {
    console.log("Layer deselected or invalid.");
    document.body.style.cursor = 'default';
    return;
  }

  // Show selected layer (fetch if needed)
  try {
    if (layers["layer_" + selectedId]) { // Check cache first
      if (!map.hasLayer(layers["layer_" + selectedId])) {
        map.addLayer(layers["layer_" + selectedId]);
        console.log(`Showing layer ${selectedId} from cache.`);
      }
    } else {
      console.log(`Workspaceing data for layer ${selectedId}...`);
      const apiData = await fetchDataFromAPI(selectedId); // Fetch from API

      if (apiData?.features?.length > 0) {
        allFeaturesData[selectedId] = apiData.features; // Cache features data
        const newLayer = L.geoJSON(apiData, geojsonOpts);
        layers["layer_" + selectedId] = newLayer; // Cache layer object
        map.addLayer(newLayer);
        console.log(`Workspaceed and displayed layer ${selectedId} (${apiData.features.length} features).`);
      } else if (apiData?.features?.length === 0) {
        console.log(`No features found for ${selectedId}.`);
        allFeaturesData[selectedId] = []; // Cache empty result
        layers["layer_" + selectedId] = L.geoJSON({ type: "FeatureCollection", features: [] }); // Cache empty layer
        alert(`Không tìm thấy địa điểm ${selectedId.toUpperCase()} nào.`);
      }
      // API error case handled within fetchDataFromAPI with an alert
    }
  } catch (error) {
    console.error(`Error in showOnlyLayer (${selectedId}):`, error);
    alert(`Lỗi hiển thị lớp ${selectedId.toUpperCase()}.`);
  } finally {
    document.body.style.cursor = 'default';
  }
}

// --- Update/Draw Route ---
function updateRoute(startLat, startLng) {
  const selectedRadio = document.querySelector('input[name="layer-group"]:checked');

  // Clear previous route/marker if any
  if (routingControl) map.removeControl(routingControl);
  if (endMarker) map.removeLayer(endMarker);
  routingControl = null;
  endMarker = null;

  if (!selectedRadio || selectedRadio.value === layersButton || !arrayLayers.includes(selectedRadio.value)) {
    console.log("No valid layer selected for routing.");
    return;
  }
  const selectedType = selectedRadio.value;

  console.log(`Finding nearest ${selectedType.toUpperCase()} for routing...`);
  const nearestTarget = findNearest(selectedType, startLat, startLng);

  if (nearestTarget) {
    const waypoints = [L.latLng(startLat, startLng), L.latLng(nearestTarget.lat, nearestTarget.lng)];

    routingControl = L.Routing.control({
      waypoints: waypoints,
      routeWhileDragging: false,
      lineOptions: { styles: [{ color: "blue", opacity: 0.8, weight: 6 }] },
      show: true,
      addWaypoints: false,
      draggableWaypoints: false,
      createMarker: () => null // Use our custom markers (S, Đ)
    }).addTo(map);

    routingControl.on('routingerror', (e) => {
      console.error("Routing Error:", e.error);
      alert(`Không tìm thấy đường đi.\nLỗi: ${e.error?.message || 'Lỗi không xác định'}.`);
      if (routingControl) map.removeControl(routingControl);
      routingControl = null;
    });

    routingControl.on('routesfound', (e) => {
      if (e.routes?.length > 0) {
        const summary = e.routes[0].summary;
        console.log(`Route found: ${(summary.totalDistance / 1000).toFixed(2)} km, ${Math.round(summary.totalTime / 60)} min.`);
      }
    });

    endMarker = L.marker([nearestTarget.lat, nearestTarget.lng], { icon: endIcon, draggable: false })
      .addTo(map)
      .bindPopup(`Điểm đến:<br><b>${nearestTarget.name}</b><br>(${selectedType.toUpperCase()})`);
  } else {
    console.error(`Cannot update route: No nearby ${selectedType.toUpperCase()} found or data unavailable.`);
    // Alert if data was fetched but still no target found
    if (allFeaturesData[selectedType] && allFeaturesData[selectedType].length > 0) {
      alert(`Không tìm thấy ${selectedType.toUpperCase()} nào gần vị trí của bạn.`);
    }
  }
}

// --- Event Handlers ---
function handleStartMarkerDragEnd(e) {
  const newLatLng = e.target.getLatLng();
  console.log("Start marker dragged to:", newLatLng);
  currentStartLocation = { lat: newLatLng.lat, lng: newLatLng.lng };
  updateRoute(newLatLng.lat, newLatLng.lng); // Update route from new start position
}

function returnToCurrentLocation() {
  if (!navigator.geolocation) {
    return alert("Trình duyệt không hỗ trợ định vị.");
  }
  document.body.style.cursor = 'wait';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      document.body.style.cursor = 'default';
      const { latitude: lat, longitude: lng } = position.coords;
      console.log("Got current location:", lat, lng);
      map.setView([lat, lng], initialZoom);
      currentStartLocation = { lat, lng };
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.marker([lat, lng], { icon: startIcon, draggable: true })
        .addTo(map)
        .bindPopup("Vị trí của bạn (kéo thả)")
        .openPopup()
        .on('dragend', handleStartMarkerDragEnd);
      updateRoute(lat, lng); // Update route from current location
    },
    (error) => {
      document.body.style.cursor = 'default';
      console.error("Geolocation Error:", error);
      alert(`Không thể lấy vị trí.\nLỗi: ${error.message}`);
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

// --- Custom Controls ---
L.Control.CurrentLocation = L.Control.extend({
  options: { position: 'topright' },
  onAdd: function (map) {
    const container = L.DomUtil.create("div", "leaflet-control-current-location leaflet-bar leaflet-control");
    container.innerHTML = '<span title="Về vị trí của tôi" style="font-size: 1.4em; cursor: pointer;">🎯</span>';
    container.onclick = (e) => { L.DomEvent.stopPropagation(e); returnToCurrentLocation(); };
    L.DomEvent.disableClickPropagation(container);
    return container;
  },
});
L.control.currentLocation = (opts) => new L.Control.CurrentLocation(opts);

const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () {
  const div = L.DomUtil.create("div", "description");
  L.DomEvent.disableClickPropagation(div);
  div.innerHTML = "Chọn loại địa điểm (POLICE, PCCC, HOSPITAL) để tìm đường gần nhất từ (S). Kéo thả (S) để đổi điểm bắt đầu.";
  return div;
};

// --- Initialization ---
function initializeMapAndData(initialLat, initialLng) {
  console.log(`Initializing map at: [${initialLat}, ${initialLng}]`);
  currentStartLocation = { lat: initialLat, lng: initialLng };
  map.setView([initialLat, initialLng], initialZoom);

  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker([initialLat, initialLng], { icon: startIcon, draggable: true })
    .addTo(map)
    .bindPopup("Vị trí của bạn (kéo thả)")
    .on('dragend', handleStartMarkerDragEnd);

  const defaultRadio = document.getElementById(layersButton);
  if (defaultRadio) defaultRadio.checked = true;

  console.log("Map initialized.");
  L.control.currentLocation().addTo(map);
  legend.addTo(map);
}

// --- Main Execution ---
// 1. Generate radio buttons
generateButton(layersButton);
arrayLayers.forEach(generateButton);

// 2. Get initial location and initialize map
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => initializeMapAndData(pos.coords.latitude, pos.coords.longitude),
    (err) => {
      console.warn("Geolocation failed, using default.", err.message);
      initializeMapAndData(defaultLat, defaultLng);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
} else {
  console.error("Geolocation not supported.");
  initializeMapAndData(defaultLat, defaultLng);
}

// 3. Add event listener for radio button changes
document.addEventListener('change', async (e) => {
  if (e.target.matches('input[type="radio"].item[name="layer-group"]')) {
    const selectedValue = e.target.value;
    console.log(`Radio selection changed: ${selectedValue}`);
    document.body.style.cursor = 'wait'; // Use loading state from CSS ideally
    try {
      await showOnlyLayer(selectedValue); // Fetch/show layer
      updateRoute(currentStartLocation.lat, currentStartLocation.lng); // Update route based on current start location
    } catch (error) {
      console.error("Error processing radio change:", error);
      alert("Đã xảy ra lỗi khi xử lý lựa chọn.");
    } finally {
      document.body.style.cursor = 'default';
    }
  }
});
