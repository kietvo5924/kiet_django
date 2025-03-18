// Cấu hình bản đồ
let config = {
    minZoom: 7,
    maxZoom: 18,
};

// Độ phóng đại khi bản đồ được mở
const zoom = 18;

// Tọa độ
const lat = 10.796501883372228;
const lng = 106.66680416611385;

// Khởi tạo bản đồ
const map = L.map("map", config).setView([lat, lng], zoom);
map.attributionControl.setPrefix(false);

// Được dùng để tải và trình các layer trên bản đồ
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; <a href='#'>LT GIS</a> cơ bản",
}).addTo(map);

// Tạo danh sách các địa điểm gồm vĩ độ, kinh độ và tên của địa điểm đó
let points = [
    [10.796277842338287, 106.66692171944823, "Cò Tea House & Coffee"],
    [10.7967043021434, 106.6674382521919, "Coi Xưa Cafe"],
    [10.795703526899937, 106.66683382964078, "BINISUN COFFEE & TEA"],
    [10.795117136275134, 106.66643199620628, "Sung Cà Phê"],
];

// Tạo 1 vòng lặp để thực hiện thêm nhiều marker vào bản đồ
for (let i = 0; i < points.length; i++) {
    const lat = points[i][0];
    const lng = points[i][1];
    const popupText = points[i][2];

    // Thêm marker đến bản đồ
    // Kéo thả marker
    const marker = new L.marker([lat, lng], {
        draggable: true,
        autoPan: true,
    })
        .bindPopup(popupText)
        .addTo(map);

    // Xử lý sự kiện khi kéo thả marker
    marker.on("dragend", function (e) {
        const markerPlace = document.querySelector(".marker-position");
        markerPlace.textContent = `${marker.getLatLng().lat}, ${marker.getLatLng().lng}`;
    });
}