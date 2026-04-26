from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestao', '0007_alertas_comerciais'),
    ]

    operations = [
        migrations.AddField(
            model_name='empresa',
            name='prazo_recompra_padrao',
            field=models.PositiveIntegerField(
                default=25,
                verbose_name='Prazo de recompra padrão (dias)',
                help_text='Clientes sem comprar há mais que este prazo são alertados. Pode ser sobrescrito por cliente.',
            ),
        ),
        migrations.AlterField(
            model_name='cliente',
            name='prazo_recompra',
            field=models.PositiveIntegerField(
                null=True,
                blank=True,
                verbose_name='Prazo de recompra individual (dias)',
                help_text='Se vazio, usa o padrão da empresa.',
            ),
        ),
    ]
