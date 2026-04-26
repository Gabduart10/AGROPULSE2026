# gestao/credito_cobranca.py
# Módulo de Cobrança e Crédito Rural
# Lógica de negócio: score, análise, PDD, aging, cobrança ativa, acordos

from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count, Q


def _get_config(empresa_id):
    from .models import ConfiguracaoCreditoCobranca, Empresa
    try:
        return ConfiguracaoCreditoCobranca.objects.get(empresa_id=empresa_id)
    except ConfiguracaoCreditoCobranca.DoesNotExist:
        empresa = Empresa.objects.get(id=empresa_id)
        return ConfiguracaoCreditoCobranca.objects.create(empresa=empresa)


# ══════════════════════════════════════════════════════════════════════════════
# SCORE DE CRÉDITO INTERNO
# ══════════════════════════════════════════════════════════════════════════════

def calcular_score_cliente(empresa_id, cliente_id):
    """
    Calcula o score de crédito interno (0–100) para um cliente.

    Componentes configuráveis:
      - Histórico de pagamentos (default 40%): pontualidade em ContaReceber
      - Tempo de relacionamento (default 20%): meses desde primeiro pedido
      - Volume de compras (default 20%): total comprado no último ano
      - Dados cadastrais (default 20%): completude do cadastro

    Classificação:
      90-100 → A  (excelente)
      70-89  → B  (bom)
      50-69  → C  (regular)
      30-49  → D  (atenção)
      0-29   → E  (risco)
    """
    from .models import Cliente, ContaReceber, PedidoVenda, ScoreCredito

    try:
        cliente = Cliente.objects.get(id=cliente_id, empresa_id=empresa_id)
    except Cliente.DoesNotExist:
        return None, 'Cliente não encontrado.'

    config = _get_config(empresa_id)
    hoje = timezone.now().date()
    ano_atras = hoje.replace(year=hoje.year - 1)

    # ── 1. Histórico de pagamentos ────────────────────────────────────────────
    contas = ContaReceber.objects.filter(cliente=cliente, empresa_id=empresa_id)
    total_contas = contas.count()
    if total_contas > 0:
        pagas_no_prazo = contas.filter(
            status='pago',
            data_pagamento__lte=timezone.now().date(),
        ).exclude(
            data_pagamento__gt=models_F_data_vencimento(contas)
        ).count()
        # Simplificado: pagas_no_prazo / total (sem F expression — usa atraso)
        atrasadas = contas.filter(
            status='pendente',
            data_vencimento__lt=hoje,
        ).count()
        inadimplencia_pct = atrasadas / total_contas
        score_hist = max(0, 100 * (1 - inadimplencia_pct * 2))
    else:
        score_hist = 50  # Sem histórico = neutro

    # ── 2. Tempo de relacionamento ────────────────────────────────────────────
    primeiro_pedido = PedidoVenda.objects.filter(
        cliente=cliente, empresa_id=empresa_id
    ).order_by('data_pedido').first()

    if primeiro_pedido:
        meses = max(0, (hoje - primeiro_pedido.data_pedido.date()).days / 30)
        score_tempo = min(100, meses / 0.6)  # 60 meses (5 anos) = 100
    else:
        score_tempo = 0

    # ── 3. Volume de compras ──────────────────────────────────────────────────
    volume_ano = PedidoVenda.objects.filter(
        cliente=cliente, empresa_id=empresa_id,
        status__in=['aprovado', 'faturado'],
        data_pedido__date__gte=ano_atras,
    ).aggregate(total=Sum('valor_total'))['total'] or Decimal('0')

    score_volume = min(100, float(volume_ano) / 500)  # R$ 50.000 = 100

    # ── 4. Dados cadastrais ───────────────────────────────────────────────────
    campos = ['cnpj_cpf', 'telefone', 'endereco', 'responsavel', 'data_nascimento']
    preenchidos = sum(1 for c in campos if getattr(cliente, c))
    score_cad = (preenchidos / len(campos)) * 100

    # ── Score final ponderado ─────────────────────────────────────────────────
    total_peso = (
        config.peso_historico_pagamento +
        config.peso_tempo_relacionamento +
        config.peso_volume_compras +
        config.peso_dados_cadastrais
    )
    score_total = (
        score_hist   * config.peso_historico_pagamento +
        score_tempo  * config.peso_tempo_relacionamento +
        score_volume * config.peso_volume_compras +
        score_cad    * config.peso_dados_cadastrais
    ) / max(total_peso, 1)

    score_total = round(min(100, max(0, score_total)), 2)

    if score_total >= 90:   classificacao = 'A'
    elif score_total >= 70: classificacao = 'B'
    elif score_total >= 50: classificacao = 'C'
    elif score_total >= 30: classificacao = 'D'
    else:                   classificacao = 'E'

    from .models import ScoreCredito
    score_obj, _ = ScoreCredito.objects.update_or_create(
        empresa_id=empresa_id,
        cliente=cliente,
        defaults={
            'score_total':                Decimal(str(score_total)),
            'score_historico_pagamento':  Decimal(str(round(score_hist, 2))),
            'score_tempo_relacionamento': Decimal(str(round(score_tempo, 2))),
            'score_volume_compras':       Decimal(str(round(score_volume, 2))),
            'score_dados_cadastrais':     Decimal(str(round(score_cad, 2))),
            'classificacao':              classificacao,
        }
    )

    return {
        'cliente_id':                  cliente_id,
        'cliente_nome':                cliente.nome_fantasia or cliente.nome_razao,
        'score_total':                 float(score_total),
        'classificacao':               classificacao,
        'score_historico_pagamento':   round(score_hist, 2),
        'score_tempo_relacionamento':  round(score_tempo, 2),
        'score_volume_compras':        round(score_volume, 2),
        'score_dados_cadastrais':      round(score_cad, 2),
        'calculado_em':                score_obj.calculado_em.strftime('%d/%m/%Y %H:%M'),
    }, None


# ══════════════════════════════════════════════════════════════════════════════
# AGING DE RECEBÍVEIS (7 FAIXAS)
# ══════════════════════════════════════════════════════════════════════════════

def calcular_aging_carteira(empresa_id):
    """
    Aging completo com 7 faixas conforme spec:
    a vencer | 1-15 | 16-30 | 31-60 | 61-90 | 91-180 | acima 180 dias
    Exclui títulos em disputa das métricas de inadimplência.
    """
    from .models import ContaReceber, TituloEmDisputa

    hoje = timezone.now().date()
    ids_disputa = TituloEmDisputa.objects.filter(
        empresa_id=empresa_id,
        status='em_disputa',
    ).values_list('conta_receber_id', flat=True)

    contas = ContaReceber.objects.filter(
        empresa_id=empresa_id,
        status='pendente',
    ).exclude(id__in=ids_disputa).select_related('cliente')

    faixas = {
        'a_vencer':      {'label': 'A Vencer',      'contas': [], 'total': Decimal('0')},
        '1_15_dias':     {'label': '1–15 dias',      'contas': [], 'total': Decimal('0')},
        '16_30_dias':    {'label': '16–30 dias',     'contas': [], 'total': Decimal('0')},
        '31_60_dias':    {'label': '31–60 dias',     'contas': [], 'total': Decimal('0')},
        '61_90_dias':    {'label': '61–90 dias',     'contas': [], 'total': Decimal('0')},
        '91_180_dias':   {'label': '91–180 dias',    'contas': [], 'total': Decimal('0')},
        'acima_180_dias':{'label': 'Acima 180 dias', 'contas': [], 'total': Decimal('0')},
    }

    total_carteira   = Decimal('0')
    total_vencido    = Decimal('0')

    for conta in contas:
        dias = (hoje - conta.data_vencimento).days
        total_carteira += conta.valor

        item = {
            'id':           conta.id,
            'cliente':      conta.cliente.nome_fantasia or conta.cliente.nome_razao,
            'cliente_id':   conta.cliente_id,
            'telefone':     conta.cliente.telefone,
            'descricao':    conta.descricao,
            'valor':        float(round(conta.valor, 2)),
            'vencimento':   conta.data_vencimento.strftime('%d/%m/%Y'),
            'dias_atraso':  dias if dias > 0 else 0,
        }

        if dias <= 0:
            faixas['a_vencer']['contas'].append(item)
            faixas['a_vencer']['total'] += conta.valor
        elif dias <= 15:
            faixas['1_15_dias']['contas'].append(item)
            faixas['1_15_dias']['total'] += conta.valor
            total_vencido += conta.valor
        elif dias <= 30:
            faixas['16_30_dias']['contas'].append(item)
            faixas['16_30_dias']['total'] += conta.valor
            total_vencido += conta.valor
        elif dias <= 60:
            faixas['31_60_dias']['contas'].append(item)
            faixas['31_60_dias']['total'] += conta.valor
            total_vencido += conta.valor
        elif dias <= 90:
            faixas['61_90_dias']['contas'].append(item)
            faixas['61_90_dias']['total'] += conta.valor
            total_vencido += conta.valor
        elif dias <= 180:
            faixas['91_180_dias']['contas'].append(item)
            faixas['91_180_dias']['total'] += conta.valor
            total_vencido += conta.valor
        else:
            faixas['acima_180_dias']['contas'].append(item)
            faixas['acima_180_dias']['total'] += conta.valor
            total_vencido += conta.valor

    for f in faixas.values():
        f['total'] = float(round(f['total'], 2))
        f['quantidade'] = len(f['contas'])

    indice_inadimplencia = float(
        round((total_vencido / total_carteira * 100), 2)
        if total_carteira > 0 else Decimal('0')
    )

    return {
        'faixas': faixas,
        'total_carteira':       float(round(total_carteira, 2)),
        'total_vencido':        float(round(total_vencido, 2)),
        'indice_inadimplencia': indice_inadimplencia,
        'data_referencia':      hoje.strftime('%d/%m/%Y'),
    }


# ══════════════════════════════════════════════════════════════════════════════
# PAINEL DA CARTEIRA
# ══════════════════════════════════════════════════════════════════════════════

def painel_carteira(empresa_id):
    """
    Retorna painel consolidado: limite total, saldo utilizado, disponível,
    vencimentos próximos e alertas de concentração.
    """
    from .models import Cliente, ContaReceber, TituloEmDisputa

    hoje = timezone.now().date()
    em_7_dias = hoje.__class__(hoje.year, hoje.month, hoje.day)
    from datetime import timedelta
    em_7_dias = hoje + timedelta(days=7)

    config = _get_config(empresa_id)

    clientes = Cliente.objects.filter(empresa_id=empresa_id, ativo=True)
    total_limite = clientes.aggregate(t=Sum('limite_credito'))['t'] or Decimal('0')

    ids_disputa = TituloEmDisputa.objects.filter(
        empresa_id=empresa_id, status='em_disputa'
    ).values_list('conta_receber_id', flat=True)

    contas_pendentes = ContaReceber.objects.filter(
        empresa_id=empresa_id, status='pendente'
    ).exclude(id__in=ids_disputa)

    saldo_utilizado = contas_pendentes.aggregate(t=Sum('valor'))['t'] or Decimal('0')
    saldo_disponivel = max(Decimal('0'), total_limite - saldo_utilizado)

    # Vencimentos nos próximos 7 dias
    vencendo_breve = contas_pendentes.filter(
        data_vencimento__gte=hoje,
        data_vencimento__lte=em_7_dias,
    ).aggregate(t=Sum('valor'))['t'] or Decimal('0')

    # Alerta de concentração
    alertas_concentracao = []
    if total_limite > 0:
        for cliente in clientes:
            divida = contas_pendentes.filter(cliente=cliente).aggregate(t=Sum('valor'))['t'] or Decimal('0')
            pct = divida / saldo_utilizado * 100 if saldo_utilizado > 0 else Decimal('0')
            if pct >= config.pct_concentracao_alerta and divida > 0:
                alertas_concentracao.append({
                    'cliente': cliente.nome_fantasia or cliente.nome_razao,
                    'cliente_id': cliente.id,
                    'divida': float(round(divida, 2)),
                    'percentual': float(round(pct, 2)),
                })

    return {
        'total_limite_concedido': float(round(total_limite, 2)),
        'saldo_utilizado':        float(round(saldo_utilizado, 2)),
        'saldo_disponivel':       float(round(saldo_disponivel, 2)),
        'vencendo_7_dias':        float(round(vencendo_breve, 2)),
        'alertas_concentracao':   alertas_concentracao,
        'pct_concentracao_config': float(config.pct_concentracao_alerta),
    }


# ══════════════════════════════════════════════════════════════════════════════
# PDD — PROVISÃO PARA DEVEDORES DUVIDOSOS
# ══════════════════════════════════════════════════════════════════════════════

def calcular_pdd(empresa_id):
    """
    Calcula PDD por faixa de atraso com percentuais configuráveis.
    """
    from .models import ContaReceber, TituloEmDisputa

    config = _get_config(empresa_id)
    hoje = timezone.now().date()

    ids_disputa = TituloEmDisputa.objects.filter(
        empresa_id=empresa_id, status='em_disputa'
    ).values_list('conta_receber_id', flat=True)

    contas_vencidas = ContaReceber.objects.filter(
        empresa_id=empresa_id,
        status='pendente',
        data_vencimento__lt=hoje,
    ).exclude(id__in=ids_disputa)

    faixas_pdd = [
        ('1_30',    1,   30,  config.pdd_1_30_dias),
        ('31_60',   31,  60,  config.pdd_31_60_dias),
        ('61_90',   61,  90,  config.pdd_61_90_dias),
        ('91_180',  91,  180, config.pdd_91_180_dias),
        ('acima_180', 181, 99999, config.pdd_acima_180_dias),
    ]

    resultado = []
    pdd_total = Decimal('0')

    for chave, dias_min, dias_max, aliquota in faixas_pdd:
        contas_faixa = [
            c for c in contas_vencidas
            if dias_min <= (hoje - c.data_vencimento).days <= dias_max
        ]
        total_faixa = sum(c.valor for c in contas_faixa)
        pdd_faixa = total_faixa * aliquota / 100
        pdd_total += pdd_faixa

        resultado.append({
            'faixa':        chave,
            'label':        f'{dias_min}–{dias_max if dias_max < 9999 else "∞"} dias',
            'quantidade':   len(contas_faixa),
            'total_faixa':  float(round(total_faixa, 2)),
            'aliquota_pdd': float(aliquota),
            'pdd':          float(round(pdd_faixa, 2)),
        })

    return {
        'faixas':    resultado,
        'pdd_total': float(round(pdd_total, 2)),
        'referencia': hoje.strftime('%d/%m/%Y'),
    }


# ══════════════════════════════════════════════════════════════════════════════
# COBRANÇA ATIVA — LISTA DIÁRIA
# ══════════════════════════════════════════════════════════════════════════════

def gerar_lista_cobranca_diaria(empresa_id):
    """
    Gera lista priorizada de contatos agrupada por cliente.
    Cada entrada consolida todos os títulos vencidos do cliente.
    Prioridade: maior dias_atraso_max, depois maior valor_total_vencido.
    Exclui títulos em disputa.
    """
    from .models import ContaReceber, TituloEmDisputa, TentativaCobranca, ScoreCredito

    hoje = timezone.now().date()
    ids_disputa = TituloEmDisputa.objects.filter(
        empresa_id=empresa_id, status='em_disputa'
    ).values_list('conta_receber_id', flat=True)

    contas_vencidas = ContaReceber.objects.filter(
        empresa_id=empresa_id,
        status='pendente',
        data_vencimento__lt=hoje,
    ).exclude(id__in=ids_disputa).select_related('cliente')

    # Agrupa por cliente
    clientes_map = {}
    for conta in contas_vencidas:
        cid = conta.cliente_id
        dias = (hoje - conta.data_vencimento).days
        if cid not in clientes_map:
            clientes_map[cid] = {
                'cliente_id':          cid,
                'cliente':             conta.cliente.nome_fantasia or conta.cliente.nome_razao,
                'telefone':            conta.cliente.telefone or '',
                'valor_total_vencido': Decimal('0'),
                'qtd_titulos':         0,
                'dias_atraso':         0,
                'titulos':             [],
            }
        clientes_map[cid]['valor_total_vencido'] += conta.valor
        clientes_map[cid]['qtd_titulos'] += 1
        clientes_map[cid]['dias_atraso'] = max(clientes_map[cid]['dias_atraso'], dias)
        clientes_map[cid]['titulos'].append({
            'conta_id':   conta.id,
            'descricao':  conta.descricao or '',
            'valor':      float(round(conta.valor, 2)),
            'vencimento': conta.data_vencimento.strftime('%d/%m/%Y'),
            'dias_atraso': dias,
        })

    if not clientes_map:
        return []

    # Última tentativa por cliente
    ultima_por_cliente = {}
    tentativas = TentativaCobranca.objects.filter(
        empresa_id=empresa_id,
        cliente_id__in=list(clientes_map.keys()),
    ).order_by('-criado_em')
    for t in tentativas:
        if t.cliente_id not in ultima_por_cliente:
            ultima_por_cliente[t.cliente_id] = t

    # Score por cliente
    scores = ScoreCredito.objects.filter(
        empresa_id=empresa_id,
        cliente_id__in=list(clientes_map.keys()),
    )
    score_map = {s.cliente_id: s.classificacao for s in scores}

    lista = []
    for cid, dados in clientes_map.items():
        ult = ultima_por_cliente.get(cid)
        lista.append({
            'cliente_id':          cid,
            'cliente':             dados['cliente'],
            'telefone':            dados['telefone'],
            'valor_total_vencido': float(round(dados['valor_total_vencido'], 2)),
            'qtd_titulos':         dados['qtd_titulos'],
            'dias_atraso':         dados['dias_atraso'],
            'titulos':             sorted(dados['titulos'], key=lambda x: -x['dias_atraso']),
            'ultima_tentativa':    ult.criado_em.strftime('%d/%m/%Y') if ult else None,
            'ultimo_resultado':    ult.get_resultado_display() if ult else None,
            'proxima_acao':        ult.proxima_acao if ult else '',
            'proxima_acao_data':   ult.proxima_acao_data.strftime('%d/%m/%Y') if ult and ult.proxima_acao_data else None,
            'score':               score_map.get(cid, '—'),
        })

    lista.sort(key=lambda x: (-x['dias_atraso'], -x['valor_total_vencido']))
    return lista


# ══════════════════════════════════════════════════════════════════════════════
# HISTÓRICO MENSAL DE INADIMPLÊNCIA
# ══════════════════════════════════════════════════════════════════════════════

def registrar_snapshot_inadimplencia(empresa_id):
    """
    Salva (ou atualiza) o snapshot de inadimplência do mês/ano atual.
    Chamado diariamente pelo management command.
    """
    from .models import HistoricoInadimplencia

    hoje = timezone.now().date()
    aging = calcular_aging_carteira(empresa_id)
    pdd   = calcular_pdd(empresa_id)

    total_carteira = Decimal(str(aging['total_carteira']))
    total_vencido  = Decimal(str(aging['total_vencido']))
    indice_pct     = Decimal(str(aging['indice_inadimplencia']))
    pdd_total      = Decimal(str(pdd['pdd_total']))

    obj, created = HistoricoInadimplencia.objects.update_or_create(
        empresa_id=empresa_id,
        mes=hoje.month,
        ano=hoje.year,
        defaults={
            'indice_pct':     indice_pct,
            'total_carteira': total_carteira,
            'total_vencido':  total_vencido,
            'pdd_total':      pdd_total,
        },
    )
    return obj, created


def listar_historico_inadimplencia(empresa_id, meses=12):
    """
    Retorna os últimos N meses de histórico de inadimplência.
    """
    from .models import HistoricoInadimplencia

    registros = HistoricoInadimplencia.objects.filter(
        empresa_id=empresa_id,
    ).order_by('ano', 'mes')[:meses]

    meses_pt = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    return [{
        'mes':            r.mes,
        'ano':            r.ano,
        'label':          f"{meses_pt[r.mes]}/{str(r.ano)[2:]}",
        'indice_pct':     float(r.indice_pct),
        'total_carteira': float(r.total_carteira),
        'total_vencido':  float(r.total_vencido),
        'pdd_total':      float(r.pdd_total),
    } for r in registros]


# ══════════════════════════════════════════════════════════════════════════════
# PACOTE JURÍDICO
# ══════════════════════════════════════════════════════════════════════════════

def gerar_pacote_juridico(empresa_id, titulo_disputa_id):
    """
    Gera resumo do pacote de documentos para encaminhamento ao advogado.
    Retorna dict com dados consolidados do título e histórico de cobrança.
    """
    from .models import TituloEmDisputa, TentativaCobranca, LogAuditoria, Empresa

    try:
        titulo = TituloEmDisputa.objects.select_related(
            'conta_receber', 'conta_receber__cliente',
        ).get(id=titulo_disputa_id, empresa_id=empresa_id)
    except TituloEmDisputa.DoesNotExist:
        return None, 'Título em disputa não encontrado.'

    conta    = titulo.conta_receber
    cliente  = conta.cliente
    tentativas = TentativaCobranca.objects.filter(
        empresa_id=empresa_id, conta_receber=conta
    ).order_by('criado_em')

    pacote = {
        'titulo_id':         titulo.id,
        'cliente':           cliente.nome_razao,
        'cnpj_cpf':          cliente.cnpj_cpf,
        'endereco':          cliente.endereco or 'Não informado',
        'telefone':          cliente.telefone or 'Não informado',
        'valor_original':    float(round(conta.valor, 2)),
        'vencimento':        conta.data_vencimento.strftime('%d/%m/%Y'),
        'dias_atraso':       (timezone.now().date() - conta.data_vencimento).days,
        'motivo_disputa':    titulo.motivo,
        'tentativas_cobranca': [{
            'data':      t.criado_em.strftime('%d/%m/%Y %H:%M'),
            'tipo':      t.get_tipo_contato_display(),
            'resultado': t.get_resultado_display(),
            'obs':       t.observacao,
        } for t in tentativas],
        'total_tentativas':  tentativas.count(),
        'gerado_em':         timezone.now().strftime('%d/%m/%Y %H:%M'),
    }

    # Marca documentos como gerados
    titulo.documentos_gerados = True
    titulo.status = 'encaminhado_juridico'
    titulo.save(update_fields=['documentos_gerados', 'status'])

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=None,
            acao='cancelamento_nfe', modelo_afetado='TituloEmDisputa',
            registro_id=titulo.id,
            descricao=f"Pacote jurídico gerado para título {titulo.id} — cliente {cliente.nome_razao}",
        )
    except Exception:
        pass

    return pacote, None


# ══════════════════════════════════════════════════════════════════════════════
# APROVAÇÃO DE FICHA POR ALÇADA
# ══════════════════════════════════════════════════════════════════════════════

def aprovar_ficha_credito(empresa_id, ficha_id, usuario, limite_aprovado, observacoes=''):
    """
    Aprova ficha de análise de crédito respeitando alçadas.
    Atualiza Cliente.limite_credito após aprovação.
    """
    from .models import FichaAnaliseCredito, Cliente, LogAuditoria, Empresa

    try:
        ficha = FichaAnaliseCredito.objects.get(id=ficha_id, empresa_id=empresa_id)
    except FichaAnaliseCredito.DoesNotExist:
        return False, 'Ficha não encontrada.'

    config = _get_config(empresa_id)
    nivel = getattr(usuario, 'nivel', 'vendedor')
    limite_aprovado = Decimal(str(limite_aprovado))

    # Valida alçada
    if nivel == 'gerente' and limite_aprovado > config.limite_alcada_gerente:
        return False, (
            f'Gerente pode aprovar até R$ {config.limite_alcada_gerente:,.2f}. '
            f'Encaminhe ao Diretor para limites maiores.'
        )

    ficha.limite_aprovado = limite_aprovado
    ficha.status          = 'aprovado'
    ficha.aprovado_por    = usuario
    ficha.data_aprovacao  = timezone.now()
    ficha.observacoes     = observacoes
    ficha.save()

    # Atualiza limite no cadastro do cliente
    ficha.cliente.limite_credito = limite_aprovado
    ficha.cliente.save(update_fields=['limite_credito'])

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=usuario,
            acao='aprovacao', modelo_afetado='FichaAnaliseCredito',
            registro_id=ficha.id,
            descricao=f"Ficha de crédito aprovada — cliente {ficha.cliente.nome_razao} — limite R$ {limite_aprovado:,.2f}",
        )
    except Exception:
        pass

    return True, {'limite_aprovado': float(limite_aprovado), 'mensagem': 'Limite aprovado e atualizado no cadastro do cliente.'}


def recusar_ficha_credito(empresa_id, ficha_id, usuario, motivo):
    """Recusa ficha de análise de crédito."""
    from .models import FichaAnaliseCredito, LogAuditoria, Empresa

    try:
        ficha = FichaAnaliseCredito.objects.get(id=ficha_id, empresa_id=empresa_id)
    except FichaAnaliseCredito.DoesNotExist:
        return False, 'Ficha não encontrada.'

    ficha.status       = 'recusado'
    ficha.aprovado_por = usuario
    ficha.data_aprovacao = timezone.now()
    ficha.observacoes  = motivo
    ficha.save()

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=usuario,
            acao='recusa', modelo_afetado='FichaAnaliseCredito',
            registro_id=ficha.id,
            descricao=f"Ficha de crédito recusada — cliente {ficha.cliente.nome_razao} — motivo: {motivo}",
        )
    except Exception:
        pass

    return True, 'Ficha recusada.'
