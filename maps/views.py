from django.shortcuts import render

# Create your views here.
def simplemap(request):
    return render(request, 'simple-map.html')