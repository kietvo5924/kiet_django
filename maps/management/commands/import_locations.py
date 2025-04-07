# map_app/management/commands/import_locations.py
import json
import os
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
# Thay 'map_app' bằng tên app của bạn nếu khác
from maps.models import Location

class Command(BaseCommand):
    help = 'Imports location data from GeoJSON files in static/data into the database'

    # Đường dẫn tương đối tới thư mục chứa file JSON
    # Điều chỉnh nếu cấu trúc dự án của bạn khác
    # Nó sẽ tìm trong thư mục static đầu tiên tìm được theo cấu hình STATICFILES_DIRS
    JSON_DATA_DIR = os.path.join(settings.BASE_DIR, 'static', 'data')
    # Hoặc chỉ định đường dẫn tuyệt đối nếu cần:
    # JSON_DATA_DIR = r'C:\Webpython\kiet_django\static\data'


    FILE_MAPPING = {
        'hospital.json': 'hospital',
        'PCCC.json': 'PCCC',
        'police.json': 'police',
    }

    def handle(self, *args, **options):
        self.stdout.write(f"Bắt đầu nhập dữ liệu từ thư mục: {self.JSON_DATA_DIR}")

        # Xóa dữ liệu cũ trước khi nhập (tùy chọn)
        # Location.objects.all().delete()
        # self.stdout.write(self.style.WARNING('Đã xóa dữ liệu địa điểm cũ.'))

        imported_count = 0
        skipped_count = 0

        for filename, amenity_type in self.FILE_MAPPING.items():
            filepath = os.path.join(self.JSON_DATA_DIR, filename)
            self.stdout.write(f"Đang xử lý file: {filepath}")

            if not os.path.exists(filepath):
                self.stderr.write(self.style.ERROR(f"Lỗi: Không tìm thấy file {filepath}"))
                continue

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Lỗi đọc hoặc parse JSON từ {filepath}: {e}"))
                continue

            features = data.get('features', [])
            if not features:
                self.stdout.write(self.style.WARNING(f"File {filename} không có features nào."))
                continue

            for feature in features:
                properties = feature.get('properties', {})
                geometry = feature.get('geometry', {})
                coordinates = geometry.get('coordinates', [])

                if geometry.get('type') == 'Point' and len(coordinates) == 2:
                    try:
                        # !!! KIỂM TRA LẠI THỨ TỰ NÀY !!!
                        latitude = float(coordinates[0])
                        longitude = float(coordinates[1])
                        # ---------------------------------

                        name = properties.get('name', 'Không có tên').strip()
                        address = properties.get('address', '').strip()

                        # Tạo hoặc cập nhật bản ghi (tránh trùng lặp nếu chạy lại script)
                        # Ở đây dùng name và amenity làm khóa định danh, có thể cần điều chỉnh
                        obj, created = Location.objects.update_or_create(
                            name=name,
                            amenity=amenity_type, # Sử dụng amenity_type chuẩn hóa từ FILE_MAPPING
                            defaults={
                                'address': address,
                                'latitude': latitude,
                                'longitude': longitude,
                            }
                        )

                        if created:
                            imported_count += 1
                        # else:
                            # self.stdout.write(f"Đã cập nhật: {name} ({amenity_type})")

                    except (ValueError, TypeError) as e:
                        self.stderr.write(self.style.ERROR(f"Lỗi dữ liệu tọa độ hoặc thuộc tính cho '{properties.get('name')}': {e}"))
                        skipped_count += 1
                    except Exception as e:
                        self.stderr.write(self.style.ERROR(f"Lỗi khi lưu feature '{properties.get('name')}': {e}"))
                        skipped_count += 1
                else:
                    self.stdout.write(self.style.WARNING(f"Bỏ qua feature không phải Point hoặc thiếu tọa độ: '{properties.get('name')}'"))
                    skipped_count += 1

        self.stdout.write(self.style.SUCCESS(f"Hoàn tất!"))
        self.stdout.write(f"Đã nhập/cập nhật: {imported_count + Location.objects.count() - skipped_count} địa điểm.") # Ước tính
        self.stdout.write(f"Bỏ qua: {skipped_count} địa điểm.")