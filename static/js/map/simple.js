// Cấu hình bản đồ
let config = {
    minZoom: 7,
    maxZoom: 18,
    fullscreenControl: true,
};

// Độ phóng đại khi bản đồ được mở
const zoom = 18;

// Tọa độ trung tâm
const lat = 10.796501883372228;
const lng = 106.66680416611385;

// Khởi tạo bản đồ
const map = L.map("map", config).setView([lat, lng], zoom);
map.attributionControl.setPrefix(false);

// Tải và hiển thị tile layer từ OpenStreetMap
// L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
//     attribution: "&copy; <a href='#'>LT GIS</a> cơ bản",
// }).addTo(map);


/////////////// Điều khiển các maker trên bản đồ như ẩn hiện maker ///////////////////

// // Danh sách các địa điểm quán cà phê
// let pointsCafe = [
//     [10.796277842333827, 106.66692171944823, "CỒ Tea House & Coffee"],
//     [10.79607043221434, 106.6674328521939, "Coi Xua Cafe"],
//     [10.795703256899937, 106.66683504293746, "BINISUN COFFEE & TEA"],
//     [10.795117136725134, 106.66643199662028, "Sung Cà Phê"],
// ];

// // Danh sách các địa điểm nhà hàng/quán ăn
// let pointsNhaHang = [
//     [10.79578534694128, 106.66710000668287, "Hương Cau 2"],
//     [10.79550750285199, 106.66622580412363, "Lẩu dê Tri kỷ"],
//     [10.795987566872768, 106.66588925403235, "Phở Phú Vương"],
//     [10.79694006846232, 106.66523263028328, "Nhà hàng Quá Ngon"],
//     [10.796278422026903, 106.6658538970941, "Bánh mì Nhà Lúa"],
//     [10.796186461235653, 106.6655664414166, "Wulao"],
//     [10.796252055146217, 106.66548974107106, "King BBQ Lê Văn Sỹ"],
//     [10.79628564798421, 106.6654421318612, "Orifood BBQ & Hotpot Lê Văn Sỹ"],
// ];

// // Tạo LayerGroup để quản lý marker của từng loại địa điểm
// const pA = new L.FeatureGroup();
// const pB = new L.FeatureGroup();
// const allMarkers = new L.FeatureGroup();

// // Thêm marker đến layer pointsCafe
// for (let i = 0; i < pointsCafe.length; i++) {
//     let marker = L.marker([pointsCafe[i][0], pointsCafe[i][1]])
//         .bindPopup(pointsCafe[i][2]);
//     pA.addLayer(marker);
// }

// // Thêm marker đến layer pointsNhaHang
// for (let i = 0; i < pointsNhaHang.length; i++) {
//     let marker = L.marker([pointsNhaHang[i][0], pointsNhaHang[i][1]])
//         .bindPopup(pointsNhaHang[i][2]);
//     pB.addLayer(marker);
// }

// // Tạo danh sách lớp overlay để điều khiển hiển thị
// const overlayMaps = {
//     "Cà phê": pA,
//     "Nhà hàng/quán ăn": pB,
// };

// // Sự kiện cập nhật khi layer được thêm hoặc gỡ bỏ
// map.on("layeradd layerremove", function () {
//     let bounds = new L.LatLngBounds();

//     // Duyệt qua từng lớp trên bản đồ
//     map.eachLayer(function (layer) {
//         if (layer instanceof L.FeatureGroup) {
//             bounds.extend(layer.getBounds());
//         }
//     });

//     // Nếu có layer hợp lệ, tự động zoom vào khu vực chứa chúng
//     if (bounds.isValid()) {
//         map.flyToBounds(bounds);
//     }
// });

// map.on("layeradd layerremove", function () {
//     // tạo các đường biên rỗng
//     let bounds = new L.LatLngBounds();

//     // Lặp lại các layer của bản đồ
//     map.eachLayer(function (layer) {
//         // Kiểm tra xem lớp có phải là FeatureGroup không
//         if (layer instanceof L.FeatureGroup) {
//             // Extend bounds với group's bounds
//             bounds.extend(layer.getBounds());
//         }
//     });

//     // Kiểm tra xem các đường biên có hợp lệ không
//     if (bounds.isValid()) {
//         map.flyToBounds(bounds);
//     }
// });

// L.Control.CustomButtons = L.Control.Layers.extend({
//     onAdd: function () {
//         this._initLayout();
//         this._addMarker();
//         this._removeMarker();
//         this._update();
//         return this._container;
//     },
//     _addMarker: function () {
//         this.createButton("Thêm", "add-button");
//     },
//     _removeMarker: function () {
//         this.createButton("Xóa", "remove-button");
//     },
//     createButton: function (type, className) {
//         const elements = this._container.getElementsByClassName(
//             "leaflet-control-layers-list"
//         );
//         const button = L.DomUtil.create(
//             "button",
//             `btn-markers ${className}`,
//             elements[0]
//         );
//         button.textContent = `${type} markers`;

//         L.DomEvent.on(button, "click", function (e) {
//             const checkbox = document.querySelectorAll(
//                 ".leaflet-control-layers-overlays input[type=checkbox]"
//             );

//             // Remove/add all layer from map when click on button
//             [].slice.call(checkbox).map((el) => {
//                 el.checked = type === "Thêm" ? false : true;
//                 el.click();
//             });
//         });
//     },
// });



///////////////// Vẽ các đối tượng lên bản độ dựa vào các tọa độ của đối tượng đó /////////////////////

// const Truong = L.polygon([
//     [10.796646364606142, 106.66708527087582],
//     [10.796736235249826, 106.66646009555878],
//     [10.797240865498882, 106.66655116203911],
//     [10.797198709914033, 106.66683748785057],
//     [10.797189488379063, 106.66683748785057],
//     [10.797165117178125, 106.66696623388287],
//     [10.797178949481602, 106.66696891609189],
//     [10.797148263935389, 106.6671822656203],
//     [10.796733762852362, 106.6671239934163],
//     [10.796724880680173, 106.66711595587091],
// ], {
//     color: "blue",
//     className: "Truong",
// });

// const Place = L.polygon(
//     [
//         [10.795818637312593, 106.66679660256901],
//         [10.795785703106535, 106.66692601915355],
//         [10.795717199946411, 106.66690925534726],
//         [10.795677678885358, 106.66694412406434],
//         [10.795550552766729, 106.66691461976534],
//         [10.795579534890932, 106.66682610686813],
//         [10.795491271140351, 106.6667878853898],
//         [10.79554989408206, 106.66671948906011],
//     ],
//     {
//         color: "red",
//         className: "place",
//     }
// );

// const truong = new L.FeatureGroup();
// const place = new L.FeatureGroup();

// truong.addLayer(Truong);
// place.addLayer(Place);

// const overlayMaps = {
//     Truong: truong,
//     Place: place,
// };

// map.on("layeradd", function () {
//     let bounds = new L.LatLngBounds();
//     map.eachLayer(function (layer) {
//         if (layer instanceof L.FeatureGroup) {
//             bounds.extend(layer.getBounds());
//         }
//     });

//     if (bounds.isValid()) {
//         map.flyToBounds(bounds);
//     } else {
//         // map.fitWorld();
//     }
// });

// L.Control.CustomButtons = L.Control.Layers.extend({
//     onAdd: function () {
//         this._initLayout();
//         this._removePolygons();
//         this._update();
//         return this._container;
//     },

//     _removePolygons: function () {
//         this._createButton("remove", "Xóa tất cả các vùng ");
//     },

//     _createButton: function (type, className) {
//         const elements = this._container.getElementsByClassName(
//             "leaflet-control-layers-list"
//         );

//         const button = L.DomUtil.create(
//             "button",
//             `btn-markers ${className}`,
//             elements[0]
//         );

//         button.textContent = className;

//         L.DomEvent.on(button, "click", function (e) {
//             const checkbox = document.querySelectorAll(
//                 `.leaflet-control-layers-overlays input[type=checkbox]`
//             );

//             // Xóa/thêm tất cả layer từ bản đồ khi click button
//             [].slice.call(checkbox).map((el) => {
//                 el.checked = type === "add" ? false : true;
//                 el.click();
//             });
//         });
//     },
// });


// new L.Control.CustomButtons(null, overlayMaps, { collapsed: false }).addTo(map);


///////////////Tùy biến marker và nội dung của popup maker/////////////////////////

// Được dùng để tải va trình các layer trên bản đồ
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "©copy; <a href='https://LT_GIS/ac'> co bản</a>",
}).addTo(map);

// Tạo icon tùy chỉnh
const funny = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconSize: [50, 58], // Kích thước của icon
    iconAnchor: [20, 58], // Điểm neo của icon (tọa độ gốc của icon)
    popupAnchor: [0, -60], // Điểm neo của popup (vị trí popup so với icon)
});

// Tạo nội dung popup
const customPopup = `
    <iframe width="560" height="315" src="https://www.youtube.com/embed/F8oVhmKu7GA" 
    title="YouTube video player" frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
    referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
`;

// Tùy chỉnh options cho popup
const customOptions = {
    maxWidth: "auto", // Đặt chiều rộng tối đa của popup
    className: "customPopup", // Tên class của popup để tùy chỉnh CSS nếu cần
};

// Thêm marker (điểm đánh dấu) vào bản đồ, truyền icon tùy chỉnh và nội dung popup
L.marker([lat, lng], {
    icon: funny,
})
    .bindPopup(customPopup, customOptions) // Gắn popup vào marker
    .addTo(map); // Thêm marker vào bản đồ


