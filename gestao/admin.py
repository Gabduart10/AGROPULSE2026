from django.contrib import admin
from .models import (
    Empresa, Usuario, NotaFiscal, Produto, LoteEstoque, ItemNotaFiscal,
    Cliente, PedidoVenda, ItemPedido, Fornecedor, ContaPagar, ContaReceber,
    CustoFixo, CondicaoPagamento, FormaPagamento, TaxaFormaPagamento,
    CaixaDiario, LancamentoCaixa, MovimentacaoEstoque, AjusteEstoque,
    LogAuditoria, MetaVendedor, Transportadora, PedidoCompra, ItemPedidoCompra, PermissaoGranular,
    ConfiguracaoFiscal, RelacionadorCFOP, MatrizTributaria, ConfiguracaoWhiteLabel
)
from .models import LancamentoFinanceiro

@admin.register(LancamentoFinanceiro)
class LancamentoFinanceiroAdmin(admin.ModelAdmin):
    list_display = ('empresa', 'tipo', 'categoria', 'descricao', 'valor', 'data_lancamento', 'recorrente')
    list_filter = ('tipo', 'categoria', 'recorrente', 'empresa')
    search_fields = ('descricao',)
    date_hierarchy = 'data_lancamento'

class MovimentacaoEstoqueInline(admin.TabularInline):
    model = MovimentacaoEstoque
    extra = 0
    readonly_fields = ('data_movimento', 'operador', 'tipo', 'quantidade', 'saldo_apos_movimento', 'origem')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


# ==========================================
# CONFIGURAÇÕES DE INTERFACE (INLINES)
# ==========================================

class TaxaFormaPagamentoInline(admin.TabularInline):
    model = TaxaFormaPagamento
    extra = 1

class ItemPedidoInline(admin.TabularInline):
    model = ItemPedido
    extra = 1
    readonly_fields = ('subtotal', 'margem_segura', 'valor_comissao')


# ==========================================
# REGISTROS DO SISTEMA
# ==========================================

@admin.register(CondicaoPagamento)
class CondicaoPagamentoAdmin(admin.ModelAdmin):
    list_display = ('descricao', 'empresa', 'numero_parcelas', 'intervalo_dias', 'ativo')
    list_filter = ('empresa', 'ativo')

@admin.register(FormaPagamento)
class FormaPagamentoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'empresa', 'repassar_taxa_cliente', 'ativo')
    list_filter = ('empresa', 'ativo')
    inlines = [TaxaFormaPagamentoInline]

@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cnpj', 'tipo_negocio')

@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ('username', 'empresa', 'nivel', 'meta_mensal', 've_apenas_seus_clientes')

@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'sku', 'empresa', 'quantidade', 'valor_custo_formatado', 'comissao_percentual', 'estoque_minimo')
    list_filter = ('empresa',)
    search_fields = ('nome', 'sku', 'ncm')
    readonly_fields = ('quantidade',)
    inlines = [MovimentacaoEstoqueInline]

    fieldsets = (
        ('Informações Básicas', {
            'fields': ('empresa', 'nome', 'sku', 'unidade_medida', 'preco_venda')
        }),
        ('Estoque e Custos', {
            'fields': ('quantidade', 'fator_divisao_nfe', 'custo_medio_ponderado', 'estoque_minimo', 'margem_minima', 'comissao_percentual')
        }),
        ('Passaporte Fiscal', {
            'fields': ('origem', 'ncm', 'cest', 'cfop_padrao_interno', 'cfop_padrao_externo'),
            'description': 'Dados obrigatórios para emissão de Nota Fiscal (NFe)'
        }),
    )

    def valor_custo_formatado(self, obj):
        if obj.custo_medio_ponderado is not None:
            valor = f"{obj.custo_medio_ponderado:,.2f}"
            valor = valor.replace(',', 'X').replace('.', ',').replace('X', '.')
            return f"R$ {valor}"
        return "R$ 0,00"
    valor_custo_formatado.short_description = 'Custo Médio Ponderado'


@admin.action(description="💰 Faturar Pedidos (Gerar Financeiro)")
def acao_faturar_pedidos(modeladmin, request, queryset):
    sucesso = 0
    erros = 0
    for pedido in queryset:
        ok, mensagem = pedido.faturar_pedido()
        if ok:
            sucesso += 1
        else:
            erros += 1
    modeladmin.message_user(request, f"Resultado: {sucesso} faturados com sucesso. {erros} ignorados (já faturados ou sem pagamento definido).")

@admin.register(PedidoVenda)
class PedidoVendaAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente', 'vendedor', 'status', 'forma_pagamento', 'condicao_pagamento', 'valor_total_formatado')
    list_filter = ('status', 'empresa', 'vendedor')
    search_fields = ('cliente__nome_razao', 'id')
    actions = [acao_faturar_pedidos]
    readonly_fields = ('valor_total_formatado',)
    exclude = ('valor_total',)
    inlines = [ItemPedidoInline]

    def valor_total_formatado(self, obj):
        if obj.valor_total is not None:
            valor = f"{obj.valor_total:,.2f}"
            valor = valor.replace(',', 'X').replace('.', ',').replace('X', '.')
            return f"R$ {valor}"
        return "R$ 0,00"
    valor_total_formatado.short_description = 'Valor Total'

@admin.register(LoteEstoque)
class LoteEstoqueAdmin(admin.ModelAdmin):
    list_display = ('produto', 'numero_lote', 'quantidade', 'custo_unitario', 'data_validade', 'alerta_validade')
    list_filter = ('produto__empresa', 'data_validade')
    search_fields = ('numero_lote', 'produto__nome')

@admin.register(NotaFiscal)
class NotaFiscalAdmin(admin.ModelAdmin):
    list_display = ('numero_nota', 'tipo_nota', 'empresa', 'valor_total_formatado', 'data_emissao')
    list_filter = ('tipo_nota', 'empresa', 'data_emissao')
    search_fields = ('numero_nota', 'chave_acesso')

    def valor_total_formatado(self, obj):
        if obj.valor_total is not None:
            valor = f"{obj.valor_total:,.2f}"
            valor = valor.replace(',', 'X').replace('.', ',').replace('X', '.')
            return f"R$ {valor}"
        return "R$ 0,00"
    valor_total_formatado.short_description = 'Valor Total'

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nome_razao', 'cnpj_cpf', 'empresa', 'limite_credito')
    list_filter = ('empresa',)
    search_fields = ('nome_razao', 'cnpj_cpf')

@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    list_display = ('nome_razao', 'cnpj', 'empresa')
    list_filter = ('empresa',)
    search_fields = ('nome_razao', 'cnpj')

@admin.register(ContaPagar)
class ContaPagarAdmin(admin.ModelAdmin):
    list_display = ('descricao', 'fornecedor', 'data_vencimento', 'valor_formatado', 'status')
    list_filter = ('status', 'data_vencimento', 'empresa')
    search_fields = ('descricao', 'fornecedor__nome_razao', 'nota_fiscal__numero_nota')

    def valor_formatado(self, obj):
        if obj.valor is not None:
            valor = f"{obj.valor:,.2f}"
            valor = valor.replace(',', 'X').replace('.', ',').replace('X', '.')
            return f"R$ {valor}"
        return "R$ 0,00"
    valor_formatado.short_description = 'Valor'

@admin.register(ContaReceber)
class ContaReceberAdmin(admin.ModelAdmin):
    list_display = ('descricao', 'cliente', 'data_vencimento', 'valor_formatado', 'status')
    list_filter = ('status', 'data_vencimento', 'empresa')
    search_fields = ('descricao', 'cliente__nome_razao', 'pedido_venda__id')

    def valor_formatado(self, obj):
        if obj.valor is not None:
            valor = f"{obj.valor:,.2f}"
            valor = valor.replace(',', 'X').replace('.', ',').replace('X', '.')
            return f"R$ {valor}"
        return "R$ 0,00"
    valor_formatado.short_description = 'Valor'

@admin.register(CustoFixo)
class CustoFixoAdmin(admin.ModelAdmin):
    list_display = ('descricao', 'dia_vencimento', 'valor_formatado', 'ativo')
    list_filter = ('ativo', 'empresa')
    search_fields = ('descricao',)

    def valor_formatado(self, obj):
        if obj.valor is not None:
            valor = f"{obj.valor:,.2f}"
            valor = valor.replace(',', 'X').replace('.', ',').replace('X', '.')
            return f"R$ {valor}"
        return "R$ 0,00"
    valor_formatado.short_description = 'Valor'


# ==========================================
# INTERFACE DO CAIXA
# ==========================================

class LancamentoCaixaInline(admin.TabularInline):
    model = LancamentoCaixa
    extra = 0
    readonly_fields = ('data_lancamento',)

@admin.register(CaixaDiario)
class CaixaDiarioAdmin(admin.ModelAdmin):
    list_display = ('id', 'data_abertura', 'operador', 'saldo_inicial', 'saldo_final_esperado', 'status')
    list_filter = ('status', 'empresa', 'data_abertura')
    readonly_fields = ('saldo_final_esperado', 'data_abertura')
    inlines = [LancamentoCaixaInline]

@admin.register(LancamentoCaixa)
class LancamentoCaixaAdmin(admin.ModelAdmin):
    list_display = ('caixa', 'tipo', 'descricao', 'valor', 'forma_pagamento', 'data_lancamento')
    list_filter = ('tipo', 'caixa__empresa', 'forma_pagamento')
    search_fields = ('descricao',)

@admin.register(AjusteEstoque)
class AjusteEstoqueAdmin(admin.ModelAdmin):
    list_display = ('produto', 'quantidade_ajuste', 'operador', 'data_ajuste', 'justificativa')
    list_filter = ('data_ajuste', 'operador')
    search_fields = ('produto__nome', 'justificativa')
    readonly_fields = ('operador', 'data_ajuste')

    def save_model(self, request, obj, form, change):
        if not getattr(obj, 'operador_id', None):
            obj.operador = request.user
        super().save_model(request, obj, form, change)


# ==========================================
# LOG DE AUDITORIA (SOMENTE LEITURA)
# ==========================================

@admin.register(LogAuditoria)
class LogAuditoriaAdmin(admin.ModelAdmin):
    list_display = ('data_hora', 'usuario', 'acao', 'modelo_afetado', 'registro_id', 'campo_alterado')
    list_filter = ('acao', 'modelo_afetado', 'empresa')
    search_fields = ('usuario__username', 'descricao', 'modelo_afetado')
    readonly_fields = (
        'data_hora', 'usuario', 'acao', 'modelo_afetado',
        'registro_id', 'campo_alterado', 'valor_anterior',
        'valor_novo', 'ip_address', 'descricao', 'empresa',
    )

    def has_add_permission(self, request):
        return False  # Ninguém cria log na mão

    def has_delete_permission(self, request, obj=None):
        return False  # Ninguém apaga log — é imutável


# ==========================================
# METAS DOS VENDEDORES
# ==========================================

@admin.register(MetaVendedor)
class MetaVendedorAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'empresa', 'mes', 'ano', 'valor_meta_formatado')
    list_filter = ('empresa', 'ano', 'mes')
    search_fields = ('usuario__username', 'usuario__first_name')

    def valor_meta_formatado(self, obj):
        if obj.valor_meta is not None:
            valor = f"{obj.valor_meta:,.2f}"
            valor = valor.replace(',', 'X').replace('.', ',').replace('X', '.')
            return f"R$ {valor}"
        return "R$ 0,00"
    valor_meta_formatado.short_description = 'Meta'

class ItemPedidoCompraInline(admin.TabularInline):
     model = ItemPedidoCompra
     extra = 1
     readonly_fields = ('subtotal', 'pendente')

@admin.register(Transportadora)
class TransportadoraAdmin(admin.ModelAdmin):
     list_display = ('nome_razao', 'cnpj', 'placa_veiculo', 'uf', 'ativo')
     list_filter = ('empresa', 'ativo', 'uf')
     search_fields = ('nome_razao', 'cnpj', 'placa_veiculo')

@admin.register(PedidoCompra)
class PedidoCompraAdmin(admin.ModelAdmin):
     list_display = ('id', 'fornecedor', 'responsavel', 'status', 'valor_total', 'data_previsao')
     list_filter = ('status', 'empresa', 'fornecedor')
     search_fields = ('fornecedor__nome_razao',)
     inlines = [ItemPedidoCompraInline]

@admin.register(PermissaoGranular)
class PermissaoGranularAdmin(admin.ModelAdmin):
     list_display = ('usuario', 'empresa', 'ver_custos', 'ver_financeiro', 'aprovar_pedido')
     list_filter = ('empresa',)
     search_fields = ('usuario__username',)

@admin.register(ConfiguracaoFiscal)
class ConfiguracaoFiscalAdmin(admin.ModelAdmin):
     list_display = ('empresa', 'regime_tributario', 'uf', 'crt', 'focusnfe_homologacao')
     list_filter = ('regime_tributario', 'uf')

@admin.register(RelacionadorCFOP)
class RelacionadorCFOPAdmin(admin.ModelAdmin):
     list_display = ('cfop_entrada', 'cfop_saida_interno', 'cfop_saida_externo', 'empresa', 'ativo')
     list_filter = ('ativo', 'empresa')
     search_fields = ('cfop_entrada', 'cfop_saida_interno')

@admin.register(MatrizTributaria)
class MatrizTributariaAdmin(admin.ModelAdmin):
     list_display = ('regime', 'descricao', 'csosn', 'cst_icms', 'aliquota_pis', 'aliquota_cofins', 'padrao')
     list_filter = ('regime', 'padrao')
 
@admin.register(ConfiguracaoWhiteLabel)
class ConfiguracaoWhiteLabelAdmin(admin.ModelAdmin):
     list_display = ('empresa', 'nome_sistema', 'tema', 'cor_primaria', 'data_configuracao')
     list_filter = ('tema', 'empresa__tipo_negocio')
     search_fields = ('empresa__nome', 'nome_sistema')
     readonly_fields = ('data_configuracao',)