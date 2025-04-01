from django.urls import path
from . import views  # Import views từ app maps

app_name = 'maps'

urlpatterns = [
    path('', views.simplemap, name="home"),  # Thêm name để định danh URL
    path('co-ban/', views.simplemap, name="co-ban"),
    path('18/', views.simplemap2, name="18"),

]
