from django.urls import path

from . import views

app_name = 'browser'

urlpatterns = [
    path('', views.index, name='index'),
    path('expanddir/', views.expandDir, name='expanddir'),
    path('listdir/', views.listDir, name='listdir'),
    path('download/', views.download, name='download'),
    path('startupload/', views.start_upload, name='start_upload'),
    path('finishupload/', views.finish_upload, name='finish_upload'),
    path('delete/', views.delete, name='delete'),
]
