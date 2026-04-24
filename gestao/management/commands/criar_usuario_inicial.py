from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Cria empresa e usuário diretor iniciais se o banco estiver vazio.'

    def handle(self, *args, **kwargs):
        from gestao.models import Empresa, Usuario

        if Usuario.objects.exists():
            self.stdout.write(self.style.WARNING(
                'Usuários já existem — nenhuma ação necessária.'
            ))
            return

        with transaction.atomic():
            empresa, criada = Empresa.objects.get_or_create(
                cnpj='12.345.678/0001-90',
                defaults={
                    'nome': 'AgroPulse Demo',
                    'tipo_negocio': 'revenda',
                }
            )

            usuario = Usuario.objects.create_user(
                username='admin',
                password='admin123',
                first_name='Administrador',
                email='admin@agropulse.com',
                nivel='diretor',
                empresa=empresa,
            )

        self.stdout.write(self.style.SUCCESS(
            f'Usuário criado com sucesso!\n'
            f'  Login : admin\n'
            f'  Senha : admin123\n'
            f'  Nível : diretor\n'
            f'  Empresa: {empresa.nome}'
        ))
