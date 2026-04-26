from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('gestao', '0006_contratos_agricolas'),
    ]

    operations = [
        # Novos campos em Cliente
        migrations.AddField(
            model_name='cliente',
            name='data_fundacao',
            field=models.DateField(blank=True, null=True, verbose_name='Data de Fundação (PJ)'),
        ),
        migrations.AddField(
            model_name='cliente',
            name='prazo_recompra',
            field=models.PositiveIntegerField(default=25, verbose_name='Prazo de recompra (dias)'),
        ),

        # Novos tipos em Notificacao.tipo (CharField — apenas documenta, sem constraint de DB)
        # Nenhuma alteração de schema necessária para CharField com choices.

        # Novo model DataComemorativa
        migrations.CreateModel(
            name='DataComemorativa',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=100)),
                ('dia', models.PositiveSmallIntegerField()),
                ('mes', models.PositiveSmallIntegerField()),
                ('dias_antecedencia', models.PositiveIntegerField(default=3)),
                ('para_todos_vendedores', models.BooleanField(default=True)),
                ('ativo', models.BooleanField(default=True)),
                ('empresa', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='datas_comemorativas',
                    to='gestao.empresa',
                )),
                ('criado_por', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='datas_criadas',
                    to='gestao.usuario',
                )),
                ('vendedores', models.ManyToManyField(
                    blank=True,
                    related_name='datas_comemorativas',
                    to='gestao.usuario',
                )),
            ],
            options={
                'verbose_name': 'Data Comemorativa',
                'verbose_name_plural': 'Datas Comemorativas',
                'unique_together': {('empresa', 'dia', 'mes', 'nome')},
            },
        ),
    ]
