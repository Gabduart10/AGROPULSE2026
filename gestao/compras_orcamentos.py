# ==========================================
# gestao/compras_orcamentos.py
#
# Lógica de negócio da Fase 5:
#   - Orçamentos (criar, enviar, converter em pedido)
#   - Solicitações de compra (criar, aprovar, recusar)
#   - Cotações de fornecedores (criar, responder, encerrar)
#   - Avaliação de fornecedores
#   - Inventário físico (iniciar, contar, concluir)
# ==========================================

from decimal import Decimal
from django.utils import timezone
from django.db import transaction


# ══════════════════════════════════════════════════════════════════════════════
# ORÇAMENTOS
# ══════════════════════════════════════════════════════════════════════════════

def criar_orcamento(empresa, vendedor, cliente, itens_data, data_validade=None, observacoes=''):
    """
    Cria um orçamento. Não baixa estoque.

    itens_data: lista de {'produto_id', 'quantidade', 'preco_unitario', 'desconto_percentual'}
    """
    from .models import Orcamento, ItemOrcamento, Produto

    if not itens_data:
        return False, 'Informe pelo menos um item.'

    with transaction.atomic():
        orc = Orcamento.objects.create(
            empresa=empresa,
            cliente=cliente,
            vendedor=vendedor,
            status='aberto',
            data_validade=data_validade,
            observacoes=observacoes,
        )

        for item_data in itens_data:
            try:
                produto = Produto.objects.get(id=item_data['produto_id'], empresa=empresa)
            except Produto.DoesNotExist:
                raise ValueError(f"Produto ID {item_data['produto_id']} não encontrado.")

            ItemOrcamento.objects.create(
                orcamento=orc,
                produto=produto,
                quantidade=Decimal(str(item_data['quantidade'])),
                preco_unitario=Decimal(str(item_data.get('preco_unitario', produto.preco_venda))),
                desconto_percentual=Decimal(str(item_data.get('desconto_percentual', 0))),
            )

    return True, orc


def converter_orcamento_em_pedido(orcamento, condicao_pagamento=None, forma_pagamento=None):
    """
    Converte um orçamento aprovado em PedidoVenda.
    O PedidoVenda criado começa como 'aguardando' e passa pelas travas normais.

    Retorna (sucesso, pedido_ou_erro)
    """
    from .models import PedidoVenda, ItemPedido

    if orcamento.status not in ('aberto', 'enviado', 'aprovado'):
        return False, f"Orçamento com status '{orcamento.get_status_display()}' não pode ser convertido."

    with transaction.atomic():
        pedido = PedidoVenda.objects.create(
            empresa=orcamento.empresa,
            cliente=orcamento.cliente,
            vendedor=orcamento.vendedor,
            status='aguardando',
            condicao_pagamento=condicao_pagamento,
            forma_pagamento=forma_pagamento,
        )

        for item_orc in orcamento.itens.select_related('produto').all():
            ItemPedido.objects.create(
                pedido=pedido,
                produto=item_orc.produto,
                quantidade=item_orc.quantidade,
                preco_unitario=item_orc.preco_final,
            )

        orcamento.status = 'convertido'
        orcamento.pedido_gerado = pedido
        orcamento.save(update_fields=['status', 'pedido_gerado'])

    return True, pedido


def listar_orcamentos(empresa_id, filtros=None):
    """Retorna orçamentos com filtros opcionais."""
    from .models import Orcamento

    filtros = filtros or {}
    qs = Orcamento.objects.filter(empresa_id=empresa_id).select_related(
        'cliente', 'vendedor'
    )
    if filtros.get('status'):
        qs = qs.filter(status=filtros['status'])
    if filtros.get('cliente_id'):
        qs = qs.filter(cliente_id=filtros['cliente_id'])
    if filtros.get('vendedor_id'):
        qs = qs.filter(vendedor_id=filtros['vendedor_id'])
    if filtros.get('data_inicio'):
        qs = qs.filter(data_criacao__date__gte=filtros['data_inicio'])
    if filtros.get('data_fim'):
        qs = qs.filter(data_criacao__date__lte=filtros['data_fim'])

    return [
        {
            'id':           o.id,
            'cliente':      o.cliente.nome_fantasia or o.cliente.nome_razao,
            'vendedor':     o.vendedor.get_full_name() or o.vendedor.username,
            'status':       o.get_status_display(),
            'status_code':  o.status,
            'valor_total':  float(o.valor_total),
            'data_criacao': o.data_criacao.strftime('%d/%m/%Y %H:%M'),
            'data_validade': o.data_validade.strftime('%d/%m/%Y') if o.data_validade else None,
            'pedido_gerado_id': o.pedido_gerado_id,
        }
        for o in qs.order_by('-data_criacao')
    ]


# ══════════════════════════════════════════════════════════════════════════════
# SOLICITAÇÕES DE COMPRA
# ══════════════════════════════════════════════════════════════════════════════

def criar_solicitacao_compra(empresa, solicitante, produto_id, quantidade, justificativa=''):
    """Qualquer nível pode criar. Vai para aprovação do gerente/diretor."""
    from .models import SolicitacaoCompra, Produto, Notificacao

    try:
        produto = Produto.objects.get(id=produto_id, empresa=empresa)
    except Produto.DoesNotExist:
        return False, 'Produto não encontrado.'

    if Decimal(str(quantidade)) <= 0:
        return False, 'Quantidade inválida.'

    sc = SolicitacaoCompra.objects.create(
        empresa=empresa,
        solicitante=solicitante,
        produto=produto,
        quantidade=Decimal(str(quantidade)),
        justificativa=justificativa,
        status='pendente',
    )

    # Notifica gerente e diretor
    Notificacao.objects.create(
        empresa=empresa,
        tipo='pedido_retido',
        prioridade='media',
        titulo=f'Nova solicitação de compra — {produto.nome}',
        mensagem=(
            f"{solicitante.get_full_name() or solicitante.username} solicitou "
            f"{quantidade} {produto.get_unidade_medida_display()} de '{produto.nome}'. "
            + (f"Justificativa: {justificativa}" if justificativa else '')
        ),
        modelo_referencia='SolicitacaoCompra',
        id_referencia=sc.id,
        chave_unica=f'solicitacao_compra_{sc.id}',
        visivel_para_nivel='gerente,diretor',
    )

    return True, sc


def decidir_solicitacao(sc, aprovador, aprovada, observacao=''):
    """Gerente ou Diretor aprova ou recusa a solicitação."""
    from .models import Notificacao

    if sc.status != 'pendente':
        return False, f"Solicitação já foi {sc.get_status_display().lower()}."

    sc.status = 'aprovada' if aprovada else 'recusada'
    sc.aprovador = aprovador
    sc.data_decisao = timezone.now()
    sc.observacao_aprovador = observacao
    sc.save()

    # Remove notificação de pendência
    Notificacao.objects.filter(
        empresa=sc.empresa,
        chave_unica=f'solicitacao_compra_{sc.id}'
    ).delete()

    # Notifica solicitante
    Notificacao.objects.create(
        empresa=sc.empresa,
        usuario=sc.solicitante,
        tipo='pedido_aprovado' if aprovada else 'pedido_retido',
        prioridade='media',
        titulo=f"Solicitação de compra {'aprovada' if aprovada else 'recusada'}",
        mensagem=(
            f"Sua solicitação de {sc.quantidade} {sc.produto.nome} foi "
            f"{'aprovada' if aprovada else 'recusada'} por "
            f"{aprovador.get_full_name() or aprovador.username}."
            + (f" Obs: {observacao}" if observacao else '')
        ),
        modelo_referencia='SolicitacaoCompra',
        id_referencia=sc.id,
        visivel_para_nivel='vendedor,administrativo,gerente,diretor',
    )

    return True, f"Solicitação {'aprovada' if aprovada else 'recusada'}."


def listar_solicitacoes(empresa_id, filtros=None):
    from .models import SolicitacaoCompra
    filtros = filtros or {}
    qs = SolicitacaoCompra.objects.filter(empresa_id=empresa_id).select_related(
        'solicitante', 'produto', 'aprovador'
    )
    if filtros.get('status'):
        qs = qs.filter(status=filtros['status'])
    if filtros.get('data_inicio'):
        qs = qs.filter(data_solicitacao__date__gte=filtros['data_inicio'])
    if filtros.get('data_fim'):
        qs = qs.filter(data_solicitacao__date__lte=filtros['data_fim'])

    return [
        {
            'id':          sc.id,
            'produto':     sc.produto.nome,
            'produto_id':  sc.produto_id,
            'quantidade':  float(sc.quantidade),
            'unidade':     sc.produto.get_unidade_medida_display(),
            'solicitante': sc.solicitante.get_full_name() or sc.solicitante.username,
            'status':      sc.get_status_display(),
            'status_code': sc.status,
            'justificativa': sc.justificativa,
            'observacao_aprovador': sc.observacao_aprovador,
            'aprovador':   sc.aprovador.get_full_name() if sc.aprovador else None,
            'data':        sc.data_solicitacao.strftime('%d/%m/%Y %H:%M'),
        }
        for sc in qs.order_by('-data_solicitacao')
    ]


# ══════════════════════════════════════════════════════════════════════════════
# COTAÇÕES DE FORNECEDORES
# ══════════════════════════════════════════════════════════════════════════════

def criar_cotacao(empresa, responsavel, titulo, itens_data, data_encerramento=None, observacoes=''):
    """
    Cria uma cotação com os itens a cotar.

    itens_data: lista de {'produto_id', 'quantidade'}
    """
    from .models import CotacaoCompra, ItemCotacao, Produto

    if not itens_data:
        return False, 'Informe pelo menos um produto para cotar.'

    with transaction.atomic():
        cot = CotacaoCompra.objects.create(
            empresa=empresa,
            responsavel=responsavel,
            titulo=titulo,
            status='aberta',
            data_encerramento=data_encerramento,
            observacoes=observacoes,
        )
        for item_data in itens_data:
            try:
                produto = Produto.objects.get(id=item_data['produto_id'], empresa=empresa)
            except Produto.DoesNotExist:
                raise ValueError(f"Produto ID {item_data['produto_id']} não encontrado.")
            ItemCotacao.objects.create(
                cotacao=cot,
                produto=produto,
                quantidade=Decimal(str(item_data['quantidade'])),
            )

    return True, cot


def registrar_resposta_fornecedor(cotacao, fornecedor_id, respostas_data):
    """
    Registra os preços informados por um fornecedor na cotação.

    respostas_data: lista de {'produto_id', 'preco_unit', 'prazo_dias', 'observacao'}
    """
    from .models import RespostaFornecedorCotacao, Fornecedor, Produto

    if cotacao.status != 'aberta':
        return False, 'Esta cotação já foi encerrada.'

    try:
        fornecedor = Fornecedor.objects.get(id=fornecedor_id, empresa=cotacao.empresa)
    except Fornecedor.DoesNotExist:
        return False, 'Fornecedor não encontrado.'

    criados = 0
    with transaction.atomic():
        for resp in respostas_data:
            try:
                produto = Produto.objects.get(id=resp['produto_id'], empresa=cotacao.empresa)
            except Produto.DoesNotExist:
                continue
            RespostaFornecedorCotacao.objects.update_or_create(
                cotacao=cotacao,
                fornecedor=fornecedor,
                produto=produto,
                defaults={
                    'preco_unit': Decimal(str(resp['preco_unit'])),
                    'prazo_dias': int(resp.get('prazo_dias', 0)),
                    'observacao': resp.get('observacao', ''),
                    'vencedor': False,
                },
            )
            criados += 1

    return True, f'{criados} resposta(s) registrada(s).'


def selecionar_vencedores(cotacao, vencedores_data):
    """
    Define o fornecedor vencedor por produto na cotação.

    vencedores_data: lista de {'produto_id', 'fornecedor_id'}
    """
    from .models import RespostaFornecedorCotacao

    if cotacao.status != 'aberta':
        return False, 'Esta cotação já foi encerrada.'

    with transaction.atomic():
        for v in vencedores_data:
            # Desmarca qualquer outro vencedor para este produto
            RespostaFornecedorCotacao.objects.filter(
                cotacao=cotacao,
                produto_id=v['produto_id'],
            ).update(vencedor=False)
            # Marca o vencedor
            RespostaFornecedorCotacao.objects.filter(
                cotacao=cotacao,
                produto_id=v['produto_id'],
                fornecedor_id=v['fornecedor_id'],
            ).update(vencedor=True)

    return True, 'Vencedores definidos.'


def encerrar_cotacao(cotacao):
    """Encerra a cotação — não aceita mais respostas."""
    cotacao.status = 'encerrada'
    cotacao.save(update_fields=['status'])
    return True, 'Cotação encerrada.'


def comparativo_cotacao(cotacao_id, empresa_id):
    """
    Monta a tabela comparativa de preços por produto × fornecedor.
    Destaca o menor preço para cada produto.
    """
    from .models import CotacaoCompra, RespostaFornecedorCotacao

    try:
        cot = CotacaoCompra.objects.get(id=cotacao_id, empresa_id=empresa_id)
    except CotacaoCompra.DoesNotExist:
        return None

    comparativo = []
    for item in cot.itens.select_related('produto').all():
        respostas = RespostaFornecedorCotacao.objects.filter(
            cotacao=cot,
            produto=item.produto,
        ).select_related('fornecedor').order_by('preco_unit')

        menor_preco = respostas.first().preco_unit if respostas.exists() else None

        comparativo.append({
            'produto_id':    item.produto.id,
            'produto':       item.produto.nome,
            'quantidade':    float(item.quantidade),
            'unidade':       item.produto.get_unidade_medida_display(),
            'respostas': [
                {
                    'fornecedor_id': r.fornecedor.id,
                    'fornecedor':    r.fornecedor.nome_razao,
                    'preco_unit':    float(r.preco_unit),
                    'subtotal':      float(r.subtotal),
                    'prazo_dias':    r.prazo_dias,
                    'observacao':    r.observacao,
                    'vencedor':      r.vencedor,
                    'menor_preco':   (r.preco_unit == menor_preco),
                }
                for r in respostas
            ],
        })

    return {
        'cotacao_id':  cot.id,
        'titulo':      cot.titulo,
        'status':      cot.get_status_display(),
        'comparativo': comparativo,
    }


# ══════════════════════════════════════════════════════════════════════════════
# AVALIAÇÃO DE FORNECEDORES
# ══════════════════════════════════════════════════════════════════════════════

def avaliar_fornecedor(empresa, avaliador, fornecedor_id, nota_preco,
                       nota_prazo, nota_qualidade, pedido_compra_id=None, observacao=''):
    """Registra avaliação após recebimento."""
    from .models import AvaliacaoFornecedor, Fornecedor, PedidoCompra

    try:
        fornecedor = Fornecedor.objects.get(id=fornecedor_id, empresa=empresa)
    except Fornecedor.DoesNotExist:
        return False, 'Fornecedor não encontrado.'

    for nome, nota in [('preco', nota_preco), ('prazo', nota_prazo), ('qualidade', nota_qualidade)]:
        if nota not in range(1, 6):
            return False, f'Nota de {nome} inválida. Use de 1 a 5.'

    pedido = None
    if pedido_compra_id:
        pedido = PedidoCompra.objects.filter(id=pedido_compra_id, empresa=empresa).first()

    av = AvaliacaoFornecedor.objects.create(
        empresa=empresa,
        fornecedor=fornecedor,
        avaliador=avaliador,
        pedido_compra=pedido,
        nota_preco=nota_preco,
        nota_prazo=nota_prazo,
        nota_qualidade=nota_qualidade,
        observacao=observacao,
    )

    return True, av


def resumo_fornecedor(empresa_id, fornecedor_id):
    """Retorna histórico e médias de avaliação de um fornecedor."""
    from .models import AvaliacaoFornecedor
    from django.db.models import Avg

    avaliacoes = AvaliacaoFornecedor.objects.filter(
        empresa_id=empresa_id,
        fornecedor_id=fornecedor_id,
    ).select_related('avaliador', 'pedido_compra').order_by('-data_avaliacao')

    if not avaliacoes.exists():
        return {'total_avaliacoes': 0, 'medias': {}, 'historico': []}

    medias = avaliacoes.aggregate(
        media_preco=Avg('nota_preco'),
        media_prazo=Avg('nota_prazo'),
        media_qualidade=Avg('nota_qualidade'),
    )

    return {
        'total_avaliacoes': avaliacoes.count(),
        'medias': {
            'preco':      round(medias['media_preco'] or 0, 1),
            'prazo':      round(medias['media_prazo'] or 0, 1),
            'qualidade':  round(medias['media_qualidade'] or 0, 1),
            'geral':      round(
                ((medias['media_preco'] or 0) +
                 (medias['media_prazo'] or 0) +
                 (medias['media_qualidade'] or 0)) / 3, 1
            ),
        },
        'historico': [
            {
                'id':          a.id,
                'data':        a.data_avaliacao.strftime('%d/%m/%Y'),
                'avaliador':   a.avaliador.get_full_name() if a.avaliador else 'Sistema',
                'nota_preco':  a.nota_preco,
                'nota_prazo':  a.nota_prazo,
                'nota_qualidade': a.nota_qualidade,
                'media':       a.nota_media,
                'observacao':  a.observacao,
                'pedido_id':   a.pedido_compra_id,
            }
            for a in avaliacoes
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# INVENTÁRIO FÍSICO
# ══════════════════════════════════════════════════════════════════════════════

def iniciar_inventario(empresa, responsavel, observacoes=''):
    """
    Cria um novo inventário e popula todos os produtos ativos
    com o saldo atual do sistema como quantidade_sistema.
    """
    from .models import InventarioFisico, ItemInventario, Produto

    # Só pode ter um inventário em andamento por vez
    if InventarioFisico.objects.filter(empresa=empresa, status='em_andamento').exists():
        return False, 'Já existe um inventário em andamento. Conclua-o antes de iniciar um novo.'

    with transaction.atomic():
        inv = InventarioFisico.objects.create(
            empresa=empresa,
            responsavel=responsavel,
            status='em_andamento',
            observacoes=observacoes,
        )

        produtos = Produto.objects.filter(empresa=empresa)
        itens = [
            ItemInventario(
                inventario=inv,
                produto=p,
                quantidade_sistema=p.quantidade,
            )
            for p in produtos
        ]
        ItemInventario.objects.bulk_create(itens)

    return True, inv


def registrar_contagem(inventario_id, empresa_id, contagens):
    """
    Registra as quantidades contadas fisicamente.

    contagens: lista de {'produto_id': X, 'quantidade_contada': Y}
    """
    from .models import InventarioFisico, ItemInventario

    try:
        inv = InventarioFisico.objects.get(id=inventario_id, empresa_id=empresa_id, status='em_andamento')
    except InventarioFisico.DoesNotExist:
        return False, 'Inventário não encontrado ou não está em andamento.'

    atualizados = 0
    for c in contagens:
        updated = ItemInventario.objects.filter(
            inventario=inv,
            produto_id=c['produto_id'],
        ).update(quantidade_contada=Decimal(str(c['quantidade_contada'])))
        atualizados += updated

    return True, f'{atualizados} item(ns) atualizado(s).'


def concluir_inventario(inventario_id, empresa_id, usuario):
    """
    Conclui o inventário aplicando todos os ajustes pendentes.
    Produtos sem contagem informada são ignorados.
    """
    from .models import InventarioFisico, ItemInventario

    try:
        inv = InventarioFisico.objects.get(id=inventario_id, empresa_id=empresa_id, status='em_andamento')
    except InventarioFisico.DoesNotExist:
        return False, 'Inventário não encontrado ou não está em andamento.'

    itens_com_contagem = ItemInventario.objects.filter(
        inventario=inv,
        quantidade_contada__isnull=False,
        ajuste_aplicado=False,
    ).select_related('produto')

    ajustes = 0
    erros = []
    for item in itens_com_contagem:
        ok, msg = item.aplicar_ajuste(usuario)
        if ok:
            ajustes += 1
        else:
            erros.append(f"{item.produto.nome}: {msg}")

    inv.status = 'concluido'
    inv.data_conclusao = timezone.now()
    inv.save(update_fields=['status', 'data_conclusao'])

    msg = f'Inventário concluído. {ajustes} ajuste(s) aplicado(s).'
    if erros:
        msg += f' Erros: {"; ".join(erros)}'

    return True, msg


def detalhe_inventario(inventario_id, empresa_id):
    """Retorna os itens do inventário com diferenças."""
    from .models import InventarioFisico, ItemInventario

    try:
        inv = InventarioFisico.objects.get(id=inventario_id, empresa_id=empresa_id)
    except InventarioFisico.DoesNotExist:
        return None

    itens = ItemInventario.objects.filter(inventario=inv).select_related('produto')

    return {
        'id':          inv.id,
        'status':      inv.get_status_display(),
        'responsavel': inv.responsavel.get_full_name() or inv.responsavel.username,
        'data_inicio': inv.data_inicio.strftime('%d/%m/%Y %H:%M'),
        'data_conclusao': inv.data_conclusao.strftime('%d/%m/%Y %H:%M') if inv.data_conclusao else None,
        'observacoes': inv.observacoes,
        'itens': [
            {
                'produto_id':          item.produto.id,
                'produto':             item.produto.nome,
                'sku':                 item.produto.sku,
                'unidade':             item.produto.get_unidade_medida_display(),
                'quantidade_sistema':  float(item.quantidade_sistema),
                'quantidade_contada':  float(item.quantidade_contada) if item.quantidade_contada is not None else None,
                'diferenca':           float(item.diferenca) if item.diferenca is not None else None,
                'ajuste_aplicado':     item.ajuste_aplicado,
            }
            for item in itens.order_by('produto__nome')
        ],
    }
