from decimal import Decimal
from django.utils import timezone
from django.db.models import F, Q, OuterRef, Subquery, DateTimeField, Sum
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
        Cliente, Notificacao, Empresa, PedidoVenda,
        DataComemorativa, Usuario, NotaFiscal
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
                          modelo_ref=None, id_ref=None, usuario=None,
                          visivel_para_nivel=''):
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
            modelo_referencia=modelo_ref, id_referencia=id_ref,
            chave_unica=chave, visivel_para_nivel=visivel_para_nivel,
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
    # Agora também gera avisos especiais aos 3, 7 e 15 dias de atraso.
    # Se o boleto continuar não pago depois de 15 dias, passa para status 'inadimplente'.
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

        if dias_atraso in (3, 7, 15) or dias_atraso > 15:
            if dias_atraso > 15:
                marco = '15+'
                texto_atraso = f"em atraso há {dias_atraso} dias"
                prioridade = 'alta'
                if conta.status != 'inadimplente':
                    conta.status = 'inadimplente'
                    conta.save(update_fields=['status'])
            else:
                marco = str(dias_atraso)
                texto_atraso = f"em atraso há {dias_atraso} dias"
                prioridade = 'alta' if dias_atraso >= 7 else 'media'

            criar_ou_reativar(
                chave=f"boleto_vencer_{conta.id}_atraso_{marco}",
                tipo='boleto_vencer',
                titulo=f"Boleto em atraso: {nome_cliente}",
                mensagem=f"R$ {conta.valor} está {texto_atraso}. Venc.: {conta.data_vencimento.strftime('%d/%m/%Y')}.",
                prioridade=prioridade,
                modelo_ref='ContaReceber', id_ref=conta.id,
            )
            if conta.pedido_venda and conta.pedido_venda.vendedor:
                criar_ou_reativar(
                    chave=f"boleto_vencer_{conta.id}_atraso_{marco}_v{vendedor.id}",
                    tipo='boleto_vencer',
                    titulo=f"Boleto em atraso: {nome_cliente}",
                    mensagem=f"R$ {conta.valor} está {texto_atraso}.",
                    prioridade=prioridade,
                    modelo_ref='ContaReceber', id_ref=conta.id, usuario=vendedor,
                )

    # ----------------------------------------------------------
    # META ATINGIDA — notificação para vendedor e aviso geral para gerentes/diretores
    # ----------------------------------------------------------
    inicio_mes = hoje.replace(day=1)
    if inicio_mes.month == 12:
        fim_mes = inicio_mes.replace(day=31)
    else:
        fim_mes = (inicio_mes.replace(month=inicio_mes.month + 1, day=1) - timedelta(days=1))

    vendedores = Usuario.objects.filter(
        empresa_id=empresa_id,
        nivel='vendedor',
        ativo=True,
        meta_mensal__gt=Decimal('0.00')
    )
    for vendedor in vendedores:
        faturado_mes = PedidoVenda.objects.filter(
            empresa_id=empresa_id,
            vendedor=vendedor,
            status='faturado',
            data_pedido__date__gte=inicio_mes,
            data_pedido__date__lte=fim_mes,
        ).aggregate(total=Sum('valor_total'))['total'] or Decimal('0.00')

        if faturado_mes >= vendedor.meta_mensal > Decimal('0.00'):
            nome_vendedor = vendedor.get_full_name() or vendedor.username
            valor_meta = round(vendedor.meta_mensal, 2)
            valor_faturado = round(faturado_mes, 2)

            criar_ou_reativar(
                chave=f"meta_atingida_v{vendedor.id}_{hoje.year}_{hoje.month}",
                tipo='meta_atingida',
                titulo=f"Parabéns, {nome_vendedor}! Meta atingida 🎉",
                mensagem=f"Você atingiu R$ {valor_faturado:.2f} de faturamento em {inicio_mes.strftime('%m/%Y')}. Meta: R$ {valor_meta:.2f}.",
                prioridade='baixa',
                modelo_ref='Usuario', id_ref=vendedor.id,
                usuario=vendedor,
            )

            criar_ou_reativar(
                chave=f"meta_atingida_geral_v{vendedor.id}_{hoje.year}_{hoje.month}",
                tipo='meta_atingida',
                titulo=f"Meta atingida por {nome_vendedor} 🎉",
                mensagem=f"O vendedor {nome_vendedor} ultrapassou sua meta de R$ {valor_meta:.2f} em {inicio_mes.strftime('%m/%Y')} com R$ {valor_faturado:.2f} faturados.",
                prioridade='baixa',
                modelo_ref='Usuario', id_ref=vendedor.id,
                visivel_para_nivel='diretor,gerente',
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
        'ultimo_pedido_data', 'ultimo_vendedor_id', 'prazo_recompra'
    )

    # Pré-carrega vendedores necessários em uma query só
    vendedor_ids = {c['ultimo_vendedor_id'] for c in clientes_inativos if c['ultimo_vendedor_id']}
    vendedores_map = {u.id: u for u in Usuario.objects.filter(id__in=vendedor_ids)} if vendedor_ids else {}

    prazo_empresa = empresa.prazo_recompra_padrao or 25

    for cliente in clientes_inativos:
        dias = (hoje - cliente['ultimo_pedido_data'].date()).days
        prazo = cliente['prazo_recompra'] or prazo_empresa
        if dias >= prazo:
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
    # ANIVERSARIANTES — PF (data_nascimento) e PJ (data_fundacao)
    # ----------------------------------------------------------
    ultimo_vendedor_aniv_sub = PedidoVenda.objects.filter(
        cliente=OuterRef('pk'),
        status__in=['aprovado', 'faturado']
    ).order_by('-data_pedido').values('vendedor_id')[:1]

    clientes_aniversario = Cliente.objects.filter(
        empresa_id=empresa_id
    ).annotate(
        ultimo_vendedor_aniv_id=Subquery(ultimo_vendedor_aniv_sub),
    ).filter(
        Q(data_nascimento__isnull=False) | Q(data_fundacao__isnull=False)
    ).values(
        'id', 'nome_razao', 'nome_fantasia', 'telefone',
        'data_nascimento', 'data_fundacao', 'tipo_pessoa', 'ultimo_vendedor_aniv_id'
    )

    vendedor_aniv_ids = {c['ultimo_vendedor_aniv_id'] for c in clientes_aniversario if c['ultimo_vendedor_aniv_id']}
    vendedores_aniv_map = {u.id: u for u in Usuario.objects.filter(id__in=vendedor_aniv_ids)} if vendedor_aniv_ids else {}

    for cliente in clientes_aniversario:
        # PJ usa data_fundacao; PF usa data_nascimento
        data_ref = cliente['data_fundacao'] if cliente['tipo_pessoa'] == 'J' else cliente['data_nascimento']
        if not data_ref:
            data_ref = cliente['data_nascimento'] or cliente['data_fundacao']
        if not data_ref:
            continue
        try:
            aniversario = data_ref.replace(year=hoje.year)
        except ValueError:
            aniversario = data_ref.replace(year=hoje.year, day=28)
        if aniversario < hoje:
            try:
                aniversario = aniversario.replace(year=hoje.year + 1)
            except ValueError:
                aniversario = aniversario.replace(year=hoje.year + 1, day=28)
        if (aniversario - hoje).days <= 7:
            nome = cliente['nome_fantasia'] or cliente['nome_razao']
            label = 'Fundação' if cliente['tipo_pessoa'] == 'J' else 'Aniversário'
            criar_ou_reativar(
                chave=f"aniversario_{cliente['id']}_{hoje.year}",
                tipo='aniversario',
                titulo=f"{label}: {nome}",
                mensagem=f"Dia {data_ref.strftime('%d/%m')}. Tel: {cliente['telefone'] or 'não informado'}.",
                prioridade='baixa', modelo_ref='Cliente', id_ref=cliente['id'],
            )
            vendedor = vendedores_aniv_map.get(cliente['ultimo_vendedor_aniv_id'])
            if vendedor:
                criar_ou_reativar(
                    chave=f"aniversario_{cliente['id']}_{hoje.year}_v{vendedor.id}",
                    tipo='aniversario',
                    titulo=f"{label}: {nome}",
                    mensagem=f"Dia {data_ref.strftime('%d/%m')}. Tel: {cliente['telefone'] or 'não informado'}.",
                    prioridade='baixa', modelo_ref='Cliente', id_ref=cliente['id'],
                    usuario=vendedor,
                )

    # ----------------------------------------------------------
    # DATAS COMEMORATIVAS
    # ----------------------------------------------------------
    for data in DataComemorativa.objects.filter(empresa_id=empresa_id, ativo=True):
        try:
            data_evento = hoje.replace(month=data.mes, day=data.dia)
        except ValueError:
            continue
        if data_evento < hoje:
            try:
                data_evento = data_evento.replace(year=hoje.year + 1)
            except ValueError:
                continue
        if (data_evento - hoje).days <= data.dias_antecedencia:
            chave_base = f"comemorativa_{data.id}_{data_evento.year}"
            criar_ou_reativar(
                chave=chave_base,
                tipo='data_comemorativa',
                titulo=f"Data comemorativa: {data.nome}",
                mensagem=f"{data.nome} em {data_evento.strftime('%d/%m/%Y')}.",
                prioridade='baixa', modelo_ref='DataComemorativa', id_ref=data.id,
            )
            if data.para_todos_vendedores:
                vendedores_dc = Usuario.objects.filter(empresa_id=empresa_id, nivel='vendedor', ativo=True)
            else:
                vendedores_dc = data.vendedores.filter(ativo=True)
            for v in vendedores_dc:
                criar_ou_reativar(
                    chave=f"{chave_base}_v{v.id}",
                    tipo='data_comemorativa',
                    titulo=f"Data comemorativa: {data.nome}",
                    mensagem=f"{data.nome} em {data_evento.strftime('%d/%m/%Y')}.",
                    prioridade='baixa', modelo_ref='DataComemorativa', id_ref=data.id,
                    usuario=v,
                )

    # ----------------------------------------------------------
    # CONTINGÊNCIA SEFAZ
    # Visível para: operacional, gerente, diretor
    # ----------------------------------------------------------
    nfes_contingencia = NotaFiscal.objects.filter(
        empresa_id=empresa_id, status='contingencia'
    ).order_by('data_emissao')

    count_contingencia = nfes_contingencia.count()
    chave_contingencia = f"contingencia_sefaz_{empresa_id}"

    if count_contingencia > 0:
        primeira = nfes_contingencia.first()
        modo = primeira.modo_contingencia or 'FS-DA'
        modo_display = dict(NotaFiscal.MODO_CONTINGENCIA_CHOICES).get(modo, modo)
        horas = None
        if primeira.data_emissao:
            horas = round((agora - primeira.data_emissao).total_seconds() / 3600, 1)
        msg_tempo = f" — ativa há {horas}h" if horas is not None else ""
        criar_ou_reativar(
            chave=chave_contingencia,
            tipo='contingencia_sefaz',
            titulo='Contingência SEFAZ ativa',
            mensagem=(
                f"Modo {modo_display}{msg_tempo}. "
                f"{count_contingencia} NF-e(s) pendente(s) de transmissão à SEFAZ."
            ),
            prioridade='alta',
        )
    else:
        # Encerra a notificação se a contingência foi resolvida
        existente = notificacoes_existentes.get(chave_contingencia)
        if existente and not existente.fechada:
            existente.fechada = True
            existente.save(update_fields=['fechada'])


def _notificacoes_visiveis(empresa_id, usuario):
    """
    OTIMIZADO: filtra notificações visíveis diretamente no ORM.
    Antes: carregava 50 notificações e filtrava em Python com n.visivel.
    Agora: Q() filtra fechada=False ou proxima_exibicao no passado diretamente no banco.
    """
    from .models import Notificacao
    agora = timezone.now()
    nivel = usuario.nivel

    # Tipos de notificação bloqueados por nível
    tipos_bloqueados = {
        'vendedor':      ['conta_vencer', 'estoque_baixo', 'validade_lote', 'contingencia_sefaz'],
        'administrativo':['cliente_sem_comprar', 'aniversario', 'pos_venda', 'data_comemorativa', 'contingencia_sefaz'],
        'operacional':   ['conta_vencer', 'boleto_vencer', 'cliente_inadimplente',
                          'cliente_sem_comprar', 'aniversario', 'meta_atingida',
                          'pos_venda', 'data_comemorativa'],
        'rh':            ['conta_vencer', 'boleto_vencer', 'cliente_inadimplente',
                          'cliente_sem_comprar', 'aniversario', 'estoque_baixo',
                          'validade_lote', 'meta_atingida', 'pos_venda', 'data_comemorativa',
                          'contingencia_sefaz'],
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


def _criar_notificacao_pos_venda(pedido):
    """
    Cria notificação de pós-venda para o vendedor do pedido e para gerentes/diretores.
    Chamada dentro de faturar_pedido() em models.py.
    """
    from .models import Notificacao, Usuario
    agora = timezone.now()
    empresa = pedido.empresa
    cliente_nome = pedido.cliente.nome_fantasia or pedido.cliente.nome_razao

    def _criar(usuario=None):
        chave = f"pos_venda_{pedido.id}" + (f"_u{usuario.id}" if usuario else "")
        if not Notificacao.objects.filter(chave_unica=chave).exists():
            Notificacao.objects.create(
                empresa=empresa,
                usuario=usuario,
                tipo='pos_venda',
                prioridade='baixa',
                titulo=f"Pós-venda: {cliente_nome}",
                mensagem=f"Pedido #{pedido.id} faturado. Lembre-se de fazer o pós-venda com {cliente_nome}.",
                modelo_referencia='PedidoVenda',
                id_referencia=pedido.id,
                chave_unica=chave,
            )

    # Notificação para o vendedor do pedido
    if pedido.vendedor:
        _criar(usuario=pedido.vendedor)

    # Notificação geral visível para gerentes e diretores (sem usuario = visível por nível)
    _criar()


def dashboard_por_perfil(usuario):
    """
    Retorna dashboard e alertas filtrados pelo nível do usuário.
    Cada nível recebe apenas alertas dos módulos que tem acesso.
    """
    from .bi_dashboard import (
        obter_resumo_financeiro, calcular_curva_abc_produtos,
        faturamento_por_dia, painel_comissoes_vendedor,
        alertas_estoque_baixo, alertas_validade_lotes,
        alertas_contas_vencer, alertas_contas_receber_atrasadas,
        alertas_clientes_sem_comprar, alertas_aniversariantes,
        alertas_operacionais, alertas_administrativo,
    )
    from .models import PedidoVenda, Colaborador, Ferias
    from django.db.models import Sum, Q
    from django.db.models.functions import Coalesce

    empresa_id = usuario.empresa_id
    nivel      = usuario.nivel

    gerar_notificacoes(empresa_id)
    notificacoes = _notificacoes_visiveis(empresa_id, usuario)

    # ── OPERACIONAL / BALCÃO DE LOJA ─────────────────────────────────────────
    if nivel == 'operacional':
        ops = alertas_operacionais(empresa_id)
        return {
            'perfil': 'operacional',
            'alertas': ops,
            'notificacoes': notificacoes,
        }

    # ── RH ───────────────────────────────────────────────────────────────────
    if nivel == 'rh':
        hoje = timezone.now().date()
        ferias_proximas = Ferias.objects.filter(
            colaborador__empresa_id=empresa_id,
            status='agendada',
            data_inicio_gozo__lte=hoje + timedelta(days=30),
            data_inicio_gozo__gte=hoje,
        ).count()
        colaboradores_ativos = Colaborador.objects.filter(
            empresa_id=empresa_id, ativo=True
        ).count()
        return {
            'perfil': 'rh',
            'alertas': {
                'ferias_proximas': ferias_proximas,
                'colaboradores_ativos': colaboradores_ativos,
            },
            'notificacoes': notificacoes,
        }

    # ── VENDEDOR ─────────────────────────────────────────────────────────────
    if nivel == 'vendedor':
        pedidos_faturados = PedidoVenda.objects.filter(
            empresa_id=empresa_id,
            vendedor=usuario,
            status='faturado',
        )
        faturamento = pedidos_faturados.aggregate(
            total=Coalesce(Sum('valor_total'), Decimal('0.00'))
        )['total']

        # Carteira do vendedor: clientes com quem já negociou
        ids_clientes = list(
            PedidoVenda.objects.filter(
                empresa_id=empresa_id, vendedor=usuario
            ).values_list('cliente_id', flat=True).distinct()
        )

        # Clientes inativos — só da carteira do vendedor
        todos_inativos = alertas_clientes_sem_comprar(empresa_id, dias=25)
        clientes_sem_comprar = [c for c in todos_inativos if c['id'] in ids_clientes]

        # Inadimplência — só clientes da carteira do vendedor
        ids_set = set(ids_clientes)
        todas_atrasadas = alertas_contas_receber_atrasadas(empresa_id)
        contas_atrasadas = [
            c for c in todas_atrasadas if c.get('cliente_id') in ids_set
        ] if ids_clientes else []

        return {
            'perfil': 'vendedor',
            'resumo': {
                'faturamento_mes':  round(faturamento, 2),
                'meta_mensal':      round(usuario.meta_mensal, 2),
                'percentual_meta':  round(
                    (faturamento / usuario.meta_mensal * 100)
                    if usuario.meta_mensal > 0 else Decimal('0.00'), 2),
            },
            'comissoes': painel_comissoes_vendedor(empresa_id, usuario.id),
            'alertas': {
                'clientes_sem_comprar': clientes_sem_comprar,
                'contas_atrasadas':     contas_atrasadas,
            },
            'notificacoes': notificacoes,
        }

    # ── ADMINISTRATIVO / FINANCEIRO ───────────────────────────────────────────
    if nivel == 'administrativo':
        return {
            'perfil': 'administrativo',
            'resumo_financeiro': obter_resumo_financeiro(empresa_id),
            'alertas': alertas_administrativo(empresa_id),
            'notificacoes': notificacoes,
        }

    # ── GERENTE / DIRETOR ─────────────────────────────────────────────────────
    return {
        'perfil': nivel,
        'resumo_financeiro': obter_resumo_financeiro(empresa_id),
        'curva_abc':         calcular_curva_abc_produtos(empresa_id),
        'faturamento_por_dia': faturamento_por_dia(empresa_id),
        'alertas': {
            'estoque_baixo':        alertas_estoque_baixo(empresa_id),
            'validade_lotes':       alertas_validade_lotes(empresa_id),
            'contas_vencer':        alertas_contas_vencer(empresa_id, dias=7),
            'contas_atrasadas':     alertas_contas_receber_atrasadas(empresa_id),
            'clientes_sem_comprar': alertas_clientes_sem_comprar(empresa_id),
            'aniversariantes':      alertas_aniversariantes(empresa_id),
        },
        'notificacoes': notificacoes,
    }