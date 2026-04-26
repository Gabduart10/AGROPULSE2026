from django.core.management.base import BaseCommand
from gestao.models import Empresa
from gestao.credito_cobranca import registrar_snapshot_inadimplencia


class Command(BaseCommand):
    help = 'Registra snapshot diário de inadimplência para todas as empresas.'

    def handle(self, *args, **options):
        empresas = Empresa.objects.all()
        total = 0
        for empresa in empresas:
            try:
                _, criado = registrar_snapshot_inadimplencia(empresa.id)
                acao = 'criado' if criado else 'atualizado'
                self.stdout.write(f'  {empresa.nome}: {acao}')
                total += 1
            except Exception as e:
                self.stderr.write(f'  {empresa.nome}: ERRO — {e}')
        self.stdout.write(self.style.SUCCESS(f'Snapshots registrados: {total}'))
