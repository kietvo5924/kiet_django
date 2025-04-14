# maps/admin.py (hoặc tên app của bạn/admin.py)

from django.contrib import admin
from .models import Location  # Import model Location từ file models.py cùng cấp

# Đăng ký model Location với trang admin
admin.site.register(Location)