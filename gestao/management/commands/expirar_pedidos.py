"""
Management command para expirar pedidos vencidos.

Uso:
    python manage.py expirar_pedidos

Agendar no Railway (ou qualquer cron):
    0 3 * * * python manage.py expirar_pedidos   # roda todo dia às 3h

Este comando verifica todos os pedidos com status 'aguardando' cuja
data_expiracao já passou e os marca como 'expirado', devolvendo o
estoque automaticamente e notificando o vendedor.
"""

from django.core.management.base import BaseCommand
from gestao.aprovacoes import expirar_pedidos_vencidos


class Command(BaseCommand):
    help = 'Expira pedidos aguardando aprovação que ultrapassaram o prazo configurado pela empresa.'

    def handle(self, *args, **options):
        self.stdout.write('Verificando pedidos vencidos...')
        total = expirar_pedidos_vencidos()
        if total == 0:
            self.stdout.write(self.style.SUCCESS('Nenhum pedido expirado.'))
        else:
            self.stdout.write(
                self.style.WARNING(f'{total} pedido(s) expirado(s) e estoque devolvido.')
            )
