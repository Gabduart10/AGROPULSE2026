# ==========================================
# ARQUIVO NOVO: gestao/estoque_inicial.py
# FUNCIONALIDADE INCOMPLETA 2: Lançar Estoque Inicial
# Usa Produto, LoteEstoque e MovimentacaoEstoque que já existem.
# Crítico para onboarding de todo cliente novo.
# ==========================================

from decimal import Decimal
from django.db import transaction


def lancar_estoque_inicial(empresa_id, operador, itens_data):
    """
    Lança o estoque inicial de uma empresa no onboarding.
    Deve ser executado UMA VEZ na ativação do cliente.

    itens_data = [
        {
            'produto_id': 1,
            'quantidade': 100,
            'custo_unitario': 25.00,
            'numero_lote': 'LOTE001',       # opcional
            'data_validade': '2026-12-31',   # opcional
            'data_fabricacao': '2024-01-01', # opcional
        },
        ...
    ]

    Integrado com:
    - Produto (atualiza quantidade e custo_medio_ponderado)
    - LoteEstoque (cria lote se não existir)
    - MovimentacaoEstoque (registra como 'entrada' com origem 'Estoque Inicial')
    """
    from .models import Produto, LoteEstoque, MovimentacaoEstoque
    from django.utils.dateparse import parse_date

    if not itens_data:
        return False, 'Nenhum item informado.'

    # Verifica se já tem movimentações — proteção contra duplo lançamento
    ja_tem_estoque = MovimentacaoEstoque.objects.filter(
        produto__empresa_id=empresa_id,
        origem='Estoque Inicial'
    ).exists()

    if ja_tem_estoque:
        return False, 'Estoque inicial já foi lançado para esta empresa.'

    erros = []
    sucesso = []

    with transaction.atomic():
        for item_data in itens_data:
            try:
                produto = Produto.objects.get(
                    id=item_data['produto_id'],
                    empresa_id=empresa_id
                )
            except Produto.DoesNotExist:
                erros.append(f"Produto ID {item_data['produto_id']} não encontrado.")
                continue

            quantidade = Decimal(str(item_data['quantidade']))
            custo_unitario = Decimal(str(item_data.get('custo_unitario', 0)))

            if quantidade <= 0:
                erros.append(f"Quantidade inválida para '{produto.nome}'.")
                continue

            # Atualiza custo médio ponderado se informado
            if custo_unitario > 0:
                qtd_atual = produto.quantidade
                custo_atual = produto.custo_medio_ponderado or Decimal('0')
                if qtd_atual > 0 and custo_atual > 0:
                    # Média ponderada com estoque existente
                    produto.custo_medio_ponderado = (
                        (qtd_atual * custo_atual + quantidade * custo_unitario)
                        / (qtd_atual + quantidade)
                    )
                else:
                    produto.custo_medio_ponderado = custo_unitario

            # Cria ou atualiza lote
            numero_lote = item_data.get('numero_lote') or f"INICIAL-{produto.sku}"
            data_validade = item_data.get('data_validade')
            data_fabricacao = item_data.get('data_fabricacao')

            lote, criado = LoteEstoque.objects.get_or_create(
                produto=produto,
                numero_lote=numero_lote,
                defaults={
                    'quantidade': Decimal('0'),
                    'custo_unitario': custo_unitario or Decimal('0'),
                    'data_validade': parse_date(data_validade) if data_validade else None,
                    'data_fabricacao': parse_date(data_fabricacao) if data_fabricacao else None,
                }
            )
            lote.quantidade += quantidade
            lote.save()

            # Atualiza quantidade total do produto
            produto.quantidade += quantidade
            produto.save()

            # Registra movimentação
            MovimentacaoEstoque.objects.create(
                produto=produto,
                operador=operador,
                tipo='entrada',
                quantidade=quantidade,
                saldo_apos_movimento=produto.quantidade,
                origem='Estoque Inicial',
            )

            sucesso.append({
                'produto': produto.nome,
                'sku': produto.sku,
                'quantidade': round(quantidade, 2),
                'lote': numero_lote,
                'custo_unitario': round(custo_unitario, 2),
            })

    if erros and not sucesso:
        return False, {'erros': erros}

    return True, {
        'mensagem': f"{len(sucesso)} produto(s) lançado(s) com sucesso.",
        'itens_lancados': sucesso,
        'erros': erros,
    }


def verificar_estoque_inicial(empresa_id):
    """
    Verifica se o estoque inicial já foi lançado para a empresa.
    Útil para exibir ou ocultar o botão de lançamento inicial no frontend.
    """
    from .models import MovimentacaoEstoque
    ja_lancado = MovimentacaoEstoque.objects.filter(
        produto__empresa_id=empresa_id,
        origem='Estoque Inicial'
    ).exists()
    return {
        'estoque_inicial_lancado': ja_lancado,
        'mensagem': 'Estoque inicial já foi lançado.' if ja_lancado else 'Estoque inicial pendente.',
    }


# ==========================================
# ARQUIVO NOVO: gestao/financeiro_avulso.py
# FUNCIONALIDADE INCOMPLETA 3: Lançamento Financeiro Avulso
# Usa LancamentoFinanceiro (novo model) + ContaPagar/ContaReceber existentes.
# ==========================================

def criar_lancamento_avulso(empresa_id, responsavel, dados):
    """
    Cria um lançamento financeiro avulso sem necessidade de caixa aberto.
    Pode opcionalmente quitar uma ContaPagar ou registrar um ContaReceber.

    dados = {
        'tipo': 'receita' | 'despesa',
        'categoria': 'operacional' | 'financeiro' | etc,
        'descricao': 'Aluguel dezembro',
        'valor': 1500.00,
        'data_lancamento': '2026-03-01',
        'data_competencia': '2026-03-01',   # opcional
        'forma_pagamento_id': 1,             # opcional
        'conta_pagar_id': None,              # opcional
        'conta_receber_id': None,            # opcional
        'observacoes': '',                   # opcional
        'recorrente': False,                 # opcional
    }
    """
    from .models import LancamentoFinanceiro, ContaPagar, ContaReceber, FormaPagamento
    from django.utils.dateparse import parse_date

    tipo = dados.get('tipo')
    if tipo not in ['receita', 'despesa']:
        return False, 'Tipo inválido. Use "receita" ou "despesa".'

    valor = Decimal(str(dados.get('valor', 0)))
    if valor <= 0:
        return False, 'Valor deve ser maior que zero.'

    data_lancamento = parse_date(str(dados.get('data_lancamento', '')))
    if not data_lancamento:
        return False, 'Data de lançamento inválida.'

    forma = None
    if dados.get('forma_pagamento_id'):
        try:
            forma = FormaPagamento.objects.get(id=dados['forma_pagamento_id'], empresa_id=empresa_id)
        except FormaPagamento.DoesNotExist:
            pass

    conta_pagar = None
    if dados.get('conta_pagar_id') and tipo == 'despesa':
        try:
            conta_pagar = ContaPagar.objects.get(id=dados['conta_pagar_id'], empresa_id=empresa_id)
        except ContaPagar.DoesNotExist:
            return False, 'Conta a pagar não encontrada.'

    conta_receber = None
    if dados.get('conta_receber_id') and tipo == 'receita':
        try:
            conta_receber = ContaReceber.objects.get(id=dados['conta_receber_id'], empresa_id=empresa_id)
        except ContaReceber.DoesNotExist:
            return False, 'Conta a receber não encontrada.'

    lancamento = LancamentoFinanceiro.objects.create(
        empresa_id=empresa_id,
        tipo=tipo,
        categoria=dados.get('categoria', 'operacional'),
        descricao=dados['descricao'],
        valor=valor,
        data_lancamento=data_lancamento,
        data_competencia=parse_date(str(dados.get('data_competencia', ''))) or data_lancamento,
        forma_pagamento=forma,
        responsavel=responsavel,
        conta_pagar=conta_pagar,
        conta_receber=conta_receber,
        observacoes=dados.get('observacoes', ''),
        recorrente=dados.get('recorrente', False),
    )

    return True, {
        'mensagem': 'Lançamento registrado com sucesso.',
        'id': lancamento.id,
        'tipo': lancamento.get_tipo_display(),
        'valor': round(lancamento.valor, 2),
        'data': lancamento.data_lancamento.strftime('%d/%m/%Y'),
        'conta_pagar_quitada': conta_pagar.descricao if conta_pagar else None,
        'conta_receber_baixada': conta_receber.descricao if conta_receber else None,
    }


def listar_lancamentos_avulsos(empresa_id, mes=None, ano=None, tipo=None):
    """
    Lista lançamentos financeiros avulsos com filtros opcionais.
    """
    from .models import LancamentoFinanceiro
    from django.db.models import Sum

    qs = LancamentoFinanceiro.objects.filter(
        empresa_id=empresa_id
    ).select_related('forma_pagamento', 'responsavel')

    if mes and ano:
        qs = qs.filter(data_lancamento__year=ano, data_lancamento__month=mes)
    if tipo:
        qs = qs.filter(tipo=tipo)

    totais = qs.values('tipo').annotate(total=Sum('valor'))
    totais_map = {t['tipo']: t['total'] or Decimal('0') for t in totais}

    resultado = [{
        'id': l.id,
        'tipo': l.get_tipo_display(),
        'categoria': l.get_categoria_display(),
        'descricao': l.descricao,
        'valor': round(l.valor, 2),
        'data': l.data_lancamento.strftime('%d/%m/%Y'),
        'forma_pagamento': l.forma_pagamento.nome if l.forma_pagamento else None,
        'responsavel': l.responsavel.get_full_name() or l.responsavel.username,
        'recorrente': l.recorrente,
        'observacoes': l.observacoes,
    } for l in qs.order_by('-data_lancamento')]

    return {
        'lancamentos': resultado,
        'totais': {
            'total_receitas': round(totais_map.get('receita', Decimal('0')), 2),
            'total_despesas': round(totais_map.get('despesa', Decimal('0')), 2),
            'saldo': round(
                totais_map.get('receita', Decimal('0')) - totais_map.get('despesa', Decimal('0')), 2
            ),
        },
    }