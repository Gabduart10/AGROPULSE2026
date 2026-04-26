from django.core.management.base import BaseCommand
from django.utils import timezone
from gestao.models import FichaAnaliseCredito, Notificacao


class Command(BaseCommand):
    help = 'Verifica fichas de crédito com revisão vencida e notifica o analista.'

    def handle(self, *args, **options):
        hoje = timezone.now().date()
        fichas = FichaAnaliseCredito.objects.filter(
            status='aprovado',
            proxima_revisao__lte=hoje,
        ).select_related('empresa', 'cliente', 'analista')

        total = 0
        for ficha in fichas:
            chave = f"revisao_credito_{ficha.id}"
            Notificacao.objects.get_or_create(
                empresa=ficha.empresa,
                chave_unica=chave,
                defaults={
                    'tipo':              'pedido_retido',
                    'prioridade':        'alta',
                    'titulo':            f"Revisão de limite — {ficha.cliente.nome_fantasia or ficha.cliente.nome_razao}",
                    'mensagem':          (
                        f"A ficha de crédito do cliente "
                        f"{ficha.cliente.nome_fantasia or ficha.cliente.nome_razao} "
                        f"está vencida para revisão desde {ficha.proxima_revisao.strftime('%d/%m/%Y')}. "
                        f"Acesse o módulo Cobrança e Crédito para revisar o limite."
                    ),
                    'modelo_referencia': 'FichaAnaliseCredito',
                    'id_referencia':     ficha.id,
                    'visivel_para_nivel': 'gerente,diretor',
                    'usuario':           ficha.analista,
                },
            )
            total += 1
            self.stdout.write(f'  Notificado: {ficha.cliente.nome_razao} (ficha #{ficha.id})')

        self.stdout.write(self.style.SUCCESS(f'Revisões pendentes notificadas: {total}'))
