from django.contrib import admin

from .models import Bucket

class BucketAdmin(admin.ModelAdmin):
    list_display = ('name', 'key_id', 'region', 'service')

    def get_exclude(self, request, obj=None):
        # Hide 'secret_key' only in the change form
        if obj:  # This means it's a change form
            return ['secret_key']
        return super().get_exclude(request, obj)

admin.site.register(Bucket, BucketAdmin)

# Register your models here.
