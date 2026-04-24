from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum


def verificar_travas_pedido(pedido, divida_atual=None):
    """
    Verifica se o pedido deve ser retido na fila de aprovações.
    Retorna (retido: bool, motivos: list)

    OTIMIZADO: aceita divida_atual pré-calculada para evitar N+1
    quando chamado em loop (ex: listar_fila_aprovacao).

    Travas verificadas:
      1. Margem mínima por item
      2. Limite de crédito do cliente
      3. Estoque insuficiente por item
    """
    from .models import ContaReceber
    motivos = []

    for item in pedido.itens.all():
        # TRAVA 1: Margem mínima por item
        if item.produto.custo_medio_ponderado and item.produto.custo_medio_ponderado > 0:
            preco_minimo = item.produto.custo_medio_ponderado * (
                1 + item.produto.margem_minima / Decimal('100')
            )
            if item.preco_unitario < preco_minimo:
                motivos.append(
                    f"Margem abaixo do mínimo: '{item.produto.nome}' "
                    f"(preço R$ {item.preco_unitario} / mínimo R$ {round(preco_minimo, 2)})"
                )

        # TRAVA 3: Estoque insuficiente
        estoque_disponivel = item.produto.quantidade or Decimal('0')
        if estoque_disponivel < item.quantidade:
            motivos.append(
                f"Estoque insuficiente: '{item.produto.nome}' "
                f"(disponível: {estoque_disponivel} / solicitado: {item.quantidade})"
            )

    # TRAVA 2: Limite de crédito do cliente
    if pedido.cliente.limite_credito > 0:
        if divida_atual is None:
            divida_atual = ContaReceber.objects.filter(
                cliente=pedido.cliente,
                status='pendente',
            ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

        total_com_pedido = divida_atual + pedido.valor_total
        if total_com_pedido > pedido.cliente.limite_credito:
            motivos.append(
                f"Limite de crédito excedido: cliente deve R$ {round(divida_atual, 2)} "
                f"+ pedido R$ {round(pedido.valor_total, 2)} "
                f"= R$ {round(total_com_pedido, 2)} "
                f"/ limite R$ {pedido.cliente.limite_credito}"
            )

    return len(motivos) > 0, motivos


def reter_pedido_para_aprovacao(pedido, motivos):
    """
    Retém o pedido na fila de aprovações e notifica gerente/diretor.
    """
    from .models import Notificacao

    pedido.status = 'aguardando'
    pedido.save(update_fields=['status'])

    empresa = pedido.empresa
    motivos_texto = ' | '.join(motivos)

    chave = f"pedido_retido_{pedido.id}"
    Notificacao.objects.get_or_create(
        empresa=empresa,
        chave_unica=chave,
        defaults={
            'tipo': 'pedido_retido',
            'prioridade': 'alta',
            'titulo': f"Pedido #{pedido.id} aguardando aprovação",
            'mensagem': (
                f"Cliente: {pedido.cliente.nome_fantasia or pedido.cliente.nome_razao} | "
                f"Vendedor: {pedido.vendedor.get_full_name() or pedido.vendedor.username} | "
                f"Valor: R$ {pedido.valor_total} | Motivo(s): {motivos_texto}"
            ),
            'modelo_referencia': 'PedidoVenda',
            'id_referencia': pedido.id,
            'visivel_para_nivel': 'gerente,diretor',
        }
    )


def aprovar_pedido(pedido, aprovador, observacao=''):
    """
    Aprova um pedido retido na fila e notifica o vendedor para concluir a venda.
    """
    from .models import LogAuditoria, Notificacao

    if pedido.status != 'aguardando':
        return False, "Pedido não está aguardando aprovação."

    pedido.status = 'aprovado'
    pedido.save(update_fields=['status'])

    # Remove a notificação de retenção para gerente/diretor
    Notificacao.objects.filter(
        empresa=pedido.empresa,
        chave_unica=f"pedido_retido_{pedido.id}"
    ).delete()

    # Notifica o vendedor para entrar e concluir a venda
    Notificacao.objects.create(
        empresa=pedido.empresa,
        usuario=pedido.vendedor,
        tipo='pedido_aprovado',
        prioridade='alta',
        titulo=f"Pedido #{pedido.id} aprovado — conclua a venda",
        mensagem=(
            f"Seu pedido para "
            f"{pedido.cliente.nome_fantasia or pedido.cliente.nome_razao} "
            f"foi aprovado por {aprovador.get_full_name() or aprovador.username}. "
            f"Entre nos pedidos e conclua a venda."
            + (f" Observação: {observacao}" if observacao else "")
        ),
        modelo_referencia='PedidoVenda',
        id_referencia=pedido.id,
        chave_unica=f"pedido_aprovado_{pedido.id}",
        visivel_para_nivel='vendedor',
    )

    LogAuditoria.registrar(
        empresa=pedido.empresa,
        usuario=aprovador,
        acao='aprovacao_pedido',
        modelo_afetado='PedidoVenda',
        registro_id=pedido.id,
        valor_anterior='aguardando',
        valor_novo='aprovado',
        descricao=f"Aprovado por {aprovador.username}. {observacao}",
    )

    return True, "Pedido aprovado com sucesso."


def recusar_pedido(pedido, aprovador, motivo):
    """
    Recusa um pedido retido na fila, devolve o estoque e notifica o vendedor.
    """
    from .models import LogAuditoria, Notificacao

    if pedido.status != 'aguardando':
        return False, "Pedido não está aguardando aprovação."

    if not motivo:
        return False, "Informe o motivo da recusa."

    pedido.status = 'recusado'
    pedido.save(update_fields=['status'])

    Notificacao.objects.filter(
        empresa=pedido.empresa,
        chave_unica=f"pedido_retido_{pedido.id}"
    ).delete()

    Notificacao.objects.create(
        empresa=pedido.empresa,
        usuario=pedido.vendedor,
        tipo='pedido_retido',
        prioridade='alta',
        titulo=f"Pedido #{pedido.id} recusado",
        mensagem=(
            f"Seu pedido para "
            f"{pedido.cliente.nome_fantasia or pedido.cliente.nome_razao} "
            f"foi recusado por {aprovador.get_full_name() or aprovador.username}. "
            f"Motivo: {motivo}"
        ),
        modelo_referencia='PedidoVenda',
        id_referencia=pedido.id,
        chave_unica=f"pedido_recusado_{pedido.id}",
        visivel_para_nivel='vendedor',
    )

    LogAuditoria.registrar(
        empresa=pedido.empresa,
        usuario=aprovador,
        acao='recusa_pedido',
        modelo_afetado='PedidoVenda',
        registro_id=pedido.id,
        valor_anterior='aguardando',
        valor_novo='recusado',
        descricao=f"Recusado por {aprovador.username}. Motivo: {motivo}",
    )

    return True, "Pedido recusado."


def expirar_pedidos_vencidos():
    """
    Expira todos os pedidos em 'aguardando' que ultrapassaram o prazo.
    Chamado diariamente via management command ou Railway cron.

    Para cada pedido expirado:
      - Muda status para 'expirado' (model.save chama devolver_estoque_logico)
      - Remove notificação de retenção do gerente/diretor
      - Cria notificação para o vendedor
      - Registra no LogAuditoria

    Retorna o total de pedidos expirados.
    """
    from .models import PedidoVenda, Notificacao, LogAuditoria

    agora = timezone.now()
    pedidos_expirados = PedidoVenda.objects.filter(
        status='aguardando',
        data_expiracao__lt=agora,
    ).select_related('empresa', 'cliente', 'vendedor')

    total = 0
    for pedido in pedidos_expirados:
        pedido.status = 'expirado'
        pedido.save(update_fields=['status'])

        Notificacao.objects.filter(
            empresa=pedido.empresa,
            chave_unica=f"pedido_retido_{pedido.id}"
        ).delete()

        Notificacao.objects.create(
            empresa=pedido.empresa,
            usuario=pedido.vendedor,
            tipo='pedido_expirado',
            prioridade='media',
            titulo=f"Pedido #{pedido.id} expirou",
            mensagem=(
                f"Seu pedido para "
                f"{pedido.cliente.nome_fantasia or pedido.cliente.nome_razao} "
                f"expirou sem aprovação dentro do prazo de "
                f"{pedido.empresa.prazo_expiracao_pedido} dia(s). "
                f"O estoque foi devolvido automaticamente. "
                f"O pedido permanece no histórico com status 'Expirado'."
            ),
            modelo_referencia='PedidoVenda',
            id_referencia=pedido.id,
            chave_unica=f"pedido_expirado_{pedido.id}",
            visivel_para_nivel='vendedor',
        )

        LogAuditoria.registrar(
            empresa=pedido.empresa,
            usuario=None,
            acao='expiracao_automatica',
            modelo_afetado='PedidoVenda',
            registro_id=pedido.id,
            valor_anterior='aguardando',
            valor_novo='expirado',
            descricao=(
                f"Pedido expirou automaticamente após "
                f"{pedido.empresa.prazo_expiracao_pedido} dia(s) sem aprovação."
            ),
        )
        total += 1

    return total


def listar_fila_aprovacao(empresa_id):
    """
    OTIMIZADO: pré-carrega dívidas de todos os clientes em uma query
    em vez de buscar por cliente dentro do loop (N+1).
    """
    from .models import PedidoVenda, ContaReceber

    pedidos = PedidoVenda.objects.filter(
        empresa_id=empresa_id,
        status='aguardando',
    ).select_related(
        'cliente', 'vendedor', 'condicao_pagamento', 'forma_pagamento'
    ).prefetch_related('itens__produto').order_by('data_pedido')

    clientes_ids = list(pedidos.values_list('cliente_id', flat=True).distinct())
    dividas_map = {}
    if clientes_ids:
        dividas_qs = ContaReceber.objects.filter(
            cliente_id__in=clientes_ids,
            status='pendente',
        ).values('cliente_id').annotate(total=Sum('valor'))
        dividas_map = {d['cliente_id']: d['total'] or Decimal('0') for d in dividas_qs}

    resultado = []
    for pedido in pedidos:
        divida_atual = dividas_map.get(pedido.cliente_id, Decimal('0'))
        _, motivos = verificar_travas_pedido(pedido, divida_atual=divida_atual)

        itens = [{
            'produto': item.produto.nome,
            'quantidade': round(item.quantidade, 2),
            'preco_unitario': round(item.preco_unitario, 2),
            'subtotal': round(item.subtotal, 2),
            'margem_segura': item.margem_segura,
        } for item in pedido.itens.all()]

        resultado.append({
            'id': pedido.id,
            'data': pedido.data_pedido.strftime('%d/%m/%Y %H:%M'),
            'data_expiracao': pedido.data_expiracao.strftime('%d/%m/%Y %H:%M') if pedido.data_expiracao else None,
            'cliente': pedido.cliente.nome_fantasia or pedido.cliente.nome_razao,
            'vendedor': pedido.vendedor.get_full_name() or pedido.vendedor.username,
            'valor_total': round(pedido.valor_total, 2),
            'motivos_retencao': motivos,
            'itens': itens,
            'forma_pagamento': pedido.forma_pagamento.nome if pedido.forma_pagamento else None,
            'condicao_pagamento': pedido.condicao_pagamento.descricao if pedido.condicao_pagamento else None,
        })

    return resultado
