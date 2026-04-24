from django.apps import AppConfig


class GestaoConfig(AppConfig):
    name = "gestao"

    def ready(self):
        import gestao.signals  # noqa: F401
