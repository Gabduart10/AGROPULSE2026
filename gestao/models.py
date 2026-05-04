import xml.etree.ElementTree as ET
from decimal import Decimal
from django.db import transaction, models
from django.db.models import F
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.contrib.auth.models import AbstractUser
from datetime import timedelta
from django.core.validators import MinLengthValidator


class Empresa(models.Model):
    TIPO_CHOICES = [
        ('revenda', 'Revenda'),
        ('industria', 'Indústria'),
    ]
    PLANO_CHOICES = [
        ('starter',    'Starter'),
        ('pro',        'Pro'),
        ('enterprise', 'Enterprise'),
    ]
    MODULOS_PADRAO = {
        'vendas': True, 'estoque': True, 'compras': True,
        'financeiro': True, 'fiscal': True, 'cobranca': True,
        'crm': True, 'rh': True, 'bi': True, 'logistica': True,
        'producao': False, 'safras': True, 'contratos': True,
        'manutencao': True,
    }

    nome = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=18, unique=True)
    tipo_negocio = models.CharField(max_length=20, choices=TIPO_CHOICES, default='revenda')
    plano = models.CharField(max_length=20, choices=PLANO_CHOICES, default='starter', verbose_name='Plano')
    max_usuarios = models.PositiveIntegerField(default=10, verbose_name='Máximo de usuários')
    modulos_habilitados = models.JSONField(default=dict, blank=True, verbose_name='Módulos habilitados')

    # Hierarquia matriz/filial
    # Quando preenchido, esta empresa é filial da empresa apontada.
    # empresa_matriz = None significa que esta empresa é independente ou é a própria matriz.
    empresa_matriz = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='filiais',
        verbose_name='Empresa Matriz',
        help_text='Preencher somente se esta empresa for filial de outra cadastrada no sistema.',
    )

    # Prazo máximo (em dias corridos) para um pedido ficar aguardando aprovação.
    # Após esse prazo, o pedido expira automaticamente e o estoque é devolvido.
    # Configurável pelo Diretor em Configurações da Empresa.
    prazo_expiracao_pedido = models.PositiveIntegerField(
        default=2,
        verbose_name='Prazo de expiração de pedidos (dias)',
        help_text='Pedidos aguardando aprovação expiram automaticamente após este prazo.',
    )
    prazo_recompra_padrao = models.PositiveIntegerField(
        default=25,
        verbose_name='Prazo de recompra padrão (dias)',
        help_text='Clientes sem comprar há mais que este prazo são alertados. Pode ser sobrescrito por cliente.',
    )
    comissao_padrao = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        verbose_name='Comissão padrão (%)',
        help_text='Percentual padrão usado para produtos sem comissão específica.',
    )
    fluxo_compra_completo = models.BooleanField(
        default=False,
        verbose_name='Fluxo de compra completo',
        help_text='Habilita solicitação → cotação → aprovação → OC. Desativado = só recebimento de NF-e.',
    )

    @property
    def is_matriz(self):
        """Retorna True se esta empresa tiver filiais cadastradas."""
        return self.filiais.exists()

    @property
    def is_filial(self):
        """Retorna True se esta empresa for filial de outra."""
        return self.empresa_matriz_id is not None

    def __str__(self):
        return self.nome

    class Meta:
        verbose_name = 'Empresa'
        verbose_name_plural = 'Empresas'


class Usuario(AbstractUser):
    NIVEIS_CHOICES = [
        ('diretor', 'Nível 1 - Diretor'),
        ('gerente', 'Nível 2 - Gerente'),
        ('vendedor', 'Nível 3 - Vendedor'),
        ('administrativo', 'Nível 4 - Administrativo / Financeiro'),
        ('operacional', 'Nível 5 - Operacional / Balcão'),
        ('rh', 'Nível 6 - RH'),
    ]

    empresa = models.ForeignKey(Empresa, on_delete=models.SET_NULL, null=True, blank=True)
    nivel = models.CharField(max_length=20, choices=NIVEIS_CHOICES, default='vendedor')
    meta_mensal = models.DecimalField(
        max_digits=15, decimal_places=2, default=0.00,
        verbose_name='Meta Mensal (R$)',
        help_text='Meta de faturamento mensal do vendedor'
    )
    ve_apenas_seus_clientes = models.BooleanField(
        default=True,
        verbose_name='Vê apenas seus clientes',
        help_text='Se marcado, o vendedor só enxerga os clientes dos seus próprios pedidos'
    )
    totp_secret = models.CharField(max_length=64, blank=True, null=True, verbose_name='Segredo TOTP (2FA)')
    totp_habilitado = models.BooleanField(default=False, verbose_name='2FA habilitado')

    class Meta:
        verbose_name = 'Usuário'
        verbose_name_plural = 'Usuários'


class NotaFiscal(models.Model):
    TIPO_CHOICES = [
        ('entrada', 'Entrada (Compra/Estoque)'),
        ('saida', 'Saída (Venda/Faturamento)')
    ]
    STATUS_NF_CHOICES = [
        ('autorizada',           'Autorizada'),
        ('contingencia',         'Em Contingência — pendente de transmissão'),
        ('pendente_transmissao', 'Pendente de Transmissão'),
        ('cancelada',            'Cancelada'),
        ('denegada',             'Denegada'),
    ]
    MODO_CONTINGENCIA_CHOICES = [
        ('FSDA',   'FS-DA — Formulário de Segurança para Impressão de DANFE'),
        ('SCAN',   'SCAN — Sistema de Contingência do Ambiente Nacional'),
        ('SVC_AN', 'SVC-AN — SEFAZ Virtual de Contingência Ambiente Nacional'),
        ('SVC_RS', 'SVC-RS — SEFAZ Virtual de Contingência Rio Grande do Sul'),
        ('EPEC',   'EPEC — Evento Prévio de Emissão em Contingência'),
    ]

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='notas')
    fornecedor = models.ForeignKey('Fornecedor', on_delete=models.SET_NULL, null=True, blank=True)
    tipo_nota = models.CharField(max_length=10, choices=TIPO_CHOICES, default='saida')
    numero_nota = models.CharField(max_length=50, blank=True)
    data_emissao = models.DateTimeField(null=True, blank=True)
    valor_total = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    arquivo_xml = models.FileField(upload_to='xmls/%Y/%m/%d/', null=True, blank=True)
    chave_acesso = models.CharField(max_length=44, unique=True, null=True, blank=True)
    status = models.CharField(
        max_length=25, choices=STATUS_NF_CHOICES,
        null=True, blank=True, verbose_name='Status de transmissão SEFAZ'
    )
    modo_contingencia = models.CharField(
        max_length=10, choices=MODO_CONTINGENCIA_CHOICES,
        null=True, blank=True, verbose_name='Modo de contingência'
    )

    def __str__(self):
        tipo = "Entrada" if self.tipo_nota == 'entrada' else "Saída"
        return f"[{tipo}] Nota {self.numero_nota or 'S/N'} - {self.empresa.nome}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if self.arquivo_xml and not self.numero_nota:
            try:
                tree = ET.parse(self.arquivo_xml)
                root = tree.getroot()
                ns = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}
                self.numero_nota = root.find('.//nfe:ide/nfe:nNF', ns).text
                self.valor_total = root.find('.//nfe:total/nfe:ICMSTot/nfe:vNF', ns).text
                data = root.find('.//nfe:ide/nfe:dhEmi', ns).text
                self.data_emissao = parse_datetime(data)
                self.chave_acesso = root.find('.//nfe:infNFe', ns).attrib['Id'][3:]
            except Exception as e:
                print(f"Erro ao ler capa do XML: {e}")
        super().save(*args, **kwargs)
        if self.arquivo_xml and self.tipo_nota == 'entrada' and is_new:
            from gestao.processador_xml import processar_nfe_entrada
            processar_nfe_entrada(self)

    class Meta:
        verbose_name = 'Nota Fiscal'
        verbose_name_plural = 'Notas Fiscais'


class Produto(models.Model):
    TIPO_PRODUTO_CHOICES = [
        ('insumo_agricola', 'Insumo Agrícola'),
        ('defensivo',       'Defensivo Agrícola'),
        ('semente',         'Semente'),
        ('fertilizante',    'Fertilizante'),
        ('produto_acabado', 'Produto Acabado'),
        ('colheita',        'Colheita'),
        ('outros',          'Outros'),
    ]
    METODO_CUSTEIO_CHOICES = [
        ('cmp',  'Custo Médio Ponderado'),
        ('fifo', 'FIFO (Primeiro a Entrar, Primeiro a Sair)'),
    ]
    UNIDADE_CHOICES = [
        ('UN',  'Unidade'),
        ('KG',  'Quilo'),
        ('LT',  'Litro'),
        ('MT',  'Metro'),
        ('PC',  'Peça'),
        ('CX',  'Caixa'),
        ('SC',  'Saca'),
        ('TON', 'Tonelada'),
        ('L',   'Litro (L)'),
        ('ML',  'Mililitro'),
        ('G',   'Grama'),
    ]
    ORIGEM_CHOICES = [
        ('0', '0 - Nacional'),
        ('1', '1 - Estrangeira (Importação Direta)'),
        ('2', '2 - Estrangeira (Adquirida no Mercado Interno)'),
    ]

    empresa            = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='produtos')
    nome               = models.CharField(max_length=255)
    sku                = models.CharField(max_length=100, help_text='Código interno do produto')
    ean                = models.CharField(max_length=14, blank=True, null=True, verbose_name='EAN / Código de Barras')
    tipo_produto       = models.CharField(max_length=20, choices=TIPO_PRODUTO_CHOICES, default='outros', verbose_name='Tipo de Produto')
    metodo_custeio     = models.CharField(max_length=4, choices=METODO_CUSTEIO_CHOICES, default='cmp', verbose_name='Método de Custeio')
    unidade_medida     = models.CharField(max_length=3, choices=UNIDADE_CHOICES, default='UN', verbose_name='Unidade')
    preco_venda        = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='Preço de Venda')
    quantidade         = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='Quantidade')
    fator_divisao_nfe  = models.DecimalField(max_digits=10, decimal_places=2, default=1.00, verbose_name='Fator de Divisão NFe')
    custo_medio_ponderado = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    margem_minima      = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name='Margem Mínima (%)')
    comissao_percentual = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name='Comissão (%)')
    estoque_minimo     = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='Estoque Mínimo')
    origem             = models.CharField(max_length=1, choices=ORIGEM_CHOICES, default='0')
    ncm                = models.CharField(max_length=10, blank=True, null=True, verbose_name='NCM')
    cest               = models.CharField(max_length=10, blank=True, null=True, verbose_name='CEST')
    cfop_padrao_interno = models.CharField(max_length=5, blank=True, null=True, verbose_name='CFOP Padrão Interno')
    cfop_padrao_externo = models.CharField(max_length=5, blank=True, null=True, verbose_name='CFOP Padrão Externo')
    fispq              = models.FileField(upload_to='fispq/', blank=True, null=True, verbose_name='FISPQ')
    ficha_tecnica      = models.FileField(upload_to='fichas_tecnicas/', blank=True, null=True, verbose_name='Ficha Técnica')
    ativo              = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if self.custo_medio_ponderado and self.custo_medio_ponderado > Decimal('0.00'):
            if self.pk:
                orig = Produto.objects.get(pk=self.pk)
                mudou_preco = self.preco_venda != orig.preco_venda
                mudou_margem = self.margem_minima != orig.margem_minima
                if mudou_preco and not mudou_margem:
                    self.margem_minima = ((self.preco_venda / self.custo_medio_ponderado) - Decimal('1.00')) * Decimal('100.00')
                elif mudou_margem:
                    self.preco_venda = self.custo_medio_ponderado * (Decimal('1.00') + (self.margem_minima / Decimal('100.00')))
            else:
                self.preco_venda = self.custo_medio_ponderado * (Decimal('1.00') + (self.margem_minima / Decimal('100.00')))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nome} (SKU: {self.sku})"

    class Meta:
        verbose_name = 'Produto'
        verbose_name_plural = 'Produtos'


class LoteEstoque(models.Model):
    produto          = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name='lotes')
    numero_lote      = models.CharField(max_length=100)
    quantidade       = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    custo_unitario   = models.DecimalField(max_digits=15, decimal_places=2, help_text='Custo exato de compra deste lote')
    data_fabricacao  = models.DateField(null=True, blank=True)
    data_validade    = models.DateField(help_text='Usado para o alerta de prateleira')
    nota_fiscal_origem = models.ForeignKey('NotaFiscal', on_delete=models.SET_NULL, null=True, blank=True, related_name='lotes_gerados')
    deposito         = models.CharField(max_length=100, blank=True, null=True, verbose_name='Depósito / Galpão')
    corredor         = models.CharField(max_length=50, blank=True, null=True, verbose_name='Corredor')
    prateleira       = models.CharField(max_length=50, blank=True, null=True, verbose_name='Prateleira')

    def __str__(self):
        return f"Lote {self.numero_lote} - {self.produto.nome} ({self.quantidade} un)"

    class Meta:
        verbose_name = 'Lote de Estoque'
        verbose_name_plural = 'Lotes de Estoque'
        unique_together = ('produto', 'numero_lote')

    @property
    def alerta_validade(self):
        if self.quantidade > 0 and self.data_validade:
            dias = (self.data_validade - timezone.now().date()).days
            if dias < 0:
                return "Vencido"
            if dias <= 45:
                return f"Vence em {dias} dias"
        return "OK"


class ItemNotaFiscal(models.Model):
    nota_fiscal = models.ForeignKey(NotaFiscal, on_delete=models.CASCADE, related_name='itens')
    produto = models.ForeignKey(Produto, on_delete=models.PROTECT, related_name='historico_movimentacao')
    lote = models.ForeignKey(LoteEstoque, on_delete=models.SET_NULL, null=True, blank=True, related_name='itens_nota')
    quantidade = models.DecimalField(max_digits=15, decimal_places=2)
    valor_unitario = models.DecimalField(max_digits=15, decimal_places=2)
    valor_total = models.DecimalField(max_digits=15, decimal_places=2)

    def __str__(self):
        return f"{self.quantidade}x {self.produto.nome} (NF: {self.nota_fiscal.numero_nota})"

    class Meta:
        verbose_name = 'Item da Nota Fiscal'
        verbose_name_plural = 'Itens da Nota Fiscal'


class GrupoCliente(models.Model):
    empresa     = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='grupos_cliente')
    nome        = models.CharField(max_length=100)
    descricao   = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.nome

    class Meta:
        verbose_name = 'Grupo de Cliente'
        verbose_name_plural = 'Grupos de Clientes'
        unique_together = ('empresa', 'nome')


class Cliente(models.Model):
    TIPO_PESSOA_CHOICES = [
        ('F', 'Pessoa Física (CPF)'),
        ('J', 'Pessoa Jurídica (CNPJ)'),
    ]
    TIPO_CLIENTE_CHOICES = [
        ('balcao',         'Balcão'),
        ('produtor_rural', 'Produtor Rural'),
        ('cooperativa',    'Cooperativa'),
        ('orgao_publico',  'Órgão Público'),
        ('outros',         'Outros'),
    ]
    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='clientes')
    grupo           = models.ForeignKey(GrupoCliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='clientes')
    tipo_pessoa     = models.CharField(max_length=1, choices=TIPO_PESSOA_CHOICES, default='J')
    tipo_cliente    = models.CharField(max_length=20, choices=TIPO_CLIENTE_CHOICES, default='balcao', verbose_name='Tipo de Cliente')
    nome_razao      = models.CharField(max_length=255, verbose_name='Nome ou Razão Social')
    nome_fantasia   = models.CharField(max_length=255, blank=True, null=True)
    cnpj_cpf        = models.CharField(max_length=20)
    responsavel     = models.CharField(max_length=100, blank=True, null=True)
    telefone        = models.CharField(max_length=20, null=True, blank=True)
    endereco        = models.CharField(max_length=255, blank=True, null=True)
    coordenadas_gps = models.CharField(max_length=100, blank=True, null=True)
    data_nascimento = models.DateField(blank=True, null=True)
    data_fundacao   = models.DateField(blank=True, null=True, verbose_name='Data de Fundação (PJ)')
    prazo_recompra  = models.PositiveIntegerField(null=True, blank=True, verbose_name='Prazo de recompra individual (dias)', help_text='Se vazio, usa o padrão da empresa.')
    limite_credito         = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    ativo                  = models.BooleanField(default=True)
    vendedor_responsavel   = models.ForeignKey(
        'Usuario', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='carteira_clientes',
        verbose_name='Vendedor Responsável',
    )

    @property
    def dias_sem_comprar(self):
        ultimo_pedido = self.pedidovenda_set.filter(status__in=['aprovado', 'faturado']).order_by('-data_pedido').first()
        if ultimo_pedido:
            delta = timezone.now().date() - ultimo_pedido.data_pedido.date()
            return delta.days
        return None

    @property
    def alerta_recompra(self):
        dias = self.dias_sem_comprar
        if dias is not None and dias >= self.prazo_recompra:
            return True
        return False

    def __str__(self):
        return f"{self.nome_fantasia or self.nome_razao} ({self.responsavel or 'Sem Responsável'})"

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'


class DataComemorativa(models.Model):
    empresa             = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='datas_comemorativas')
    nome                = models.CharField(max_length=100)
    dia                 = models.PositiveSmallIntegerField()
    mes                 = models.PositiveSmallIntegerField()
    dias_antecedencia   = models.PositiveIntegerField(default=3)
    para_todos_vendedores = models.BooleanField(default=True)
    vendedores          = models.ManyToManyField('Usuario', blank=True, related_name='datas_comemorativas')
    ativo               = models.BooleanField(default=True)
    criado_por          = models.ForeignKey('Usuario', on_delete=models.SET_NULL, null=True, related_name='datas_criadas')

    class Meta:
        unique_together = ('empresa', 'dia', 'mes', 'nome')
        verbose_name = 'Data Comemorativa'
        verbose_name_plural = 'Datas Comemorativas'

    def __str__(self):
        return f"{self.nome} ({self.dia:02d}/{self.mes:02d})"


class Fornecedor(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='fornecedores')
    nome_razao = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=20)

    def __str__(self):
        return f"{self.nome_razao} (CNPJ: {self.cnpj})"

    class Meta:
        verbose_name = 'Fornecedor'
        verbose_name_plural = 'Fornecedores'


class PedidoVenda(models.Model):
    STATUS_CHOICES = [
        ('orcamento', 'Orçamento'),
        ('aguardando', 'Aguardando Aprovação'),
        ('aprovado', 'Aprovado (Pronto para NF)'),
        ('faturado', 'Faturado (NF Emitida)'),
        ('recusado', 'Recusado/Cancelado'),
        ('expirado', 'Expirado (Prazo esgotado)'),
    ]
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE)
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT)
    vendedor = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='pedidos_vendedor')
    data_pedido = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='orcamento')
    condicao_pagamento = models.ForeignKey('CondicaoPagamento', on_delete=models.PROTECT, null=True, blank=True)
    forma_pagamento = models.ForeignKey('FormaPagamento', on_delete=models.PROTECT, null=True, blank=True)
    valor_total = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)

    # Prazo de expiração — preenchido automaticamente quando pedido entra em 'aguardando'.
    # Baseado em empresa.prazo_expiracao_pedido (padrão: 2 dias corridos).
    data_expiracao = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Expira em',
        help_text='Preenchido automaticamente. Pedido expira se não aprovado até esta data.',
    )

    # Indica se o estoque já foi baixado para este pedido.
    # Garante que a baixa não ocorra mais de uma vez mesmo em chamadas concorrentes.
    estoque_baixado = models.BooleanField(default=False)

    def __str__(self):
        return f"Pedido #{self.id} - {self.cliente.nome_razao} ({self.get_status_display()})"

    def atualizar_valor_total(self):
        total = sum(item.subtotal for item in self.itens.all()) or Decimal('0.00')
        self.valor_total = total
        PedidoVenda.objects.filter(pk=self.pk).update(valor_total=self.valor_total)

    def save(self, *args, **kwargs):
        if self.pk:
            pedido_antigo = PedidoVenda.objects.get(pk=self.pk)
            status_anterior = pedido_antigo.status

            # ── Transição orcamento → aguardando ────────────────────────────
            # Baixa o estoque e define o prazo de expiração
            if status_anterior == 'orcamento' and self.status == 'aguardando':
                if not self.estoque_baixado:
                    self.baixar_estoque_logico()
                    self.estoque_baixado = True
                # Define data_expiracao com base no prazo configurado na empresa
                prazo = self.empresa.prazo_expiracao_pedido or 2
                self.data_expiracao = timezone.now() + timedelta(days=prazo)

            # ── Transição para recusado ou expirado ─────────────────────────
            # Devolve o estoque que havia sido baixado
            if status_anterior not in ('recusado', 'expirado') and self.status in ('recusado', 'expirado'):
                if self.estoque_baixado:
                    self.devolver_estoque_logico()
                    self.estoque_baixado = False

            # ── Faturamento ─────────────────────────────────────────────────
            # O estoque já foi baixado ao entrar em aguardando.
            # Aqui apenas registra a movimentação de saída definitiva no faturamento.
            if status_anterior != 'faturado' and self.status == 'faturado':
                pass  # Estoque já baixado — sem ação adicional aqui.

        super().save(*args, **kwargs)

        # Verifica travas ao criar pedido novo como 'aguardando'
        # (quando o vendedor cria diretamente como pedido, não como orçamento)
        if not self.pk or self.status == 'aguardando':
            from .aprovacoes import verificar_travas_pedido, reter_pedido_para_aprovacao
            retido, motivos = verificar_travas_pedido(self)
            if retido:
                reter_pedido_para_aprovacao(self, motivos)

    def baixar_estoque_logico(self):
        """
        Baixa o estoque dos lotes por FEFO (First Expired First Out).
        Chamado quando o pedido entra em status 'aguardando'.
        """
        with transaction.atomic():
            for item in self.itens.all():
                qtd_necessaria = item.quantidade
                lotes = item.produto.lotes.filter(quantidade__gt=0).order_by(
                    F('data_validade').asc(nulls_last=True)
                )
                estoque_total = sum(lote.quantidade for lote in lotes)
                if estoque_total < qtd_necessaria:
                    raise ValidationError(
                        f"Estoque insuficiente para '{item.produto.nome}'. "
                        f"Disponível: {estoque_total} | Solicitado: {qtd_necessaria}"
                    )
                for lote in lotes:
                    if qtd_necessaria <= Decimal('0.00'):
                        break
                    if lote.quantidade >= qtd_necessaria:
                        lote.quantidade -= qtd_necessaria
                        lote.save()
                        qtd_necessaria = Decimal('0.00')
                    else:
                        qtd_necessaria -= lote.quantidade
                        lote.quantidade = Decimal('0.00')
                        lote.save()
                item.produto.quantidade -= item.quantidade
                item.produto.save()
                MovimentacaoEstoque.objects.create(
                    produto=item.produto,
                    operador=self.vendedor,
                    tipo='saida',
                    quantidade=-item.quantidade,
                    saldo_apos_movimento=item.produto.quantidade,
                    origem=f"Pedido #{self.id} — reserva de estoque",
                )

    def devolver_estoque_logico(self):
        """
        Devolve o estoque ao ser recusado ou expirado.
        Cria um lote genérico de devolução para manter o histórico correto.
        """
        with transaction.atomic():
            for item in self.itens.all():
                item.produto.quantidade += item.quantidade
                item.produto.save()
                # Cria lote de devolução sem validade para rastreabilidade
                from .models import LoteEstoque
                LoteEstoque.objects.create(
                    produto=item.produto,
                    quantidade=item.quantidade,
                    data_validade=None,
                    numero_lote=f"DEV-PED{self.id}",
                    nota_fiscal=None,
                )
                MovimentacaoEstoque.objects.create(
                    produto=item.produto,
                    operador=self.vendedor,
                    tipo='entrada',
                    quantidade=item.quantidade,
                    saldo_apos_movimento=item.produto.quantidade,
                    origem=f"Devolução — Pedido #{self.id} ({self.get_status_display()})",
                )

    def faturar_pedido(self):
        if self.status == 'faturado':
            return False, "Este pedido já foi faturado."
        if self.status not in ('aprovado', 'aguardando'):
            return False, f"Pedido com status '{self.get_status_display()}' não pode ser faturado."
        if not self.condicao_pagamento or not self.forma_pagamento:
            return False, "Forma ou Condição de pagamento ausentes."
        subtotal = sum(item.subtotal for item in self.itens.all())
        parcelas = self.condicao_pagamento.numero_parcelas
        taxa = self.forma_pagamento.matriz_taxas.filter(parcelas=parcelas).first()
        taxa_perc = taxa.taxa_percentual if taxa else Decimal('0.00')
        taxa_fixa = taxa.taxa_fixa if taxa else Decimal('0.00')
        valor_juros = (subtotal * taxa_perc) / Decimal('100.00') + taxa_fixa
        if self.forma_pagamento.repassar_taxa_cliente:
            self.valor_total = subtotal + valor_juros
        else:
            self.valor_total = subtotal
        self.status = 'faturado'
        self.save()
        # Dispara lembrete de pós-venda para o vendedor e gerentes
        try:
            from .dashboard_perfil import _criar_notificacao_pos_venda
            _criar_notificacao_pos_venda(self)
        except Exception:
            pass
        from .models import ContaReceber
        valor_parcela = self.valor_total / parcelas
        hoje = timezone.now().date()
        for i in range(parcelas):
            if self.condicao_pagamento.intervalo_dias == 0:
                vencimento = hoje
            else:
                vencimento = hoje + timedelta(days=self.condicao_pagamento.intervalo_dias * (i + 1))
            ContaReceber.objects.create(
                empresa=self.empresa,
                cliente=self.cliente,
                pedido_venda=self,
                descricao=f"Parcela {i+1}/{parcelas} - Ped. #{self.id} ({self.forma_pagamento.nome})",
                data_vencimento=vencimento,
                valor=valor_parcela,
                status='pendente'
            )
        return True, "Faturado com sucesso!"

    class Meta:
        verbose_name = 'Pedido de Venda'
        verbose_name_plural = 'Pedidos de Venda'


class ItemPedido(models.Model):
    pedido = models.ForeignKey(PedidoVenda, on_delete=models.CASCADE, related_name='itens')
    produto = models.ForeignKey(Produto, on_delete=models.PROTECT)
    quantidade = models.DecimalField(max_digits=15, decimal_places=2)
    preco_unitario = models.DecimalField(max_digits=15, decimal_places=2)
    comissao_aplicada = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name='Comissão no ato da Venda (%)')
    valor_comissao = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='Valor da Comissão (R$)')

    @property
    def subtotal(self):
        if self.quantidade is not None and self.preco_unitario is not None:
            return self.quantidade * self.preco_unitario
        return Decimal('0.00')

    @property
    def margem_segura(self):
        if self.produto_id is not None and self.preco_unitario is not None and self.produto.custo_medio_ponderado is not None:
            piso_lucro = self.produto.custo_medio_ponderado * (1 + (self.produto.margem_minima / Decimal('100.00')))
            return self.preco_unitario >= piso_lucro
        return None

    def save(self, *args, **kwargs):
        if not self.pk and self.produto_id:
            self.comissao_aplicada = self.produto.comissao_percentual
        if self.comissao_aplicada and self.comissao_aplicada > 0:
            self.valor_comissao = self.subtotal * (self.comissao_aplicada / Decimal('100.00'))
        else:
            self.valor_comissao = Decimal('0.00')
        super().save(*args, **kwargs)
        self.pedido.atualizar_valor_total()

    def delete(self, *args, **kwargs):
        pedido = self.pedido
        super().delete(*args, **kwargs)
        pedido.atualizar_valor_total()

    def __str__(self):
        if self.produto_id and self.quantidade:
            return f"{self.quantidade}x {self.produto.nome}"
        return "Novo Item"

    class Meta:
        verbose_name = 'Item do Pedido'
        verbose_name_plural = 'Itens do Pedido'


class ContaPagar(models.Model):
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('pago', 'Pago'),
        ('atrasado', 'Atrasado'),
    ]
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='contas_pagar')
    fornecedor = models.ForeignKey(
        Fornecedor, on_delete=models.PROTECT, related_name='contas_pagar',
        null=True, blank=True  # Permite despesas sem fornecedor (ex: aluguel)
    )
    nota_fiscal = models.ForeignKey('NotaFiscal', on_delete=models.SET_NULL, null=True, blank=True, related_name='contas_pagar')
    descricao = models.CharField(max_length=255)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    link_boleto = models.URLField(max_length=500, blank=True, null=True)
    linha_digitavel = models.CharField(max_length=100, blank=True, null=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if not is_new:
            try:
                original = ContaPagar.objects.get(pk=self.pk)
                _status_anterior = original.status
            except ContaPagar.DoesNotExist:
                _status_anterior = None
        else:
            _status_anterior = None

        super().save(*args, **kwargs)

        # Gera lançamento contábil ao marcar como pago (uma única vez)
        if self.status == 'pago' and _status_anterior != 'pago':
            from django.utils import timezone
            _gerar_lancamento_contabil(
                empresa=self.empresa,
                tipo_operacao='conta_pagar_paga',
                valor=self.valor,
                historico=f'Pagamento: {self.descricao}',
                origem_tipo='conta_pagar',
                origem_id=self.pk,
                data=self.data_pagamento or timezone.localdate(),
            )

    def __str__(self):
        fornecedor_nome = self.fornecedor.nome_razao if self.fornecedor else 'Sem Fornecedor'
        return f"{self.descricao} - {fornecedor_nome}"

    class Meta:
        verbose_name = 'Conta a Pagar'
        verbose_name_plural = 'Contas a Pagar'


class ContaReceber(models.Model):
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('recebido', 'Recebido'),
        ('inadimplente', 'Inadimplente'),
        ('atrasado', 'Inadimplente'),
    ]
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='contas_receber')
    cliente = models.ForeignKey('Cliente', on_delete=models.PROTECT, related_name='contas_receber')
    pedido_venda = models.ForeignKey('PedidoVenda', on_delete=models.SET_NULL, null=True, blank=True, related_name='contas_receber')
    descricao = models.CharField(max_length=255)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data_vencimento = models.DateField()
    data_recebimento = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if not is_new:
            try:
                original = ContaReceber.objects.get(pk=self.pk)
                _status_anterior = original.status
            except ContaReceber.DoesNotExist:
                _status_anterior = None
        else:
            _status_anterior = None

        super().save(*args, **kwargs)

        # Gera lançamento contábil ao marcar como recebido (uma única vez)
        if self.status == 'recebido' and _status_anterior != 'recebido':
            from django.utils import timezone
            _gerar_lancamento_contabil(
                empresa=self.empresa,
                tipo_operacao='conta_receber_recebida',
                valor=self.valor,
                historico=f'Recebimento: {self.descricao}',
                origem_tipo='conta_receber',
                origem_id=self.pk,
                data=self.data_recebimento or timezone.localdate(),
            )

    def __str__(self):
        # CORRIGIDO: era self.cliente.nome, agora usa nome_fantasia ou nome_razao
        return f"{self.descricao} - {self.cliente.nome_fantasia or self.cliente.nome_razao}"

    class Meta:
        verbose_name = 'Conta a Receber'
        verbose_name_plural = 'Contas a Receber'


class CustoFixo(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='custos_fixos')
    descricao = models.CharField(max_length=255)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    dia_vencimento = models.IntegerField(help_text="Dia do mês que costuma vencer")
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.descricao} - R$ {self.valor}"

    class Meta:
        verbose_name = 'Custo Fixo'
        verbose_name_plural = 'Custos Fixos'


class CondicaoPagamento(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE)
    descricao = models.CharField(max_length=50)
    numero_parcelas = models.IntegerField(default=1)
    intervalo_dias = models.IntegerField(default=30)
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return self.descricao

    class Meta:
        verbose_name = 'Condição de Pagamento'
        verbose_name_plural = 'Condições de Pagamento'


class FormaPagamento(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE)
    nome = models.CharField(max_length=50)
    repassar_taxa_cliente = models.BooleanField(default=False)
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return self.nome

    class Meta:
        verbose_name = 'Forma de Pagamento'
        verbose_name_plural = 'Formas de Pagamento'


class TaxaFormaPagamento(models.Model):
    forma_pagamento = models.ForeignKey(FormaPagamento, on_delete=models.CASCADE, related_name='matriz_taxas')
    parcelas = models.IntegerField()
    taxa_percentual = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    taxa_fixa = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    def __str__(self):
        return f"{self.forma_pagamento.nome} - {self.parcelas}x"

    class Meta:
        verbose_name = 'Taxa da Forma de Pagamento'
        verbose_name_plural = 'Matriz de Taxas'


class CaixaDiario(models.Model):
    STATUS_CHOICES = [
        ('aberto', 'Aberto'),
        ('fechado', 'Fechado'),
    ]
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='caixas')
    operador = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    data_abertura = models.DateTimeField(auto_now_add=True)
    data_fechamento = models.DateTimeField(null=True, blank=True)
    saldo_inicial = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    saldo_final_esperado = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    saldo_final_real = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='aberto')

    def __str__(self):
        data_formatada = self.data_abertura.strftime("%d/%m/%Y")
        return f"Caixa {data_formatada} - {self.operador.username} ({self.get_status_display()})"

    class Meta:
        verbose_name = 'Caixa Diário'
        verbose_name_plural = 'Controle de Caixas'


class LancamentoCaixa(models.Model):
    TIPO_CHOICES = [
        ('entrada', 'Entrada (Receita)'),
        ('saida', 'Saída (Despesa)'),
    ]
    caixa = models.ForeignKey(CaixaDiario, on_delete=models.CASCADE, related_name='lancamentos')
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    descricao = models.CharField(max_length=255)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    forma_pagamento = models.ForeignKey(FormaPagamento, on_delete=models.PROTECT)
    conta_receber = models.ForeignKey(ContaReceber, on_delete=models.SET_NULL, null=True, blank=True)
    conta_pagar = models.ForeignKey(ContaPagar, on_delete=models.SET_NULL, null=True, blank=True)
    data_lancamento = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        sinal = "+" if self.tipo == 'entrada' else "-"
        return f"[{sinal}] R$ {self.valor} - {self.descricao}"

    class Meta:
        verbose_name = 'Lançamento de Caixa'
        verbose_name_plural = 'Fluxo de Caixa'


class MovimentacaoEstoque(models.Model):
    TIPO_CHOICES = [
        ('entrada', 'Entrada (XML/Compra)'),
        ('saida', 'Saída (Venda/Perda)'),
        ('ajuste', 'Ajuste Manual'),
    ]
    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name='movimentacoes')
    operador = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    quantidade = models.DecimalField(max_digits=15, decimal_places=2)
    saldo_apos_movimento = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    origem = models.CharField(max_length=255)
    data_movimento = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.produto.nome} | {self.quantidade} | {self.origem}"

    class Meta:
        verbose_name = 'Extrato de Movimentação'
        verbose_name_plural = 'Extratos de Movimentação'


class AjusteEstoque(models.Model):
    produto = models.ForeignKey(Produto, on_delete=models.CASCADE)
    operador = models.ForeignKey(Usuario, on_delete=models.PROTECT, null=True, blank=True)
    quantidade_ajuste = models.DecimalField(max_digits=10, decimal_places=2)
    justificativa = models.CharField(max_length=255, validators=[MinLengthValidator(10)])
    data_ajuste = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            self.produto.quantidade += self.quantidade_ajuste
            self.produto.save()
            MovimentacaoEstoque.objects.create(
                produto=self.produto,
                operador=self.operador,
                tipo='ajuste',
                quantidade=self.quantidade_ajuste,
                saldo_apos_movimento=self.produto.quantidade,
                origem=f"Ajuste Manual: {self.justificativa}"
            )

    class Meta:
        verbose_name = 'Ajuste Manual de Estoque'
        verbose_name_plural = 'Ajustes Manuais'


# ==========================================
# LOG DE AUDITORIA
# ==========================================

class LogAuditoria(models.Model):
    ACAO_CHOICES = [
        ('alteracao_preco', 'Alteração de Preço'),
        ('alteracao_estoque', 'Alteração de Estoque'),
        ('alteracao_permissao', 'Alteração de Permissão'),
        ('exclusao', 'Exclusão de Registro'),
        ('aprovacao_pedido', 'Aprovação de Pedido'),
        ('recusa_pedido', 'Recusa de Pedido'),
        ('expiracao_automatica', 'Expiração Automática de Pedido'),
        ('expiracao_manual', 'Expiração Manual de Pedido'),
        ('faturamento', 'Faturamento de Pedido'),
        ('login', 'Login no Sistema'),
        ('alteracao_usuario', 'Alteração de Usuário'),
        ('manifestacao_nfe', 'Manifestação de NF-e'),
        ('cancelamento_nfe', 'Cancelamento de NF-e'),
        ('carta_correcao_nfe', 'Carta de Correção NF-e'),
        ('venda_pdv', 'Venda PDV'),
        ('cancelamento_pdv', 'Cancelamento de Venda PDV'),
        ('acesso_superhost', 'Acesso SuperHost ao Ambiente'),
        ('bloqueio_empresa', 'Bloqueio/Desbloqueio de Empresa'),
        ('alteracao_tipo_empresa',  'Alteração de Tipo de Empresa'),
        ('transferencia_carteira',  'Transferência de Carteira'),
        ('criacao',  'Criação de Registro'),
        ('edicao',   'Edição de Registro'),
    ]
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='logs_auditoria')
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True)
    acao = models.CharField(max_length=30, choices=ACAO_CHOICES)
    modelo_afetado = models.CharField(max_length=100)
    registro_id = models.IntegerField()
    campo_alterado = models.CharField(max_length=100, blank=True, null=True)
    valor_anterior = models.TextField(blank=True, null=True)
    valor_novo = models.TextField(blank=True, null=True)
    descricao = models.CharField(max_length=500, blank=True)
    justificativa = models.TextField(blank=True, null=True, verbose_name='Justificativa de acesso')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    data_hora = models.DateTimeField(auto_now_add=True)

    def delete(self, *args, **kwargs):
        raise PermissionError('Logs de auditoria são imutáveis e não podem ser excluídos.')

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError('Logs de auditoria são imutáveis e não podem ser editados.')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.get_acao_display()}] {self.modelo_afetado} #{self.registro_id} por {self.usuario}"

    class Meta:
        verbose_name = 'Log de Auditoria'
        verbose_name_plural = 'Logs de Auditoria'
        ordering = ['-data_hora']

    @classmethod
    def registrar(cls, empresa, usuario, acao, modelo_afetado,
                  registro_id, campo_alterado=None,
                  valor_anterior=None, valor_novo=None,
                  descricao='', justificativa=None, request=None):
        ip = None
        if request:
            x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
            ip = x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')
        cls.objects.create(
            empresa=empresa,
            usuario=usuario,
            acao=acao,
            modelo_afetado=modelo_afetado,
            registro_id=registro_id,
            campo_alterado=campo_alterado,
            valor_anterior=str(valor_anterior) if valor_anterior is not None else None,
            valor_novo=str(valor_novo) if valor_novo is not None else None,
            descricao=descricao,
            justificativa=justificativa,
            ip_address=ip,
        )


# ==========================================
# META DO VENDEDOR
# ==========================================

class MetaVendedor(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='metas')
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='metas_vendedores')
    mes = models.IntegerField(help_text='Mês de referência (1-12)')
    ano = models.IntegerField(help_text='Ano de referência')
    valor_meta = models.DecimalField(max_digits=15, decimal_places=2)

    def __str__(self):
        return f"Meta de {self.usuario.get_full_name() or self.usuario.username} — {self.mes}/{self.ano}: R$ {self.valor_meta}"

    class Meta:
        verbose_name = 'Meta do Vendedor'
        verbose_name_plural = 'Metas dos Vendedores'
        unique_together = ('usuario', 'mes', 'ano')


class VisitaCliente(models.Model):
    TIPO_CHOICES = [
        ('presencial',  'Presencial'),
        ('telefone',    'Ligação Telefônica'),
        ('whatsapp',    'WhatsApp'),
        ('email',       'E-mail'),
        ('video',       'Videoconferência'),
    ]
    RESULTADO_CHOICES = [
        ('positivo',    'Positivo'),
        ('neutro',      'Neutro'),
        ('negativo',    'Negativo'),
        ('sem_contato', 'Sem Contato'),
    ]

    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='visitas_clientes')
    vendedor        = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='visitas_realizadas')
    cliente         = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='visitas')
    tipo            = models.CharField(max_length=15, choices=TIPO_CHOICES, default='presencial')
    data_visita     = models.DateTimeField()
    observacoes     = models.TextField(blank=True, default='')
    resultado       = models.CharField(max_length=15, choices=RESULTADO_CHOICES, default='neutro')
    proximo_contato = models.DateField(null=True, blank=True)
    criado_em       = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Visita {self.vendedor.get_full_name()} → {self.cliente.nome_razao} ({self.data_visita.strftime('%d/%m/%Y')})"

    class Meta:
        verbose_name = 'Visita a Cliente'
        verbose_name_plural = 'Visitas a Clientes'
        ordering = ['-data_visita']


# ==========================================
# COLE NO FINAL DO SEU models.py
# ==========================================

class Notificacao(models.Model):
    TIPO_CHOICES = [
        ('estoque_baixo', 'Estoque Baixo'),
        ('validade_lote', 'Lote Próximo do Vencimento'),
        ('conta_vencer', 'Conta a Pagar Vencendo'),
        ('boleto_vencer', 'Boleto do Cliente Vencendo'),
        ('cliente_inadimplente', 'Cliente Inadimplente'),
        ('cliente_sem_comprar', 'Cliente Sem Comprar'),
        ('aniversario', 'Aniversário do Cliente'),
        ('pedido_retido', 'Pedido Retido para Aprovação'),
        ('pedido_aprovado', 'Pedido Aprovado — aguardando conclusão do vendedor'),
        ('pedido_expirado', 'Pedido Expirado por Prazo'),
        ('meta_atingida', 'Meta Atingida'),
        ('pos_venda', 'Pós-venda — Contato após faturamento'),
        ('data_comemorativa', 'Data Comemorativa'),
        ('contingencia_sefaz', 'Contingência SEFAZ Ativa'),
    ]
    PRIORIDADE_CHOICES = [
        ('alta', 'Alta'),
        ('media', 'Média'),
        ('baixa', 'Baixa'),
    ]
    # Tempo em minutos para ressurgir após ser fechada sem resolução
    RESUBIR_POR_PRIORIDADE = {
        'alta': 30,
        'media': 240,    # 4 horas
        'baixa': 2880,   # 48 horas
    }

    empresa = models.ForeignKey(
        'Empresa', on_delete=models.CASCADE, related_name='notificacoes'
    )
    # Notificações direcionadas a um usuário específico
    usuario = models.ForeignKey(
        'Usuario', on_delete=models.CASCADE,
        null=True, blank=True, related_name='notificacoes'
    )
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    prioridade = models.CharField(max_length=10, choices=PRIORIDADE_CHOICES, default='media')
    titulo = models.CharField(max_length=255)
    mensagem = models.TextField()

    modelo_referencia = models.CharField(max_length=100, blank=True, null=True)
    id_referencia = models.IntegerField(blank=True, null=True)

    lida = models.BooleanField(default=False)
    fechada = models.BooleanField(default=False)  # usuário clicou em "ok"
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_leitura = models.DateTimeField(null=True, blank=True)
    data_fechamento = models.DateTimeField(null=True, blank=True)

    # Controle de recorrência
    chave_unica = models.CharField(max_length=255, blank=True, null=True)
    proxima_exibicao = models.DateTimeField(null=True, blank=True)

    # Filtragem por perfil no dashboard.
    # Formato: string separada por vírgula, ex: 'vendedor' ou 'gerente,diretor'
    # Vazio = visível para todos os níveis da empresa.
    visivel_para_nivel = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Visível para nível(is)',
        help_text='Deixe em branco para todos. Ex: "vendedor" ou "gerente,diretor"',
    )

    def marcar_lida(self):
        self.lida = True
        self.data_leitura = timezone.now()
        self.save(update_fields=['lida', 'data_leitura'])

    def fechar(self):
        """Usuário clicou em OK — agenda próxima exibição pela prioridade."""
        minutos = self.RESUBIR_POR_PRIORIDADE.get(self.prioridade, 240)
        self.fechada = True
        self.lida = True
        self.data_fechamento = timezone.now()
        self.proxima_exibicao = timezone.now() + timedelta(minutes=minutos)
        self.save(update_fields=['fechada', 'lida', 'data_fechamento', 'proxima_exibicao'])

    @property
    def visivel(self):
        """Retorna se a notificação deve aparecer agora."""
        if not self.fechada:
            return True
        if self.proxima_exibicao and timezone.now() >= self.proxima_exibicao:
            return True
        return False

    def __str__(self):
        return f"[{self.get_prioridade_display()}] {self.titulo}"

    class Meta:
        verbose_name = 'Notificação'
        verbose_name_plural = 'Notificações'
        ordering = ['-data_criacao']


class LogComportamental(models.Model):
    """
    Registro imutável de tudo que cada usuário faz no sistema.
    Visível apenas para Diretor por padrão.
    Pode ser liberado para Gerente pelo Diretor.
    """
    ACAO_CHOICES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('visualizou_tela', 'Visualizou Tela'),
        ('visualizou_relatorio', 'Visualizou Relatório'),
        ('alterou_cadastro', 'Alterou Cadastro'),
        ('alterou_preco', 'Alterou Preço/Margem'),
        ('movimentou_estoque', 'Movimentou Estoque'),
        ('aprovou_pedido', 'Aprovou Pedido'),
        ('recusou_pedido', 'Recusou Pedido'),
        ('fechou_notificacao', 'Fechou Notificação'),
        ('faturou_pedido', 'Faturou Pedido'),
        ('exportou_relatorio', 'Exportou Relatório'),
    ]

    empresa = models.ForeignKey(
        'Empresa', on_delete=models.CASCADE, related_name='logs_comportamentais'
    )
    usuario = models.ForeignKey(
        'Usuario', on_delete=models.SET_NULL,
        null=True, related_name='logs_comportamentais'
    )
    acao = models.CharField(max_length=30, choices=ACAO_CHOICES)
    descricao = models.CharField(max_length=500)

    # Contexto da ação
    modelo_afetado = models.CharField(max_length=100, blank=True, null=True)
    id_afetado = models.IntegerField(null=True, blank=True)
    valor_anterior = models.TextField(blank=True, null=True)
    valor_novo = models.TextField(blank=True, null=True)

    # Metadados
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True, null=True)
    data_hora = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.usuario} — {self.get_acao_display()} — {self.data_hora.strftime('%d/%m/%Y %H:%M')}"

    class Meta:
        verbose_name = 'Log Comportamental'
        verbose_name_plural = 'Logs Comportamentais'
        ordering = ['-data_hora']

    @classmethod
    def registrar(cls, request, acao, descricao, modelo_afetado=None,
                  id_afetado=None, valor_anterior=None, valor_novo=None):
        """
        Método de conveniência para registrar de qualquer lugar.

        Uso:
            LogComportamental.registrar(
                request=request,
                acao='alterou_preco',
                descricao=f'Alterou preço do produto {produto.nome}',
                modelo_afetado='Produto',
                id_afetado=produto.id,
                valor_anterior=str(preco_antigo),
                valor_novo=str(produto.preco_venda),
            )
        """
        if not request or not hasattr(request, 'user') or not request.user.is_authenticated:
            return

        ip = None
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')

        empresa = getattr(request.user, 'empresa', None)
        if not empresa:
            return

        cls.objects.create(
            empresa=empresa,
            usuario=request.user,
            acao=acao,
            descricao=descricao,
            modelo_afetado=modelo_afetado,
            id_afetado=id_afetado,
            valor_anterior=str(valor_anterior) if valor_anterior is not None else None,
            valor_novo=str(valor_novo) if valor_novo is not None else None,
            ip_address=ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
        )


class PermissaoLog(models.Model):
    """
    Controla quem pode ver os logs comportamentais.
    Diretor pode liberar para gerentes específicos.
    """
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE)
    usuario = models.OneToOneField(
        'Usuario', on_delete=models.CASCADE, related_name='permissao_log'
    )
    pode_ver_log_comportamental = models.BooleanField(
        default=False,
        help_text='Permite que este usuário veja os logs comportamentais de todos'
    )
    liberado_por = models.ForeignKey(
        'Usuario', on_delete=models.SET_NULL, null=True,
        related_name='logs_liberados',
        help_text='Diretor que liberou o acesso'
    )
    data_liberacao = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Permissão de log para {self.usuario.username}"

    class Meta:
        verbose_name = 'Permissão de Log'
        verbose_name_plural = 'Permissões de Log'

# ==========================================
# COLE NO FINAL DO SEU models.py
# ==========================================


class Transportadora(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='transportadoras')
    nome_razao = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=20)
    placa_veiculo = models.CharField(max_length=10, blank=True, null=True)
    uf = models.CharField(max_length=2, blank=True, null=True, verbose_name='UF')
    antt = models.CharField(max_length=20, blank=True, null=True, verbose_name='ANTT')
    telefone = models.CharField(max_length=20, blank=True, null=True)
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nome_razao} ({self.placa_veiculo or 'Sem placa'})"

    class Meta:
        verbose_name = 'Transportadora'
        verbose_name_plural = 'Transportadoras'


class PedidoCompra(models.Model):
    """
    Controle do que foi pedido às indústrias/fornecedores
    antes de chegar o XML de entrada.
    """
    STATUS_CHOICES = [
        ('rascunho', 'Rascunho'),
        ('enviado', 'Enviado ao Fornecedor'),
        ('parcial', 'Recebido Parcialmente'),
        ('recebido', 'Recebido Totalmente'),
        ('cancelado', 'Cancelado'),
    ]

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='pedidos_compra')
    fornecedor = models.ForeignKey(Fornecedor, on_delete=models.PROTECT, related_name='pedidos_compra')
    responsavel = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='pedidos_compra')
    transportadora = models.ForeignKey(
        Transportadora, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pedidos_compra'
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='rascunho')
    data_pedido = models.DateTimeField(auto_now_add=True)
    data_previsao = models.DateField(null=True, blank=True, help_text='Previsão de entrega')
    observacoes = models.TextField(blank=True, null=True)
    valor_total = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)

    # Vinculo com NF de entrada quando chegar
    nota_fiscal_entrada = models.ForeignKey(
        NotaFiscal, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pedidos_compra'
    )

    def __str__(self):
        return f"PC #{self.id} - {self.fornecedor.nome_razao} ({self.get_status_display()})"

    def atualizar_valor_total(self):
        total = sum(item.subtotal for item in self.itens.all()) or Decimal('0.00')
        self.valor_total = total
        PedidoCompra.objects.filter(pk=self.pk).update(valor_total=total)

    class Meta:
        verbose_name = 'Pedido de Compra'
        verbose_name_plural = 'Pedidos de Compra'


class ItemPedidoCompra(models.Model):
    pedido_compra = models.ForeignKey(PedidoCompra, on_delete=models.CASCADE, related_name='itens')
    produto = models.ForeignKey(Produto, on_delete=models.PROTECT)
    quantidade_pedida = models.DecimalField(max_digits=15, decimal_places=2)
    quantidade_recebida = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    preco_unitario = models.DecimalField(max_digits=15, decimal_places=2)

    @property
    def subtotal(self):
        return self.quantidade_pedida * self.preco_unitario

    @property
    def pendente(self):
        return self.quantidade_pedida - self.quantidade_recebida

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.pedido_compra.atualizar_valor_total()

    def __str__(self):
        return f"{self.quantidade_pedida}x {self.produto.nome} (PC #{self.pedido_compra.id})"

    class Meta:
        verbose_name = 'Item do Pedido de Compra'
        verbose_name_plural = 'Itens do Pedido de Compra'


class PermissaoGranular(models.Model):
    """
    Matriz de permissões individuais por usuário.
    O Diretor pode ligar/desligar cada switch.
    """
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name='permissoes_granulares'
    )
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE)

    # Financeiro
    ver_custos = models.BooleanField(default=False, verbose_name='Ver custos e margens')
    ver_financeiro = models.BooleanField(default=False, verbose_name='Ver módulo financeiro')
    ver_dre = models.BooleanField(default=False, verbose_name='Ver DRE')
    ver_comissoes_outros = models.BooleanField(default=False, verbose_name='Ver comissões de outros vendedores')

    # Operacional
    aprovar_pedido = models.BooleanField(default=False, verbose_name='Aprovar pedidos')
    emitir_nota = models.BooleanField(default=False, verbose_name='Emitir nota fiscal')
    ajustar_estoque = models.BooleanField(default=False, verbose_name='Ajustar estoque manualmente')
    ver_relatorios = models.BooleanField(default=False, verbose_name='Ver relatórios')

    # Cadastros
    editar_clientes = models.BooleanField(default=True, verbose_name='Editar clientes')
    editar_produtos = models.BooleanField(default=False, verbose_name='Editar produtos e preços')
    excluir_registros = models.BooleanField(default=False, verbose_name='Excluir registros')

    # Log
    ver_log_comportamental = models.BooleanField(default=False, verbose_name='Ver log comportamental')

    # Acesso multi-unidade — configurável pelo CEO para gerentes específicos
    # Permite que um gerente veja o contexto de outra empresa do mesmo grupo.
    empresas_adicionais = models.ManyToManyField(
        'Empresa',
        blank=True,
        related_name='gerentes_com_acesso',
        verbose_name='Empresas adicionais com acesso',
        help_text='Empresas do grupo às quais este usuário tem acesso além da própria.',
    )

    def __str__(self):
        return f"Permissões de {self.usuario.username}"

    class Meta:
        verbose_name = 'Permissão Granular'
        verbose_name_plural = 'Permissões Granulares'

class ConfiguracaoFiscal(models.Model):
    REGIME_CHOICES = [
        ('simples', 'Simples Nacional'),
        ('presumido', 'Lucro Presumido'),
        ('real', 'Lucro Real'),
    ]
 
    empresa = models.OneToOneField(
        Empresa, on_delete=models.CASCADE, related_name='configuracao_fiscal'
    )
    regime_tributario = models.CharField(max_length=20, choices=REGIME_CHOICES, default='simples')
    cnpj = models.CharField(max_length=18, blank=True, null=True)
    inscricao_estadual = models.CharField(max_length=20, blank=True, null=True)
    uf = models.CharField(max_length=2, help_text='UF do estabelecimento')
    crt = models.CharField(
        max_length=1,
        help_text='Código de Regime Tributário (1=Simples, 2=Simples Excesso, 3=Normal)',
        default='1'
    )
 
    # Alíquotas editáveis pelo cliente com o contador
    aliquota_icms_interno = models.DecimalField(
        max_digits=5, decimal_places=2, default=12.00,
        help_text='Alíquota ICMS para operações internas (%) — confirme com seu contador'
    )
    aliquota_icms_interestadual = models.DecimalField(
        max_digits=5, decimal_places=2, default=12.00,
        help_text='Alíquota ICMS para operações interestaduais (%) — confirme com seu contador'
    )
 
    # Chavinha de sugestão automática
    sugestao_fiscal_automatica = models.BooleanField(
        default=True,
        verbose_name='Sugestão fiscal automática',
        help_text='Se marcado, o sistema sugere CFOP e tributação automaticamente na venda. Desmarque se preferir preencher manualmente.'
    )
 
    # Chave de API do Focus NFe
    focusnfe_token = models.CharField(
        max_length=255, blank=True, null=True,
        help_text='Token de acesso ao Focus NFe para emissão de NF-e'
    )
    focusnfe_homologacao = models.BooleanField(
        default=True,
        help_text='Se marcado, emite em homologação (testes). Desmarque para produção.'
    )
 
    def __str__(self):
        return f"Config Fiscal — {self.empresa.nome} ({self.get_regime_tributario_display()})"
 
    class Meta:
        verbose_name = 'Configuração Fiscal'
        verbose_name_plural = 'Configurações Fiscais'
 
 
class RelacionadorCFOP(models.Model):
    """
    Tabela que relaciona CFOP de entrada com CFOP de saída.
    Pré-populada com os CFOPs mais usados no agro.
    Editável pelo cliente com o contador.
    """
    empresa = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, related_name='relacionadores_cfop',
        null=True, blank=True,
        help_text='Se null, é uma regra global do sistema'
    )
    cfop_entrada = models.CharField(max_length=5, help_text='Ex: 1102')
    descricao_entrada = models.CharField(max_length=255)
    cfop_saida_interno = models.CharField(max_length=5, help_text='Saída dentro do estado. Ex: 5102')
    cfop_saida_externo = models.CharField(max_length=5, help_text='Saída para outro estado. Ex: 6102')
    descricao_saida = models.CharField(max_length=255)
    ativo = models.BooleanField(default=True)
 
    def __str__(self):
        return f"{self.cfop_entrada} → {self.cfop_saida_interno} / {self.cfop_saida_externo}"
 
    class Meta:
        verbose_name = 'Relacionador de CFOP'
        verbose_name_plural = 'Relacionadores de CFOP'
 
 
class MatrizTributaria(models.Model):
    """
    Matriz de tributação por regime.
    Define CST/CSOSN, alíquotas de PIS e COFINS por regime.
    Pré-populada com valores oficiais — editável pelo cliente.
    """
    REGIME_CHOICES = [
        ('simples', 'Simples Nacional'),
        ('presumido', 'Lucro Presumido'),
        ('real', 'Lucro Real'),
    ]
 
    regime = models.CharField(max_length=20, choices=REGIME_CHOICES)
    descricao = models.CharField(max_length=255, help_text='Ex: Venda tributada normal')
 
    # ICMS
    csosn = models.CharField(
        max_length=4, blank=True, null=True,
        help_text='Código CSOSN para Simples Nacional (ex: 102, 400, 500)'
    )
    cst_icms = models.CharField(
        max_length=3, blank=True, null=True,
        help_text='Código CST ICMS para Presumido/Real (ex: 000, 040, 060)'
    )
 
    # PIS
    cst_pis = models.CharField(max_length=2, help_text='CST do PIS (ex: 01, 07, 99)')
    aliquota_pis = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.00,
        help_text='Alíquota PIS (%)'
    )
 
    # COFINS
    cst_cofins = models.CharField(max_length=2, help_text='CST da COFINS (ex: 01, 07, 99)')
    aliquota_cofins = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.00,
        help_text='Alíquota COFINS (%)'
    )
 
    padrao = models.BooleanField(
        default=False,
        help_text='Se marcado, é a tributação padrão deste regime'
    )
 
    def __str__(self):
        return f"[{self.get_regime_display()}] {self.descricao}"
 
    class Meta:
        verbose_name = 'Matriz Tributária'
        verbose_name_plural = 'Matriz Tributária'

class ConfiguracaoWhiteLabel(models.Model):
    """
    Personalização visual do sistema por empresa.
    Disponível apenas para empresas do tipo 'industria'.
    """
    empresa = models.OneToOneField(
        Empresa, on_delete=models.CASCADE, related_name='whitelabel'
    )
 
    # Logo
    logo_url = models.URLField(
        max_length=500, blank=True, null=True,
        help_text='URL da logo no S3 após upload'
    )
    logo_s3_key = models.CharField(
        max_length=500, blank=True, null=True,
        help_text='Chave do arquivo no S3'
    )
 
    # Nome do sistema
    # Gerado automaticamente: pega primeira palavra do nome da empresa + "Pulse"
    # Ex: "AURA Fertilizantes" → "AuraPulse"
    nome_sistema = models.CharField(
        max_length=100, blank=True, null=True,
        help_text='Nome personalizado do sistema. Gerado automaticamente da logo.'
    )
 
    # Cores extraídas automaticamente da logo
    TEMA_CHOICES = [
        ('claro', 'Tema Claro'),
        ('escuro', 'Tema Escuro'),
    ]
    tema = models.CharField(max_length=10, choices=TEMA_CHOICES, default='claro')
 
    # Paleta de cores (sugerida automaticamente, editável)
    cor_primaria = models.CharField(
        max_length=7, default='#1B5E20',
        help_text='Cor principal (HEX). Ex: #2E7D32'
    )
    cor_secundaria = models.CharField(
        max_length=7, default='#4CAF50',
        help_text='Cor secundária (HEX). Ex: #A5D6A7'
    )
    cor_texto = models.CharField(
        max_length=7, default='#1B1B1B',
        help_text='Cor do texto principal (HEX)'
    )
    cor_fundo = models.CharField(
        max_length=7, default='#FFFFFF',
        help_text='Cor do fundo (HEX)'
    )
 
    # Rodapé
    rodape_personalizado = models.CharField(
        max_length=255, blank=True, null=True,
        help_text='Texto do rodapé nos documentos. Gerado automaticamente se vazio.'
    )
 
    # Domínio personalizado (futuro)
    dominio_personalizado = models.CharField(
        max_length=255, blank=True, null=True,
        help_text='Ex: sistema.aurafertilizantes.com.br'
    )
 
    data_configuracao = models.DateTimeField(auto_now=True)
 
    def gerar_nome_sistema(self):
        """Gera nome automático: primeira palavra + Pulse"""
        primeira_palavra = self.empresa.nome.split()[0].capitalize()
        return f"{primeira_palavra}Pulse"
 
    def gerar_rodape(self):
        """Gera rodapé automático se não personalizado."""
        if self.rodape_personalizado:
            return self.rodape_personalizado
        nome = self.nome_sistema or self.gerar_nome_sistema()
        return f"{nome} — {self.empresa.nome}"
 
    def save(self, *args, **kwargs):
        # Gera nome automático se não definido
        if not self.nome_sistema:
            self.nome_sistema = self.gerar_nome_sistema()
        super().save(*args, **kwargs)
 
    def __str__(self):
        return f"White-label — {self.empresa.nome} ({self.nome_sistema})"
 
    class Meta:
        verbose_name = 'Configuração White-label'
        verbose_name_plural = 'Configurações White-label'

class LancamentoFinanceiro(models.Model):
    """
    FUNCIONALIDADE INCOMPLETA 3: Lançamento Financeiro Avulso.
    Diferente do LancamentoCaixa, este não exige CaixaDiario aberto.
    Serve para registrar despesas/receitas que não passam pelo caixa físico
    (ex: débito automático, transferência bancária, despesa de cartão).
    Integrado com ContaPagar e ContaReceber existentes.
    """
    TIPO_CHOICES = [
        ('receita', 'Receita'),
        ('despesa', 'Despesa'),
    ]
    CATEGORIA_CHOICES = [
        ('operacional', 'Operacional'),
        ('financeiro', 'Financeiro'),
        ('pessoal', 'Pessoal/Sócio'),
        ('imposto', 'Imposto/Taxa'),
        ('investimento', 'Investimento'),
        ('outros', 'Outros'),
    ]
 
    empresa = models.ForeignKey(
        'Empresa', on_delete=models.CASCADE, related_name='lancamentos_financeiros'
    )
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES, default='operacional')
    descricao = models.CharField(max_length=255)
    valor = models.DecimalField(max_digits=15, decimal_places=2)
    data_lancamento = models.DateField()
    data_competencia = models.DateField(
        null=True, blank=True,
        help_text='Mês de competência do lançamento (para DRE)'
    )
    forma_pagamento = models.ForeignKey(
        'FormaPagamento', on_delete=models.PROTECT, null=True, blank=True
    )
    responsavel = models.ForeignKey(
        'Usuario', on_delete=models.PROTECT, related_name='lancamentos_financeiros'
    )
 
    # Vínculos opcionais com contas existentes
    conta_pagar = models.ForeignKey(
        'ContaPagar', on_delete=models.SET_NULL, null=True, blank=True,
        help_text='Se este lançamento quita uma conta a pagar'
    )
    conta_receber = models.ForeignKey(
        'ContaReceber', on_delete=models.SET_NULL, null=True, blank=True,
        help_text='Se este lançamento registra um recebimento'
    )
 
    observacoes = models.TextField(blank=True, null=True)
    recorrente = models.BooleanField(
        default=False,
        help_text='Se marcado, este lançamento se repete mensalmente'
    )
    data_criacao = models.DateTimeField(auto_now_add=True)
 
    def save(self, *args, **kwargs):
        # Se vincular a uma ContaPagar, marca como paga
        if self.conta_pagar and self.tipo == 'despesa':
            self.conta_pagar.status = 'pago'
            self.conta_pagar.data_pagamento = self.data_lancamento
            self.conta_pagar.save(update_fields=['status', 'data_pagamento'])
 
        # Se vincular a uma ContaReceber, marca como recebida
        if self.conta_receber and self.tipo == 'receita':
            self.conta_receber.status = 'recebido'
            self.conta_receber.data_recebimento = self.data_lancamento
            self.conta_receber.save(update_fields=['status', 'data_recebimento'])
 
        super().save(*args, **kwargs)
 
    def __str__(self):
        sinal = '+' if self.tipo == 'receita' else '-'
        return f"[{sinal}] R$ {self.valor} — {self.descricao} ({self.data_lancamento})"
 
    class Meta:
        verbose_name = 'Lançamento Financeiro'
        verbose_name_plural = 'Lançamentos Financeiros'
        ordering = ['-data_lancamento']
 

# ==========================================
# MANIFESTAÇÃO DE NF-e (MD-e)
# Fase 4 — obrigação legal
# ==========================================

class ManifestacaoNFe(models.Model):
    TIPO_CHOICES = [
        ('ciencia',         'Ciência da Operação'),
        ('confirmacao',     'Confirmação da Operação'),
        ('desconhecimento', 'Desconhecimento da Operação'),
        ('nao_realizada',   'Operação não Realizada'),
    ]
    STATUS_CHOICES = [
        ('sucesso', 'Enviado com Sucesso'),
        ('erro',    'Erro no Envio'),
    ]

    empresa           = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='manifestacoes')
    usuario           = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True)
    chave_acesso      = models.CharField(max_length=44)
    tipo_manifestacao = models.CharField(max_length=20, choices=TIPO_CHOICES)
    justificativa     = models.TextField(blank=True, default='')
    status_envio      = models.CharField(max_length=10, choices=STATUS_CHOICES)
    resposta_sefaz    = models.TextField(blank=True, default='')
    data_manifestacao = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = 'Manifestação de NF-e'
        verbose_name_plural = 'Manifestações de NF-e'
        unique_together = ('empresa', 'chave_acesso')
        ordering = ['-data_manifestacao']

    def __str__(self):
        return f"{self.get_tipo_manifestacao_display()} — {self.chave_acesso[:10]}..."


# ==========================================
# PDV — PONTO DE VENDA / FRENTE DE CAIXA
# Fase 4
# ==========================================

class PedidoVendaPDV(models.Model):
    STATUS_CHOICES = [
        ('finalizado', 'Finalizado'),
        ('cancelado',  'Cancelado'),
    ]

    empresa            = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='vendas_pdv')
    operador           = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='vendas_pdv')
    caixa              = models.ForeignKey('CaixaDiario', on_delete=models.PROTECT, related_name='vendas_pdv')
    forma_pagamento    = models.ForeignKey('FormaPagamento', on_delete=models.PROTECT)
    valor_total        = models.DecimalField(max_digits=15, decimal_places=2)
    valor_recebido     = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    troco              = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cpf_cnpj_cliente = models.CharField(max_length=18, blank=True, default='', verbose_name='CPF/CNPJ do Cliente')
    nome_cliente       = models.CharField(max_length=255, blank=True, default='')
    status             = models.CharField(max_length=15, choices=STATUS_CHOICES, default='finalizado')
    motivo_cancelamento = models.TextField(blank=True, default='')

    # NFC-e
    nfce_referencia    = models.CharField(max_length=50, blank=True, default='')
    nfce_chave         = models.CharField(max_length=44, blank=True, default='')
    nfce_status        = models.CharField(max_length=30, blank=True, default='')

    data_venda         = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Venda PDV'
        verbose_name_plural = 'Vendas PDV'
        ordering = ['-data_venda']

    def __str__(self):
        return f"PDV #{self.id} — R$ {self.valor_total} ({self.get_status_display()})"


class ItemPedidoPDV(models.Model):
    venda               = models.ForeignKey(PedidoVendaPDV, on_delete=models.CASCADE, related_name='itens')
    produto             = models.ForeignKey('Produto', on_delete=models.PROTECT)
    quantidade          = models.DecimalField(max_digits=15, decimal_places=2)
    preco_unitario      = models.DecimalField(max_digits=15, decimal_places=2)
    desconto_percentual = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    preco_final         = models.DecimalField(max_digits=15, decimal_places=2)
    subtotal            = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        verbose_name = 'Item Venda PDV'
        verbose_name_plural = 'Itens Venda PDV'

    def __str__(self):
        return f"{self.quantidade}x {self.produto.nome} — R$ {self.subtotal}"


# ==========================================
# ORÇAMENTO
# Fase 5 — separado de PedidoVenda
# Não baixa estoque. Pode ser convertido em pedido.
# ==========================================

class Orcamento(models.Model):
    STATUS_CHOICES = [
        ('aberto',    'Aberto'),
        ('enviado',   'Enviado ao Cliente'),
        ('aprovado',  'Aprovado pelo Cliente'),
        ('convertido','Convertido em Pedido'),
        ('recusado',  'Recusado pelo Cliente'),
        ('expirado',  'Expirado'),
    ]

    empresa           = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='orcamentos')
    cliente           = models.ForeignKey('Cliente', on_delete=models.PROTECT, related_name='orcamentos')
    vendedor          = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='orcamentos')
    status            = models.CharField(max_length=15, choices=STATUS_CHOICES, default='aberto')
    data_criacao      = models.DateTimeField(auto_now_add=True)
    data_validade     = models.DateField(null=True, blank=True, help_text='Data de validade do orçamento')
    valor_total       = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    observacoes       = models.TextField(blank=True, default='')
    # Pedido gerado a partir deste orçamento
    pedido_gerado     = models.OneToOneField(
        'PedidoVenda', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='orcamento_origem',
    )

    def atualizar_valor_total(self):
        total = sum(item.subtotal for item in self.itens.all()) or Decimal('0.00')
        self.valor_total = total
        Orcamento.objects.filter(pk=self.pk).update(valor_total=total)

    def __str__(self):
        return f"ORC #{self.id} — {self.cliente.nome_razao} ({self.get_status_display()})"

    class Meta:
        verbose_name = 'Orçamento'
        verbose_name_plural = 'Orçamentos'
        ordering = ['-data_criacao']


class ItemOrcamento(models.Model):
    orcamento       = models.ForeignKey(Orcamento, on_delete=models.CASCADE, related_name='itens')
    produto         = models.ForeignKey('Produto', on_delete=models.PROTECT)
    quantidade      = models.DecimalField(max_digits=15, decimal_places=2)
    preco_unitario  = models.DecimalField(max_digits=15, decimal_places=2)
    desconto_percentual = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))

    @property
    def preco_final(self):
        return self.preco_unitario * (1 - self.desconto_percentual / Decimal('100'))

    @property
    def subtotal(self):
        return self.quantidade * self.preco_final

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.orcamento.atualizar_valor_total()

    def delete(self, *args, **kwargs):
        orc = self.orcamento
        super().delete(*args, **kwargs)
        orc.atualizar_valor_total()

    def __str__(self):
        return f"{self.quantidade}x {self.produto.nome}"

    class Meta:
        verbose_name = 'Item de Orçamento'
        verbose_name_plural = 'Itens de Orçamento'


# ==========================================
# SOLICITAÇÃO DE COMPRA
# Fase 5 — qualquer nível cria, gerente/diretor aprova
# ==========================================

class SolicitacaoCompra(models.Model):
    STATUS_CHOICES = [
        ('pendente',  'Pendente de Aprovação'),
        ('aprovada',  'Aprovada'),
        ('recusada',  'Recusada'),
        ('atendida',  'Atendida (PC gerado)'),
    ]

    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='solicitacoes_compra')
    solicitante     = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='solicitacoes_compra')
    aprovador       = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='solicitacoes_aprovadas',
    )
    produto         = models.ForeignKey('Produto', on_delete=models.PROTECT)
    quantidade      = models.DecimalField(max_digits=15, decimal_places=2)
    justificativa   = models.TextField(blank=True, default='')
    status          = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pendente')
    data_solicitacao = models.DateTimeField(auto_now_add=True)
    data_decisao    = models.DateTimeField(null=True, blank=True)
    observacao_aprovador = models.TextField(blank=True, default='')
    # Pedido de compra gerado ao atender
    pedido_compra_gerado = models.ForeignKey(
        PedidoCompra, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='solicitacoes_origem',
    )

    def __str__(self):
        return f"SC #{self.id} — {self.produto.nome} x{self.quantidade} ({self.get_status_display()})"

    class Meta:
        verbose_name = 'Solicitação de Compra'
        verbose_name_plural = 'Solicitações de Compra'
        ordering = ['-data_solicitacao']


# ==========================================
# COTAÇÃO DE FORNECEDORES
# Fase 5 — comparativo de preços
# ==========================================

class CotacaoCompra(models.Model):
    STATUS_CHOICES = [
        ('aberta',    'Aberta'),
        ('encerrada', 'Encerrada'),
        ('cancelada', 'Cancelada'),
    ]

    empresa        = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='cotacoes')
    responsavel    = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='cotacoes')
    titulo         = models.CharField(max_length=255)
    status         = models.CharField(max_length=10, choices=STATUS_CHOICES, default='aberta')
    data_criacao   = models.DateTimeField(auto_now_add=True)
    data_encerramento = models.DateField(null=True, blank=True)
    observacoes    = models.TextField(blank=True, default='')

    def __str__(self):
        return f"COT #{self.id} — {self.titulo} ({self.get_status_display()})"

    class Meta:
        verbose_name = 'Cotação de Compra'
        verbose_name_plural = 'Cotações de Compra'
        ordering = ['-data_criacao']


class ItemCotacao(models.Model):
    """Produto que está sendo cotado."""
    cotacao    = models.ForeignKey(CotacaoCompra, on_delete=models.CASCADE, related_name='itens')
    produto    = models.ForeignKey('Produto', on_delete=models.PROTECT)
    quantidade = models.DecimalField(max_digits=15, decimal_places=2)

    def __str__(self):
        return f"{self.produto.nome} x{self.quantidade}"

    class Meta:
        verbose_name = 'Item de Cotação'
        unique_together = ('cotacao', 'produto')


class RespostaFornecedorCotacao(models.Model):
    """Preço informado por um fornecedor para um item da cotação."""
    cotacao    = models.ForeignKey(CotacaoCompra, on_delete=models.CASCADE, related_name='respostas')
    fornecedor = models.ForeignKey(Fornecedor, on_delete=models.CASCADE, related_name='respostas_cotacao')
    produto    = models.ForeignKey('Produto', on_delete=models.PROTECT)
    preco_unit = models.DecimalField(max_digits=15, decimal_places=2)
    prazo_dias = models.PositiveIntegerField(default=0, help_text='Prazo de entrega em dias')
    observacao = models.TextField(blank=True, default='')
    vencedor   = models.BooleanField(default=False, help_text='Fornecedor selecionado para este item')

    @property
    def subtotal(self):
        item = self.cotacao.itens.filter(produto=self.produto).first()
        if item:
            return item.quantidade * self.preco_unit
        return Decimal('0.00')

    def __str__(self):
        return f"{self.fornecedor.nome_razao} — {self.produto.nome}: R$ {self.preco_unit}"

    class Meta:
        verbose_name = 'Resposta de Fornecedor'
        verbose_name_plural = 'Respostas de Fornecedores'
        unique_together = ('cotacao', 'fornecedor', 'produto')


# ==========================================
# AVALIAÇÃO DE FORNECEDOR
# Fase 5 — registrada a cada recebimento de NF
# ==========================================

class AvaliacaoFornecedor(models.Model):
    NOTA_CHOICES = [(i, str(i)) for i in range(1, 6)]  # 1 a 5

    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='avaliacoes_fornecedor')
    fornecedor      = models.ForeignKey(Fornecedor, on_delete=models.CASCADE, related_name='avaliacoes')
    avaliador       = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True)
    pedido_compra   = models.ForeignKey(
        PedidoCompra, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='avaliacoes',
    )
    nota_preco      = models.IntegerField(choices=NOTA_CHOICES, help_text='1=Ruim, 5=Excelente')
    nota_prazo      = models.IntegerField(choices=NOTA_CHOICES)
    nota_qualidade  = models.IntegerField(choices=NOTA_CHOICES)
    observacao      = models.TextField(blank=True, default='')
    data_avaliacao  = models.DateTimeField(auto_now_add=True)

    @property
    def nota_media(self):
        return round((self.nota_preco + self.nota_prazo + self.nota_qualidade) / 3, 1)

    def __str__(self):
        return f"Avaliação {self.fornecedor.nome_razao} — {self.nota_media}/5"

    class Meta:
        verbose_name = 'Avaliação de Fornecedor'
        verbose_name_plural = 'Avaliações de Fornecedores'
        ordering = ['-data_avaliacao']


# ==========================================
# INVENTÁRIO FÍSICO
# Fase 5 — contagem e ajuste automático
# ==========================================

class InventarioFisico(models.Model):
    STATUS_CHOICES = [
        ('em_andamento', 'Em Andamento'),
        ('concluido',    'Concluído'),
        ('cancelado',    'Cancelado'),
    ]

    empresa        = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='inventarios')
    responsavel    = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='inventarios')
    status         = models.CharField(max_length=15, choices=STATUS_CHOICES, default='em_andamento')
    data_inicio    = models.DateTimeField(auto_now_add=True)
    data_conclusao = models.DateTimeField(null=True, blank=True)
    observacoes    = models.TextField(blank=True, default='')

    def __str__(self):
        return f"INV #{self.id} — {self.data_inicio.strftime('%d/%m/%Y')} ({self.get_status_display()})"

    class Meta:
        verbose_name = 'Inventário Físico'
        verbose_name_plural = 'Inventários Físicos'
        ordering = ['-data_inicio']


class ItemInventario(models.Model):
    inventario          = models.ForeignKey(InventarioFisico, on_delete=models.CASCADE, related_name='itens')
    produto             = models.ForeignKey('Produto', on_delete=models.PROTECT)
    quantidade_sistema  = models.DecimalField(max_digits=15, decimal_places=2, help_text='Saldo no sistema antes da contagem')
    quantidade_contada  = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    ajuste_aplicado     = models.BooleanField(default=False)

    @property
    def diferenca(self):
        if self.quantidade_contada is None:
            return None
        return self.quantidade_contada - self.quantidade_sistema

    def aplicar_ajuste(self, usuario):
        """
        Aplica a diferença ao estoque do produto e registra movimentação.
        Só pode ser chamado uma vez (ajuste_aplicado=False).
        """
        if self.ajuste_aplicado or self.quantidade_contada is None:
            return False, 'Ajuste já aplicado ou contagem não informada.'
        dif = self.diferenca
        if dif == Decimal('0.00'):
            self.ajuste_aplicado = True
            self.save(update_fields=['ajuste_aplicado'])
            return True, 'Sem diferença — nenhum ajuste necessário.'
        from django.db import transaction as db_transaction
        with db_transaction.atomic():
            self.produto.quantidade += dif
            self.produto.save(update_fields=['quantidade'])
            MovimentacaoEstoque.objects.create(
                produto=self.produto,
                operador=usuario,
                tipo='ajuste',
                quantidade=dif,
                saldo_apos_movimento=self.produto.quantidade,
                origem=f"Inventário Físico #{self.inventario.id}",
            )
            self.ajuste_aplicado = True
            self.save(update_fields=['ajuste_aplicado'])
        return True, f'Ajuste de {dif:+.2f} aplicado ao produto "{self.produto.nome}".'

    def __str__(self):
        return f"{self.produto.nome} — sistema: {self.quantidade_sistema} | contado: {self.quantidade_contada}"

    class Meta:
        verbose_name = 'Item de Inventário'
        verbose_name_plural = 'Itens de Inventário'
        unique_together = ('inventario', 'produto')


# ══════════════════════════════════════════════════════════════════════════════
# FASE 6 — FINANCEIRO AVANÇADO
# ══════════════════════════════════════════════════════════════════════════════

class CentroCusto(models.Model):
    empresa     = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='centros_custo')
    nome        = models.CharField(max_length=100)
    descricao   = models.TextField(blank=True, default='')
    ativo       = models.BooleanField(default=True)

    def __str__(self):
        return self.nome

    class Meta:
        verbose_name = 'Centro de Custo'
        verbose_name_plural = 'Centros de Custo'
        unique_together = ('empresa', 'nome')


class LancamentoRecorrente(models.Model):
    """Modelo para despesas/receitas que se repetem mensalmente."""
    TIPO_CHOICES = [('receita', 'Receita'), ('despesa', 'Despesa')]

    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='lancamentos_recorrentes')
    tipo            = models.CharField(max_length=10, choices=TIPO_CHOICES)
    descricao       = models.CharField(max_length=255)
    valor           = models.DecimalField(max_digits=15, decimal_places=2)
    dia_vencimento  = models.PositiveIntegerField(help_text='Dia do mês para geração (1-28)')
    centro_custo    = models.ForeignKey(CentroCusto, on_delete=models.SET_NULL, null=True, blank=True)
    ativo           = models.BooleanField(default=True)
    data_inicio     = models.DateField()
    data_fim        = models.DateField(null=True, blank=True, help_text='Deixe em branco para recorrência indefinida')
    responsavel     = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='lancamentos_recorrentes')

    def __str__(self):
        return f"[{self.get_tipo_display()}] {self.descricao} — R$ {self.valor}/mês"

    class Meta:
        verbose_name = 'Lançamento Recorrente'
        verbose_name_plural = 'Lançamentos Recorrentes'


class ConciliacaoBancaria(models.Model):
    """Arquivo OFX/CNAB importado pelo cliente para conciliação."""
    STATUS_CHOICES = [
        ('importado',    'Importado'),
        ('em_analise',   'Em Análise'),
        ('conciliado',   'Conciliado'),
    ]

    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='conciliacoes')
    responsavel     = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='conciliacoes')
    nome_arquivo    = models.CharField(max_length=255)
    data_importacao = models.DateTimeField(auto_now_add=True)
    data_inicio     = models.DateField()
    data_fim        = models.DateField()
    status          = models.CharField(max_length=15, choices=STATUS_CHOICES, default='importado')
    total_transacoes = models.PositiveIntegerField(default=0)
    total_conciliados = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Conciliação {self.nome_arquivo} ({self.data_inicio} → {self.data_fim})"

    class Meta:
        verbose_name = 'Conciliação Bancária'
        verbose_name_plural = 'Conciliações Bancárias'
        ordering = ['-data_importacao']


class TransacaoBancaria(models.Model):
    """Linha de extrato importado via OFX/CNAB."""
    TIPO_CHOICES = [('credito', 'Crédito'), ('debito', 'Débito')]
    STATUS_CHOICES = [
        ('pendente',    'Pendente de Conciliação'),
        ('conciliado',  'Conciliado'),
        ('ignorado',    'Ignorado'),
    ]

    conciliacao     = models.ForeignKey(ConciliacaoBancaria, on_delete=models.CASCADE, related_name='transacoes')
    data            = models.DateField()
    tipo            = models.CharField(max_length=7, choices=TIPO_CHOICES)
    valor           = models.DecimalField(max_digits=15, decimal_places=2)
    descricao       = models.CharField(max_length=255, blank=True, default='')
    id_banco        = models.CharField(max_length=100, blank=True, default='', help_text='ID da transação no banco')
    status          = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pendente')
    # Vínculo com conta identificada
    conta_pagar     = models.ForeignKey(ContaPagar, on_delete=models.SET_NULL, null=True, blank=True)
    conta_receber   = models.ForeignKey(ContaReceber, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.data} [{self.get_tipo_display()}] R$ {self.valor} — {self.descricao}"

    class Meta:
        verbose_name = 'Transação Bancária'
        verbose_name_plural = 'Transações Bancárias'
        ordering = ['data']


# ══════════════════════════════════════════════════════════════════════════════
# FASE 7 — RH
# ══════════════════════════════════════════════════════════════════════════════

class Colaborador(models.Model):
    CARGO_CHOICES = [
        ('vendedor', 'Vendedor'),
        ('gerente', 'Gerente'),
        ('administrativo', 'Administrativo'),
        ('operacional', 'Operacional'),
        ('motorista', 'Motorista'),
        ('outros', 'Outros'),
    ]
    STATUS_CHOICES = [('ativo', 'Ativo'), ('inativo', 'Inativo'), ('ferias', 'Em Férias'), ('afastado', 'Afastado')]

    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='colaboradores')
    usuario         = models.OneToOneField(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='colaborador')
    nome_completo   = models.CharField(max_length=255)
    cpf             = models.CharField(max_length=14)
    rg              = models.CharField(max_length=20, blank=True, default='')
    data_nascimento = models.DateField(null=True, blank=True)
    cargo           = models.CharField(max_length=20, choices=CARGO_CHOICES, default='outros')
    cargo_personalizado = models.CharField(max_length=100, blank=True, default='', help_text='Cargo fora das opções padrão')
    salario_base    = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    data_admissao   = models.DateField()
    data_demissao   = models.DateField(null=True, blank=True)
    status          = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ativo')
    email           = models.EmailField(blank=True, default='')
    telefone        = models.CharField(max_length=20, blank=True, default='')
    endereco        = models.TextField(blank=True, default='')
    observacoes     = models.TextField(blank=True, default='')

    def save(self, *args, **kwargs):
        # Sincroniza is_active do Usuario quando colaborador é inativado/reativado.
        if self.pk and self.usuario_id:
            try:
                original = Colaborador.objects.get(pk=self.pk)
                if original.status != self.status:
                    ativo = self.status == 'ativo'
                    Usuario.objects.filter(pk=self.usuario_id).update(is_active=ativo)
            except Colaborador.DoesNotExist:
                pass
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nome_completo} — {self.get_cargo_display()}"

    @property
    def tempo_empresa(self):
        from datetime import date
        fim = self.data_demissao or date.today()
        delta = fim - self.data_admissao
        anos = delta.days // 365
        meses = (delta.days % 365) // 30
        return f"{anos}a {meses}m"

    class Meta:
        verbose_name = 'Colaborador'
        verbose_name_plural = 'Colaboradores'
        ordering = ['nome_completo']


class RegistroPonto(models.Model):
    colaborador     = models.ForeignKey(Colaborador, on_delete=models.CASCADE, related_name='registros_ponto')
    data            = models.DateField()
    entrada         = models.TimeField(null=True, blank=True)
    saida_almoco    = models.TimeField(null=True, blank=True)
    retorno_almoco  = models.TimeField(null=True, blank=True)
    saida           = models.TimeField(null=True, blank=True)
    observacao      = models.CharField(max_length=255, blank=True, default='')

    @property
    def horas_trabalhadas(self):
        from datetime import datetime, timedelta
        if not self.entrada or not self.saida:
            return None
        e = datetime.combine(self.data, self.entrada)
        s = datetime.combine(self.data, self.saida)
        total = s - e
        if self.saida_almoco and self.retorno_almoco:
            sa = datetime.combine(self.data, self.saida_almoco)
            ra = datetime.combine(self.data, self.retorno_almoco)
            total -= (ra - sa)
        return total

    def __str__(self):
        return f"{self.colaborador.nome_completo} — {self.data}"

    class Meta:
        verbose_name = 'Registro de Ponto'
        verbose_name_plural = 'Registros de Ponto'
        unique_together = ('colaborador', 'data')
        ordering = ['-data']


class Ferias(models.Model):
    STATUS_CHOICES = [
        ('agendada',  'Agendada'),
        ('em_gozo',   'Em Gozo'),
        ('concluida', 'Concluída'),
        ('cancelada', 'Cancelada'),
    ]

    colaborador         = models.ForeignKey(Colaborador, on_delete=models.CASCADE, related_name='ferias')
    periodo_aquisitivo_inicio = models.DateField()
    periodo_aquisitivo_fim    = models.DateField()
    data_inicio_gozo    = models.DateField()
    data_fim_gozo       = models.DateField()
    dias_direito        = models.PositiveIntegerField(default=30)
    dias_gozados        = models.PositiveIntegerField(default=0)
    abono_pecuniario    = models.BooleanField(default=False, help_text='Venda de 10 dias de férias')
    status              = models.CharField(max_length=12, choices=STATUS_CHOICES, default='agendada')
    observacoes         = models.TextField(blank=True, default='')

    def __str__(self):
        return f"Férias {self.colaborador.nome_completo} — {self.data_inicio_gozo} a {self.data_fim_gozo}"

    class Meta:
        verbose_name = 'Férias'
        verbose_name_plural = 'Férias'
        ordering = ['-data_inicio_gozo']


class Afastamento(models.Model):
    MOTIVO_CHOICES = [
        ('atestado',    'Atestado Médico'),
        ('licenca',     'Licença'),
        ('acidente',    'Acidente de Trabalho'),
        ('maternidade', 'Licença Maternidade/Paternidade'),
        ('outros',      'Outros'),
    ]

    colaborador     = models.ForeignKey(Colaborador, on_delete=models.CASCADE, related_name='afastamentos')
    motivo          = models.CharField(max_length=15, choices=MOTIVO_CHOICES)
    data_inicio     = models.DateField()
    data_fim        = models.DateField(null=True, blank=True)
    descricao       = models.TextField(blank=True, default='')
    cid             = models.CharField(max_length=10, blank=True, default='', help_text='CID do atestado, se aplicável')

    def __str__(self):
        return f"{self.get_motivo_display()} — {self.colaborador.nome_completo} ({self.data_inicio})"

    class Meta:
        verbose_name = 'Afastamento'
        verbose_name_plural = 'Afastamentos'
        ordering = ['-data_inicio']


class FolhaPagamento(models.Model):
    STATUS_CHOICES = [('aberta', 'Aberta'), ('fechada', 'Fechada'), ('paga', 'Paga')]

    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='folhas_pagamento')
    mes             = models.PositiveIntegerField()
    ano             = models.PositiveIntegerField()
    status          = models.CharField(max_length=8, choices=STATUS_CHOICES, default='aberta')
    total_bruto     = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_descontos = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_liquido   = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    responsavel     = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='folhas_pagamento')
    data_fechamento = models.DateTimeField(null=True, blank=True)
    observacoes     = models.TextField(blank=True, default='')

    def __str__(self):
        return f"Folha {self.mes:02d}/{self.ano} — {self.get_status_display()}"

    class Meta:
        verbose_name = 'Folha de Pagamento'
        verbose_name_plural = 'Folhas de Pagamento'
        unique_together = ('empresa', 'mes', 'ano')
        ordering = ['-ano', '-mes']


class ItemFolhaPagamento(models.Model):
    folha           = models.ForeignKey(FolhaPagamento, on_delete=models.CASCADE, related_name='itens')
    colaborador     = models.ForeignKey(Colaborador, on_delete=models.PROTECT)
    salario_base    = models.DecimalField(max_digits=12, decimal_places=2)
    horas_extras    = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    valor_horas_extras = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    comissoes       = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    outros_acrescimos = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    inss            = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    irrf            = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    outros_descontos = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    observacao      = models.TextField(blank=True, default='')

    @property
    def total_bruto(self):
        return self.salario_base + self.valor_horas_extras + self.comissoes + self.outros_acrescimos

    @property
    def total_descontos(self):
        return self.inss + self.irrf + self.outros_descontos

    @property
    def salario_liquido(self):
        return self.total_bruto - self.total_descontos

    def __str__(self):
        return f"{self.colaborador.nome_completo} — Folha {self.folha}"

    class Meta:
        verbose_name = 'Item de Folha'
        verbose_name_plural = 'Itens de Folha'
        unique_together = ('folha', 'colaborador')


# ══════════════════════════════════════════════════════════════════════════════
# FASE 6 — CONFIGURAÇÃO FINANCEIRA (boletos Asaas)
# ══════════════════════════════════════════════════════════════════════════════

class ConfiguracaoFinanceira(models.Model):
    empresa         = models.OneToOneField(Empresa, on_delete=models.CASCADE, related_name='configuracao_financeira')
    asaas_api_key   = models.CharField(max_length=255, blank=True, default='', help_text='Chave de API Asaas para geração de boletos')
    asaas_sandbox   = models.BooleanField(default=True, help_text='Ambiente sandbox (testes). Desmarque para produção.')

    def __str__(self):
        return f'Config Financeira — {self.empresa.nome}'

    class Meta:
        verbose_name = 'Configuração Financeira'
        verbose_name_plural = 'Configurações Financeiras'


# ══════════════════════════════════════════════════════════════════════════════
# FISCAL COMPLEMENTAR — Certificado Digital e Inutilização de NF
# ══════════════════════════════════════════════════════════════════════════════

class CertificadoDigital(models.Model):
    """
    Metadados do certificado digital da empresa.
    O arquivo .pfx em si fica no Focus NFe — nunca no banco.
    """
    TIPO_CHOICES = [
        ('a1', 'A1 (arquivo .pfx)'),
        ('a3', 'A3 (token/cartão)'),
    ]

    empresa          = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='certificados')
    tipo             = models.CharField(max_length=2, choices=TIPO_CHOICES, default='a1')
    cn               = models.CharField(max_length=255, blank=True, help_text='Nome no certificado (CN)')
    cnpj             = models.CharField(max_length=18, blank=True)
    data_validade    = models.DateField(null=True, blank=True)
    data_upload      = models.DateTimeField(auto_now_add=True)
    ativo            = models.BooleanField(default=True)
    enviado_focusnfe = models.BooleanField(default=False, help_text='True se já foi enviado ao Focus NFe')

    def __str__(self):
        return f"Cert {self.tipo.upper()} — {self.empresa.nome} (vence: {self.data_validade})"

    class Meta:
        verbose_name = 'Certificado Digital'
        verbose_name_plural = 'Certificados Digitais'
        ordering = ['-data_upload']


class InutilizacaoNF(models.Model):
    """
    Registro de inutilização de faixa de numeração de NF-e na SEFAZ.
    Imutável após criação — segue a regra de logs do sistema.
    """
    STATUS_CHOICES = [
        ('pendente',   'Pendente'),
        ('autorizado', 'Autorizado pela SEFAZ'),
        ('erro',       'Erro'),
    ]

    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='inutilizacoes_nf')
    usuario         = models.ForeignKey('Usuario', on_delete=models.SET_NULL, null=True)
    serie           = models.CharField(max_length=3)
    numero_inicial  = models.IntegerField()
    numero_final    = models.IntegerField()
    justificativa   = models.CharField(max_length=255)
    status          = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pendente')
    protocolo_sefaz = models.CharField(max_length=100, blank=True)
    resposta_sefaz  = models.TextField(blank=True)
    data_solicitacao = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Inutilização série {self.serie} nº {self.numero_inicial}–{self.numero_final} ({self.get_status_display()})"

    class Meta:
        verbose_name = 'Inutilização de NF'
        verbose_name_plural = 'Inutilizações de NF'
        ordering = ['-data_solicitacao']


# ══════════════════════════════════════════════════════
# TABELA DE PREÇOS
# ══════════════════════════════════════════════════════

class TabelaPreco(models.Model):
    CANAL_CHOICES = [
        ('todos',     'Todos'),
        ('balcao',    'Balcão'),
        ('campo',     'Campo / Externo'),
        ('ecommerce', 'E-commerce'),
    ]
    empresa      = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='tabelas_preco')
    nome         = models.CharField(max_length=100)
    canal_venda  = models.CharField(max_length=20, choices=CANAL_CHOICES, default='todos')
    grupo_cliente = models.ForeignKey(GrupoCliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='tabelas_preco')
    cliente      = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='tabelas_preco')
    regiao       = models.CharField(max_length=100, blank=True, null=True)
    data_inicio  = models.DateField(null=True, blank=True)
    data_fim     = models.DateField(null=True, blank=True)
    ativa        = models.BooleanField(default=True)
    criado_em    = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nome} ({self.empresa.nome})"

    class Meta:
        verbose_name = 'Tabela de Preço'
        verbose_name_plural = 'Tabelas de Preço'
        ordering = ['nome']


class ItemTabelaPreco(models.Model):
    tabela   = models.ForeignKey(TabelaPreco, on_delete=models.CASCADE, related_name='itens')
    produto  = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name='itens_tabela_preco')
    preco    = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.produto.nome} — {self.preco} ({self.tabela.nome})"

    class Meta:
        verbose_name = 'Item de Tabela de Preço'
        verbose_name_plural = 'Itens de Tabela de Preço'
        unique_together = ('tabela', 'produto')


# ══════════════════════════════════════════════════════
# VEÍCULOS E EQUIPAMENTOS
# ══════════════════════════════════════════════════════

class Veiculo(models.Model):
    TIPO_CHOICES = [
        ('caminhao', 'Caminhão'),
        ('van', 'Van / VUC'),
        ('pickup', 'Pickup'),
        ('trator', 'Trator'),
        ('outro', 'Outro'),
    ]
    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='veiculos')
    tipo            = models.CharField(max_length=15, choices=TIPO_CHOICES, default='veiculo')
    descricao       = models.CharField(max_length=255)
    placa           = models.CharField(max_length=10, blank=True, null=True)
    numero_serie    = models.CharField(max_length=100, blank=True, null=True, verbose_name='Número de Série')
    marca           = models.CharField(max_length=100, blank=True, null=True)
    modelo          = models.CharField(max_length=100, blank=True, null=True)
    ano             = models.PositiveIntegerField(null=True, blank=True)
    crlv            = models.FileField(upload_to='crlv/', blank=True, null=True, verbose_name='CRLV')
    vencimento_doc  = models.DateField(null=True, blank=True, verbose_name='Vencimento da Documentação')
    ativo           = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.descricao} ({self.placa or self.numero_serie or '—'})"

    class Meta:
        verbose_name = 'Veículo / Equipamento'
        verbose_name_plural = 'Veículos / Equipamentos'


# ══════════════════════════════════════════════════════
# FAZENDAS, GLEBAS E TALHÕES
# ══════════════════════════════════════════════════════

class Fazenda(models.Model):
    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='fazendas')
    cliente         = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='fazendas', verbose_name='Produtor / Proprietário')
    nome            = models.CharField(max_length=255)
    municipio       = models.CharField(max_length=100, blank=True, null=True)
    uf              = models.CharField(max_length=2, blank=True, null=True)
    area_total_ha   = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Área Total (ha)')
    coordenadas     = models.CharField(max_length=255, blank=True, null=True, verbose_name='Georreferenciamento')
    car             = models.CharField(max_length=100, blank=True, null=True, verbose_name='CAR (Cadastro Ambiental Rural)')
    ativa           = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nome} — {self.municipio}/{self.uf}"

    class Meta:
        verbose_name = 'Fazenda'
        verbose_name_plural = 'Fazendas'


class Gleba(models.Model):
    fazenda     = models.ForeignKey(Fazenda, on_delete=models.CASCADE, related_name='glebas')
    nome        = models.CharField(max_length=100)
    area_ha     = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Área (ha)')
    coordenadas = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.fazenda.nome} — Gleba {self.nome}"

    class Meta:
        verbose_name = 'Gleba'
        verbose_name_plural = 'Glebas'


class Talhao(models.Model):
    gleba       = models.ForeignKey(Gleba, on_delete=models.CASCADE, related_name='talhoes')
    nome        = models.CharField(max_length=100)
    area_ha     = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Área (ha)')
    cultura     = models.CharField(max_length=100, blank=True, null=True, verbose_name='Cultura Plantada')
    coordenadas = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.gleba.fazenda.nome} / {self.gleba.nome} / Talhão {self.nome}"

    class Meta:
        verbose_name = 'Talhão'
        verbose_name_plural = 'Talhões'


# ══════════════════════════════════════════════════════
# DEVOLUÇÕES DE VENDA
# ══════════════════════════════════════════════════════

class DevolucaoVenda(models.Model):
    MOTIVO_CHOICES = [
        ('qualidade',    'Problema de Qualidade'),
        ('quantidade',   'Quantidade Incorreta'),
        ('avaria',       'Produto Avariado'),
        ('prazo',        'Fora do Prazo'),
        ('outros',       'Outros'),
    ]
    STATUS_CHOICES = [
        ('aberta',     'Aberta'),
        ('aprovada',   'Aprovada'),
        ('concluida',  'Concluída'),
        ('cancelada',  'Cancelada'),
    ]
    DESTINO_CREDITO_CHOICES = [
        ('abatimento', 'Abatimento em Próxima Compra'),
        ('dinheiro',   'Devolução em Dinheiro / PIX'),
        ('estorno',    'Estorno no Cartão'),
    ]

    empresa         = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='devolucoes')
    pedido_original = models.ForeignKey(PedidoVenda, on_delete=models.PROTECT, related_name='devolucoes')
    usuario         = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='devolucoes_abertas')
    motivo          = models.CharField(max_length=20, choices=MOTIVO_CHOICES, default='outros')
    status          = models.CharField(max_length=15, choices=STATUS_CHOICES, default='aberta')
    destino_credito = models.CharField(max_length=15, choices=DESTINO_CREDITO_CHOICES, default='abatimento')
    observacao      = models.TextField(blank=True, null=True)
    nfe_devolucao   = models.CharField(max_length=50, blank=True, null=True, verbose_name='Ref. NF-e de Devolução')
    criado_em       = models.DateTimeField(auto_now_add=True)
    concluido_em    = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Devolução #{self.pk} — Pedido #{self.pedido_original_id}"

    class Meta:
        verbose_name = 'Devolução de Venda'
        verbose_name_plural = 'Devoluções de Venda'
        ordering = ['-criado_em']


class ItemDevolucaoVenda(models.Model):
    DESTINO_ESTOQUE_CHOICES = [
        ('reposicao', 'Retorna ao Estoque'),
        ('descarte',  'Descarte'),
    ]

    devolucao       = models.ForeignKey(DevolucaoVenda, on_delete=models.CASCADE, related_name='itens')
    produto         = models.ForeignKey(Produto, on_delete=models.PROTECT)
    lote            = models.ForeignKey(LoteEstoque, on_delete=models.SET_NULL, null=True, blank=True)
    quantidade      = models.DecimalField(max_digits=10, decimal_places=2)
    destino_estoque = models.CharField(max_length=15, choices=DESTINO_ESTOQUE_CHOICES, default='reposicao')
    justificativa_descarte = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.produto.nome} x{self.quantidade} ({self.get_destino_estoque_display()})"

    class Meta:
        verbose_name = 'Item de Devolução'
        verbose_name_plural = 'Itens de Devolução'


# ══════════════════════════════════════════════════════
# BANCOS
# ══════════════════════════════════════════════════════

class Banco(models.Model):
    TIPO_CONTA_CHOICES = [
        ('corrente',    'Conta Corrente'),
        ('poupanca',    'Poupança'),
        ('investimento','Investimento'),
    ]

    empresa       = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='bancos')
    nome          = models.CharField(max_length=100, verbose_name='Nome do Banco')
    agencia       = models.CharField(max_length=10, blank=True, default='')
    conta         = models.CharField(max_length=20, blank=True, default='')
    tipo_conta    = models.CharField(max_length=20, choices=TIPO_CONTA_CHOICES, default='corrente')
    saldo_inicial = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    ativo         = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nome} — Ag {self.agencia} / CC {self.conta}"

    class Meta:
        verbose_name = 'Banco'
        verbose_name_plural = 'Bancos'
        ordering = ['nome']



# ══════════════════════════════════════════════════════
# COBRANÇA E CRÉDITO RURAL
# ══════════════════════════════════════════════════════

class ConfiguracaoCreditoCobranca(models.Model):
    empresa = models.OneToOneField(Empresa, on_delete=models.CASCADE, related_name='config_credito')
    # Bloqueio automático (0 = desativado)
    dias_atraso_bloqueio = models.IntegerField(default=0)
    # Alçadas de aprovação de limite
    limite_alcada_gerente = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('10000.00'))
    limite_alcada_diretor = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('100000.00'))
    # Pesos do score (devem somar 100)
    peso_historico_pagamento = models.IntegerField(default=40)
    peso_tempo_relacionamento = models.IntegerField(default=20)
    peso_volume_compras = models.IntegerField(default=20)
    peso_dados_cadastrais = models.IntegerField(default=20)
    # Alerta de concentração de carteira (%)
    pct_concentracao_alerta = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('20.00'))
    # PDD por faixa (%)
    pdd_1_30_dias     = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    pdd_31_60_dias    = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('10.00'))
    pdd_61_90_dias    = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('30.00'))
    pdd_91_180_dias   = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('50.00'))
    pdd_acima_180_dias = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('100.00'))

    class Meta:
        verbose_name = 'Configuração Crédito e Cobrança'


class FichaAnaliseCredito(models.Model):
    STATUS_CHOICES = [
        ('em_analise', 'Em Análise'),
        ('aprovado',   'Aprovado'),
        ('recusado',   'Recusado'),
        ('em_revisao', 'Em Revisão'),
    ]
    empresa             = models.ForeignKey(Empresa,  on_delete=models.CASCADE, related_name='fichas_credito')
    cliente             = models.ForeignKey(Cliente,  on_delete=models.CASCADE, related_name='fichas_credito')
    analista            = models.ForeignKey(Usuario,  on_delete=models.SET_NULL, null=True, related_name='fichas_criadas')
    aprovado_por        = models.ForeignKey(Usuario,  on_delete=models.SET_NULL, null=True, blank=True, related_name='fichas_aprovadas')
    # Dados agropecuários
    area_plantada_ha        = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cultura_principal       = models.CharField(max_length=100, blank=True)
    produtividade_historica = models.CharField(max_length=255, blank=True)
    renda_estimada_anual    = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    endividamento_declarado = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    garantias               = models.TextField(blank=True)
    # Limite
    limite_solicitado = models.DecimalField(max_digits=15, decimal_places=2)
    limite_aprovado   = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    # Status e datas
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='em_analise')
    data_aprovacao  = models.DateTimeField(null=True, blank=True)
    proxima_revisao = models.DateField(null=True, blank=True)
    observacoes     = models.TextField(blank=True)
    criado_em       = models.DateTimeField(auto_now_add=True)
    atualizado_em   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ficha de Análise de Crédito'
        ordering = ['-criado_em']


class ScoreCredito(models.Model):
    empresa                    = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='scores_credito')
    cliente                    = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='scores_credito')
    score_total                = models.DecimalField(max_digits=5, decimal_places=2)
    score_historico_pagamento  = models.DecimalField(max_digits=5, decimal_places=2)
    score_tempo_relacionamento = models.DecimalField(max_digits=5, decimal_places=2)
    score_volume_compras       = models.DecimalField(max_digits=5, decimal_places=2)
    score_dados_cadastrais     = models.DecimalField(max_digits=5, decimal_places=2)
    classificacao              = models.CharField(max_length=2)  # A, B, C, D, E
    calculado_em               = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Score de Crédito'
        unique_together = ('empresa', 'cliente')


class TentativaCobranca(models.Model):
    TIPO_CHOICES = [
        ('ligacao',  'Ligação Telefônica'),
        ('whatsapp', 'WhatsApp'),
        ('email',    'E-mail'),
        ('visita',   'Visita Presencial'),
        ('carta',    'Carta/Notificação'),
    ]
    RESULTADO_CHOICES = [
        ('contato_realizado',   'Contato Realizado'),
        ('sem_resposta',        'Sem Resposta'),
        ('promessa_pagamento',  'Promessa de Pagamento'),
        ('pagamento_efetuado',  'Pagamento Efetuado'),
        ('recusou_pagar',       'Recusou Pagar'),
        ('numero_invalido',     'Número Inválido'),
    ]
    empresa        = models.ForeignKey(Empresa,      on_delete=models.CASCADE, related_name='tentativas_cobranca')
    cliente        = models.ForeignKey(Cliente,      on_delete=models.CASCADE, related_name='tentativas_cobranca')
    conta_receber  = models.ForeignKey('ContaReceber', on_delete=models.SET_NULL, null=True, blank=True, related_name='tentativas_cobranca')
    usuario        = models.ForeignKey(Usuario,      on_delete=models.SET_NULL, null=True, related_name='tentativas_cobranca')
    tipo_contato   = models.CharField(max_length=20, choices=TIPO_CHOICES)
    resultado      = models.CharField(max_length=30, choices=RESULTADO_CHOICES)
    observacao     = models.TextField(blank=True)
    proxima_acao       = models.CharField(max_length=255, blank=True)
    proxima_acao_data  = models.DateField(null=True, blank=True)
    criado_em      = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Tentativa de Cobrança'
        ordering = ['-criado_em']


class TituloEmDisputa(models.Model):
    STATUS_CHOICES = [
        ('em_disputa',            'Em Disputa'),
        ('resolvido_pago',        'Resolvido — Pago'),
        ('resolvido_cancelado',   'Resolvido — Cancelado'),
        ('encaminhado_juridico',  'Encaminhado ao Jurídico'),
    ]
    empresa       = models.ForeignKey(Empresa,      on_delete=models.CASCADE, related_name='titulos_disputa')
    conta_receber = models.ForeignKey('ContaReceber', on_delete=models.CASCADE, related_name='titulos_disputa')
    usuario       = models.ForeignKey(Usuario,      on_delete=models.SET_NULL, null=True, related_name='titulos_disputa')
    motivo        = models.TextField()
    status        = models.CharField(max_length=30, choices=STATUS_CHOICES, default='em_disputa')
    documentos_gerados = models.BooleanField(default=False)
    criado_em     = models.DateTimeField(auto_now_add=True)
    resolvido_em  = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Título em Disputa'
        ordering = ['-criado_em']


class AcordoJudicial(models.Model):
    STATUS_CHOICES = [
        ('ativo',       'Ativo'),
        ('cumprido',    'Cumprido'),
        ('inadimplido', 'Inadimplido'),
        ('cancelado',   'Cancelado'),
    ]
    empresa         = models.ForeignKey(Empresa,           on_delete=models.CASCADE, related_name='acordos_judiciais')
    cliente         = models.ForeignKey(Cliente,           on_delete=models.CASCADE, related_name='acordos_judiciais')
    titulo_disputa  = models.ForeignKey(TituloEmDisputa,   on_delete=models.SET_NULL, null=True, blank=True, related_name='acordos')
    valor_total     = models.DecimalField(max_digits=15, decimal_places=2)
    numero_parcelas = models.IntegerField()
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ativo')
    observacoes     = models.TextField(blank=True)
    criado_em       = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Acordo Judicial'
        ordering = ['-criado_em']


class ParcelaAcordoJudicial(models.Model):
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('paga',     'Paga'),
        ('atrasada', 'Atrasada'),
    ]
    acordo          = models.ForeignKey(AcordoJudicial, on_delete=models.CASCADE, related_name='parcelas')
    numero          = models.IntegerField()
    valor           = models.DecimalField(max_digits=15, decimal_places=2)
    data_vencimento = models.DateField()
    data_pagamento  = models.DateField(null=True, blank=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')

    class Meta:
        verbose_name = 'Parcela de Acordo Judicial'
        ordering = ['numero']


class HistoricoInadimplencia(models.Model):
    empresa           = models.ForeignKey('Empresa', on_delete=models.CASCADE, related_name='historico_inadimplencia')
    mes               = models.IntegerField()
    ano               = models.IntegerField()
    indice_pct        = models.DecimalField(max_digits=6, decimal_places=2)
    total_carteira    = models.DecimalField(max_digits=15, decimal_places=2)
    total_vencido     = models.DecimalField(max_digits=15, decimal_places=2)
    pdd_total         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    registrado_em     = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Histórico de Inadimplência'
        unique_together = [('empresa', 'mes', 'ano')]
        ordering = ['-ano', '-mes']


# ══════════════════════════════════════════════════════════════════════════════
# CONTRATOS AGRÍCOLAS — CPR, BARTER, TERMO
# ══════════════════════════════════════════════════════════════════════════════

FONTE_PRECO_CHOICES = [
    ('manual',  'Cotação Manual'),
    ('cbot',    'CBOT (Integração)'),
    ('esalq',   'ESALQ (Integração)'),
]


class CPR(models.Model):
    STATUS_CHOICES = [
        ('aberta',                'Aberta'),
        ('liquidada_fisica',      'Liquidada Fisicamente'),
        ('liquidada_financeira',  'Liquidada Financeiramente'),
        ('vencida',               'Vencida'),
        ('cancelada',             'Cancelada'),
    ]
    empresa             = models.ForeignKey('Empresa', on_delete=models.CASCADE, related_name='cprs')
    numero              = models.CharField(max_length=50)
    emitente            = models.ForeignKey('Cliente', on_delete=models.PROTECT, related_name='cprs_emitidas')
    produto             = models.ForeignKey('Produto', on_delete=models.PROTECT, related_name='cprs')
    quantidade_sacas    = models.DecimalField(max_digits=12, decimal_places=3)
    qualidade_minima    = models.TextField(blank=True)
    local_entrega       = models.CharField(max_length=255, blank=True)
    data_emissao        = models.DateField()
    data_vencimento     = models.DateField()
    valor_credito       = models.DecimalField(max_digits=15, decimal_places=2)
    garantias           = models.TextField(blank=True)
    status              = models.CharField(max_length=30, choices=STATUS_CHOICES, default='aberta')
    pedido_venda        = models.ForeignKey('PedidoVenda', null=True, blank=True, on_delete=models.SET_NULL, related_name='cprs')
    observacoes         = models.TextField(blank=True)
    # Liquidação financeira
    preco_mercado_manual = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    fonte_preco          = models.CharField(max_length=10, choices=FONTE_PRECO_CHOICES, default='manual')
    criado_em            = models.DateTimeField(auto_now_add=True)
    atualizado_em        = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'CPR'
        unique_together = [('empresa', 'numero')]
        ordering = ['-data_vencimento']


class EntregaCPR(models.Model):
    cpr                  = models.ForeignKey(CPR, on_delete=models.CASCADE, related_name='entregas')
    data_entrega         = models.DateField()
    quantidade_entregue  = models.DecimalField(max_digits=12, decimal_places=3)
    nota_fiscal_entrada  = models.CharField(max_length=100, blank=True)
    observacoes          = models.TextField(blank=True)
    criado_em            = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Entrega de CPR'
        ordering = ['data_entrega']


class ContratosBarter(models.Model):
    STATUS_CHOICES = [
        ('ativo',     'Ativo'),
        ('entregue',  'Entregue'),
        ('vencido',   'Vencido'),
        ('cancelado', 'Cancelado'),
    ]
    empresa                 = models.ForeignKey('Empresa', on_delete=models.CASCADE, related_name='contratos_barter')
    numero                  = models.CharField(max_length=50)
    produtor                = models.ForeignKey('Cliente', on_delete=models.PROTECT, related_name='contratos_barter')
    safra                   = models.CharField(max_length=20, blank=True, help_text='Ex: 2025/2026')
    produto_receber         = models.ForeignKey('Produto', on_delete=models.PROTECT, related_name='barters_receber')
    quantidade_sacas        = models.DecimalField(max_digits=12, decimal_places=3)
    preco_referencia_manual = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    fonte_preco_referencia  = models.CharField(max_length=10, choices=FONTE_PRECO_CHOICES, default='manual')
    data_contrato           = models.DateField()
    data_entrega_prevista   = models.DateField()
    valor_insumos           = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status                  = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ativo')
    observacoes             = models.TextField(blank=True)
    criado_em               = models.DateTimeField(auto_now_add=True)
    atualizado_em           = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Contrato Barter'
        unique_together = [('empresa', 'numero')]
        ordering = ['-data_entrega_prevista']

    def quantidade_equivalente(self):
        """Sacas equivalentes ao valor dos insumos pelo preço de referência."""
        if self.preco_referencia_manual and self.preco_referencia_manual > 0:
            return round(self.valor_insumos / self.preco_referencia_manual, 3)
        return None


class ItemBarter(models.Model):
    contrato        = models.ForeignKey(ContratosBarter, on_delete=models.CASCADE, related_name='itens')
    produto         = models.ForeignKey('Produto', on_delete=models.PROTECT, related_name='itens_barter')
    quantidade      = models.DecimalField(max_digits=12, decimal_places=3)
    preco_unitario  = models.DecimalField(max_digits=12, decimal_places=4)
    pedido_venda    = models.ForeignKey('PedidoVenda', null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        verbose_name = 'Item de Barter'

    @property
    def subtotal(self):
        return self.quantidade * self.preco_unitario


class EntregaBarter(models.Model):
    contrato                 = models.ForeignKey(ContratosBarter, on_delete=models.CASCADE, related_name='entregas')
    data_entrega             = models.DateField()
    quantidade_entregue      = models.DecimalField(max_digits=12, decimal_places=3)
    preco_entrega_manual     = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    fonte_preco_entrega      = models.CharField(max_length=10, choices=FONTE_PRECO_CHOICES, default='manual')
    ajuste_financeiro        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    nota_fiscal_entrada      = models.CharField(max_length=100, blank=True)
    observacoes              = models.TextField(blank=True)
    criado_em                = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Entrega de Barter'
        ordering = ['data_entrega']


class ContratoTermo(models.Model):
    TIPO_CHOICES = [
        ('compra', 'Compra Futura'),
        ('venda',  'Venda Futura'),
    ]
    STATUS_CHOICES = [
        ('aberto',    'Aberto'),
        ('entregue',  'Entregue'),
        ('cancelado', 'Cancelado'),
    ]
    empresa                   = models.ForeignKey('Empresa', on_delete=models.CASCADE, related_name='contratos_termo')
    numero                    = models.CharField(max_length=50)
    tipo                      = models.CharField(max_length=10, choices=TIPO_CHOICES)
    contraparte               = models.ForeignKey('Cliente', null=True, blank=True, on_delete=models.SET_NULL, related_name='contratos_termo')
    contraparte_nome          = models.CharField(max_length=255, blank=True)
    produto                   = models.ForeignKey('Produto', on_delete=models.PROTECT, related_name='contratos_termo')
    quantidade                = models.DecimalField(max_digits=12, decimal_places=3)
    preco_travado             = models.DecimalField(max_digits=12, decimal_places=4)
    data_contrato             = models.DateField()
    data_entrega              = models.DateField()
    safra                     = models.CharField(max_length=20, blank=True)
    status                    = models.CharField(max_length=20, choices=STATUS_CHOICES, default='aberto')
    observacoes               = models.TextField(blank=True)
    # Preço de mercado para comparação de exposição
    preco_mercado_manual      = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    fonte_preco_mercado       = models.CharField(max_length=10, choices=FONTE_PRECO_CHOICES, default='manual')
    criado_em                 = models.DateTimeField(auto_now_add=True)
    atualizado_em             = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Contrato a Termo'
        unique_together = [('empresa', 'numero')]
        ordering = ['data_entrega']

    @property
    def valor_total_travado(self):
        return self.quantidade * self.preco_travado

    def exposicao_mercado(self):
        if self.preco_mercado_manual:
            diff = self.preco_mercado_manual - self.preco_travado
            return float(diff * self.quantidade)
        return None


class EntregaTermo(models.Model):
    contrato             = models.ForeignKey(ContratoTermo, on_delete=models.CASCADE, related_name='entregas')
    data_entrega         = models.DateField()
    quantidade_entregue  = models.DecimalField(max_digits=12, decimal_places=3)
    preco_entrega        = models.DecimalField(max_digits=12, decimal_places=4)
    resultado_financeiro = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    nota_fiscal          = models.CharField(max_length=100, blank=True)
    observacoes          = models.TextField(blank=True)
    criado_em            = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Entrega a Termo'
        ordering = ['data_entrega']


# ══════════════════════════════════════════════════════════════════════════════
# RASTREABILIDADE AGRÍCOLA — Aplicação de Insumos por Talhão
# ══════════════════════════════════════════════════════════════════════════════

class AplicacaoInsumo(models.Model):
    """
    Registra a aplicação de insumos/defensivos em talhões específicos.
    Mantém rastreabilidade do lote utilizado por área, obrigatória para
    certificações e laudos agronômicos.
    """
    empresa        = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='aplicacoes_insumo')
    talhao         = models.ForeignKey(Talhao, on_delete=models.CASCADE, related_name='aplicacoes')
    produto        = models.ForeignKey(Produto, on_delete=models.PROTECT, related_name='aplicacoes_insumo')
    lote           = models.ForeignKey(LoteEstoque, on_delete=models.SET_NULL, null=True, blank=True, related_name='aplicacoes')
    quantidade     = models.DecimalField(max_digits=12, decimal_places=3, verbose_name='Quantidade aplicada')
    unidade_medida = models.CharField(max_length=10, blank=True, help_text='Unidade da aplicação (L/ha, kg/ha, etc.)')
    data_aplicacao = models.DateField(verbose_name='Data da aplicação')
    operador       = models.ForeignKey(
        'Usuario', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='aplicacoes_registradas', verbose_name='Operador responsável'
    )
    safra          = models.CharField(max_length=20, blank=True, verbose_name='Safra')
    cultura        = models.CharField(max_length=100, blank=True, verbose_name='Cultura aplicada')
    numero_receita_agronomica = models.CharField(max_length=50, blank=True, verbose_name='N° Receita Agronômica')
    crea_responsavel = models.CharField(max_length=30, blank=True, verbose_name='CREA do Responsável Técnico')
    observacoes    = models.TextField(blank=True)
    criado_em      = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Aplicação de Insumo'
        verbose_name_plural = 'Aplicações de Insumos'
        ordering = ['-data_aplicacao']

    def __str__(self):
        return f"{self.produto.nome} em {self.talhao.nome} — {self.data_aplicacao}"


# ══════════════════════════════════════════════════════════════════════════════
# PLANO DE CONTAS — Contabilidade Gerencial
# ══════════════════════════════════════════════════════════════════════════════

class GrupoContabil(models.Model):
    """Agrupador hierárquico de contas contábeis (ex: 1 Ativo, 1.1 Circulante)."""
    empresa = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, null=True, blank=True,
        related_name='grupos_contabeis',
        help_text='Null = grupo padrão do sistema compartilhado por todas as empresas.'
    )
    codigo  = models.CharField(max_length=20, verbose_name='Código')
    nome    = models.CharField(max_length=150, verbose_name='Nome')
    parent  = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='subgrupos', verbose_name='Grupo pai'
    )

    class Meta:
        verbose_name = 'Grupo Contábil'
        verbose_name_plural = 'Grupos Contábeis'
        ordering = ['codigo']

    def __str__(self):
        return f"{self.codigo} — {self.nome}"


class ContaContabil(models.Model):
    TIPO_CHOICES = [
        ('receita',   'Receita'),
        ('despesa',   'Despesa'),
        ('ativo',     'Ativo'),
        ('passivo',   'Passivo'),
        ('resultado', 'Resultado / Apuração'),
    ]
    CLASSE_CHOICES = [
        ('1', '1 - Ativo'),
        ('2', '2 - Passivo'),
        ('3', '3 - Patrimônio Líquido'),
        ('4', '4 - Receita'),
        ('5', '5 - Despesa'),
        ('6', '6 - Resultado'),
    ]

    empresa            = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, null=True, blank=True,
        related_name='contas_contabeis',
        help_text='Null = conta padrão do sistema.'
    )
    grupo              = models.ForeignKey(
        GrupoContabil, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='contas'
    )
    codigo             = models.CharField(max_length=20, verbose_name='Código')
    nome               = models.CharField(max_length=200, verbose_name='Nome da conta')
    tipo               = models.CharField(max_length=20, choices=TIPO_CHOICES)
    classe             = models.CharField(max_length=2, choices=CLASSE_CHOICES)
    aceita_lancamento  = models.BooleanField(default=True, verbose_name='Aceita lançamento direto')
    ativo              = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Conta Contábil'
        verbose_name_plural = 'Contas Contábeis'
        ordering = ['codigo']
        unique_together = [('empresa', 'codigo')]

    def __str__(self):
        return f"{self.codigo} — {self.nome}"


# ══════════════════════════════════════════════════════════════════════════════
# PRODUÇÃO E BENEFICIAMENTO — Exclusivo para tipo_negocio='industria'
# ══════════════════════════════════════════════════════════════════════════════

class OrdemProducao(models.Model):
    STATUS_CHOICES = [
        ('rascunho',    'Rascunho'),
        ('liberada',    'Liberada para Produção'),
        ('em_producao', 'Em Produção'),
        ('concluida',   'Concluída'),
        ('cancelada',   'Cancelada'),
    ]

    empresa              = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='ordens_producao')
    numero               = models.CharField(max_length=50, verbose_name='Número da OP')
    produto_final        = models.ForeignKey(
        Produto, on_delete=models.PROTECT, related_name='ordens_como_produto_final',
        verbose_name='Produto a produzir'
    )
    quantidade_planejada = models.DecimalField(max_digits=12, decimal_places=3, verbose_name='Quantidade planejada')
    quantidade_produzida = models.DecimalField(max_digits=12, decimal_places=3, default=0, verbose_name='Quantidade produzida')
    status               = models.CharField(max_length=20, choices=STATUS_CHOICES, default='rascunho')
    data_prevista        = models.DateField(verbose_name='Data prevista de conclusão')
    data_inicio          = models.DateTimeField(null=True, blank=True, verbose_name='Início efetivo')
    data_conclusao       = models.DateTimeField(null=True, blank=True, verbose_name='Conclusão efetiva')
    responsavel          = models.ForeignKey(
        'Usuario', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ordens_producao_responsavel'
    )
    centro_custo         = models.ForeignKey(
        'CentroCusto', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ordens_producao'
    )
    observacoes          = models.TextField(blank=True)
    criado_em            = models.DateTimeField(auto_now_add=True)
    atualizado_em        = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ordem de Produção'
        verbose_name_plural = 'Ordens de Produção'
        ordering = ['-criado_em']
        unique_together = [('empresa', 'numero')]

    def __str__(self):
        return f"OP {self.numero} — {self.produto_final.nome}"

    @property
    def percentual_conclusao(self):
        if self.quantidade_planejada > 0:
            return round(float(self.quantidade_produzida / self.quantidade_planejada * 100), 1)
        return 0.0


class ItemOrdemProducao(models.Model):
    """Insumos e matérias-primas necessários para a OP (ficha técnica de produção)."""
    ordem                = models.ForeignKey(OrdemProducao, on_delete=models.CASCADE, related_name='insumos')
    produto              = models.ForeignKey(Produto, on_delete=models.PROTECT, related_name='usado_em_ordens')
    lote                 = models.ForeignKey(
        LoteEstoque, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='consumido_em_ordens', verbose_name='Lote a consumir'
    )
    quantidade_planejada = models.DecimalField(max_digits=12, decimal_places=3)
    quantidade_consumida = models.DecimalField(max_digits=12, decimal_places=3, default=0)

    class Meta:
        verbose_name = 'Item da Ordem de Produção'
        verbose_name_plural = 'Itens da Ordem de Produção'

    def __str__(self):
        return f"{self.produto.nome} × {self.quantidade_planejada} (OP {self.ordem.numero})"


class BeneficiamentoLote(models.Model):
    """
    Processo de beneficiamento: transforma lotes de produto bruto em produto
    beneficiado/processado (ex: soja bruta → soja beneficiada, farelo, óleo).
    Exclusivo para indústrias.
    """
    STATUS_CHOICES = [
        ('pendente',    'Pendente'),
        ('em_andamento','Em Andamento'),
        ('concluido',   'Concluído'),
        ('cancelado',   'Cancelado'),
    ]

    empresa             = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='beneficiamentos')
    produto_entrada     = models.ForeignKey(
        Produto, on_delete=models.PROTECT, related_name='beneficiamentos_entrada',
        verbose_name='Produto bruto (entrada)'
    )
    lote_entrada        = models.ForeignKey(
        LoteEstoque, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='beneficiamentos_como_entrada', verbose_name='Lote de entrada'
    )
    quantidade_entrada  = models.DecimalField(max_digits=12, decimal_places=3, verbose_name='Quantidade de entrada')
    produto_saida       = models.ForeignKey(
        Produto, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='beneficiamentos_saida', verbose_name='Produto beneficiado (saída)'
    )
    quantidade_saida    = models.DecimalField(max_digits=12, decimal_places=3, default=0, verbose_name='Quantidade de saída')
    rendimento_percentual = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='Rendimento (%)')
    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    data_inicio         = models.DateField(verbose_name='Data de início')
    data_conclusao      = models.DateField(null=True, blank=True, verbose_name='Data de conclusão')
    operador            = models.ForeignKey(
        'Usuario', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='beneficiamentos_operados'
    )
    lote_saida_gerado   = models.ForeignKey(
        LoteEstoque, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='gerado_por_beneficiamento', verbose_name='Lote gerado'
    )
    observacoes         = models.TextField(blank=True)
    criado_em           = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Beneficiamento de Lote'
        verbose_name_plural = 'Beneficiamentos de Lotes'
        ordering = ['-criado_em']

    def __str__(self):
        return f"Benef. {self.produto_entrada.nome} → {self.produto_saida.nome if self.produto_saida else '?'} ({self.data_inicio})"

    def save(self, *args, **kwargs):
        if self.quantidade_entrada > 0 and self.quantidade_saida > 0:
            self.rendimento_percentual = (self.quantidade_saida / self.quantidade_entrada) * 100
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# PLANO DE CONTAS — Mapeamento e Lançamentos Contábeis Automáticos
# ══════════════════════════════════════════════════════════════════════════════

class MapaContabil(models.Model):
    """
    Vincula cada tipo de operação do ERP a um par de contas contábeis
    (débito/crédito). Configurado na implantação junto ao contador.
    Quando preenchido, operações geram LancamentoContabil automaticamente.
    """
    OPERACAO_CHOICES = [
        ('conta_pagar_paga',      'Pagamento de Conta a Pagar'),
        ('conta_receber_recebida','Recebimento de Conta a Receber'),
        ('venda_pdv',             'Venda PDV'),
        ('compra_estoque',        'Entrada de Estoque por Compra'),
        ('sangria_caixa',         'Sangria de Caixa'),
        ('suprimento_caixa',      'Suprimento de Caixa'),
    ]

    empresa        = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, null=True, blank=True,
        related_name='mapa_contabil',
        help_text='Null = mapeamento padrão do sistema.'
    )
    tipo_operacao  = models.CharField(max_length=30, choices=OPERACAO_CHOICES)
    conta_debito   = models.ForeignKey(
        ContaContabil, on_delete=models.PROTECT,
        related_name='mapa_debito', verbose_name='Conta de Débito'
    )
    conta_credito  = models.ForeignKey(
        ContaContabil, on_delete=models.PROTECT,
        related_name='mapa_credito', verbose_name='Conta de Crédito'
    )
    ativo          = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Mapa Contábil'
        verbose_name_plural = 'Mapa Contábil'
        unique_together = [('empresa', 'tipo_operacao')]

    def __str__(self):
        return f"{self.get_tipo_operacao_display()} → D:{self.conta_debito.codigo} / C:{self.conta_credito.codigo}"


class LancamentoContabil(models.Model):
    """
    Partida dobrada gerada automaticamente pelas operações do ERP
    após o Mapa Contábil estar configurado.
    Imutável — append only, nunca editar ou deletar.
    """
    ORIGEM_CHOICES = [
        ('conta_pagar',    'Conta a Pagar'),
        ('conta_receber',  'Conta a Receber'),
        ('venda_pdv',      'Venda PDV'),
        ('manual',         'Lançamento Manual'),
    ]

    empresa       = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='lancamentos_contabeis')
    data          = models.DateField()
    conta_debito  = models.ForeignKey(
        ContaContabil, on_delete=models.PROTECT, related_name='lancamentos_debito'
    )
    conta_credito = models.ForeignKey(
        ContaContabil, on_delete=models.PROTECT, related_name='lancamentos_credito'
    )
    valor         = models.DecimalField(max_digits=15, decimal_places=2)
    historico     = models.CharField(max_length=255, verbose_name='Histórico')
    origem_tipo   = models.CharField(max_length=20, choices=ORIGEM_CHOICES, blank=True)
    origem_id     = models.PositiveIntegerField(null=True, blank=True)
    criado_em     = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Lançamento Contábil'
        verbose_name_plural = 'Lançamentos Contábeis'
        ordering = ['-data', '-criado_em']

    def __str__(self):
        return f"{self.data} | D:{self.conta_debito.codigo} C:{self.conta_credito.codigo} | R${self.valor}"


def _gerar_lancamento_contabil(empresa, tipo_operacao, valor, historico, origem_tipo, origem_id, data):
    """
    Gera um LancamentoContabil se existir MapaContabil configurado para a
    operação. Idempotente: não duplica se já existir lançamento para o
    mesmo (origem_tipo, origem_id).
    """
    if LancamentoContabil.objects.filter(origem_tipo=origem_tipo, origem_id=origem_id).exists():
        return
    mapa = MapaContabil.objects.filter(
        empresa=empresa, tipo_operacao=tipo_operacao, ativo=True
    ).first() or MapaContabil.objects.filter(
        empresa=None, tipo_operacao=tipo_operacao, ativo=True
    ).first()
    if not mapa:
        return
    LancamentoContabil.objects.create(
        empresa=empresa,
        data=data,
        conta_debito=mapa.conta_debito,
        conta_credito=mapa.conta_credito,
        valor=valor,
        historico=historico,
        origem_tipo=origem_tipo,
        origem_id=origem_id,
    )
