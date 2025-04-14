# maps/views.py
from django.shortcuts import render
from django.http import JsonResponse
from .models import Location

def simplemap(request):
    return render(request, 'simple-map.html')

def simplemap2(request):
    return render(request, 'emergency-road.html')

def get_locations_api(request):
    """
    API endpoint để lấy danh sách địa điểm theo amenity.
    """
    amenity_filter = request.GET.get('amenity', None)

    if not amenity_filter:
        return JsonResponse({'error': 'Thiếu tham số amenity'}, status=400)

    valid_amenities = ['hospital', 'PCCC', 'police']
    if amenity_filter.lower() not in [a.lower() for a in valid_amenities]:
        return JsonResponse({'error': f'Giá trị amenity "{amenity_filter}" không hợp lệ.'}, status=400)

    try:
        # Lấy thêm các trường mới từ database
        locations_qs = Location.objects.filter(amenity__iexact=amenity_filter).values(
            'name', 'address', 'amenity', 'latitude', 'longitude',
            'phone', 'description', 'website', 'image_url' # <--- Thêm các trường mới
        )

        features = []
        for loc in locations_qs:
            feature = {
                "type": "Feature",
                "properties": {
                    "name": loc['name'],
                    "address": loc['address'],
                    "amenity": loc['amenity'],
                    # --- Thêm các thuộc tính mới vào response ---
                    "phone": loc['phone'],
                    "description": loc['description'],
                    "website": loc['website'],
                    "image_url": loc['image_url']
                    # -----------------------------------------
                },
                "geometry": {
                    "type": "Point",
                    # Đảm bảo thứ tự [lat, lon] nếu frontend cần vậy
                    "coordinates": [loc['latitude'], loc['longitude']]
                }
            }
            features.append(feature)

        response_data = {
            "type": "FeatureCollection",
            "features": features
        }
        return JsonResponse(response_data)

    except Exception as e:
        print(f"Lỗi API get_locations_api: {e}")
        return JsonResponse({'error': 'Đã xảy ra lỗi khi truy vấn dữ liệu'}, status=500)