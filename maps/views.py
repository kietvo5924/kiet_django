# maps/views.py
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from .models import Location

# View cho các trang HTML
def simplemap(request):
    # Có thể bạn muốn render cùng template 'emergency-road.html' ở đây?
    # Hoặc là một template khác tùy ý.
    return render(request, 'simple-map.html') # Hoặc 'emergency-road.html'

def simplemap2(request):
    # View render trang bản đồ chính với ô tìm kiếm và định tuyến
    return render(request, 'emergency-road.html')

# API lấy dữ liệu ban đầu cho marker (GeoJSON)
@require_GET
def get_locations_api(request):
    """
    API endpoint để lấy danh sách địa điểm theo amenity (dạng GeoJSON).
    """
    amenity_filter = request.GET.get('amenity', None)

    if not amenity_filter:
        return JsonResponse({'error': 'Thiếu tham số amenity'}, status=400)

    valid_amenities = ['hospital', 'PCCC', 'police']
    if amenity_filter.lower() not in [a.lower() for a in valid_amenities]:
        return JsonResponse({'error': f'Giá trị amenity "{amenity_filter}" không hợp lệ.'}, status=400)

    try:
        locations_qs = Location.objects.filter(amenity__iexact=amenity_filter).values(
            'name', 'address', 'amenity', 'latitude', 'longitude',
            'phone', 'description', 'website', 'image_url'
        )

        features = []
        for loc in locations_qs:
            feature = {
                "type": "Feature",
                "properties": {
                    "name": loc['name'],
                    "address": loc['address'],
                    "amenity": loc['amenity'],
                    "phone": loc['phone'],
                    "description": loc['description'],
                    "website": loc['website'],
                    "image_url": loc['image_url']
                },
                "geometry": {
                    "type": "Point",
                    # GeoJSON thường dùng [longitude, latitude]
                    # Nhưng view cũ của bạn dùng [latitude, longitude], giữ nguyên để tránh lỗi JS cũ
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

# API mới cho tìm kiếm autocomplete (JSON list)
@require_GET
def search_locations_api(request):
    """
    API endpoint mới cho chức năng tìm kiếm autocomplete theo tên (dạng JSON list).
    """
    query = request.GET.get('query', '')

    if not query:
        return JsonResponse([], safe=False)

    try:
        locations = Location.objects.filter(name__icontains=query)
        results = locations.values(
            'id', 'name', 'address', 'amenity', 'latitude', 'longitude',
            'description', 'image_url', 'phone', 'website'
        )
        results_list = list(results)
        return JsonResponse(results_list, safe=False)

    except Exception as e:
        print(f"Lỗi API search_locations_api: {e}")
        return JsonResponse({"error": "Có lỗi xảy ra phía máy chủ"}, status=500)