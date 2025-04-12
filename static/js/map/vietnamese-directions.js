const VietnameseDirections = (function () {

    // Hàm trợ giúp nhỏ để lấy hướng chi tiết từ modifier
    const getModifierText = (mod) => {
        if (!mod) return '';
        mod = mod.toLowerCase(); // Chuẩn hóa để dễ so sánh
        if (mod.includes('sharp left')) return 'gắt sang trái';
        if (mod.includes('sharp right')) return 'gắt sang phải';
        if (mod.includes('slight left')) return 'chếch sang trái';
        if (mod.includes('slight right')) return 'chếch sang phải';
        if (mod.includes('left')) return 'trái';
        if (mod.includes('right')) return 'phải';
        if (mod.includes('uturn')) return 'quay đầu';
        if (mod.includes('straight')) return 'thẳng';
        return mod; // Trả về modifier gốc nếu không khớp
    };

    // --- Hàm công khai (public methods) ---

    /**
     * Lấy văn bản hướng dẫn tiếng Việt từ đối tượng instruction của OSRM.
     * @param {object} instruction Đối tượng instruction từ Leaflet Routing Machine.
     * @returns {string} Chuỗi văn bản hướng dẫn tiếng Việt.
     */
    const getText = function (instruction) {
        if (!instruction) return ''; // Tránh lỗi nếu instruction không hợp lệ

        const { type, modifier } = instruction;
        const direction = getModifierText(modifier); // Dịch modifier trước

        switch (type) {
            case 'Depart': return `Khởi hành ${direction ? `về hướng ${direction}` : ''}`;
            case 'Head':
            case 'Continue': return `Tiếp tục đi thẳng ${direction ? `về hướng ${direction}` : ''}`;

            // Xử lý các loại rẽ khác nhau
            case 'Turn':
                if (direction === 'quay đầu') return 'Quay đầu';
                return `Rẽ ${direction || 'theo hướng không xác định'}`; // Dùng hướng từ modifier, fallback

            case 'Right':
                return `Rẽ ${direction || 'phải'}`; // Ưu tiên modifier, nếu không thì mặc định là "phải"

            case 'Left':
                return `Rẽ ${direction || 'trái'}`; // Ưu tiên modifier, nếu không thì mặc định là "trái"

            case 'Fork':
                return `Đi theo nhánh ${direction || 'phải'}`; // Mặc định ngã ba là rẽ phải nếu không rõ modifier

            case 'Merge':
                return `Nhập làn ${direction || ''}`;

            case 'Roundabout':
            case 'Rotary':
                const exitText = instruction.exit ? ` đi theo lối ra thứ ${instruction.exit}` : '';
                // Sửa lỗi template literal trong code gốc
                return `Vào ${type === 'Rotary' ? 'bùng binh' : 'vòng xuyến'}${exitText}`;

            case 'RoundaboutTurn':
                // Đôi khi type là Roundabout nhưng vẫn có exit và modifier? Kiểm tra thêm
                const turnExitText = instruction.exit ? `lối ra thứ ${instruction.exit}` : 'lối ra';
                // Sử dụng tên đường nếu có, không thì dùng tên bùng binh/vòng xuyến
                const locationName = instruction.name ? `tại ${instruction.name}` : `tại ${type === 'Rotary' ? 'bùng binh' : 'vòng xuyến'}`;
                return `${locationName}, đi theo ${turnExitText} ${direction ? `về hướng ${direction}` : ''}`;

            case 'EndOfRoad':
                return `Cuối đường, rẽ ${direction || 'theo hướng không xác định'}`; // Fallback

            case 'NewName':
                return `Tiếp tục đi vào ${instruction.road || instruction.name || 'đường mới'}`; // Ưu tiên road rồi đến name

            // case 'UseLane': // Xử lý làn đường phức tạp, tạm bỏ qua
            //     return `Đi vào làn ${direction}`;

            case 'Arrive':
                return `Đã đến nơi ${direction ? `ở phía ${direction}` : ''}`;

            default:
                console.warn(`VietnameseDirections: Loại chỉ dẫn/modifier chưa được xử lý: ${type} / ${modifier}`);
                // Thử dịch cơ bản nếu type là hướng đơn giản
                if (type?.toLowerCase() === 'right') return 'Rẽ phải';
                if (type?.toLowerCase() === 'left') return 'Rẽ trái';
                if (type?.toLowerCase() === 'straight') return 'Đi thẳng';
                // Trả về type/modifier gốc nếu không dịch được
                return `${type || ''} ${modifier || ''}`.trim();
        }
    };

    /**
     * Lấy biểu tượng gợi ý từ đối tượng instruction của OSRM.
     * @param {object} instruction Đối tượng instruction từ Leaflet Routing Machine.
     * @returns {string} Chuỗi biểu tượng (emoji hoặc ký tự).
     */
    const getIcon = function (instruction) {
        if (!instruction) return '•'; // Mặc định

        const { type, modifier } = instruction;
        const modLower = modifier?.toLowerCase(); // Chuẩn hóa để dễ so sánh

        switch (type) {
            case 'Depart':
            case 'Head':
            case 'Continue':
                if (modLower?.includes('left')) return '↖'; // Hơi chếch trái
                if (modLower?.includes('right')) return '↗'; // Hơi chếch phải
                return '↑'; // Thẳng
            case 'Turn':
            case 'Right': // Gộp case cho icon
            case 'Left':  // Gộp case cho icon
            case 'Fork':
            case 'EndOfRoad':
                if (modLower?.includes('sharp left')) return '↩'; // Gắt trái
                if (modLower?.includes('sharp right')) return '↪'; // Gắt phải
                if (modLower?.includes('slight left') || modLower?.includes('left')) return '←'; // Trái / Chếch trái
                if (modLower?.includes('slight right') || modLower?.includes('right')) return '→'; // Phải / Chếch phải
                if (modLower?.includes('uturn')) return '⤸'; // Quay đầu
                if (modLower?.includes('straight')) return '↑'; // Đi thẳng tại ngã ba/cuối đường? (Hiếm)
                // Fallback cho type Left/Right nếu không có modifier
                if (type === 'Left') return '←';
                if (type === 'Right') return '→';
                return '↔'; // Rẽ (không rõ hướng)
            case 'Merge': return '⤭'; // Nhập làn
            case 'Roundabout':
            case 'Rotary':
            case 'RoundaboutTurn': return '↻'; // Vòng xuyến / Bùng binh
            // case 'UseLane': return '🚦'; // Placeholder làn đường
            case 'NewName': return '→'; // Biểu tượng tiếp tục hoặc đổi tên đường
            case 'Arrive': return '📍'; // Đến nơi
            default: return '•'; // Mặc định
        }
    };

    // Trả về đối tượng chứa các hàm công khai
    return {
        getText: getText,
        getIcon: getIcon
    };

})(); // Gọi IIFE ngay lập tức để tạo module