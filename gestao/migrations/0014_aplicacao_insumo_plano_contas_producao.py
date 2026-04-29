from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('gestao', '0013_visita_cliente_e_crm'),
    ]

    operations = [
        # ── AplicacaoInsumo ──────────────────────────────────────
        migrations.CreateModel(
            name='AplicacaoInsumo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantidade', models.DecimalField(decimal_places=3, max_digits=12, verbose_name='Quantidade aplicada')),
                ('unidade_medida', models.CharField(blank=True, help_text='Unidade da aplicação (L/ha, kg/ha, etc.)', max_length=10)),
                ('data_aplicacao', models.DateField(verbose_name='Data da aplicação')),
                ('safra', models.CharField(blank=True, max_length=20, verbose_name='Safra')),
                ('cultura', models.CharField(blank=True, max_length=100, verbose_name='Cultura aplicada')),
                ('numero_receita_agronomica', models.CharField(blank=True, max_length=50, verbose_name='N° Receita Agronômica')),
                ('crea_responsavel', models.CharField(blank=True, max_length=30, verbose_name='CREA do Responsável Técnico')),
                ('observacoes', models.TextField(blank=True)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='aplicacoes_insumo', to='gestao.empresa')),
                ('lote', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='aplicacoes', to='gestao.loteestoque')),
                ('operador', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='aplicacoes_registradas', to='gestao.usuario', verbose_name='Operador responsável')),
                ('produto', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='aplicacoes_insumo', to='gestao.produto')),
                ('talhao', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='aplicacoes', to='gestao.talhao')),
            ],
            options={
                'verbose_name': 'Aplicação de Insumo',
                'verbose_name_plural': 'Aplicações de Insumos',
                'ordering': ['-data_aplicacao'],
            },
        ),

        # ── GrupoContabil ────────────────────────────────────────
        migrations.CreateModel(
            name='GrupoContabil',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=20, verbose_name='Código')),
                ('nome', models.CharField(max_length=150, verbose_name='Nome')),
                ('empresa', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='grupos_contabeis', to='gestao.empresa')),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subgrupos', to='gestao.grupocontabil', verbose_name='Grupo pai')),
            ],
            options={
                'verbose_name': 'Grupo Contábil',
                'verbose_name_plural': 'Grupos Contábeis',
                'ordering': ['codigo'],
            },
        ),

        # ── ContaContabil ────────────────────────────────────────
        migrations.CreateModel(
            name='ContaContabil',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=20, verbose_name='Código')),
                ('nome', models.CharField(max_length=200, verbose_name='Nome da conta')),
                ('tipo', models.CharField(choices=[('receita', 'Receita'), ('despesa', 'Despesa'), ('ativo', 'Ativo'), ('passivo', 'Passivo'), ('resultado', 'Resultado / Apuração')], max_length=20)),
                ('classe', models.CharField(choices=[('1', '1 - Ativo'), ('2', '2 - Passivo'), ('3', '3 - Patrimônio Líquido'), ('4', '4 - Receita'), ('5', '5 - Despesa'), ('6', '6 - Resultado')], max_length=2)),
                ('aceita_lancamento', models.BooleanField(default=True, verbose_name='Aceita lançamento direto')),
                ('ativo', models.BooleanField(default=True)),
                ('empresa', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='contas_contabeis', to='gestao.empresa')),
                ('grupo', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='contas', to='gestao.grupocontabil')),
            ],
            options={
                'verbose_name': 'Conta Contábil',
                'verbose_name_plural': 'Contas Contábeis',
                'ordering': ['codigo'],
            },
        ),
        migrations.AddConstraint(
            model_name='contacontabil',
            constraint=models.UniqueConstraint(fields=['empresa', 'codigo'], name='unique_conta_por_empresa'),
        ),

        # ── OrdemProducao ────────────────────────────────────────
        migrations.CreateModel(
            name='OrdemProducao',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.CharField(max_length=50, verbose_name='Número da OP')),
                ('quantidade_planejada', models.DecimalField(decimal_places=3, max_digits=12, verbose_name='Quantidade planejada')),
                ('quantidade_produzida', models.DecimalField(decimal_places=3, default=0, max_digits=12, verbose_name='Quantidade produzida')),
                ('status', models.CharField(choices=[('rascunho', 'Rascunho'), ('liberada', 'Liberada para Produção'), ('em_producao', 'Em Produção'), ('concluida', 'Concluída'), ('cancelada', 'Cancelada')], default='rascunho', max_length=20)),
                ('data_prevista', models.DateField(verbose_name='Data prevista de conclusão')),
                ('data_inicio', models.DateTimeField(blank=True, null=True, verbose_name='Início efetivo')),
                ('data_conclusao', models.DateTimeField(blank=True, null=True, verbose_name='Conclusão efetiva')),
                ('observacoes', models.TextField(blank=True)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('atualizado_em', models.DateTimeField(auto_now=True)),
                ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ordens_producao', to='gestao.empresa')),
                ('produto_final', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ordens_como_produto_final', to='gestao.produto', verbose_name='Produto a produzir')),
                ('responsavel', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ordens_producao_responsavel', to='gestao.usuario')),
                ('centro_custo', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ordens_producao', to='gestao.centrocusto')),
            ],
            options={
                'verbose_name': 'Ordem de Produção',
                'verbose_name_plural': 'Ordens de Produção',
                'ordering': ['-criado_em'],
            },
        ),
        migrations.AddConstraint(
            model_name='ordemproducao',
            constraint=models.UniqueConstraint(fields=['empresa', 'numero'], name='unique_op_por_empresa'),
        ),

        # ── ItemOrdemProducao ────────────────────────────────────
        migrations.CreateModel(
            name='ItemOrdemProducao',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantidade_planejada', models.DecimalField(decimal_places=3, max_digits=12)),
                ('quantidade_consumida', models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ('ordem', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='insumos', to='gestao.ordemproducao')),
                ('produto', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='usado_em_ordens', to='gestao.produto')),
                ('lote', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='consumido_em_ordens', to='gestao.loteestoque', verbose_name='Lote a consumir')),
            ],
            options={
                'verbose_name': 'Item da Ordem de Produção',
                'verbose_name_plural': 'Itens da Ordem de Produção',
            },
        ),

        # ── BeneficiamentoLote ───────────────────────────────────
        migrations.CreateModel(
            name='BeneficiamentoLote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantidade_entrada', models.DecimalField(decimal_places=3, max_digits=12, verbose_name='Quantidade de entrada')),
                ('quantidade_saida', models.DecimalField(decimal_places=3, default=0, max_digits=12, verbose_name='Quantidade de saída')),
                ('rendimento_percentual', models.DecimalField(decimal_places=2, default=0, max_digits=5, verbose_name='Rendimento (%)')),
                ('status', models.CharField(choices=[('pendente', 'Pendente'), ('em_andamento', 'Em Andamento'), ('concluido', 'Concluído'), ('cancelado', 'Cancelado')], default='pendente', max_length=20)),
                ('data_inicio', models.DateField(verbose_name='Data de início')),
                ('data_conclusao', models.DateField(blank=True, null=True, verbose_name='Data de conclusão')),
                ('observacoes', models.TextField(blank=True)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='beneficiamentos', to='gestao.empresa')),
                ('lote_entrada', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='beneficiamentos_como_entrada', to='gestao.loteestoque', verbose_name='Lote de entrada')),
                ('lote_saida_gerado', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='gerado_por_beneficiamento', to='gestao.loteestoque', verbose_name='Lote gerado')),
                ('operador', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='beneficiamentos_operados', to='gestao.usuario')),
                ('produto_entrada', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='beneficiamentos_entrada', to='gestao.produto', verbose_name='Produto bruto (entrada)')),
                ('produto_saida', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='beneficiamentos_saida', to='gestao.produto', verbose_name='Produto beneficiado (saída)')),
            ],
            options={
                'verbose_name': 'Beneficiamento de Lote',
                'verbose_name_plural': 'Beneficiamentos de Lotes',
                'ordering': ['-criado_em'],
            },
        ),
    ]
