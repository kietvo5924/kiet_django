window.addEventListener("DOMContentLoaded", function () {
    // Cấu hình bản đồ
    let config = {
        minZoom: 7,
        maxZoom: 18,
        fullscreenControl: true,
    };

    // Bộ phóng đại khi bản đồ được mở
    const zoom = 18;

    // Tọa độ Trường
    const lat = 10.796588138173228;
    const lng = 106.6646816113185;

    // Khởi tạo bản đồ
    const map = L.map("map", config).setView([lat, lng], zoom);
    map.attributionControl.setPrefix(false);

    // Dùng dịch vụ để vẽ và trình các layer trên bản đồ
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Autocomplete
    new Autocomplete("search", {
        delay: 1000,
        selectFirst: true,
        howManyCharacters: 2,

        onSearch: function ({ currentValue }) {
            const api = `https://nominatim.openstreetmap.org/search?format=geojson&limit=5&q=${encodeURI(
                currentValue
            )}`;

            /**
             * Promise
             */
            return new Promise((resolve, reject) => {
                fetch(api)
                    .then((response) => response.json())
                    .then((data) => {
                        // Kiểm tra xem data.features có tồn tại không
                        if (data && data.features) {
                            resolve(data.features);
                        } else {
                            reject(new Error("Không tìm thấy dữ liệu từ API"));
                        }
                    })
                    .catch((error) => {
                        console.error("Lỗi khi gọi API:", error);
                        reject(error);
                    });
            });
        },

        // nominatim
        onResults: ({ currentValue, matches, template }) => {
            const regex = new RegExp(currentValue, "i");
            // Kiểm tra nếu không có kết quả thì trả về template
            return matches.length === 0
                ? template
                : matches
                    .map(
                        (element) => `
            <li class="loupe" role="option">
                ${element.properties.display_name.replace(
                            regex,
                            (str) => `<b>${str}</b>`
                        )}
            </li> `
                    )
                    .join("");
        },

        // Khi người dùng chọn một mục từ danh sách gợi ý
        onSelectedItem: ({ index, element, object }) => {
            console.log("onSelectedItem:", index, element, object);
        },

        // Khi không tìm thấy kết quả
        noResults: ({ currentValue, template }) =>
            template(`<li>Không tìm thấy kết quả: '${currentValue}'</li>`),

        // Khi người dùng submit (chọn một địa điểm)
        onSubmit: ({ object }) => {
            const { display_name } = object.properties;
            const cord = object.geometry.coordinates;
            // Custom id cho marker
            const customId = Math.random();

            // Tạo marker mới
            const marker = L.marker([cord[1], cord[0]], {
                title: display_name,
                id: customId,
            });

            // Thêm marker vào bản đồ và gắn popup
            marker.addTo(map).bindPopup(display_name);

            // Di chuyển bản đồ đến vị trí của marker
            map.setView([cord[1], cord[0]], 8);

            // Xóa các marker cũ, giữ lại marker mới
            map.eachLayer(function (layer) {
                // Chỉ xóa các layer là marker (không xóa tile layer)
                if (layer instanceof L.Marker && layer.options.id !== customId) {
                    map.removeLayer(layer);
                }
            });
        },
    });
    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = function () {
        let div = L.DomUtil.create("div", "description");
        L.DomEvent.disableClickPropagation(div);
        const text =
            "<b>Thu Điếu - Nguyễn Khuyến</b></br>" +
            "Ao thu lạnh lẽo nước trong veo,</br>" +
            "Một chiếc thuyền câu bé tẻo teo.</br>" +
            "Sóng biếc theo làn hơi gợn tí,</br>" +
            "Lá vàng trước gió sẽ đưa vèo.</br>" +
            "Tầng mây lơ lửng trời xanh ngắt,</br>" +
            "Ngõ trúc quanh co khách vắng teo.</br>" +
            "Tựa gối, ôm cần lâu chẳng được,</br>" +
            "Cá đâu đớp động dưới chân bèo.</br>";
        div.insertAdjacentHTML("beforeend", text);
        return div;
    };

    legend.addTo(map);
    //Được dùng để tải và trình các layer trên bản đồ 
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="#">LT GIS</a> cơ bản',
    }).addTo(map);

    map
        .locate({
            // https://leafletjs.com/reference-1.7.1.html#locate-options-option 
            setView: true,
            enableHighAccuracy: true,
        })
        // if location found show marker and circle 
        .on("locationfound", (e) => {
            // marker 
            const marker = L.marker([e.latitude, e.longitude]).bindPopup(
                "Your are here :)"
            );
            // circle 
            const circle = L.circle([e.latitude, e.longitude], e.accuracy / 2, {
                weight: 2,
                color: "red",
                fillColor: "red",
                fillOpacity: 0.1,
            });
            // add marker 
            map.addLayer(marker);
            // add circle 
            map.addLayer(circle);
        })
        // if error show alert 
        .on("locationerror", (e) => {
            alert("Location access denied.");
        });
});