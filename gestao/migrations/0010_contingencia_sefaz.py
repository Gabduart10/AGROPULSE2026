from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestao', '0009_comissao_padrao_empresa'),
    ]

    operations = [
        migrations.AddField(
            model_name='notafiscal',
            name='status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('autorizada',           'Autorizada'),
                    ('contingencia',         'Em Contingência — pendente de transmissão'),
                    ('pendente_transmissao', 'Pendente de Transmissão'),
                    ('cancelada',            'Cancelada'),
                    ('denegada',             'Denegada'),
                ],
                max_length=25,
                null=True,
                verbose_name='Status de transmissão SEFAZ',
            ),
        ),
        migrations.AddField(
            model_name='notafiscal',
            name='modo_contingencia',
            field=models.CharField(
                blank=True,
                choices=[
                    ('FSDA',   'FS-DA — Formulário de Segurança para Impressão de DANFE'),
                    ('SCAN',   'SCAN — Sistema de Contingência do Ambiente Nacional'),
                    ('SVC_AN', 'SVC-AN — SEFAZ Virtual de Contingência Ambiente Nacional'),
                    ('SVC_RS', 'SVC-RS — SEFAZ Virtual de Contingência Rio Grande do Sul'),
                    ('EPEC',   'EPEC — Evento Prévio de Emissão em Contingência'),
                ],
                max_length=10,
                null=True,
                verbose_name='Modo de contingência',
            ),
        ),
    ]
