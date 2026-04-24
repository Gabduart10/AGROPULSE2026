from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum, F, Q, OuterRef, Subquery, DateTimeField
from django.db.models.functions import Coalesce
from .models import (
    PedidoVenda, ItemPedido, Produto, LoteEstoque,
    ContaPagar, ContaReceber, Cliente,
)


# ==========================================
# RESUMO FINANCEIRO
# ==========================================

def obter_resumo_financeiro(empresa_id, dias=30):
    data_limite = timezone.now() - timedelta(days=dias)

    pedidos = PedidoVenda.objects.filter(
        empresa_id=empresa_id,
        status='faturado',
        data_pedido__gte=data_limite
    )

    faturamento_total = pedidos.aggregate(
        total=Coalesce(Sum('valor_total'), Decimal('0.00'))
    )['total']

    # Custo: aggregate direto via JOIN
    custo_result = ItemPedido.objects.filter(
        pedido__in=pedidos
    ).select_related('produto').aggregate(
        total=Coalesce(Sum(
            F('quantidade') * Coalesce(F('produto__custo_medio_ponderado'), Decimal('0.00'))
        ), Decimal('0.00'))
    )
    custo_total = custo_result['total']

    lucro_bruto = faturamento_total - custo_total
    margem = (lucro_bruto / faturamento_total * 100) if faturamento_total > 0 else Decimal('0.00')

    total_receber = ContaReceber.objects.filter(
        empresa_id=empresa_id, status='pendente'
    ).aggregate(total=Coalesce(Sum('valor'), Decimal('0.00')))['total']

    total_pagar = ContaPagar.objects.filter(
        empresa_id=empresa_id, status='pendente'
    ).aggregate(total=Coalesce(Sum('valor'), Decimal('0.00')))['total']

    return {
        'faturamento': round(faturamento_total, 2),
        'custo_mercadoria': round(custo_total, 2),
        'lucro_bruto': round(lucro_bruto, 2),
        'margem_percentual': round(margem, 2),
        'total_a_receber': round(total_receber, 2),
        'total_a_pagar': round(total_pagar, 2),
        'saldo_previsto': round(total_receber - total_pagar, 2),
        'periodo_dias': dias,
    }


# ==========================================
# CURVA ABC
# ==========================================

def calcular_curva_abc_produtos(empresa_id, dias=90):
    data_limite = timezone.now() - timedelta(days=dias)

    itens = ItemPedido.objects.filter(
        pedido__empresa_id=empresa_id,
        pedido__status='faturado',
        pedido__data_pedido__gte=data_limite
    ).select_related('produto')

    produtos_venda = {}
    faturamento_total = Decimal('0.00')

    for item in itens:
        subtotal = item.quantidade * item.preco_unitario
        faturamento_total += subtotal
        pid = item.produto.id
        if pid not in produtos_venda:
            produtos_venda[pid] = {
                'nome': item.produto.nome,
                'sku': item.produto.sku,
                'total_vendido': Decimal('0.00'),
                'quantidade_vendida': Decimal('0.00'),
            }
        produtos_venda[pid]['total_vendido'] += subtotal
        produtos_venda[pid]['quantidade_vendida'] += item.quantidade

    if faturamento_total == 0:
        return []

    lista_produtos = sorted(produtos_venda.values(), key=lambda x: x['total_vendido'], reverse=True)

    percentual_acumulado = Decimal('0.00')
    for prod in lista_produtos:
        percentual = (prod['total_vendido'] / faturamento_total) * 100
        percentual_acumulado += percentual
        prod['participacao_percentual'] = round(percentual, 2)
        prod['total_vendido'] = round(prod['total_vendido'], 2)
        prod['quantidade_vendida'] = round(prod['quantidade_vendida'], 2)
        if percentual_acumulado <= 80:
            prod['curva'] = 'A'
        elif percentual_acumulado <= 95:
            prod['curva'] = 'B'
        else:
            prod['curva'] = 'C'

    return lista_produtos


# ==========================================
# ALERTAS DE ESTOQUE — OTIMIZADO com F()
# ==========================================

def alertas_estoque_baixo(empresa_id):
    """
    OTIMIZADO: usa F() para comparar campos no banco.
    Antes: carregava todos os produtos em Python e comparava.
    Agora: uma única query filtrada no banco.
    """
    alertas = []
    produtos = Produto.objects.filter(
        empresa_id=empresa_id,
        quantidade__lte=F('estoque_minimo')
    ).values(
        'id', 'nome', 'sku', 'quantidade', 'estoque_minimo', 'unidade_medida'
    ).order_by('quantidade')

    for p in produtos:
        alertas.append({
            'id': p['id'],
            'nome': p['nome'],
            'sku': p['sku'],
            'quantidade_atual': round(p['quantidade'], 2),
            'estoque_minimo': round(p['estoque_minimo'], 2),
            'unidade': p['unidade_medida'],
            'urgencia': 'critico' if p['quantidade'] == 0 else 'baixo',
        })

    return alertas


def alertas_validade_lotes(empresa_id, dias_alerta=45):
    hoje = timezone.now().date()
    data_limite = hoje + timedelta(days=dias_alerta)

    lotes = LoteEstoque.objects.filter(
        produto__empresa_id=empresa_id,
        quantidade__gt=0,
        data_validade__lte=data_limite
    ).select_related('produto').order_by('data_validade')

    alertas = []
    for lote in lotes:
        dias_restantes = (lote.data_validade - hoje).days
        alertas.append({
            'produto': lote.produto.nome,
            'sku': lote.produto.sku,
            'numero_lote': lote.numero_lote,
            'quantidade': round(lote.quantidade, 2),
            'data_validade': lote.data_validade.strftime('%d/%m/%Y'),
            'dias_restantes': dias_restantes,
            'status': 'vencido' if dias_restantes < 0 else ('urgente' if dias_restantes <= 15 else 'atencao'),
        })

    return alertas


# ==========================================
# ALERTAS FINANCEIROS
# ==========================================

def alertas_contas_vencer(empresa_id, dias=7):
    hoje = timezone.now().date()
    data_limite = hoje + timedelta(days=dias)

    contas = ContaPagar.objects.filter(
        empresa_id=empresa_id,
        status='pendente',
        data_vencimento__lte=data_limite
    ).select_related('fornecedor').order_by('data_vencimento')

    resultado = []
    for conta in contas:
        dias_restantes = (conta.data_vencimento - hoje).days
        resultado.append({
            'id': conta.id,
            'descricao': conta.descricao,
            'fornecedor': conta.fornecedor.nome_razao if conta.fornecedor else 'Sem fornecedor',
            'valor': round(conta.valor, 2),
            'vencimento': conta.data_vencimento.strftime('%d/%m/%Y'),
            'dias_restantes': dias_restantes,
            'status': 'vencido' if dias_restantes < 0 else ('hoje' if dias_restantes == 0 else 'proximo'),
        })

    return resultado


def alertas_contas_receber_atrasadas(empresa_id):
    hoje = timezone.now().date()

    contas = ContaReceber.objects.filter(
        empresa_id=empresa_id,
        status='pendente',
        data_vencimento__lt=hoje
    ).select_related('cliente').order_by('data_vencimento')

    resultado = []
    for conta in contas:
        dias_atraso = (hoje - conta.data_vencimento).days
        resultado.append({
            'id': conta.id,
            'descricao': conta.descricao,
            'cliente': conta.cliente.nome_fantasia or conta.cliente.nome_razao,
            'valor': round(conta.valor, 2),
            'vencimento': conta.data_vencimento.strftime('%d/%m/%Y'),
            'dias_atraso': dias_atraso,
        })

    return resultado


# ==========================================
# ALERTAS DE CLIENTES — OTIMIZADO com Subquery
# ==========================================

def alertas_clientes_sem_comprar(empresa_id, dias=25):
    """
    OTIMIZADO: usa Subquery para anotar data do último pedido.
    Antes: N queries (uma por cliente via property dias_sem_comprar).
    Agora: 1 query com Subquery.
    """
    hoje = timezone.now().date()

    ultimo_pedido_sub = PedidoVenda.objects.filter(
        cliente=OuterRef('pk'),
        status__in=['aprovado', 'faturado']
    ).order_by('-data_pedido').values('data_pedido')[:1]

    clientes = Cliente.objects.filter(
        empresa_id=empresa_id
    ).annotate(
        ultimo_pedido_data=Subquery(ultimo_pedido_sub, output_field=DateTimeField())
    ).filter(
        ultimo_pedido_data__isnull=False
    ).values(
        'id', 'nome_razao', 'nome_fantasia', 'responsavel', 'telefone', 'ultimo_pedido_data'
    )

    resultado = []
    for cliente in clientes:
        dias_sem = (hoje - cliente['ultimo_pedido_data'].date()).days
        if dias_sem >= dias:
            resultado.append({
                'id': cliente['id'],
                'nome': cliente['nome_fantasia'] or cliente['nome_razao'],
                'responsavel': cliente['responsavel'],
                'telefone': cliente['telefone'],
                'dias_sem_comprar': dias_sem,
                'urgencia': 'critico' if dias_sem >= 60 else ('atencao' if dias_sem >= 40 else 'aviso'),
            })

    resultado.sort(key=lambda x: x['dias_sem_comprar'], reverse=True)
    return resultado


def alertas_aniversariantes(empresa_id):
    """
    OTIMIZADO: carrega só campos necessários com values().
    """
    hoje = timezone.now().date()
    resultado = []

    clientes = Cliente.objects.filter(
        empresa_id=empresa_id,
        data_nascimento__isnull=False
    ).values('id', 'nome_razao', 'nome_fantasia', 'responsavel', 'telefone', 'data_nascimento')

    for cliente in clientes:
        try:
            aniversario = cliente['data_nascimento'].replace(year=hoje.year)
        except ValueError:
            aniversario = cliente['data_nascimento'].replace(year=hoje.year, day=28)

        if aniversario < hoje:
            try:
                aniversario = aniversario.replace(year=hoje.year + 1)
            except ValueError:
                aniversario = aniversario.replace(year=hoje.year + 1, day=28)

        dias_restantes = (aniversario - hoje).days
        if dias_restantes <= 7:
            resultado.append({
                'id': cliente['id'],
                'nome': cliente['nome_fantasia'] or cliente['nome_razao'],
                'responsavel': cliente['responsavel'],
                'telefone': cliente['telefone'],
                'data_aniversario': cliente['data_nascimento'].strftime('%d/%m'),
                'dias_restantes': dias_restantes,
            })

    resultado.sort(key=lambda x: x['dias_restantes'])
    return resultado


# ==========================================
# PAINEL DE COMISSÕES DO VENDEDOR
# ==========================================

def painel_comissoes_vendedor(empresa_id, vendedor_id, dias=30):
    data_limite = timezone.now() - timedelta(days=dias)

    itens = ItemPedido.objects.filter(
        pedido__empresa_id=empresa_id,
        pedido__vendedor_id=vendedor_id,
        pedido__status='faturado',
        pedido__data_pedido__gte=data_limite
    ).select_related('produto', 'pedido__cliente')

    total_comissao = Decimal('0.00')
    total_vendido = Decimal('0.00')
    detalhes = []

    for item in itens:
        total_comissao += item.valor_comissao
        total_vendido += item.subtotal
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

    return {
        'total_vendido': round(total_vendido, 2),
        'total_comissao': round(total_comissao, 2),
        'percentual_medio': round(
            (total_comissao / total_vendido * 100) if total_vendido > 0 else Decimal('0.00'), 2
        ),
        'periodo_dias': dias,
        'detalhes': detalhes,
    }


# ==========================================
# FATURAMENTO POR DIA
# ==========================================

def faturamento_por_dia(empresa_id, dias=30):
    data_limite = timezone.now().date() - timedelta(days=dias)

    pedidos = PedidoVenda.objects.filter(
        empresa_id=empresa_id,
        status='faturado',
        data_pedido__date__gte=data_limite
    ).order_by('data_pedido')

    por_dia = {}
    for pedido in pedidos:
        dia = pedido.data_pedido.strftime('%d/%m')
        por_dia[dia] = por_dia.get(dia, Decimal('0.00')) + pedido.valor_total

    return [{'dia': dia, 'valor': round(valor, 2)} for dia, valor in por_dia.items()]


# ==========================================
# PACOTE COMPLETO DO DASHBOARD
# ==========================================

def obter_dashboard_completo(empresa_id, vendedor_id=None, dias=30):
    dados = {
        'resumo_financeiro': obter_resumo_financeiro(empresa_id, dias),
        'curva_abc': calcular_curva_abc_produtos(empresa_id, dias=90),
        'faturamento_por_dia': faturamento_por_dia(empresa_id, dias),
        'alertas': {
            'estoque_baixo': alertas_estoque_baixo(empresa_id),
            'validade_lotes': alertas_validade_lotes(empresa_id),
            'contas_vencer': alertas_contas_vencer(empresa_id, dias=7),
            'contas_atrasadas': alertas_contas_receber_atrasadas(empresa_id),
            'clientes_sem_comprar': alertas_clientes_sem_comprar(empresa_id),
            'aniversariantes': alertas_aniversariantes(empresa_id),
        },
    }
    if vendedor_id:
        dados['comissoes'] = painel_comissoes_vendedor(empresa_id, vendedor_id, dias)
    return dados


# ==========================================
# DOSSIÊ DO VENDEDOR
# ==========================================

def dossie_vendedor(empresa_id, vendedor_id, mes=None, ano=None):
    from .models import MetaVendedor, Usuario
    hoje = timezone.now().date()
    mes = mes or hoje.month
    ano = ano or hoje.year
    inicio_mes = hoje.replace(day=1, month=mes, year=ano)
    if mes == 12:
        fim_mes = hoje.replace(day=31, month=12, year=ano)
    else:
        fim_mes = hoje.replace(day=1, month=mes + 1, year=ano) - timedelta(days=1)

    try:
        vendedor = Usuario.objects.get(id=vendedor_id, empresa_id=empresa_id)
    except Usuario.DoesNotExist:
        return {'erro': 'Vendedor não encontrado.'}

    pedidos_mes = PedidoVenda.objects.filter(
        empresa_id=empresa_id, vendedor_id=vendedor_id,
        data_pedido__date__gte=inicio_mes, data_pedido__date__lte=fim_mes,
    )
    faturado_mes = pedidos_mes.filter(status='faturado').aggregate(
        total=Coalesce(Sum('valor_total'), Decimal('0.00'))
    )['total']

    por_status = {}
    for status, label in PedidoVenda.STATUS_CHOICES:
        por_status[label] = pedidos_mes.filter(status=status).count()

    meta_obj = MetaVendedor.objects.filter(
        usuario_id=vendedor_id, empresa_id=empresa_id, mes=mes, ano=ano).first()
    valor_meta = meta_obj.valor_meta if meta_obj else Decimal('0.00')
    percentual_meta = round(
        (faturado_mes / valor_meta * 100) if valor_meta > 0 else Decimal('0.00'), 2)

    itens_mes = ItemPedido.objects.filter(
        pedido__in=pedidos_mes.filter(status='faturado')
    ).select_related('pedido__cliente')

    clientes_faturamento = {}
    comissao_mes = Decimal('0.00')
    for item in itens_mes:
        comissao_mes += item.valor_comissao
        cliente = item.pedido.cliente
        cid = cliente.id
        if cid not in clientes_faturamento:
            clientes_faturamento[cid] = {
                'nome': cliente.nome_fantasia or cliente.nome_razao,
                'total': Decimal('0.00'),
            }
        clientes_faturamento[cid]['total'] += item.subtotal

    top_clientes = sorted(clientes_faturamento.values(), key=lambda x: x['total'], reverse=True)[:5]
    for c in top_clientes:
        c['total'] = round(c['total'], 2)

    evolucao = []
    for i in range(5, -1, -1):
        data_ref = hoje.replace(day=1) - timedelta(days=i * 30)
        m, a = data_ref.month, data_ref.year
        inicio_ref = data_ref.replace(day=1)
        fim_ref = data_ref.replace(day=1, month=m + 1) - timedelta(days=1) if m < 12 else data_ref.replace(day=31)
        faturado_ref = PedidoVenda.objects.filter(
            empresa_id=empresa_id, vendedor_id=vendedor_id, status='faturado',
            data_pedido__date__gte=inicio_ref, data_pedido__date__lte=fim_ref,
        ).aggregate(total=Coalesce(Sum('valor_total'), Decimal('0.00')))['total']
        meta_ref = MetaVendedor.objects.filter(
            usuario_id=vendedor_id, empresa_id=empresa_id, mes=m, ano=a).first()
        evolucao.append({
            'mes': data_ref.strftime('%b/%y'),
            'faturado': round(faturado_ref, 2),
            'meta': round(meta_ref.valor_meta if meta_ref else Decimal('0.00'), 2),
        })

    total_faturados = pedidos_mes.filter(status='faturado').count()
    total_recusados = pedidos_mes.filter(status='recusado').count()

    return {
        'vendedor': {
            'id': vendedor.id,
            'nome': vendedor.get_full_name() or vendedor.username,
            'nivel': vendedor.get_nivel_display(),
            'email': vendedor.email,
        },
        'periodo': f"{mes:02d}/{ano}",
        'resumo_mes': {
            'faturado': round(faturado_mes, 2),
            'meta': round(valor_meta, 2),
            'percentual_meta': percentual_meta,
            'comissao_mes': round(comissao_mes, 2),
            'pedidos_por_status': por_status,
            'faturados': total_faturados,
            'recusados': total_recusados,
            'taxa_conversao': round(
                (total_faturados / (total_faturados + total_recusados) * 100)
                if (total_faturados + total_recusados) > 0 else 0, 2),
        },
        'top_clientes': top_clientes,
        'evolucao_6_meses': evolucao,
    }