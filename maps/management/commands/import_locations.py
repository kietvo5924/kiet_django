# map_app/management/commands/import_locations.py (hoặc maps/...)
import json
import os
from django.core.management.base import BaseCommand
from django.conf import settings
# Thay 'maps' bằng tên app thực tế của bạn nếu khác
from maps.models import Location

class Command(BaseCommand):
    help = 'Imports location data from GeoJSON files in static/data into the database'

    # Điều chỉnh đường dẫn này nếu cần
    JSON_DATA_DIR = os.path.join(settings.BASE_DIR, 'static', 'data')

    FILE_MAPPING = {
        'hospital.json': 'hospital',
        'PCCC.json': 'PCCC',
        'police.json': 'police',
    }

    def handle(self, *args, **options):
        self.stdout.write(f"Bắt đầu nhập dữ liệu từ thư mục: {self.JSON_DATA_DIR}")

        # Cân nhắc xóa dữ liệu cũ nếu muốn nhập lại hoàn toàn
        # Location.objects.all().delete()
        # self.stdout.write(self.style.WARNING('Đã xóa dữ liệu địa điểm cũ.'))

        total_created = 0
        total_updated = 0
        total_skipped = 0

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

            file_created = 0
            file_updated = 0
            file_skipped = 0

            for feature in features:
                properties = feature.get('properties', {})
                geometry = feature.get('geometry', {})
                coordinates = geometry.get('coordinates', [])

                if geometry.get('type') == 'Point' and len(coordinates) == 2:
                    try:
                        # Lưu ý thứ tự tọa độ trong file JSON của bạn
                        # Thông thường GeoJSON là [longitude, latitude]
                        # Nhưng code gốc của bạn đang đọc là [latitude, longitude]
                        # Hãy kiểm tra lại và điều chỉnh nếu cần
                        latitude = float(coordinates[0]) # Hoặc coordinates[1]
                        longitude = float(coordinates[1]) # Hoặc coordinates[0]

                        name = properties.get('name', 'Không có tên').strip()
                        address = properties.get('address', '').strip()

                        # --- Lấy dữ liệu cho các trường mới ---
                        phone = properties.get('phone', '').strip() or None # Đặt là None nếu rỗng
                        description = properties.get('description', '').strip() or None
                        website = properties.get('website', '').strip() or None
                        image_url = properties.get('image_url', '').strip() or None
                        # --------------------------------------

                        # Tạo hoặc cập nhật bản ghi
                        obj, created = Location.objects.update_or_create(
                            # Sử dụng (name, amenity) làm khóa chính logic
                            # Đảm bảo sự kết hợp này là duy nhất cho mỗi địa điểm
                            name=name,
                            amenity=amenity_type,
                            defaults={
                                'address': address,
                                'latitude': latitude,
                                'longitude': longitude,
                                # --- Thêm giá trị các trường mới vào defaults ---
                                'phone': phone,
                                'description': description,
                                'website': website,
                                'image_url': image_url,
                                # ---------------------------------------------
                            }
                        )

                        if created:
                            file_created += 1
                        else:
                            file_updated += 1

                    except (ValueError, TypeError) as e:
                        self.stderr.write(self.style.ERROR(f"Lỗi dữ liệu tọa độ/thuộc tính cho '{properties.get('name')}': {e}"))
                        file_skipped += 1
                    except Exception as e:
                        self.stderr.write(self.style.ERROR(f"Lỗi khi lưu feature '{properties.get('name')}': {e}"))
                        file_skipped += 1
                else:
                    self.stdout.write(self.style.WARNING(f"Bỏ qua feature không phải Point hoặc thiếu tọa độ: '{properties.get('name')}'"))
                    file_skipped += 1

            self.stdout.write(f"-> File {filename}: Tạo mới {file_created}, Cập nhật {file_updated}, Bỏ qua {file_skipped}")
            total_created += file_created
            total_updated += file_updated
            total_skipped += total_skipped

        self.stdout.write(self.style.SUCCESS(f"Hoàn tất!"))
        self.stdout.write(f"Tổng cộng: Tạo mới {total_created}, Cập nhật {total_updated}, Bỏ qua {total_skipped} địa điểm.")
        self.stdout.write(f"Tổng số địa điểm trong database: {Location.objects.count()}")