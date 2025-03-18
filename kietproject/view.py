#from django.http import HttpResponse
from django.shortcuts import render

def homepage(request):
    #return HttpResponse("xin chao django")
    return render(request, 'home.html')
def aboutpage(request):
    #return HttpResponse("Day la trang gioi thieu")
    return render(request, 'about.html')