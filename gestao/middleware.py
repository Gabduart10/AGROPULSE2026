from django.conf import settings
from django.contrib import auth
from django.apps import apps

class AutomaticLoginMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/admin/') and not request.user.is_authenticated:
            try:
                User = apps.get_model(settings.AUTH_USER_MODEL)
                user = User.objects.filter(is_superuser=True).first()
                if user:
                    user.backend = 'django.contrib.auth.backends.ModelBackend'
                    auth.login(request, user)
            except Exception:
                pass
        return self.get_response(request)