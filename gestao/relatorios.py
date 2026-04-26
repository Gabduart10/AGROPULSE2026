from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum, Count, Q, F
from django.db.models.functions import Coalesce


# ==========================================
# DRE REAL
# ==========================================

def gerar_dre(empresa_id, mes, ano):
    from .models import PedidoVenda, ItemPedido, CustoFixo, ContaPagar

    inicio = timezone.datetime(ano, mes, 1, tzinfo=timezone.utc)
    fim = timezone.datetime(ano + 1, 1, 1, tzinfo=timezone.utc) if mes == 12 else timezone.datetime(ano, mes + 1, 1, tzinfo=timezone.utc)

    pedidos = PedidoVenda.objects.filter(
        empresa_id=empresa_id, status='faturado',
        data_pedido__gte=inicio, data_pedido__lt=fim,
    )

    receita_bruta = pedidos.aggregate(
        total=Coalesce(Sum('valor_total'), Decimal('0'))
    )['total']

    # OTIMIZADO: calcula custo via aggregate com F() no banco
    custo_result = ItemPedido.objects.filter(
        pedido__in=pedidos
    ).aggregate(
        total=Coalesce(
            Sum(F('quantidade') * Coalesce(F('produto__custo_medio_ponderado'), Decimal('0'))),
            Decimal('0')
        )
    )
    custo_mercadoria = custo_result['total']

    lucro_bruto = receita_bruta - custo_mercadoria
    margem_bruta = (lucro_bruto / receita_bruta * 100) if receita_bruta > 0 else Decimal('0')

    custos_fixos = CustoFixo.objects.filter(
        empresa_id=empresa_id, ativo=True
    ).aggregate(total=Coalesce(Sum('valor'), Decimal('0')))['total']

    despesas_variaveis = ContaPagar.objects.filter(
        empresa_id=empresa_id, status='pago',
        data_pagamento__year=ano, data_pagamento__month=mes,
    ).aggregate(total=Coalesce(Sum('valor'), Decimal('0')))['total']

    total_despesas = custos_fixos + despesas_variaveis
    lucro_liquido = lucro_bruto - total_despesas
    margem_liquida = (lucro_liquido / receita_bruta * 100) if receita_bruta > 0 else Decimal('0')

    total_comissoes = ItemPedido.objects.filter(
        pedido__in=pedidos
    ).aggregate(
        total=Coalesce(Sum('valor_comissao'), Decimal('0'))
    )['total']

    return {
        'periodo': f"{mes:02d}/{ano}",
        'receita_bruta': round(receita_bruta, 2),
        'custo_mercadoria_vendida': round(custo_mercadoria, 2),
        'lucro_bruto': round(lucro_bruto, 2),
        'margem_bruta_percentual': round(margem_bruta, 2),
        'custos_fixos': round(custos_fixos, 2),
        'despesas_variaveis': round(despesas_variaveis, 2),
        'total_despesas': round(total_despesas, 2),
        'total_comissoes': round(total_comissoes, 2),
        'lucro_liquido': round(lucro_liquido, 2),
        'margem_liquida_percentual': round(margem_liquida, 2),
        'total_pedidos_faturados': pedidos.count(),
        'ticket_medio': round(receita_bruta / pedidos.count(), 2) if pedidos.count() > 0 else Decimal('0'),
    }


# ==========================================
# INADIMPLÊNCIA COM AGING DA DÍVIDA
# ==========================================

def relatorio_inadimplencia(empresa_id):
    from .models import ContaReceber

    hoje = timezone.now().date()

    # OTIMIZADO: select_related em vez de query por conta no loop
    contas = ContaReceber.objects.filter(
        empresa_id=empresa_id,
        status__in=['pendente', 'inadimplente', 'atrasado'],
        data_vencimento__lt=hoje,
    ).select_related('cliente', 'pedido_venda__vendedor')

    faixas = {
        '1_a_15_dias': {'contas': [], 'total': Decimal('0')},
        '16_a_30_dias': {'contas': [], 'total': Decimal('0')},
        '31_a_60_dias': {'contas': [], 'total': Decimal('0')},
        '61_a_90_dias': {'contas': [], 'total': Decimal('0')},
        'acima_90_dias': {'contas': [], 'total': Decimal('0')},
    }

    por_vendedor = {}
    total_geral = Decimal('0')

    for conta in contas:
        dias = (hoje - conta.data_vencimento).days
        total_geral += conta.valor

        item = {
            'id': conta.id,
            'cliente': conta.cliente.nome_fantasia or conta.cliente.nome_razao,
            'telefone': conta.cliente.telefone,
            'descricao': conta.descricao,
            'valor': round(conta.valor, 2),
            'vencimento': conta.data_vencimento.strftime('%d/%m/%Y'),
            'dias_atraso': dias,
            'vendedor': conta.pedido_venda.vendedor.get_full_name() if conta.pedido_venda and conta.pedido_venda.vendedor else 'Não identificado',
        }

        if dias <= 15:
            faixas['1_a_15_dias']['contas'].append(item)
            faixas['1_a_15_dias']['total'] += conta.valor
        elif dias <= 30:
            faixas['16_a_30_dias']['contas'].append(item)
            faixas['16_a_30_dias']['total'] += conta.valor
        elif dias <= 60:
            faixas['31_a_60_dias']['contas'].append(item)
            faixas['31_a_60_dias']['total'] += conta.valor
        elif dias <= 90:
            faixas['61_a_90_dias']['contas'].append(item)
            faixas['61_a_90_dias']['total'] += conta.valor
        else:
            faixas['acima_90_dias']['contas'].append(item)
            faixas['acima_90_dias']['total'] += conta.valor

        vendedor_nome = item['vendedor']
        if vendedor_nome not in por_vendedor:
            por_vendedor[vendedor_nome] = {'total': Decimal('0'), 'quantidade': 0}
        por_vendedor[vendedor_nome]['total'] += conta.valor
        por_vendedor[vendedor_nome]['quantidade'] += 1

    for faixa in faixas.values():
        faixa['total'] = round(faixa['total'], 2)

    return {
        'total_inadimplente': round(total_geral, 2),
        'aging': faixas,
        'por_vendedor': [
            {'vendedor': v, 'total': round(d['total'], 2), 'quantidade': d['quantidade']}
            for v, d in sorted(por_vendedor.items(), key=lambda x: x[1]['total'], reverse=True)
        ],
    }


# ==========================================
# PERFORMANCE POR VENDEDOR — OTIMIZADO
# ==========================================

def relatorio_performance_vendedores(empresa_id, mes=None, ano=None):
    """
    OTIMIZADO: usa annotate para agregar dados por vendedor em poucas queries,
    em vez de N*5 queries (uma por vendedor para cada tipo de dado).
    Antes: loop com 5 queries por vendedor.
    Agora: 4 queries totais independente da quantidade de vendedores.
    """
    from .models import PedidoVenda, ItemPedido, MetaVendedor, Usuario

    hoje = timezone.now().date()
    mes = mes or hoje.month
    ano = ano or hoje.year

    inicio = timezone.datetime(ano, mes, 1, tzinfo=timezone.utc)
    fim = timezone.datetime(ano, mes + 1, 1, tzinfo=timezone.utc) if mes < 12 else timezone.datetime(ano + 1, 1, 1, tzinfo=timezone.utc)

    # QUERY 1: Agrega pedidos por vendedor com annotate
    stats_pedidos = PedidoVenda.objects.filter(
        empresa_id=empresa_id,
        data_pedido__gte=inicio,
        data_pedido__lt=fim,
        vendedor__nivel='vendedor',
    ).values('vendedor_id').annotate(
        faturamento=Coalesce(Sum('valor_total', filter=Q(status='faturado')), Decimal('0')),
        pedidos_faturados=Count('id', filter=Q(status='faturado')),
        pedidos_recusados=Count('id', filter=Q(status='recusado')),
        orcamentos_abertos=Count('id', filter=Q(status='orcamento')),
    )
    stats_map = {s['vendedor_id']: s for s in stats_pedidos}

    # QUERY 2: Agrega comissões por vendedor
    comissoes_qs = ItemPedido.objects.filter(
        pedido__empresa_id=empresa_id,
        pedido__status='faturado',
        pedido__data_pedido__gte=inicio,
        pedido__data_pedido__lt=fim,
        pedido__vendedor__nivel='vendedor',
    ).values('pedido__vendedor_id').annotate(
        total_comissao=Coalesce(Sum('valor_comissao'), Decimal('0'))
    )
    comissoes_map = {c['pedido__vendedor_id']: c['total_comissao'] for c in comissoes_qs}

    # QUERY 3: Carrega metas do mês
    metas_qs = MetaVendedor.objects.filter(
        empresa_id=empresa_id, mes=mes, ano=ano
    ).values('usuario_id', 'valor_meta')
    metas_map = {m['usuario_id']: m['valor_meta'] for m in metas_qs}

    # QUERY 4: Carrega vendedores
    vendedores = Usuario.objects.filter(
        empresa_id=empresa_id, nivel='vendedor'
    )

    resultado = []
    for vendedor in vendedores:
        stats = stats_map.get(vendedor.id, {})
        faturamento = stats.get('faturamento', Decimal('0'))
        pedidos_faturados = stats.get('pedidos_faturados', 0)
        pedidos_recusados = stats.get('pedidos_recusados', 0)
        orcamentos = stats.get('orcamentos_abertos', 0)
        total_comissao = comissoes_map.get(vendedor.id, Decimal('0'))
        meta = metas_map.get(vendedor.id, Decimal('0'))

        total_pedidos = pedidos_faturados + pedidos_recusados
        taxa_conversao = round(
            (pedidos_faturados / total_pedidos * 100) if total_pedidos > 0 else 0, 2
        )
        ticket_medio = round(faturamento / pedidos_faturados, 2) if pedidos_faturados > 0 else Decimal('0')
        percentual_meta = round((faturamento / meta * 100) if meta > 0 else 0, 2)

        resultado.append({
            'vendedor': vendedor.get_full_name() or vendedor.username,
            'faturamento': round(faturamento, 2),
            'meta': round(meta, 2),
            'percentual_meta': percentual_meta,
            'pedidos_faturados': pedidos_faturados,
            'orcamentos_abertos': orcamentos,
            'pedidos_recusados': pedidos_recusados,
            'taxa_conversao': taxa_conversao,
            'ticket_medio': ticket_medio,
            'total_comissao': round(total_comissao, 2),
        })

    resultado.sort(key=lambda x: x['faturamento'], reverse=True)
    return resultado


# ==========================================
# COMISSÕES PARA REPASSE
# ==========================================

def relatorio_comissoes_repasse(empresa_id, mes, ano):
    from .models import ItemPedido, Usuario

    inicio = timezone.datetime(ano, mes, 1, tzinfo=timezone.utc)
    fim = timezone.datetime(ano, mes + 1, 1, tzinfo=timezone.utc) if mes < 12 else timezone.datetime(ano + 1, 1, 1, tzinfo=timezone.utc)

    vendedores = Usuario.objects.filter(empresa_id=empresa_id, nivel='vendedor')
    resultado = []

    for vendedor in vendedores:
        itens = ItemPedido.objects.filter(
            pedido__empresa_id=empresa_id,
            pedido__vendedor=vendedor,
            pedido__status='faturado',
            pedido__data_pedido__gte=inicio,
            pedido__data_pedido__lt=fim,
        ).select_related('produto', 'pedido__cliente')

        if not itens.exists():
            continue

        detalhes = []
        total_vendido = Decimal('0')
        total_comissao = Decimal('0')

        for item in itens:
            total_vendido += item.subtotal
            total_comissao += item.valor_comissao
            detalhes.append({
                'pedido_id': item.pedido.id,
                'cliente': item.pedido.cliente.nome_fantasia or item.pedido.cliente.nome_razao,
                'produto': item.produto.nome,
                'quantidade': round(item.quantidade, 2),
                'preco_unitario': round(item.preco_unitario, 2),
                'subtotal': round(item.subtotal, 2),
                'comissao_percentual': round(item.comissao_aplicada, 2),
                'valor_comissao': round(item.valor_comissao, 2),
                'data': item.pedido.data_pedido.strftime('%d/%m/%Y'),
            })

        resultado.append({
            'vendedor': vendedor.get_full_name() or vendedor.username,
            'email': vendedor.email,
            'total_vendido': round(total_vendido, 2),
            'total_comissao': round(total_comissao, 2),
            'percentual_medio': round(
                (total_comissao / total_vendido * 100) if total_vendido > 0 else 0, 2
            ),
            'detalhes': detalhes,
        })

    resultado.sort(key=lambda x: x['total_comissao'], reverse=True)
    return {
        'periodo': f"{mes:02d}/{ano}",
        'vendedores': resultado,
        'total_geral_comissoes': round(sum(v['total_comissao'] for v in resultado), 2),
    }


# ==========================================
# CURVA ABC AVANÇADA
# ==========================================

def curva_abc_lucratividade(empresa_id, dias=90):
    from .models import ItemPedido

    data_limite = timezone.now() - timedelta(days=dias)

    itens = ItemPedido.objects.filter(
        pedido__empresa_id=empresa_id,
        pedido__status='faturado',
        pedido__data_pedido__gte=data_limite,
    ).select_related('produto')

    produtos = {}
    lucro_total = Decimal('0')

    for item in itens:
        custo = item.produto.custo_medio_ponderado or Decimal('0')
        lucro_item = (item.preco_unitario - custo) * item.quantidade
        lucro_total += lucro_item
        pid = item.produto.id
        if pid not in produtos:
            produtos[pid] = {
                'nome': item.produto.nome,
                'sku': item.produto.sku,
                'lucro': Decimal('0'),
                'faturamento': Decimal('0'),
                'quantidade': Decimal('0'),
            }
        produtos[pid]['lucro'] += lucro_item
        produtos[pid]['faturamento'] += item.subtotal
        produtos[pid]['quantidade'] += item.quantidade

    if lucro_total == 0:
        return []

    lista = sorted(produtos.values(), key=lambda x: x['lucro'], reverse=True)
    acumulado = Decimal('0')
    for p in lista:
        percentual = (p['lucro'] / lucro_total * 100)
        acumulado += percentual
        p['lucro'] = round(p['lucro'], 2)
        p['faturamento'] = round(p['faturamento'], 2)
        p['quantidade'] = round(p['quantidade'], 2)
        p['participacao_lucro'] = round(percentual, 2)
        p['margem_real'] = round(
            (p['lucro'] / p['faturamento'] * 100) if p['faturamento'] > 0 else 0, 2
        )
        p['curva'] = 'A' if acumulado <= 80 else ('B' if acumulado <= 95 else 'C')

    return lista


# ==========================================
# FUNCIONALIDADE INCOMPLETA 1:
# ENTRADAS E SAÍDAS DETALHADO
# Usa MovimentacaoEstoque que já existe.
# ==========================================

def relatorio_entradas_saidas_detalhado(empresa_id, data_inicio=None, data_fim=None,
                                         produto_id=None, tipo=None):
    """
    Extrato completo de movimentações de estoque.
    Integrado com MovimentacaoEstoque já existente.
    Parâmetros opcionais: data_inicio, data_fim, produto_id, tipo (entrada/saida/ajuste)
    """
    from .models import MovimentacaoEstoque

    qs = MovimentacaoEstoque.objects.filter(
        produto__empresa_id=empresa_id
    ).select_related('produto', 'operador').order_by('-data_movimento')

    if data_inicio:
        qs = qs.filter(data_movimento__date__gte=data_inicio)
    if data_fim:
        qs = qs.filter(data_movimento__date__lte=data_fim)
    if produto_id:
        qs = qs.filter(produto_id=produto_id)
    if tipo:
        qs = qs.filter(tipo=tipo)

    # Totais por tipo
    totais = qs.values('tipo').annotate(
        total_quantidade=Sum('quantidade'),
        total_movimentacoes=Count('id')
    )
    totais_map = {t['tipo']: t for t in totais}

    resultado = []
    for mov in qs[:500]:  # Limite de 500 registros por consulta
        resultado.append({
            'data': mov.data_movimento.strftime('%d/%m/%Y %H:%M'),
            'produto': mov.produto.nome,
            'sku': mov.produto.sku,
            'tipo': mov.get_tipo_display(),
            'quantidade': round(mov.quantidade, 2),
            'saldo_apos': round(mov.saldo_apos_movimento, 2) if mov.saldo_apos_movimento else None,
            'origem': mov.origem,
            'operador': mov.operador.get_full_name() or mov.operador.username if mov.operador else 'Sistema',
        })

    return {
        'movimentacoes': resultado,
        'totais': {
            'entradas': {
                'quantidade': round(totais_map.get('entrada', {}).get('total_quantidade') or 0, 2),
                'movimentacoes': totais_map.get('entrada', {}).get('total_movimentacoes', 0),
            },
            'saidas': {
                'quantidade': round(abs(totais_map.get('saida', {}).get('total_quantidade') or 0), 2),
                'movimentacoes': totais_map.get('saida', {}).get('total_movimentacoes', 0),
            },
            'ajustes': {
                'quantidade': round(totais_map.get('ajuste', {}).get('total_quantidade') or 0, 2),
                'movimentacoes': totais_map.get('ajuste', {}).get('total_movimentacoes', 0),
            },
        },
        'filtros_aplicados': {
            'data_inicio': str(data_inicio) if data_inicio else None,
            'data_fim': str(data_fim) if data_fim else None,
            'produto_id': produto_id,
            'tipo': tipo,
        },
    }


# ==========================================
# FUNCIONALIDADE INCOMPLETA 5:
# CONTAS EM ABERTO POR CLIENTE
# Usa ContaReceber que já existe.
# ==========================================

def contas_aberto_por_cliente(empresa_id, cliente_id=None):
    """
    Visão consolidada de contas em aberto por cliente.
    Mostra total em aberto, vencido e a vencer por cliente.
    Integrado com ContaReceber já existente.
    """
    from .models import ContaReceber, Cliente

    hoje = timezone.now().date()

    qs = ContaReceber.objects.filter(
        empresa_id=empresa_id,
        status='pendente',
    ).select_related('cliente', 'pedido_venda__vendedor')

    if cliente_id:
        qs = qs.filter(cliente_id=cliente_id)

    # Agrega por cliente em uma query
    por_cliente_agg = qs.values('cliente_id').annotate(
        total_aberto=Coalesce(Sum('valor'), Decimal('0')),
        total_vencido=Coalesce(Sum('valor', filter=Q(data_vencimento__lt=hoje)), Decimal('0')),
        total_a_vencer=Coalesce(Sum('valor', filter=Q(data_vencimento__gte=hoje)), Decimal('0')),
        quantidade_parcelas=Count('id'),
    )

    # Carrega clientes
    clientes_ids = [a['cliente_id'] for a in por_cliente_agg]
    clientes_map = {
        c.id: c for c in Cliente.objects.filter(id__in=clientes_ids)
    }

    resultado = []
    for agg in por_cliente_agg:
        cliente = clientes_map.get(agg['cliente_id'])
        if not cliente:
            continue

        # Parcelas detalhadas deste cliente
        parcelas = qs.filter(cliente_id=agg['cliente_id']).order_by('data_vencimento')
        parcelas_lista = [{
            'id': p.id,
            'descricao': p.descricao,
            'valor': round(p.valor, 2),
            'vencimento': p.data_vencimento.strftime('%d/%m/%Y'),
            'dias_atraso': max(0, (hoje - p.data_vencimento).days) if p.data_vencimento < hoje else 0,
            'status': 'vencida' if p.data_vencimento < hoje else 'a_vencer',
            'pedido_id': p.pedido_venda_id,
        } for p in parcelas]

        resultado.append({
            'cliente_id': cliente.id,
            'cliente': cliente.nome_fantasia or cliente.nome_razao,
            'telefone': cliente.telefone,
            'limite_credito': round(cliente.limite_credito, 2),
            'total_aberto': round(agg['total_aberto'], 2),
            'total_vencido': round(agg['total_vencido'], 2),
            'total_a_vencer': round(agg['total_a_vencer'], 2),
            'quantidade_parcelas': agg['quantidade_parcelas'],
            'score': 'critico' if agg['total_vencido'] > 0 else 'ok',
            'parcelas': parcelas_lista,
        })

    resultado.sort(key=lambda x: x['total_vencido'], reverse=True)

    return {
        'clientes': resultado,
        'totais_gerais': {
            'total_aberto': round(sum(c['total_aberto'] for c in resultado), 2),
            'total_vencido': round(sum(c['total_vencido'] for c in resultado), 2),
            'total_a_vencer': round(sum(c['total_a_vencer'] for c in resultado), 2),
            'clientes_inadimplentes': sum(1 for c in resultado if c['total_vencido'] > 0),
        },
    }