# maps/urls.py
from django.urls import path
from . import views  # Import views từ app maps

app_name = 'maps'

urlpatterns = [
    # URL cho các trang HTML (giữ nguyên)
    path('', views.simplemap, name="home"), # Trang chủ (có thể trùng với emergency-road)
    path('co-ban/', views.simplemap, name="co-ban"), # Trang bản đồ cơ bản
    path('emergency-road/', views.simplemap2, name="emergency-road"), # Trang bản đồ tìm đường

    # URL cho API lấy locations ban đầu (GeoJSON)
    path('api/locations/', views.get_locations_api, name='api_get_locations'),

    # URL cho API tìm kiếm autocomplete (JSON list)
    path('api/search-locations/', views.search_locations_api, name='api_search_locations'),
]