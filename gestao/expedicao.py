# ==========================================
# ARQUIVO NOVO: gestao/expedicao.py
# Crie esse arquivo na pasta gestao/
# ==========================================

def gerar_romaneio_cego(pedido_venda_id, empresa_id):
    """
    Romaneio de carga cego para o motorista/auxiliar.
    Mostra APENAS: produto, lote e quantidade.
    NUNCA mostra: preço, desconto, cliente, valor total.
    """
    from .models import PedidoVenda, ItemPedido

    try:
        pedido = PedidoVenda.objects.get(
            id=pedido_venda_id,
            empresa_id=empresa_id,
            status__in=['aprovado', 'faturado'],
        )
    except PedidoVenda.DoesNotExist:
        return None, "Pedido não encontrado ou não aprovado."

    itens = []
    for item in pedido.itens.all():
        # Busca lotes disponíveis para o produto — sem mostrar custo
        lotes = item.produto.lotes.filter(
            quantidade__gt=0
        ).order_by('data_validade').values('numero_lote', 'quantidade', 'data_validade')

        itens.append({
            'produto': item.produto.nome,
            'sku': item.produto.sku,
            'quantidade': round(item.quantidade, 2),
            'unidade': item.produto.unidade_medida,
            'lotes_disponiveis': [{
                'numero_lote': l['numero_lote'],
                'quantidade': round(l['quantidade'], 2),
                'validade': l['data_validade'].strftime('%d/%m/%Y') if l['data_validade'] else 'N/A',
            } for l in lotes],
        })

    return {
        'romaneio_id': pedido.id,
        'data': pedido.data_pedido.strftime('%d/%m/%Y'),
        'itens': itens,
        'total_itens': len(itens),
        # Intencionalmente sem: cliente, vendedor, valor, desconto
    }, None


def listar_pedidos_expedicao(empresa_id):
    """
    Lista pedidos aprovados aguardando expedição.
    Visão cega — sem valores financeiros.
    """
    from .models import PedidoVenda

    pedidos = PedidoVenda.objects.filter(
        empresa_id=empresa_id,
        status='aprovado',
    ).prefetch_related('itens__produto').order_by('data_pedido')

    resultado = []
    for pedido in pedidos:
        itens = [{
            'produto': item.produto.nome,
            'sku': item.produto.sku,
            'quantidade': round(item.quantidade, 2),
            'unidade': item.produto.unidade_medida,
        } for item in pedido.itens.all()]

        resultado.append({
            'pedido_id': pedido.id,
            'data': pedido.data_pedido.strftime('%d/%m/%Y %H:%M'),
            'itens': itens,
            'total_itens': len(itens),
            # Sem cliente, vendedor, valor
        })

    return resultado
