from django.db import models
import base64
import hashlib
from cryptography.fernet import Fernet

from main.settings import SECRET_KEY

from .s3 import S3


fernet_key = base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode()).digest())
fernet = Fernet(fernet_key)
def encrypt_secret_key(secret_key):
    """Encrypt the secret key using Fernet symmetric encryption."""
    return fernet.encrypt(secret_key.encode()).decode()


# Create your models here.

class Bucket(models.Model):
    name = models.CharField(max_length=255, unique=True)
    key_id = models.CharField(max_length=255)
    secret_key = models.CharField(max_length=255)

    REGION_CHOICES = (
        ('eu-central-003', 'EU (backblazeB2)'),
        ('us-east-005', 'US East (backblazeB2)'),
        ('us-west-1', 'US West (N. California)'),
        ('eu-west-1', 'EU (Ireland)'),
        ('eu-central-1', 'EU (Frankfurt)'),
        ('eu-west-2', 'EU (London)'),
    )

    region = models.CharField(max_length=255, choices=REGION_CHOICES, default='eu-central-003')


    SERBVICES = (
        ('aws', 'AWS'),
        ('backblaze', 'BackblazeB2'),
    )
    service = models.CharField(max_length=255, choices=SERBVICES, default='backblaze')


    def save(self, *args, **kwargs):
        # Encrypt the secret key before saving
        if self.secret_key:
            self.secret_key = encrypt_secret_key(self.secret_key)
            super().save(*args, **kwargs)

    def delete(self, using = None, keep_parents = False):
        # Delete the S3 handle associated with this bucket
        S3.delete_handle(self.name)
        return super().delete(using=using, keep_parents=keep_parents)
    

    def get_decrypted_secret_key(self):
        """Decrypt the secret key using Fernet symmetric encryption."""
        return fernet.decrypt(self.secret_key.encode()).decode()
    

   

    def __str__(self):
        return self.name
    

