# ==========================================
# gestao/rh.py — Fase 7
#
# Recursos Humanos:
#   - Colaboradores (CRUD)
#   - Ponto (registrar, relatório)
#   - Férias (agendar, iniciar, concluir)
#   - Afastamentos
#   - Folha de pagamento (gerar, fechar)
# ==========================================

from decimal import Decimal
from datetime import date, timedelta, datetime
from django.utils import timezone


def listar_colaboradores(empresa_id, so_ativos=False):
    from .models import Colaborador
    qs = Colaborador.objects.filter(empresa_id=empresa_id)
    if so_ativos:
        qs = qs.filter(status='ativo')
    return [
        {
            'id':             c.id,
            'nome':           c.nome_completo,
            'cargo':          c.get_cargo_display(),
            'cargo_custom':   c.cargo_personalizado,
            'status':         c.get_status_display(),
            'data_admissao':  c.data_admissao.strftime('%d/%m/%Y'),
            'tempo_empresa':  c.tempo_empresa,
            'salario_base':   float(c.salario_base),
            'email':          c.email,
            'telefone':       c.telefone,
            'usuario_id':     c.usuario_id,
        }
        for c in qs.order_by('nome_completo')
    ]


def registrar_ponto(colaborador_id, empresa_id, data_ref, entrada=None,
                    saida_almoco=None, retorno_almoco=None, saida=None, observacao=''):
    from .models import RegistroPonto, Colaborador

    try:
        col = Colaborador.objects.get(id=colaborador_id, empresa_id=empresa_id)
    except Colaborador.DoesNotExist:
        return False, 'Colaborador não encontrado.'

    obj, criado = RegistroPonto.objects.update_or_create(
        colaborador=col,
        data=data_ref,
        defaults={
            'entrada':       entrada,
            'saida_almoco':  saida_almoco,
            'retorno_almoco': retorno_almoco,
            'saida':         saida,
            'observacao':    observacao,
        }
    )
    return True, obj


def relatorio_ponto(colaborador_id, empresa_id, mes, ano):
    from .models import RegistroPonto, Colaborador

    try:
        col = Colaborador.objects.get(id=colaborador_id, empresa_id=empresa_id)
    except Colaborador.DoesNotExist:
        return None

    inicio = date(ano, mes, 1)
    fim = date(ano, mes + 1, 1) - timedelta(days=1) if mes < 12 else date(ano, 12, 31)

    registros = RegistroPonto.objects.filter(
        colaborador=col, data__gte=inicio, data__lte=fim
    ).order_by('data')

    total_horas = timedelta()
    dias = []
    for r in registros:
        ht = r.horas_trabalhadas
        if ht:
            total_horas += ht
        dias.append({
            'data':       r.data.strftime('%d/%m/%Y'),
            'entrada':    r.entrada.strftime('%H:%M') if r.entrada else None,
            'saida':      r.saida.strftime('%H:%M') if r.saida else None,
            'horas':      str(ht) if ht else None,
            'observacao': r.observacao,
        })

    horas_totais = total_horas.total_seconds() / 3600
    horas_esperadas = len(dias) * 8  # 8h/dia útil (simplificado)

    return {
        'colaborador': col.nome_completo,
        'periodo': f'{mes:02d}/{ano}',
        'dias_registrados': len(dias),
        'horas_trabalhadas': round(horas_totais, 2),
        'horas_esperadas': horas_esperadas,
        'saldo_horas': round(horas_totais - horas_esperadas, 2),
        'registros': dias,
    }


def agendar_ferias(colaborador_id, empresa_id, periodo_aq_inicio, periodo_aq_fim,
                   data_inicio_gozo, data_fim_gozo, abono=False, observacoes=''):
    from .models import Ferias, Colaborador

    try:
        col = Colaborador.objects.get(id=colaborador_id, empresa_id=empresa_id)
    except Colaborador.DoesNotExist:
        return False, 'Colaborador não encontrado.'

    dias = (data_fim_gozo - data_inicio_gozo).days + 1
    direito = 20 if abono else 30

    f = Ferias.objects.create(
        colaborador=col,
        periodo_aquisitivo_inicio=periodo_aq_inicio,
        periodo_aquisitivo_fim=periodo_aq_fim,
        data_inicio_gozo=data_inicio_gozo,
        data_fim_gozo=data_fim_gozo,
        dias_direito=direito,
        dias_gozados=dias,
        abono_pecuniario=abono,
        status='agendada',
        observacoes=observacoes,
    )
    return True, f


def gerar_folha(empresa_id, mes, ano, responsavel):
    """
    Gera a folha do mês para todos os colaboradores ativos.
    Cálculo simplificado: INSS 7,5% e IRRF básico por faixa.
    """
    from .models import FolhaPagamento, ItemFolhaPagamento, Colaborador

    if FolhaPagamento.objects.filter(empresa_id=empresa_id, mes=mes, ano=ano).exists():
        return False, f'Folha {mes:02d}/{ano} já existe.'

    from .models import Empresa
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return False, 'Empresa não encontrada.'

    colaboradores = Colaborador.objects.filter(empresa_id=empresa_id, status='ativo')
    if not colaboradores.exists():
        return False, 'Nenhum colaborador ativo.'

    from django.db import transaction
    with transaction.atomic():
        folha = FolhaPagamento.objects.create(
            empresa=empresa,
            mes=mes,
            ano=ano,
            responsavel=responsavel,
            status='aberta',
        )

        total_bruto = Decimal('0')
        total_descontos = Decimal('0')

        for col in colaboradores:
            salario = col.salario_base
            inss = _calcular_inss(salario)
            base_irrf = salario - inss
            irrf = _calcular_irrf(base_irrf)

            ItemFolhaPagamento.objects.create(
                folha=folha,
                colaborador=col,
                salario_base=salario,
                inss=inss,
                irrf=irrf,
            )
            total_bruto += salario
            total_descontos += inss + irrf

        folha.total_bruto = total_bruto
        folha.total_descontos = total_descontos
        folha.total_liquido = total_bruto - total_descontos
        folha.save()

    return True, folha


def _calcular_inss(salario):
    """Tabela INSS 2024 progressiva simplificada."""
    faixas = [
        (Decimal('1412.00'),  Decimal('0.075')),
        (Decimal('2666.68'),  Decimal('0.09')),
        (Decimal('4000.03'),  Decimal('0.12')),
        (Decimal('7786.02'),  Decimal('0.14')),
    ]
    inss = Decimal('0')
    anterior = Decimal('0')
    for teto, aliq in faixas:
        if salario <= anterior:
            break
        base = min(salario, teto) - anterior
        inss += base * aliq
        anterior = teto
        if salario <= teto:
            break
    return round(inss, 2)


def _calcular_irrf(base):
    """Tabela IRRF 2024 simplificada."""
    deducao_dependente = Decimal('189.59')
    faixas = [
        (Decimal('2259.20'),  Decimal('0'),     Decimal('0')),
        (Decimal('2826.65'),  Decimal('0.075'), Decimal('169.44')),
        (Decimal('3751.05'),  Decimal('0.15'),  Decimal('381.44')),
        (Decimal('4664.68'),  Decimal('0.225'), Decimal('662.77')),
        (Decimal('99999.99'), Decimal('0.275'), Decimal('896.00')),
    ]
    for teto, aliq, deducao in faixas:
        if base <= teto:
            irrf = base * aliq - deducao
            return max(round(irrf, 2), Decimal('0'))
    return Decimal('0')
