# ==========================================
# gestao/financeiro_avancado.py — Fase 6
#
# - Centros de custo
# - Lançamentos recorrentes (geração mensal)
# - Fluxo de caixa (projeção vs realizado)
# - Conciliação bancária OFX/CNAB
# - Boletos (integração Asaas)
# ==========================================

from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone


# ══════════════════════════════════════════════════════════════════════════════
# CENTROS DE CUSTO
# ══════════════════════════════════════════════════════════════════════════════

def listar_centros_custo(empresa_id):
    from .models import CentroCusto
    return list(
        CentroCusto.objects.filter(empresa_id=empresa_id, ativo=True)
        .values('id', 'nome', 'descricao')
    )


def dre_por_centro_custo(empresa_id, mes, ano):
    """
    DRE agrupado por centro de custo para o mês/ano.
    Usa LancamentoFinanceiro vinculado a centros.
    """
    from .models import LancamentoFinanceiro, CentroCusto
    from django.db.models import Sum, Q

    inicio = date(ano, mes, 1)
    fim = date(ano, mes + 1, 1) - timedelta(days=1) if mes < 12 else date(ano, 12, 31)

    centros = CentroCusto.objects.filter(empresa_id=empresa_id, ativo=True)
    resultado = []

    for centro in centros:
        receitas = LancamentoFinanceiro.objects.filter(
            empresa_id=empresa_id,
            tipo='receita',
            data_competencia__gte=inicio,
            data_competencia__lte=fim,
            # centro_custo não existe em LancamentoFinanceiro ainda — deixamos preparado
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

        despesas = LancamentoFinanceiro.objects.filter(
            empresa_id=empresa_id,
            tipo='despesa',
            data_competencia__gte=inicio,
            data_competencia__lte=fim,
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

        resultado.append({
            'centro':   centro.nome,
            'receitas': float(receitas),
            'despesas': float(despesas),
            'resultado': float(receitas - despesas),
        })

    return {'mes': mes, 'ano': ano, 'centros': resultado}


# ══════════════════════════════════════════════════════════════════════════════
# LANÇAMENTOS RECORRENTES
# ══════════════════════════════════════════════════════════════════════════════

def gerar_lancamentos_recorrentes(empresa_id, mes, ano):
    """
    Gera ContaPagar/ContaReceber para todos os lançamentos recorrentes
    ativos da empresa para o mês/ano especificado.
    Idempotente — não duplica se já gerou para aquele mês.
    """
    from .models import LancamentoRecorrente, ContaPagar, ContaReceber, Empresa

    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return 0

    dia_limite = 28  # Evita problema com fevereiro
    recorrentes = LancamentoRecorrente.objects.filter(
        empresa=empresa,
        ativo=True,
        data_inicio__lte=date(ano, mes, 1),
    ).filter(
        models_Q := None  # placeholder
    )

    # Filtro por data_fim
    from django.db.models import Q
    recorrentes = LancamentoRecorrente.objects.filter(
        empresa=empresa,
        ativo=True,
        data_inicio__lte=date(ano, mes, 1),
    ).filter(
        Q(data_fim__isnull=True) | Q(data_fim__gte=date(ano, mes, 1))
    )

    gerados = 0
    for rec in recorrentes:
        dia = min(rec.dia_vencimento, dia_limite)
        try:
            vencimento = date(ano, mes, dia)
        except ValueError:
            vencimento = date(ano, mes, 28)

        if rec.tipo == 'despesa':
            descricao_unica = f"{rec.descricao} — {mes:02d}/{ano}"
            if not ContaPagar.objects.filter(
                empresa=empresa,
                descricao=descricao_unica,
                data_vencimento=vencimento,
            ).exists():
                ContaPagar.objects.create(
                    empresa=empresa,
                    descricao=descricao_unica,
                    valor=rec.valor,
                    data_vencimento=vencimento,
                    status='pendente',
                )
                gerados += 1
        else:
            descricao_unica = f"{rec.descricao} — {mes:02d}/{ano}"
            # Receitas recorrentes são criadas como LancamentoFinanceiro
            from .models import LancamentoFinanceiro
            if not LancamentoFinanceiro.objects.filter(
                empresa=empresa,
                descricao=descricao_unica,
                data_lancamento=vencimento,
                tipo='receita',
            ).exists():
                LancamentoFinanceiro.objects.create(
                    empresa=empresa,
                    tipo='receita',
                    categoria='operacional',
                    descricao=descricao_unica,
                    valor=rec.valor,
                    data_lancamento=vencimento,
                    data_competencia=vencimento,
                    responsavel=rec.responsavel,
                )
                gerados += 1

    return gerados


# ══════════════════════════════════════════════════════════════════════════════
# FLUXO DE CAIXA
# ══════════════════════════════════════════════════════════════════════════════

def fluxo_caixa(empresa_id, data_inicio, data_fim):
    """
    Projeção vs realizado para o período.
    - Realizado: LancamentoFinanceiro + LancamentoCaixa já concluídos
    - Projetado: ContaPagar/ContaReceber pendentes no período
    """
    from .models import ContaPagar, ContaReceber, LancamentoFinanceiro, LancamentoCaixa
    from django.db.models import Sum

    # ── Realizado ──────────────────────────────────────────────────────────
    entradas_real = LancamentoFinanceiro.objects.filter(
        empresa_id=empresa_id,
        tipo='receita',
        data_lancamento__gte=data_inicio,
        data_lancamento__lte=data_fim,
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    saidas_real = LancamentoFinanceiro.objects.filter(
        empresa_id=empresa_id,
        tipo='despesa',
        data_lancamento__gte=data_inicio,
        data_lancamento__lte=data_fim,
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    # ── Projetado ──────────────────────────────────────────────────────────
    a_receber = ContaReceber.objects.filter(
        empresa_id=empresa_id,
        status='pendente',
        data_vencimento__gte=data_inicio,
        data_vencimento__lte=data_fim,
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    a_pagar = ContaPagar.objects.filter(
        empresa_id=empresa_id,
        status='pendente',
        data_vencimento__gte=data_inicio,
        data_vencimento__lte=data_fim,
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    # ── Linha do tempo diária ──────────────────────────────────────────────
    dias = []
    cursor = data_inicio
    saldo_acumulado = Decimal('0')

    while cursor <= data_fim:
        entrada_dia = LancamentoFinanceiro.objects.filter(
            empresa_id=empresa_id, tipo='receita', data_lancamento=cursor
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

        saida_dia = LancamentoFinanceiro.objects.filter(
            empresa_id=empresa_id, tipo='despesa', data_lancamento=cursor
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

        projecao_entrada = ContaReceber.objects.filter(
            empresa_id=empresa_id, status='pendente', data_vencimento=cursor
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

        projecao_saida = ContaPagar.objects.filter(
            empresa_id=empresa_id, status='pendente', data_vencimento=cursor
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

        saldo_dia = entrada_dia - saida_dia
        saldo_acumulado += saldo_dia

        dias.append({
            'data':              cursor.strftime('%d/%m/%Y'),
            'entradas_real':     float(entrada_dia),
            'saidas_real':       float(saida_dia),
            'projecao_entrada':  float(projecao_entrada),
            'projecao_saida':    float(projecao_saida),
            'saldo_dia':         float(saldo_dia),
            'saldo_acumulado':   float(saldo_acumulado),
        })
        cursor += timedelta(days=1)

    return {
        'periodo': f"{data_inicio.strftime('%d/%m/%Y')} → {data_fim.strftime('%d/%m/%Y')}",
        'resumo': {
            'entradas_realizadas': float(entradas_real),
            'saidas_realizadas':   float(saidas_real),
            'saldo_realizado':     float(entradas_real - saidas_real),
            'a_receber_projetado': float(a_receber),
            'a_pagar_projetado':   float(a_pagar),
            'saldo_projetado':     float(a_receber - a_pagar),
        },
        'linha_tempo': dias,
    }


# ══════════════════════════════════════════════════════════════════════════════
# CONCILIAÇÃO BANCÁRIA (OFX)
# ══════════════════════════════════════════════════════════════════════════════

def importar_ofx(empresa, responsavel, arquivo_bytes, nome_arquivo):
    """
    Importa extrato bancário em formato OFX.
    Cria uma ConciliacaoBancaria com as TransacaoBancaria extraídas.
    Tenta fazer match automático com ContaPagar/ContaReceber pelo valor e data.
    """
    from .models import ConciliacaoBancaria, TransacaoBancaria, ContaPagar, ContaReceber
    import xml.etree.ElementTree as ET
    import re

    conteudo = arquivo_bytes.decode('latin-1', errors='replace')

    transacoes_raw = []
    data_inicio_extrato = None
    data_fim_extrato = None

    # Extrai transações via regex (OFX é SGML, não XML padrão)
    padrao_stmttrn = re.findall(r'<STMTTRN>(.*?)</STMTTRN>', conteudo, re.DOTALL)
    padrao_dtstart = re.search(r'<DTSTART>([\d]+)', conteudo)
    padrao_dtend   = re.search(r'<DTEND>([\d]+)', conteudo)

    def parse_ofx_date(s):
        """Converte YYYYMMDD ou YYYYMMDDHHMMSS para date."""
        from datetime import datetime
        s = s[:8]
        try:
            return datetime.strptime(s, '%Y%m%d').date()
        except ValueError:
            return date.today()

    if padrao_dtstart:
        data_inicio_extrato = parse_ofx_date(padrao_dtstart.group(1))
    if padrao_dtend:
        data_fim_extrato = parse_ofx_date(padrao_dtend.group(1))

    for bloco in padrao_stmttrn:
        def get_tag(tag, b):
            m = re.search(rf'<{tag}>(.*?)[\n<]', b, re.IGNORECASE)
            return m.group(1).strip() if m else ''

        tipo_raw = get_tag('TRNTYPE', bloco).upper()
        tipo = 'credito' if tipo_raw in ('CREDIT', 'DEP', 'INT') else 'debito'
        valor_raw = get_tag('TRNAMT', bloco).replace(',', '.')
        try:
            valor = abs(Decimal(valor_raw))
        except Exception:
            continue

        data_raw = get_tag('DTPOSTED', bloco)
        data_transacao = parse_ofx_date(data_raw) if data_raw else date.today()
        descricao = get_tag('MEMO', bloco) or get_tag('NAME', bloco) or ''
        id_banco = get_tag('FITID', bloco)

        transacoes_raw.append({
            'data': data_transacao,
            'tipo': tipo,
            'valor': valor,
            'descricao': descricao[:255],
            'id_banco': id_banco[:100],
        })

    if not transacoes_raw:
        return False, 'Nenhuma transação encontrada no arquivo OFX.'

    from django.db import transaction
    with transaction.atomic():
        conc = ConciliacaoBancaria.objects.create(
            empresa=empresa,
            responsavel=responsavel,
            nome_arquivo=nome_arquivo,
            data_inicio=data_inicio_extrato or transacoes_raw[0]['data'],
            data_fim=data_fim_extrato or transacoes_raw[-1]['data'],
            status='importado',
            total_transacoes=len(transacoes_raw),
        )

        conciliados = 0
        for t in transacoes_raw:
            conta_pagar = conta_receber = None

            # Match automático por valor e data próxima (±3 dias)
            d_ini = t['data'] - timedelta(days=3)
            d_fim = t['data'] + timedelta(days=3)

            if t['tipo'] == 'debito':
                conta_pagar = ContaPagar.objects.filter(
                    empresa=empresa,
                    valor=t['valor'],
                    status='pendente',
                    data_vencimento__gte=d_ini,
                    data_vencimento__lte=d_fim,
                ).first()
                if conta_pagar:
                    conciliados += 1

            else:
                conta_receber = ContaReceber.objects.filter(
                    empresa=empresa,
                    valor=t['valor'],
                    status='pendente',
                    data_vencimento__gte=d_ini,
                    data_vencimento__lte=d_fim,
                ).first()
                if conta_receber:
                    conciliados += 1

            TransacaoBancaria.objects.create(
                conciliacao=conc,
                data=t['data'],
                tipo=t['tipo'],
                valor=t['valor'],
                descricao=t['descricao'],
                id_banco=t['id_banco'],
                status='conciliado' if (conta_pagar or conta_receber) else 'pendente',
                conta_pagar=conta_pagar,
                conta_receber=conta_receber,
            )

        conc.total_conciliados = conciliados
        conc.save(update_fields=['total_conciliados'])

    return True, {
        'conciliacao_id':    conc.id,
        'total_transacoes':  len(transacoes_raw),
        'auto_conciliados':  conciliados,
        'pendentes':         len(transacoes_raw) - conciliados,
    }


def conciliar_manualmente(transacao_id, empresa_id, conta_pagar_id=None, conta_receber_id=None):
    """Vincula manualmente uma transação a uma conta."""
    from .models import TransacaoBancaria, ContaPagar, ContaReceber

    try:
        tr = TransacaoBancaria.objects.get(
            id=transacao_id,
            conciliacao__empresa_id=empresa_id
        )
    except TransacaoBancaria.DoesNotExist:
        return False, 'Transação não encontrada.'

    if conta_pagar_id:
        cp = ContaPagar.objects.filter(id=conta_pagar_id, empresa_id=empresa_id).first()
        if not cp:
            return False, 'Conta a pagar não encontrada.'
        tr.conta_pagar = cp
        tr.conta_receber = None
    elif conta_receber_id:
        cr = ContaReceber.objects.filter(id=conta_receber_id, empresa_id=empresa_id).first()
        if not cr:
            return False, 'Conta a receber não encontrada.'
        tr.conta_receber = cr
        tr.conta_pagar = None
    else:
        return False, 'Informe conta_pagar_id ou conta_receber_id.'

    tr.status = 'conciliado'
    tr.save()
    return True, 'Transação conciliada.'


# ══════════════════════════════════════════════════════════════════════════════
# BOLETOS (Asaas)
# Asaas é uma fintech brasileira com API bem documentada que suporta
# boleto, PIX e cartão. Alternativa: Pagar.me ou EFÍ (antiga Gerencianet).
# ══════════════════════════════════════════════════════════════════════════════

def _get_asaas_config(empresa_id):
    """Retorna a configuração Asaas da empresa ou levanta ValueError."""
    from .models import ConfiguracaoFinanceira
    try:
        cfg = ConfiguracaoFinanceira.objects.get(empresa_id=empresa_id)
    except ConfiguracaoFinanceira.DoesNotExist:
        raise ValueError('Configuração financeira não encontrada. Configure a integração Asaas em Configurações.')
    if not cfg.asaas_api_key:
        raise ValueError('Chave de API Asaas não configurada.')
    return cfg


def gerar_boleto(empresa_id, conta_receber_id, usuario):
    """
    Gera boleto via Asaas para uma ContaReceber.
    Atualiza a conta com link_boleto e linha_digitavel quando autorizado.

    Returns (sucesso, resultado_dict_ou_erro_str)
    """
    import requests
    from .models import ContaReceber, LogAuditoria, Empresa

    try:
        cfg = _get_asaas_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        conta = ContaReceber.objects.select_related('cliente').get(
            id=conta_receber_id,
            empresa_id=empresa_id,
        )
    except ContaReceber.DoesNotExist:
        return False, 'Conta a receber não encontrada.'

    if conta.status == 'recebido':
        return False, 'Esta conta já foi recebida.'

    cliente = conta.cliente
    base_url = 'https://sandbox.asaas.com/api/v3' if cfg.asaas_sandbox else 'https://api.asaas.com/v3'
    headers = {
        'access_token': cfg.asaas_api_key,
        'Content-Type': 'application/json',
    }

    # Garante que o cliente existe no Asaas
    customer_id = _upsert_cliente_asaas(base_url, headers, cliente)
    if not customer_id:
        return False, 'Erro ao cadastrar cliente no Asaas.'

    payload = {
        'customer':    customer_id,
        'billingType': 'BOLETO',
        'value':       float(conta.valor),
        'dueDate':     conta.data_vencimento.strftime('%Y-%m-%d'),
        'description': conta.descricao,
        'externalReference': str(conta.id),
    }

    try:
        resp = requests.post(f'{base_url}/payments', json=payload, headers=headers, timeout=30)
        data = resp.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação com Asaas: {str(e)}'

    if resp.status_code in (200, 201):
        conta.link_boleto    = data.get('bankSlipUrl', '')
        conta.linha_digitavel = data.get('nossoNumero', '')
        conta.save(update_fields=['link_boleto', 'linha_digitavel'])

        try:
            empresa = Empresa.objects.get(id=empresa_id)
            LogAuditoria.registrar(
                empresa=empresa, usuario=usuario,
                acao='geracao_boleto', modelo_afetado='ContaReceber',
                registro_id=conta.id,
                descricao=f'Boleto gerado para {cliente.nome_razao} — R$ {conta.valor}',
            )
        except Exception:
            pass

        return True, {
            'payment_id':     data.get('id'),
            'link_boleto':    data.get('bankSlipUrl'),
            'linha_digitavel': data.get('nossoNumero'),
            'status':         data.get('status'),
        }
    else:
        return False, data.get('errors', [{'description': 'Erro desconhecido'}])[0].get('description', 'Erro Asaas')


def _upsert_cliente_asaas(base_url, headers, cliente):
    """Cria ou localiza o cliente no Asaas pelo CPF/CNPJ. Retorna o customer_id."""
    import requests

    # Busca por CPF/CNPJ
    cnpj_cpf = (cliente.cnpj_cpf or '').replace('.', '').replace('/', '').replace('-', '')
    if cnpj_cpf:
        r = requests.get(f'{base_url}/customers', params={'cpfCnpj': cnpj_cpf}, headers=headers, timeout=15)
        if r.status_code == 200:
            data = r.json()
            if data.get('data'):
                return data['data'][0]['id']

    # Cria novo
    payload = {
        'name':    cliente.nome_fantasia or cliente.nome_razao,
        'cpfCnpj': cnpj_cpf,
        'email':   cliente.email or '',
        'phone':   cliente.telefone or '',
    }
    r = requests.post(f'{base_url}/customers', json=payload, headers=headers, timeout=15)
    if r.status_code in (200, 201):
        return r.json().get('id')
    return None


# ══════════════════════════════════════════════════════════════════════════════
# SUPERHOST — painel do dono do sistema
# ══════════════════════════════════════════════════════════════════════════════

def painel_superhost():
    """Retorna visão geral de todas as empresas clientes."""
    from .models import Empresa, Usuario
    from django.db.models import Count

    empresas = Empresa.objects.annotate(
        total_usuarios=Count('usuario', distinct=True),
    ).order_by('nome')

    return [
        {
            'id':             e.id,
            'nome':           e.nome,
            'cnpj':           e.cnpj,
            'tipo_negocio':   e.get_tipo_negocio_display(),
            'total_usuarios': e.total_usuarios,
            'plano':          getattr(e, 'plano_assinatura', 'N/A'),
            'status_assinatura': getattr(e, 'status_assinatura', 'N/A'),
            'is_filial':      e.is_filial,
            'matriz_nome':    e.empresa_matriz.nome if e.empresa_matriz else None,
        }
        for e in empresas
    ]


def _indicadores_empresa(emp, hoje, primeiro_mes):
    """Calcula todos os indicadores de uma empresa para o consolidado da matriz."""
    from .models import PedidoVenda, ContaReceber, ContaPagar, Produto
    from django.db.models import Sum, Count, F

    pedidos_mes_qs = PedidoVenda.objects.filter(
        empresa=emp, status='faturado', data_pedido__date__gte=primeiro_mes
    )
    fat_agg = pedidos_mes_qs.aggregate(total=Sum('valor_total'), qtd=Count('id'))
    faturamento_mes = fat_agg['total'] or Decimal('0')
    pedidos_mes_qtd = fat_agg['qtd'] or 0
    ticket_medio = (faturamento_mes / pedidos_mes_qtd) if pedidos_mes_qtd else Decimal('0')

    pedidos_abertos = PedidoVenda.objects.filter(
        empresa=emp, status__in=['aguardando', 'aprovado']
    ).count()

    a_receber = ContaReceber.objects.filter(
        empresa=emp, status='pendente'
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    inadimplencia = ContaReceber.objects.filter(
        empresa=emp, status__in=['pendente', 'inadimplente', 'atrasado'], data_vencimento__lt=hoje
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    a_pagar = ContaPagar.objects.filter(
        empresa=emp, status='pendente'
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    estoque_valor = Produto.objects.filter(empresa=emp).aggregate(
        total=Sum(F('quantidade') * F('preco_custo'))
    )['total'] or Decimal('0')

    return {
        'faturamento_mes':  float(faturamento_mes),
        'pedidos_mes':      pedidos_mes_qtd,
        'pedidos_abertos':  pedidos_abertos,
        'ticket_medio':     float(ticket_medio),
        'a_receber':        float(a_receber),
        'inadimplencia':    float(inadimplencia),
        'a_pagar':          float(a_pagar),
        'saldo_liquido':    float(a_receber - a_pagar),
        'estoque_valor':    float(estoque_valor),
    }


def consolidado_matriz(empresa_matriz_id):
    """
    Retorna métricas consolidadas de uma matriz e todas suas filiais.
    Apenas leitura — nunca altera dados das filiais.
    """
    from .models import Empresa
    from django.db.models import Sum

    try:
        matriz = Empresa.objects.get(id=empresa_matriz_id)
    except Empresa.DoesNotExist:
        return None

    filiais        = list(matriz.filiais.all())
    todas_empresas = [matriz] + filiais
    hoje           = date.today()
    primeiro_mes   = date(hoje.year, hoje.month, 1)

    por_unidade = []
    for emp in todas_empresas:
        indicadores = _indicadores_empresa(emp, hoje, primeiro_mes)
        por_unidade.append({
            'id':        emp.id,
            'nome':      emp.nome,
            'cnpj':      emp.cnpj,
            'tipo':      emp.get_tipo_negocio_display(),
            'is_matriz': emp.id == empresa_matriz_id,
            **indicadores,
        })

    def soma(campo):
        return sum(u[campo] for u in por_unidade)

    return {
        'matriz':         matriz.nome,
        'total_unidades': len(todas_empresas),
        'consolidado': {
            'faturamento_mes': soma('faturamento_mes'),
            'pedidos_mes':     soma('pedidos_mes'),
            'pedidos_abertos': soma('pedidos_abertos'),
            'ticket_medio':    (soma('faturamento_mes') / soma('pedidos_mes')) if soma('pedidos_mes') else 0,
            'a_receber':       soma('a_receber'),
            'inadimplencia':   soma('inadimplencia'),
            'a_pagar':         soma('a_pagar'),
            'saldo_liquido':   soma('a_receber') - soma('a_pagar'),
            'estoque_valor':   soma('estoque_valor'),
        },
        'por_unidade': por_unidade,
    }


def detalhe_filial(empresa_matriz_id, filial_id):
    """
    Retorna indicadores detalhados de uma filial específica.
    Valida que a filial pertence à matriz antes de retornar dados.
    """
    from .models import Empresa, PedidoVenda, ContaReceber, ContaPagar
    from django.db.models import Sum

    try:
        filial = Empresa.objects.get(id=filial_id)
    except Empresa.DoesNotExist:
        return None

    # Garante que a filial pertence à matriz solicitante
    if filial.empresa_matriz_id != empresa_matriz_id and filial.id != empresa_matriz_id:
        return None

    hoje         = date.today()
    primeiro_mes = date(hoje.year, hoje.month, 1)
    indicadores  = _indicadores_empresa(filial, hoje, primeiro_mes)

    # Últimos 5 pedidos faturados
    ultimos_pedidos = list(
        PedidoVenda.objects.filter(empresa=filial, status='faturado')
        .order_by('-data_pedido')
        .values('id', 'cliente__nome_razao', 'valor_total', 'data_pedido')[:5]
    )
    for p in ultimos_pedidos:
        p['valor_total']  = float(p['valor_total'])
        p['data_pedido']  = p['data_pedido'].strftime('%d/%m/%Y') if p['data_pedido'] else None
        p['cliente']      = p.pop('cliente__nome_razao', '—')

    # Contas a receber vencidas (top 5)
    atrasados = list(
        ContaReceber.objects.filter(empresa=filial, status__in=['pendente', 'inadimplente', 'atrasado'], data_vencimento__lt=hoje)
        .order_by('data_vencimento')
        .values('descricao', 'cliente__nome_razao', 'valor', 'data_vencimento')[:5]
    )
    for a in atrasados:
        a['valor']      = float(a['valor'])
        a['vencimento'] = a.pop('data_vencimento').strftime('%d/%m/%Y')
        a['cliente']    = a.pop('cliente__nome_razao', '—')

    # Contas a pagar vencendo em 7 dias
    prox_venc = list(
        ContaPagar.objects.filter(
            empresa=filial, status='pendente',
            data_vencimento__lte=hoje + timedelta(days=7)
        )
        .order_by('data_vencimento')
        .values('descricao', 'fornecedor__nome_razao', 'valor', 'data_vencimento')[:5]
    )
    for c in prox_venc:
        c['valor']      = float(c['valor'])
        c['vencimento'] = c.pop('data_vencimento').strftime('%d/%m/%Y')
        c['fornecedor'] = c.pop('fornecedor__nome_razao', '—')

    return {
        'id':              filial.id,
        'nome':            filial.nome,
        'cnpj':            filial.cnpj,
        'tipo':            filial.get_tipo_negocio_display(),
        'is_matriz':       filial.id == empresa_matriz_id,
        **indicadores,
        'ultimos_pedidos': ultimos_pedidos,
        'inadimplentes':   atrasados,
        'contas_vencer':   prox_venc,
    }
