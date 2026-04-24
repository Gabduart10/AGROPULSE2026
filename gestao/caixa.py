# ==========================================
# ARQUIVO NOVO: gestao/caixa.py
# Crie esse arquivo na pasta gestao/
# ==========================================

from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum


def abrir_caixa(empresa, operador, saldo_inicial):
    """
    Abre um novo caixa diário.
    Impede abrir se já existe um caixa aberto para o operador.
    """
    from .models import CaixaDiario

    caixa_aberto = CaixaDiario.objects.filter(
        empresa=empresa,
        operador=operador,
        status='aberto',
    ).first()

    if caixa_aberto:
        return False, f"Já existe um caixa aberto (#{caixa_aberto.id}). Feche-o antes de abrir outro.", None

    caixa = CaixaDiario.objects.create(
        empresa=empresa,
        operador=operador,
        saldo_inicial=saldo_inicial,
        status='aberto',
    )

    return True, f"Caixa #{caixa.id} aberto com sucesso.", caixa


def fechar_caixa(caixa, saldo_final_real, operador):
    """
    Fecha o caixa calculando o saldo esperado e registrando a diferença.
    """
    from .models import LancamentoCaixa, LogAuditoria

    if caixa.status == 'fechado':
        return False, "Este caixa já está fechado.", None

    # Calcula saldo esperado
    entradas = LancamentoCaixa.objects.filter(
        caixa=caixa, tipo='entrada'
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    saidas = LancamentoCaixa.objects.filter(
        caixa=caixa, tipo='saida'
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    saldo_esperado = caixa.saldo_inicial + entradas - saidas
    diferenca = saldo_final_real - saldo_esperado

    caixa.saldo_final_esperado = saldo_esperado
    caixa.saldo_final_real = saldo_final_real
    caixa.status = 'fechado'
    caixa.data_fechamento = timezone.now()
    caixa.save()

    LogAuditoria.registrar(
        empresa=caixa.empresa,
        usuario=operador,
        acao='alteracao_estoque',
        modelo_afetado='CaixaDiario',
        registro_id=caixa.id,
        descricao=(
            f"Caixa fechado. Saldo inicial: R$ {caixa.saldo_inicial} | "
            f"Entradas: R$ {entradas} | Saídas: R$ {saidas} | "
            f"Esperado: R$ {saldo_esperado} | Real: R$ {saldo_final_real} | "
            f"Diferença: R$ {diferenca}"
        ),
    )

    return True, "Caixa fechado com sucesso.", {
        'saldo_inicial': round(caixa.saldo_inicial, 2),
        'total_entradas': round(entradas, 2),
        'total_saidas': round(saidas, 2),
        'saldo_esperado': round(saldo_esperado, 2),
        'saldo_real': round(saldo_final_real, 2),
        'diferenca': round(diferenca, 2),
        'status_diferenca': 'zerado' if diferenca == 0 else ('sobra' if diferenca > 0 else 'falta'),
    }


def registrar_sangria(caixa, valor, descricao, forma_pagamento, operador):
    """
    Sangria — retirada de dinheiro do caixa (ex: depósito bancário).
    """
    from .models import LancamentoCaixa

    if caixa.status == 'fechado':
        return False, "Caixa já está fechado."

    if valor <= 0:
        return False, "Valor deve ser maior que zero."

    LancamentoCaixa.objects.create(
        caixa=caixa,
        tipo='saida',
        descricao=f"[SANGRIA] {descricao}",
        valor=valor,
        forma_pagamento=forma_pagamento,
    )

    return True, f"Sangria de R$ {valor} registrada."


def registrar_suprimento(caixa, valor, descricao, forma_pagamento, operador):
    """
    Suprimento — adição de dinheiro ao caixa (ex: troco).
    """
    from .models import LancamentoCaixa

    if caixa.status == 'fechado':
        return False, "Caixa já está fechado."

    if valor <= 0:
        return False, "Valor deve ser maior que zero."

    LancamentoCaixa.objects.create(
        caixa=caixa,
        tipo='entrada',
        descricao=f"[SUPRIMENTO] {descricao}",
        valor=valor,
        forma_pagamento=forma_pagamento,
    )

    return True, f"Suprimento de R$ {valor} registrado."


def resumo_caixa(caixa):
    """
    Retorna o resumo em tempo real do caixa aberto.
    """
    from .models import LancamentoCaixa

    lancamentos = LancamentoCaixa.objects.filter(caixa=caixa).select_related('forma_pagamento')

    entradas = Decimal('0')
    saidas = Decimal('0')
    por_forma = {}

    for lanc in lancamentos:
        forma = lanc.forma_pagamento.nome
        if forma not in por_forma:
            por_forma[forma] = {'entradas': Decimal('0'), 'saidas': Decimal('0')}

        if lanc.tipo == 'entrada':
            entradas += lanc.valor
            por_forma[forma]['entradas'] += lanc.valor
        else:
            saidas += lanc.valor
            por_forma[forma]['saidas'] += lanc.valor

    saldo_atual = caixa.saldo_inicial + entradas - saidas

    return {
        'caixa_id': caixa.id,
        'status': caixa.status,
        'operador': caixa.operador.get_full_name() or caixa.operador.username,
        'abertura': caixa.data_abertura.strftime('%d/%m/%Y %H:%M'),
        'saldo_inicial': round(caixa.saldo_inicial, 2),
        'total_entradas': round(entradas, 2),
        'total_saidas': round(saidas, 2),
        'saldo_atual': round(saldo_atual, 2),
        'por_forma_pagamento': {
            forma: {
                'entradas': round(v['entradas'], 2),
                'saidas': round(v['saidas'], 2),
                'saldo': round(v['entradas'] - v['saidas'], 2),
            }
            for forma, v in por_forma.items()
        },
        'lancamentos': [{
            'tipo': l.tipo,
            'descricao': l.descricao,
            'valor': round(l.valor, 2),
            'forma': l.forma_pagamento.nome,
            'hora': l.data_lancamento.strftime('%H:%M'),
        } for l in lancamentos.order_by('data_lancamento')],
    }
