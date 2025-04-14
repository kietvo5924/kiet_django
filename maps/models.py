# map_app/models.py (hoặc maps/models.py)
from django.db import models

class Location(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    amenity = models.CharField(max_length=50, db_index=True)
    latitude = models.FloatField()
    longitude = models.FloatField()

    # --- Các trường mới được thêm vào ---
    phone = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    website = models.URLField(max_length=500, blank=True, null=True) # Tăng max_length nếu cần
    image_url = models.URLField(max_length=1000, blank=True, null=True) # Tăng max_length nếu cần
    # -----------------------------------

    def __str__(self):
        return f"{self.name} ({self.amenity})"

    class Meta:
        verbose_name = "Địa điểm"
        verbose_name_plural = "Các Địa điểm"