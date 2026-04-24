from decimal import Decimal
from django.utils import timezone
from django.db.models import F, Q, OuterRef, Subquery, DateTimeField
from datetime import timedelta


def gerar_notificacoes(empresa_id):
    """
    OTIMIZADO:
    - Estoque baixo: usa F() no ORM em vez de loop Python
    - Clientes sem comprar: usa Subquery para anotar último pedido (elimina N+1)
    - Aniversariantes: carrega só campos necessários com values()
    - Notificações existentes: pré-carregadas em dicionário para evitar query por chamada
    """
    from .models import (
        Produto, LoteEstoque, ContaPagar, ContaReceber,
        Cliente, Notificacao, Empresa, PedidoVenda
    )

    empresa = Empresa.objects.get(id=empresa_id)
    hoje = timezone.now().date()
    agora = timezone.now()

    # PRÉ-CARREGA notificações existentes em memória para evitar query por chamada
    notificacoes_existentes = {
        n.chave_unica: n
        for n in Notificacao.objects.filter(empresa=empresa)
        if n.chave_unica
    }

    def criar_ou_reativar(chave, tipo, titulo, mensagem, prioridade,
                          modelo_ref=None, id_ref=None, usuario=None):
        existente = notificacoes_existentes.get(chave)

        if existente:
            if existente.fechada and existente.proxima_exibicao and agora < existente.proxima_exibicao:
                return
            if not existente.fechada:
                return
            existente.delete()
            notificacoes_existentes.pop(chave, None)

        nova = Notificacao.objects.create(
            empresa=empresa, usuario=usuario, tipo=tipo,
            titulo=titulo, mensagem=mensagem, prioridade=prioridade,
            modelo_referencia=modelo_ref, id_referencia=id_ref, chave_unica=chave,
        )
        notificacoes_existentes[chave] = nova

    # ----------------------------------------------------------
    # ESTOQUE BAIXO — OTIMIZADO com F()
    # Antes: carregava todos os produtos em Python e comparava
    # Agora: query filtrada no banco
    # ----------------------------------------------------------
    produtos_baixo = Produto.objects.filter(
        empresa_id=empresa_id,
        quantidade__lte=F('estoque_minimo')
    ).values('id', 'nome', 'quantidade', 'estoque_minimo', 'unidade_medida')

    for p in produtos_baixo:
        urgencia = 'alta' if p['quantidade'] == 0 else 'media'
        criar_ou_reativar(
            chave=f"estoque_baixo_{p['id']}",
            tipo='estoque_baixo',
            titulo=f"Estoque baixo: {p['nome']}",
            mensagem=f"'{p['nome']}' com {p['quantidade']} {p['unidade_medida']}. Mínimo: {p['estoque_minimo']}.",
            prioridade=urgencia, modelo_ref='Produto', id_ref=p['id'],
        )

    # ----------------------------------------------------------
    # LOTES VENCENDO — já estava eficiente, mantido
    # ----------------------------------------------------------
    for lote in LoteEstoque.objects.filter(
        produto__empresa_id=empresa_id, quantidade__gt=0,
        data_validade__lte=hoje + timedelta(days=45),
    ).select_related('produto'):
        dias = (lote.data_validade - hoje).days
        status = 'VENCIDO' if dias < 0 else f"vence em {dias} dias"
        criar_ou_reativar(
            chave=f"validade_{lote.id}",
            tipo='validade_lote',
            titulo=f"Lote {status}: {lote.produto.nome}",
            mensagem=f"Lote {lote.numero_lote} — {status}. Qtd: {lote.quantidade} {lote.produto.unidade_medida}.",
            prioridade='alta' if dias <= 15 else 'media',
            modelo_ref='LoteEstoque', id_ref=lote.id,
        )

    # ----------------------------------------------------------
    # CONTAS A PAGAR — já estava eficiente, mantido
    # ----------------------------------------------------------
    for conta in ContaPagar.objects.filter(
        empresa_id=empresa_id, status='pendente',
        data_vencimento__lte=hoje + timedelta(days=2),
    ).select_related('fornecedor'):
        dias = (conta.data_vencimento - hoje).days
        status = 'VENCIDA' if dias < 0 else ('VENCE HOJE' if dias == 0 else f"vence em {dias} dia(s)")
        fornecedor = conta.fornecedor.nome_razao if conta.fornecedor else 'Sem fornecedor'
        criar_ou_reativar(
            chave=f"conta_pagar_{conta.id}",
            tipo='conta_vencer',
            titulo=f"Conta {status}: {fornecedor}",
            mensagem=f"'{conta.descricao}' — R$ {conta.valor} — venc. {conta.data_vencimento.strftime('%d/%m/%Y')}.",
            prioridade='alta', modelo_ref='ContaPagar', id_ref=conta.id,
        )

    # ----------------------------------------------------------
    # BOLETOS VENCIDOS — já estava eficiente, mantido
    # ----------------------------------------------------------
    for conta in ContaReceber.objects.filter(
        empresa_id=empresa_id, status='pendente', data_vencimento__lt=hoje,
    ).select_related('cliente', 'pedido_venda__vendedor'):
        dias_atraso = (hoje - conta.data_vencimento).days
        nome_cliente = conta.cliente.nome_fantasia or conta.cliente.nome_razao
        criar_ou_reativar(
            chave=f"boleto_vencer_{conta.id}",
            tipo='boleto_vencer',
            titulo=f"Boleto vencido: {nome_cliente}",
            mensagem=f"R$ {conta.valor} venceu há {dias_atraso} dia(s). Venc.: {conta.data_vencimento.strftime('%d/%m/%Y')}.",
            prioridade='alta' if dias_atraso >= 15 else 'media',
            modelo_ref='ContaReceber', id_ref=conta.id,
        )
        if conta.pedido_venda and conta.pedido_venda.vendedor:
            vendedor = conta.pedido_venda.vendedor
            criar_ou_reativar(
                chave=f"boleto_vencer_{conta.id}_v{vendedor.id}",
                tipo='boleto_vencer',
                titulo=f"Boleto vencido: {nome_cliente}",
                mensagem=f"R$ {conta.valor} venceu há {dias_atraso} dia(s).",
                prioridade='alta' if dias_atraso >= 15 else 'media',
                modelo_ref='ContaReceber', id_ref=conta.id, usuario=vendedor,
            )

    # ----------------------------------------------------------
    # CLIENTES SEM COMPRAR — OTIMIZADO com Subquery
    # Antes: loop Python com property dias_sem_comprar (N+1 queries)
    # Agora: 1 query com Subquery anotando último pedido
    # ----------------------------------------------------------
    ultimo_pedido_sub = PedidoVenda.objects.filter(
        cliente=OuterRef('pk'),
        status__in=['aprovado', 'faturado']
    ).order_by('-data_pedido').values('data_pedido')[:1]

    ultimo_vendedor_sub = PedidoVenda.objects.filter(
        cliente=OuterRef('pk'),
        status__in=['aprovado', 'faturado']
    ).order_by('-data_pedido').values('vendedor_id')[:1]

    clientes_inativos = Cliente.objects.filter(
        empresa_id=empresa_id
    ).annotate(
        ultimo_pedido_data=Subquery(ultimo_pedido_sub, output_field=DateTimeField()),
        ultimo_vendedor_id=Subquery(ultimo_vendedor_sub),
    ).filter(
        ultimo_pedido_data__isnull=False
    ).values(
        'id', 'nome_razao', 'nome_fantasia', 'telefone',
        'ultimo_pedido_data', 'ultimo_vendedor_id'
    )

    # Pré-carrega vendedores necessários em uma query só
    vendedor_ids = {c['ultimo_vendedor_id'] for c in clientes_inativos if c['ultimo_vendedor_id']}
    from .models import Usuario
    vendedores_map = {u.id: u for u in Usuario.objects.filter(id__in=vendedor_ids)} if vendedor_ids else {}

    for cliente in clientes_inativos:
        dias = (hoje - cliente['ultimo_pedido_data'].date()).days
        if dias >= 25:
            urgencia = 'alta' if dias >= 60 else ('media' if dias >= 40 else 'baixa')
            nome = cliente['nome_fantasia'] or cliente['nome_razao']
            criar_ou_reativar(
                chave=f"sem_comprar_{cliente['id']}",
                tipo='cliente_sem_comprar',
                titulo=f"Cliente inativo: {nome}",
                mensagem=f"Sem comprar há {dias} dias. Tel: {cliente['telefone'] or 'não informado'}.",
                prioridade=urgencia, modelo_ref='Cliente', id_ref=cliente['id'],
            )
            vendedor = vendedores_map.get(cliente['ultimo_vendedor_id'])
            if vendedor:
                criar_ou_reativar(
                    chave=f"sem_comprar_{cliente['id']}_v{vendedor.id}",
                    tipo='cliente_sem_comprar',
                    titulo=f"Cliente inativo: {nome}",
                    mensagem=f"Sem comprar há {dias} dias. Tel: {cliente['telefone'] or 'não informado'}.",
                    prioridade=urgencia, modelo_ref='Cliente', id_ref=cliente['id'],
                    usuario=vendedor,
                )

    # ----------------------------------------------------------
    # ANIVERSARIANTES — OTIMIZADO com values()
    # ----------------------------------------------------------
    clientes_aniversario = Cliente.objects.filter(
        empresa_id=empresa_id,
        data_nascimento__isnull=False
    ).values('id', 'nome_razao', 'nome_fantasia', 'telefone', 'data_nascimento')

    for cliente in clientes_aniversario:
        try:
            aniversario = cliente['data_nascimento'].replace(year=hoje.year)
        except ValueError:
            aniversario = cliente['data_nascimento'].replace(year=hoje.year, day=28)
        if aniversario < hoje:
            try:
                aniversario = aniversario.replace(year=hoje.year + 1)
            except ValueError:
                aniversario = aniversario.replace(year=hoje.year + 1, day=28)
        if (aniversario - hoje).days <= 7:
            criar_ou_reativar(
                chave=f"aniversario_{cliente['id']}_{hoje.year}",
                tipo='aniversario',
                titulo=f"Aniversário: {cliente['nome_fantasia'] or cliente['nome_razao']}",
                mensagem=f"Dia {cliente['data_nascimento'].strftime('%d/%m')}. Tel: {cliente['telefone'] or 'não informado'}.",
                prioridade='baixa', modelo_ref='Cliente', id_ref=cliente['id'],
            )


def _notificacoes_visiveis(empresa_id, usuario):
    """
    OTIMIZADO: filtra notificações visíveis diretamente no ORM.
    Antes: carregava 50 notificações e filtrava em Python com n.visivel.
    Agora: Q() filtra fechada=False ou proxima_exibicao no passado diretamente no banco.
    """
    from .models import Notificacao
    agora = timezone.now()
    nivel = usuario.nivel

    tipos_bloqueados = {
        'vendedor': ['conta_vencer'],
        'operacional': ['conta_vencer', 'cliente_sem_comprar', 'aniversario'],
    }

    qs = Notificacao.objects.filter(
        empresa_id=empresa_id,
    ).filter(
        usuario__in=[usuario, None]
    ).filter(
        Q(fechada=False) | Q(proxima_exibicao__lte=agora)
    )

    bloqueados = tipos_bloqueados.get(nivel, [])
    if bloqueados:
        qs = qs.exclude(tipo__in=bloqueados)

    resultado = []
    for n in qs.order_by('-data_criacao')[:50]:
        resultado.append({
            'id': n.id,
            'tipo': n.tipo,
            'prioridade': n.prioridade,
            'titulo': n.titulo,
            'mensagem': n.mensagem,
            'data': n.data_criacao.strftime('%d/%m/%Y %H:%M'),
            'modelo_referencia': n.modelo_referencia,
            'id_referencia': n.id_referencia,
        })
    return resultado


def dashboard_por_perfil(usuario):
    """
    OTIMIZADO: seção do vendedor usa Subquery via alertas_clientes_sem_comprar
    em vez de loop com property N+1.
    """
    from .bi_dashboard import (
        obter_resumo_financeiro, calcular_curva_abc_produtos,
        faturamento_por_dia, painel_comissoes_vendedor,
        alertas_estoque_baixo, alertas_validade_lotes,
        alertas_contas_vencer, alertas_contas_receber_atrasadas,
        alertas_clientes_sem_comprar, alertas_aniversariantes,
    )
    from .models import PedidoVenda
    from django.db.models import Sum
    from django.db.models.functions import Coalesce

    empresa_id = usuario.empresa_id
    nivel = usuario.nivel

    gerar_notificacoes(empresa_id)
    notificacoes = _notificacoes_visiveis(empresa_id, usuario)

    if nivel == 'operacional':
        return {
            'perfil': 'operacional',
            'alertas': {
                'estoque_baixo': alertas_estoque_baixo(empresa_id),
                'validade_lotes': alertas_validade_lotes(empresa_id),
            },
            'notificacoes': notificacoes,
        }

    if nivel == 'vendedor':
        pedidos_faturados = PedidoVenda.objects.filter(
            empresa_id=empresa_id,
            vendedor=usuario,
            status='faturado',
        )
        faturamento = pedidos_faturados.aggregate(
            total=Coalesce(Sum('valor_total'), Decimal('0.00'))
        )['total']

        # OTIMIZADO: usa ids dos clientes do vendedor para filtrar alertas
        # em vez de loop com property N+1
        ids_clientes = list(
            pedidos_faturados.values_list('cliente_id', flat=True).distinct()
        )
        todos_clientes_inativos = alertas_clientes_sem_comprar(empresa_id, dias=25)
        clientes_sem_comprar = [
            c for c in todos_clientes_inativos if c['id'] in ids_clientes
        ]

        return {
            'perfil': 'vendedor',
            'resumo': {
                'faturamento_mes': round(faturamento, 2),
                'meta_mensal': round(usuario.meta_mensal, 2),
                'percentual_meta': round(
                    (faturamento / usuario.meta_mensal * 100)
                    if usuario.meta_mensal > 0 else Decimal('0.00'), 2),
            },
            'comissoes': painel_comissoes_vendedor(empresa_id, usuario.id),
            'alertas': {
                'estoque_baixo': alertas_estoque_baixo(empresa_id),
                'validade_lotes': alertas_validade_lotes(empresa_id),
                'clientes_sem_comprar': clientes_sem_comprar,
                'contas_atrasadas': alertas_contas_receber_atrasadas(empresa_id),
            },
            'notificacoes': notificacoes,
        }

    # GERENTE / DIRETOR
    return {
        'perfil': nivel,
        'resumo_financeiro': obter_resumo_financeiro(empresa_id),
        'curva_abc': calcular_curva_abc_produtos(empresa_id),
        'faturamento_por_dia': faturamento_por_dia(empresa_id),
        'alertas': {
            'estoque_baixo': alertas_estoque_baixo(empresa_id),
            'validade_lotes': alertas_validade_lotes(empresa_id),
            'contas_vencer': alertas_contas_vencer(empresa_id, dias=7),
            'contas_atrasadas': alertas_contas_receber_atrasadas(empresa_id),
            'clientes_sem_comprar': alertas_clientes_sem_comprar(empresa_id),
            'aniversariantes': alertas_aniversariantes(empresa_id),
        },
        'notificacoes': notificacoes,
    }