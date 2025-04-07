# map_app/models.py
from django.db import models

class Location(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    # Lưu trữ loại địa điểm chuẩn hóa
    amenity = models.CharField(max_length=50, db_index=True) # db_index=True để tăng tốc độ lọc theo amenity
    latitude = models.FloatField() # Hoặc DecimalField(max_digits=10, decimal_places=7) nếu cần độ chính xác cao hơn
    longitude = models.FloatField() # Hoặc DecimalField(max_digits=10, decimal_places=7)

    def __str__(self):
        return f"{self.name} ({self.amenity})"

    class Meta:
        verbose_name = "Địa điểm"
        verbose_name_plural = "Các Địa điểm"