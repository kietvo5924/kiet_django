# maps/urls.py
from django.urls import path
from . import views  # Import views từ app maps

app_name = 'maps'

urlpatterns = [
    path('', views.simplemap, name="home"),  # maps/
    path('co-ban/', views.simplemap, name="co-ban"),  # maps/co-ban/
    path('emergency-road/', views.simplemap2, name="emergency-road"),  # maps/emergency-road/

    # === Thêm dòng này vào ===
    # Định nghĩa URL cho API endpoint lấy dữ liệu địa điểm
    # Khi truy cập /maps/api/locations/?amenity=... (giả sử URL gốc của app là /maps/)
    # nó sẽ gọi hàm views.get_locations_api
    path('api/locations/', views.get_locations_api, name='api_get_locations'),
    # ========================
]