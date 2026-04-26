"""
gestao/contratos.py
Lógica de negócio: CPR, Barter e Contratos a Termo.
"""

from decimal import Decimal
from django.utils import timezone


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRAÇÃO DE PREÇO DE MERCADO
# ══════════════════════════════════════════════════════════════════════════════

def consultar_preco_mercado(produto_nome, fonte='cbot'):
    """
    Retorna (preco: Decimal | None, erro: str | None).

    STUB — integrar com a API contratada quando disponível.

    Exemplo B3/CBOT:
        import requests
        r = requests.get(
            'https://api.b3.com.br/v1/produtos/preco',
            params={'produto': produto_nome, 'fonte': fonte},
            headers={'Authorization': f'Bearer {settings.B3_API_KEY}'},
            timeout=5,
        )
        return Decimal(str(r.json()['ultimo_preco'])), None

    Exemplo ESALQ/Cepea:
        r = requests.get(
            'https://cepea.esalq.usp.br/api/cotacao',
            params={'produto': produto_nome},
            timeout=5,
        )
        return Decimal(str(r.json()['preco_a_vista'])), None
    """
    return None, (
        f'Integração com {fonte.upper()} não configurada. '
        'Informe a cotação manualmente ou contrate a API de preços.'
    )


# ══════════════════════════════════════════════════════════════════════════════
# CPR
# ══════════════════════════════════════════════════════════════════════════════

def listar_cprs(empresa_id, status=None):
    from .models import CPR
    qs = CPR.objects.filter(empresa_id=empresa_id).select_related('emitente', 'produto')
    if status:
        qs = qs.filter(status=status)
    hoje = timezone.now().date()
    resultado = []
    for cpr in qs:
        entregue = sum(e.quantidade_entregue for e in cpr.entregas.all())
        resultado.append({
            'id':                    cpr.id,
            'numero':                cpr.numero,
            'emitente':              cpr.emitente.nome_fantasia or cpr.emitente.nome_razao,
            'emitente_id':           cpr.emitente_id,
            'produto':               cpr.produto.nome,
            'produto_id':            cpr.produto_id,
            'quantidade_sacas':      float(cpr.quantidade_sacas),
            'quantidade_entregue':   float(entregue),
            'quantidade_pendente':   float(cpr.quantidade_sacas - entregue),
            'pct_entregue':          round(float(entregue / cpr.quantidade_sacas * 100), 1) if cpr.quantidade_sacas else 0,
            'valor_credito':         float(cpr.valor_credito),
            'data_emissao':          cpr.data_emissao.strftime('%d/%m/%Y'),
            'data_vencimento':       cpr.data_vencimento.strftime('%d/%m/%Y'),
            'dias_para_vencer':      (cpr.data_vencimento - hoje).days,
            'status':                cpr.status,
            'local_entrega':         cpr.local_entrega,
            'qualidade_minima':      cpr.qualidade_minima,
            'garantias':             cpr.garantias,
            'preco_mercado_manual':  float(cpr.preco_mercado_manual) if cpr.preco_mercado_manual else None,
            'fonte_preco':           cpr.fonte_preco,
            'pedido_venda_id':       cpr.pedido_venda_id,
            'observacoes':           cpr.observacoes,
        })
    return resultado


def registrar_entrega_cpr(empresa_id, cpr_id, data_entrega, quantidade, nota_fiscal='', observacoes=''):
    from .models import CPR, EntregaCPR
    try:
        cpr = CPR.objects.get(id=cpr_id, empresa_id=empresa_id)
    except CPR.DoesNotExist:
        return None, 'CPR não encontrada.'
    if cpr.status not in ['aberta']:
        return None, f'CPR com status "{cpr.status}" não permite novas entregas.'

    quantidade = Decimal(str(quantidade))
    entregue_total = sum(e.quantidade_entregue for e in cpr.entregas.all())
    if entregue_total + quantidade > cpr.quantidade_sacas:
        return None, (
            f'Quantidade excede o saldo da CPR. '
            f'Pendente: {float(cpr.quantidade_sacas - entregue_total)} sacas.'
        )

    entrega = EntregaCPR.objects.create(
        cpr=cpr,
        data_entrega=data_entrega,
        quantidade_entregue=quantidade,
        nota_fiscal_entrada=nota_fiscal,
        observacoes=observacoes,
    )

    novo_total = entregue_total + quantidade
    if novo_total >= cpr.quantidade_sacas:
        cpr.status = 'liquidada_fisica'
        cpr.save(update_fields=['status'])

    return {
        'entrega_id':          entrega.id,
        'quantidade_entregue': float(quantidade),
        'total_entregue':      float(novo_total),
        'pendente':            float(cpr.quantidade_sacas - novo_total),
        'status_cpr':          cpr.status,
    }, None


def liquidar_cpr_financeira(empresa_id, cpr_id, preco_mercado, fonte_preco='manual'):
    from .models import CPR
    try:
        cpr = CPR.objects.get(id=cpr_id, empresa_id=empresa_id)
    except CPR.DoesNotExist:
        return None, 'CPR não encontrada.'
    if cpr.status not in ['aberta']:
        return None, f'CPR com status "{cpr.status}" não pode ser liquidada financeiramente.'

    preco_mercado = Decimal(str(preco_mercado))
    entregue = sum(e.quantidade_entregue for e in cpr.entregas.all())
    pendente = cpr.quantidade_sacas - entregue
    valor_liquidacao = pendente * preco_mercado

    cpr.preco_mercado_manual = preco_mercado
    cpr.fonte_preco = fonte_preco
    cpr.status = 'liquidada_financeira'
    cpr.save(update_fields=['preco_mercado_manual', 'fonte_preco', 'status'])

    return {
        'cpr_id':           cpr.id,
        'sacas_liquidadas': float(pendente),
        'preco_mercado':    float(preco_mercado),
        'fonte_preco':      fonte_preco,
        'valor_liquidacao': float(valor_liquidacao),
    }, None


def alertas_cpr(empresa_id):
    from .models import CPR
    hoje = timezone.now().date()
    alertas = []
    cprs = CPR.objects.filter(empresa_id=empresa_id, status='aberta')
    for cpr in cprs:
        dias = (cpr.data_vencimento - hoje).days
        if dias < 0:
            alertas.append({
                'cpr_id':  cpr.id,
                'numero':  cpr.numero,
                'cliente': cpr.emitente.nome_fantasia or cpr.emitente.nome_razao,
                'tipo':    'vencida',
                'dias':    abs(dias),
                'msg':     f'CPR vencida há {abs(dias)} dia(s).',
            })
        elif dias <= 5:
            alertas.append({'cpr_id': cpr.id, 'numero': cpr.numero, 'cliente': cpr.emitente.nome_fantasia or cpr.emitente.nome_razao, 'tipo': 'critico', 'dias': dias, 'msg': f'Vence em {dias} dia(s).'})
        elif dias <= 15:
            alertas.append({'cpr_id': cpr.id, 'numero': cpr.numero, 'cliente': cpr.emitente.nome_fantasia or cpr.emitente.nome_razao, 'tipo': 'alerta', 'dias': dias, 'msg': f'Vence em {dias} dia(s).'})
        elif dias <= 30:
            alertas.append({'cpr_id': cpr.id, 'numero': cpr.numero, 'cliente': cpr.emitente.nome_fantasia or cpr.emitente.nome_razao, 'tipo': 'aviso', 'dias': dias, 'msg': f'Vence em {dias} dia(s).'})
    return alertas


# ══════════════════════════════════════════════════════════════════════════════
# BARTER
# ══════════════════════════════════════════════════════════════════════════════

def listar_barters(empresa_id, status=None):
    from .models import ContratosBarter
    qs = ContratosBarter.objects.filter(empresa_id=empresa_id).select_related('produtor', 'produto_receber').prefetch_related('itens', 'entregas')
    if status:
        qs = qs.filter(status=status)
    hoje = timezone.now().date()
    resultado = []
    for b in qs:
        valor_insumos = sum(i.subtotal for i in b.itens.all()) or b.valor_insumos
        entregue = sum(e.quantidade_entregue for e in b.entregas.all())
        qtd_equiv = b.quantidade_equivalente()
        resultado.append({
            'id':                     b.id,
            'numero':                 b.numero,
            'produtor':               b.produtor.nome_fantasia or b.produtor.nome_razao,
            'produtor_id':            b.produtor_id,
            'produto_receber':        b.produto_receber.nome,
            'produto_receber_id':     b.produto_receber_id,
            'safra':                  b.safra,
            'quantidade_sacas':       float(b.quantidade_sacas),
            'quantidade_entregue':    float(entregue),
            'quantidade_pendente':    float(b.quantidade_sacas - entregue),
            'preco_referencia':       float(b.preco_referencia_manual) if b.preco_referencia_manual else None,
            'fonte_preco_referencia': b.fonte_preco_referencia,
            'quantidade_equivalente': float(qtd_equiv) if qtd_equiv else None,
            'valor_insumos':          float(valor_insumos),
            'data_contrato':          b.data_contrato.strftime('%d/%m/%Y'),
            'data_entrega_prevista':  b.data_entrega_prevista.strftime('%d/%m/%Y'),
            'dias_para_entrega':      (b.data_entrega_prevista - hoje).days,
            'status':                 b.status,
            'observacoes':            b.observacoes,
        })
    return resultado


def registrar_entrega_barter(empresa_id, contrato_id, data_entrega, quantidade,
                              preco_entrega_manual, fonte_preco='manual', nota_fiscal='', observacoes=''):
    from .models import ContratosBarter, EntregaBarter
    try:
        contrato = ContratosBarter.objects.get(id=contrato_id, empresa_id=empresa_id)
    except ContratosBarter.DoesNotExist:
        return None, 'Contrato Barter não encontrado.'
    if contrato.status != 'ativo':
        return None, f'Contrato com status "{contrato.status}" não aceita entregas.'

    quantidade = Decimal(str(quantidade))
    preco_entrega = Decimal(str(preco_entrega_manual))
    preco_ref = contrato.preco_referencia_manual or Decimal('0')

    # Ajuste financeiro = (preço_entrega - preço_referência) × quantidade
    ajuste = (preco_entrega - preco_ref) * quantidade

    entrega = EntregaBarter.objects.create(
        contrato=contrato,
        data_entrega=data_entrega,
        quantidade_entregue=quantidade,
        preco_entrega_manual=preco_entrega,
        fonte_preco_entrega=fonte_preco,
        ajuste_financeiro=ajuste,
        nota_fiscal_entrada=nota_fiscal,
        observacoes=observacoes,
    )

    entregue_total = sum(e.quantidade_entregue for e in contrato.entregas.all())
    if entregue_total >= contrato.quantidade_sacas:
        contrato.status = 'entregue'
        contrato.save(update_fields=['status'])

    return {
        'entrega_id':         entrega.id,
        'quantidade_entregue': float(quantidade),
        'preco_entrega':      float(preco_entrega),
        'preco_referencia':   float(preco_ref),
        'ajuste_financeiro':  float(ajuste),
        'status_contrato':    contrato.status,
    }, None


# ══════════════════════════════════════════════════════════════════════════════
# CONTRATO A TERMO
# ══════════════════════════════════════════════════════════════════════════════

def listar_termos(empresa_id, status=None):
    from .models import ContratoTermo
    qs = ContratoTermo.objects.filter(empresa_id=empresa_id).select_related('produto', 'contraparte').prefetch_related('entregas')
    if status:
        qs = qs.filter(status=status)
    hoje = timezone.now().date()
    resultado = []
    for t in qs:
        entregue = sum(e.quantidade_entregue for e in t.entregas.all())
        exposicao = t.exposicao_mercado()
        resultado.append({
            'id':                  t.id,
            'numero':              t.numero,
            'tipo':                t.tipo,
            'tipo_display':        t.get_tipo_display(),
            'contraparte':         t.contraparte.nome_fantasia or t.contraparte.nome_razao if t.contraparte else t.contraparte_nome,
            'contraparte_id':      t.contraparte_id,
            'produto':             t.produto.nome,
            'produto_id':          t.produto_id,
            'safra':               t.safra,
            'quantidade':          float(t.quantidade),
            'quantidade_entregue': float(entregue),
            'quantidade_pendente': float(t.quantidade - entregue),
            'preco_travado':       float(t.preco_travado),
            'valor_total_travado': float(t.valor_total_travado),
            'preco_mercado_manual': float(t.preco_mercado_manual) if t.preco_mercado_manual else None,
            'fonte_preco_mercado': t.fonte_preco_mercado,
            'exposicao_mercado':   exposicao,
            'data_contrato':       t.data_contrato.strftime('%d/%m/%Y'),
            'data_entrega':        t.data_entrega.strftime('%d/%m/%Y'),
            'dias_para_entrega':   (t.data_entrega - hoje).days,
            'status':              t.status,
            'observacoes':         t.observacoes,
        })
    return resultado


def formalizar_entrega_termo(empresa_id, contrato_id, data_entrega, quantidade,
                              preco_entrega, nota_fiscal='', observacoes=''):
    from .models import ContratoTermo, EntregaTermo
    try:
        contrato = ContratoTermo.objects.get(id=contrato_id, empresa_id=empresa_id)
    except ContratoTermo.DoesNotExist:
        return None, 'Contrato a termo não encontrado.'
    if contrato.status != 'aberto':
        return None, f'Contrato com status "{contrato.status}" não aceita entregas.'

    quantidade = Decimal(str(quantidade))
    preco_entrega = Decimal(str(preco_entrega))
    resultado_financeiro = (preco_entrega - contrato.preco_travado) * quantidade

    entrega = EntregaTermo.objects.create(
        contrato=contrato,
        data_entrega=data_entrega,
        quantidade_entregue=quantidade,
        preco_entrega=preco_entrega,
        resultado_financeiro=resultado_financeiro,
        nota_fiscal=nota_fiscal,
        observacoes=observacoes,
    )

    entregue_total = sum(e.quantidade_entregue for e in contrato.entregas.all())
    if entregue_total >= contrato.quantidade:
        contrato.status = 'entregue'
        contrato.save(update_fields=['status'])

    return {
        'entrega_id':            entrega.id,
        'preco_travado':         float(contrato.preco_travado),
        'preco_entrega':         float(preco_entrega),
        'resultado_financeiro':  float(resultado_financeiro),
        'status_contrato':       contrato.status,
    }, None


def painel_termos_por_safra(empresa_id):
    from .models import ContratoTermo
    from django.db.models import Sum
    termos = ContratoTermo.objects.filter(empresa_id=empresa_id, status='aberto')
    safras = {}
    for t in termos.select_related('produto'):
        chave = t.safra or 'Sem safra'
        if chave not in safras:
            safras[chave] = {'safra': chave, 'compra': [], 'venda': []}
        item = {
            'id':            t.id,
            'produto':       t.produto.nome,
            'quantidade':    float(t.quantidade),
            'preco_travado': float(t.preco_travado),
            'valor_total':   float(t.valor_total_travado),
            'data_entrega':  t.data_entrega.strftime('%d/%m/%Y'),
        }
        safras[chave][t.tipo].append(item)
    return list(safras.values())


def alertas_contratos(empresa_id):
    from .models import CPR, ContratosBarter, ContratoTermo
    hoje = timezone.now().date()
    alertas = []

    for cpr in CPR.objects.filter(empresa_id=empresa_id, status='aberta'):
        dias = (cpr.data_vencimento - hoje).days
        if dias <= 30:
            nivel = 'critico' if dias <= 5 else 'alerta' if dias <= 15 else 'aviso'
            alertas.append({'tipo': 'CPR', 'nivel': nivel, 'id': cpr.id, 'numero': cpr.numero,
                            'descricao': f"{cpr.emitente.nome_fantasia or cpr.emitente.nome_razao} — vence em {dias}d"})

    for b in ContratosBarter.objects.filter(empresa_id=empresa_id, status='ativo').select_related('produtor'):
        dias = (b.data_entrega_prevista - hoje).days
        if dias <= 30:
            nivel = 'critico' if dias <= 5 else 'alerta' if dias <= 15 else 'aviso'
            alertas.append({'tipo': 'Barter', 'nivel': nivel, 'id': b.id, 'numero': b.numero,
                            'descricao': f"{b.produtor.nome_fantasia or b.produtor.nome_razao} — entrega em {dias}d"})

    for t in ContratoTermo.objects.filter(empresa_id=empresa_id, status='aberto').select_related('produto'):
        dias = (t.data_entrega - hoje).days
        if dias <= 30:
            nivel = 'critico' if dias <= 5 else 'alerta' if dias <= 15 else 'aviso'
            alertas.append({'tipo': 'Termo', 'nivel': nivel, 'id': t.id, 'numero': t.numero,
                            'descricao': f"{t.produto.nome} ({t.get_tipo_display()}) — entrega em {dias}d"})

    alertas.sort(key=lambda x: (0 if x['nivel'] == 'critico' else 1 if x['nivel'] == 'alerta' else 2))
    return alertas
