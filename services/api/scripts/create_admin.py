
import os
import django
from django.contrib.auth import get_user_model

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'accesosen_api.settings')
django.setup()

User = get_user_model()

username = os.getenv('DEFAULT_SUPERADMIN_USERNAME', 'admin')
email = os.getenv('DEFAULT_SUPERADMIN_EMAIL', 'admin@sadi.local')
password = os.getenv('DEFAULT_SUPERADMIN_PASSWORD', 'admin123')

if not User.objects.filter(username=username).exists():
    print(f"Creating superuser {username}...")
    User.objects.create_superuser(username=username, email=email, password=password)
    print("Superuser created successfully.")
else:
    print(f"Superuser {username} already exists.")
