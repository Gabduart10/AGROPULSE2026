# ==========================================
# ARQUIVO NOVO: gestao/pedido_compra.py
# Crie esse arquivo na pasta gestao/
# ==========================================

from decimal import Decimal


def criar_pedido_compra(empresa, fornecedor, responsavel, itens_data,
                         transportadora=None, data_previsao=None, observacoes=''):
    """
    Cria um pedido de compra com seus itens.
    itens_data = [{'produto_id': X, 'quantidade': Y, 'preco_unitario': Z}]
    """
    from .models import PedidoCompra, ItemPedidoCompra, Produto

    pedido = PedidoCompra.objects.create(
        empresa=empresa,
        fornecedor=fornecedor,
        responsavel=responsavel,
        transportadora=transportadora,
        data_previsao=data_previsao,
        observacoes=observacoes,
        status='rascunho',
    )

    for item_data in itens_data:
        try:
            produto = Produto.objects.get(id=item_data['produto_id'], empresa=empresa)
        except Produto.DoesNotExist:
            continue

        ItemPedidoCompra.objects.create(
            pedido_compra=pedido,
            produto=produto,
            quantidade_pedida=Decimal(str(item_data['quantidade'])),
            preco_unitario=Decimal(str(item_data['preco_unitario'])),
        )

    pedido.atualizar_valor_total()
    return pedido


def vincular_nf_entrada(pedido_compra, nota_fiscal):
    """
    Vincula uma NF de entrada a um pedido de compra.
    Atualiza as quantidades recebidas comparando os itens.
    """
    from .models import ItemPedidoCompra, ItemNotaFiscal

    pedido_compra.nota_fiscal_entrada = nota_fiscal
    itens_nf = ItemNotaFiscal.objects.filter(nota_fiscal=nota_fiscal)

    for item_nf in itens_nf:
        item_pc = ItemPedidoCompra.objects.filter(
            pedido_compra=pedido_compra,
            produto=item_nf.produto,
        ).first()

        if item_pc:
            item_pc.quantidade_recebida += item_nf.quantidade
            item_pc.save()

    # Verifica se foi totalmente recebido
    todos_recebidos = all(
        item.quantidade_recebida >= item.quantidade_pedida
        for item in pedido_compra.itens.all()
    )
    pedido_compra.status = 'recebido' if todos_recebidos else 'parcial'
    pedido_compra.save()

    return pedido_compra


def listar_pedidos_compra(empresa_id, status=None):
    """
    Lista pedidos de compra com resumo dos itens.
    """
    from .models import PedidoCompra

    qs = PedidoCompra.objects.filter(
        empresa_id=empresa_id
    ).select_related('fornecedor', 'responsavel', 'transportadora')

    if status:
        qs = qs.filter(status=status)

    resultado = []
    for pedido in qs.order_by('-data_pedido'):
        itens_pendentes = [
            item for item in pedido.itens.all()
            if item.pendente > 0
        ]

        resultado.append({
            'id': pedido.id,
            'fornecedor': pedido.fornecedor.nome_razao,
            'responsavel': pedido.responsavel.get_full_name() or pedido.responsavel.username,
            'status': pedido.get_status_display(),
            'data_pedido': pedido.data_pedido.strftime('%d/%m/%Y'),
            'data_previsao': pedido.data_previsao.strftime('%d/%m/%Y') if pedido.data_previsao else None,
            'valor_total': round(pedido.valor_total, 2),
            'transportadora': pedido.transportadora.nome_razao if pedido.transportadora else None,
            'itens_pendentes': len(itens_pendentes),
            'nf_vinculada': pedido.nota_fiscal_entrada.numero_nota if pedido.nota_fiscal_entrada else None,
        })

    return resultado
