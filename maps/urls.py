from django.urls import path
from . import views  # Import views từ app maps

app_name = 'maps'

urlpatterns = [
    path('', views.simplemap, name="home"),  # maps/
    path('co-ban/', views.simplemap, name="co-ban"),  # maps/co-ban/
    path('emergency-road/', views.simplemap2, name="emergency-road"),  # maps/emergency-road/
]