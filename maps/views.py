from django.shortcuts import render

# Create your views here.
def simplemap(request):
    return render(request, 'simple-map.html')
def simplemap2(request):
    return render(request, 'emergency-road.html')