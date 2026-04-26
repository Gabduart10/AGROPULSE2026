from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestao', '0008_prazo_recompra_empresa'),
    ]

    operations = [
        migrations.AddField(
            model_name='empresa',
            name='comissao_padrao',
            field=models.DecimalField(
                max_digits=5,
                decimal_places=2,
                default=0.00,
                verbose_name='Comissão padrão (%)',
                help_text='Percentual padrão usado para produtos sem comissão específica.',
            ),
        ),
    ]
