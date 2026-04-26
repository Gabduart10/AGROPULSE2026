from rest_framework import serializers
from .models import (
    PedidoVenda, ItemPedido, Cliente, Produto,
    ContaPagar, ContaReceber, LoteEstoque,
    Fornecedor, MovimentacaoEstoque,
    GrupoCliente, TabelaPreco, ItemTabelaPreco,
    Veiculo, Fazenda, Gleba, Talhao,
    DevolucaoVenda, ItemDevolucaoVenda,
    Banco, LogAuditoria,
)


class ItemPedidoSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    margem_segura = serializers.BooleanField(read_only=True)

    class Meta:
        model = ItemPedido
        fields = [
            'id', 'produto', 'quantidade', 'preco_unitario',
            'comissao_aplicada', 'valor_comissao', 'subtotal', 'margem_segura',
        ]


class PedidoVendaSerializer(serializers.ModelSerializer):
    itens = ItemPedidoSerializer(many=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PedidoVenda
        fields = [
            'id', 'empresa', 'cliente', 'vendedor',
            'condicao_pagamento', 'forma_pagamento',
            'status', 'status_display', 'valor_total', 'data_pedido',
            'itens',
        ]
        read_only_fields = ['valor_total', 'data_pedido']

    def create(self, validated_data):
        itens_data = validated_data.pop('itens')
        pedido = PedidoVenda.objects.create(**validated_data)
        for item in itens_data:
            ItemPedido.objects.create(pedido=pedido, **item)
        return pedido

    def update(self, instance, validated_data):
        itens_data = validated_data.pop('itens', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if itens_data is not None:
            instance.itens.all().delete()
            for item in itens_data:
                ItemPedido.objects.create(pedido=instance, **item)

        return instance


class ClienteSerializer(serializers.ModelSerializer):
    dias_sem_comprar = serializers.IntegerField(read_only=True)
    alerta_recompra  = serializers.BooleanField(read_only=True)
    grupo_nome       = serializers.CharField(source='grupo.nome', read_only=True)

    class Meta:
        model = Cliente
        fields = [
            'id', 'empresa', 'tipo_pessoa', 'tipo_cliente',
            'grupo', 'grupo_nome',
            'nome_razao', 'nome_fantasia', 'cnpj_cpf',
            'responsavel', 'telefone', 'endereco',
            'coordenadas_gps', 'data_nascimento', 'limite_credito',
            'ativo', 'dias_sem_comprar', 'alerta_recompra',
        ]


class LoteEstoqueSerializer(serializers.ModelSerializer):
    alerta_validade = serializers.CharField(read_only=True)

    class Meta:
        model = LoteEstoque
        fields = [
            'id', 'numero_lote', 'quantidade', 'custo_unitario',
            'data_fabricacao', 'data_validade', 'alerta_validade',
            'deposito', 'corredor', 'prateleira', 'nota_fiscal_origem',
        ]


class ProdutoSerializer(serializers.ModelSerializer):
    lotes              = LoteEstoqueSerializer(many=True, read_only=True)
    tipo_produto_label = serializers.CharField(source='get_tipo_produto_display', read_only=True)
    metodo_custeio_label = serializers.CharField(source='get_metodo_custeio_display', read_only=True)

    class Meta:
        model = Produto
        fields = [
            'id', 'empresa', 'nome', 'sku', 'ean',
            'tipo_produto', 'tipo_produto_label',
            'metodo_custeio', 'metodo_custeio_label',
            'unidade_medida', 'preco_venda', 'quantidade', 'fator_divisao_nfe',
            'custo_medio_ponderado', 'margem_minima', 'comissao_percentual',
            'estoque_minimo', 'origem', 'ncm', 'cest',
            'cfop_padrao_interno', 'cfop_padrao_externo',
            'fispq', 'ficha_tecnica', 'ativo',
            'lotes',
        ]


# ── Novos serializers ──────────────────────────────────

class GrupoClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GrupoCliente
        fields = ['id', 'empresa', 'nome', 'descricao']


class ItemTabelaPrecoSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source='produto.nome', read_only=True)

    class Meta:
        model  = ItemTabelaPreco
        fields = ['id', 'tabela', 'produto', 'produto_nome', 'preco']


class TabelaPrecoSerializer(serializers.ModelSerializer):
    itens          = ItemTabelaPrecoSerializer(many=True, read_only=True)
    grupo_nome     = serializers.CharField(source='grupo_cliente.nome', read_only=True)
    cliente_nome   = serializers.CharField(source='cliente.nome_razao', read_only=True)

    class Meta:
        model  = TabelaPreco
        fields = [
            'id', 'empresa', 'nome', 'canal_venda',
            'grupo_cliente', 'grupo_nome', 'cliente', 'cliente_nome',
            'regiao', 'data_inicio', 'data_fim', 'ativa', 'criado_em',
            'itens',
        ]


class VeiculoSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model  = Veiculo
        fields = [
            'id', 'empresa', 'tipo', 'tipo_label', 'descricao',
            'placa', 'numero_serie', 'marca', 'modelo', 'ano',
            'crlv', 'vencimento_doc', 'ativo',
        ]


class TalhaoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Talhao
        fields = ['id', 'gleba', 'nome', 'area_ha', 'cultura', 'coordenadas']


class GlebaSerializer(serializers.ModelSerializer):
    talhoes = TalhaoSerializer(many=True, read_only=True)

    class Meta:
        model  = Gleba
        fields = ['id', 'fazenda', 'nome', 'area_ha', 'coordenadas', 'talhoes']


class FazendaSerializer(serializers.ModelSerializer):
    glebas       = GlebaSerializer(many=True, read_only=True)
    cliente_nome = serializers.CharField(source='cliente.nome_razao', read_only=True)

    class Meta:
        model  = Fazenda
        fields = [
            'id', 'empresa', 'cliente', 'cliente_nome',
            'nome', 'municipio', 'uf', 'area_total_ha',
            'coordenadas', 'car', 'ativa', 'glebas',
        ]


class ItemDevolucaoSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source='produto.nome', read_only=True)

    class Meta:
        model  = ItemDevolucaoVenda
        fields = [
            'id', 'devolucao', 'produto', 'produto_nome',
            'lote', 'quantidade', 'destino_estoque', 'justificativa_descarte',
        ]


class DevolucaoVendaSerializer(serializers.ModelSerializer):
    itens          = ItemDevolucaoSerializer(many=True, read_only=True)
    pedido_numero  = serializers.IntegerField(source='pedido_original.id', read_only=True)
    cliente_nome   = serializers.CharField(source='pedido_original.cliente.nome_razao', read_only=True)

    class Meta:
        model  = DevolucaoVenda
        fields = [
            'id', 'empresa', 'pedido_original', 'pedido_numero', 'cliente_nome',
            'usuario', 'motivo', 'status', 'destino_credito',
            'observacao', 'nfe_devolucao', 'criado_em', 'concluido_em',
            'itens',
        ]


class FornecedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fornecedor
        fields = ['id', 'empresa', 'nome_razao', 'cnpj']


class ContaPagarSerializer(serializers.ModelSerializer):
    fornecedor_nome = serializers.CharField(source='fornecedor.nome_razao', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ContaPagar
        fields = [
            'id', 'empresa', 'fornecedor', 'fornecedor_nome',
            'nota_fiscal', 'descricao', 'valor',
            'data_vencimento', 'data_pagamento',
            'status', 'status_display',
            'link_boleto', 'linha_digitavel',
        ]


class ContaReceberSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ContaReceber
        fields = [
            'id', 'empresa', 'cliente', 'cliente_nome',
            'pedido_venda', 'descricao', 'valor',
            'data_vencimento', 'data_recebimento',
            'status', 'status_display',
        ]

    def get_cliente_nome(self, obj):
        return obj.cliente.nome_fantasia or obj.cliente.nome_razao


class MovimentacaoEstoqueSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source='produto.nome', read_only=True)
    operador_nome = serializers.CharField(source='operador.get_full_name', read_only=True)

    class Meta:
        model = MovimentacaoEstoque
        fields = [
            'id', 'produto', 'produto_nome', 'operador', 'operador_nome',
            'tipo', 'quantidade', 'saldo_apos_movimento',
            'origem', 'data_movimento',
        ]


class BancoSerializer(serializers.ModelSerializer):
    tipo_conta_display = serializers.CharField(source='get_tipo_conta_display', read_only=True)

    class Meta:
        model = Banco
        fields = [
            'id', 'empresa', 'nome', 'agencia', 'conta',
            'tipo_conta', 'tipo_conta_display', 'saldo_inicial', 'ativo',
        ]


class LogAuditoriaSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.SerializerMethodField()
    acao_display = serializers.CharField(source='get_acao_display', read_only=True)

    class Meta:
        model = LogAuditoria
        fields = [
            'id', 'empresa', 'usuario', 'usuario_nome',
            'acao', 'acao_display', 'modelo_afetado', 'registro_id',
            'campo_alterado', 'valor_anterior', 'valor_novo',
            'descricao', 'ip_address', 'data_hora',
        ]

    def get_usuario_nome(self, obj):
        return getattr(obj.usuario, 'nome', None) if obj.usuario else None
