# maps/views.py

from django.shortcuts import render
# === Thêm các import này ===
from django.http import JsonResponse
from django.core.exceptions import ValidationError
from .models import Location  # Đảm bảo model Location ở trong app 'maps' này
# ===========================

# Create your views here.

# View cũ của bạn, giữ nguyên
def simplemap(request):
    return render(request, 'simple-map.html')

# View hiển thị trang bản đồ emergency-road, giữ nguyên
def simplemap2(request):
    # View này vẫn chỉ render template HTML
    # Logic lấy dữ liệu sẽ được gọi từ JavaScript thông qua API mới
    return render(request, 'emergency-road.html')

# === Thêm hàm API view này vào ===
def get_locations_api(request):
    """
    API endpoint để lấy danh sách địa điểm theo amenity.
    Ví dụ: /api/locations/?amenity=hospital
    """
    amenity_filter = request.GET.get('amenity', None)

    if not amenity_filter:
        return JsonResponse({'error': 'Thiếu tham số amenity'}, status=400)

    # Danh sách các amenity hợp lệ (lấy từ tên file hoặc định nghĩa cố định)
    valid_amenities = ['hospital', 'PCCC', 'police']
    if amenity_filter.lower() not in [a.lower() for a in valid_amenities]:
         return JsonResponse({'error': f'Giá trị amenity "{amenity_filter}" không hợp lệ.'}, status=400)


    try:
        # Lọc các địa điểm từ database, không phân biệt hoa thường
        locations_qs = Location.objects.filter(amenity__iexact=amenity_filter).values(
            'name', 'address', 'amenity', 'latitude', 'longitude'
        ) # Chỉ lấy các trường cần thiết

        # Chuyển đổi QuerySet thành cấu trúc giống GeoJSON FeatureCollection
        features = []
        for loc in locations_qs:
             # !!! Quan trọng: Trả về tọa độ theo thứ tự JavaScript đang cần [lat, lon] !!!
            feature = {
                "type": "Feature",
                "properties": {
                    "name": loc['name'],
                    "address": loc['address'],
                    "amenity": loc['amenity'] # amenity đã được chuẩn hóa
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [loc['latitude'], loc['longitude']] # Trả về [lat, lon]
                }
            }
            features.append(feature)

        response_data = {
            "type": "FeatureCollection",
            "features": features
        }

        return JsonResponse(response_data)

    # Bắt lỗi cụ thể hơn nếu có thể
    # except ValidationError:
    #      return JsonResponse({'error': 'Giá trị amenity không hợp lệ'}, status=400)
    except Exception as e:
        # Trong môi trường production, nên ghi log lỗi chi tiết thay vì print
        print(f"Lỗi API get_locations_api: {e}")
        # Trả về lỗi chung chung cho client
        return JsonResponse({'error': 'Đã xảy ra lỗi khi truy vấn dữ liệu'}, status=500)
# ==============================