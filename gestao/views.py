from rest_framework.permissions import AllowAny
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .dashboard_perfil import dashboard_por_perfil
from .aprovacoes import verificar_travas_pedido, reter_pedido_para_aprovacao, aprovar_pedido, recusar_pedido, listar_fila_aprovacao
from .caixa import abrir_caixa, fechar_caixa, registrar_sangria, registrar_suprimento, resumo_caixa
from django.utils import timezone
from decimal import Decimal
from .expedicao import gerar_romaneio_cego, listar_pedidos_expedicao
from .pedido_compra import criar_pedido_compra, vincular_nf_entrada, listar_pedidos_compra
from .whitelabel import upload_logo_s3, obter_configuracao_whitelabel
from django.db.models import Q
from datetime import date

from .fiscal import (
     sugerir_tributacao,
     emitir_nfe_focusnfe,
     consultar_status_nfe,
     gerar_zip_contador,
     popular_dados_fiscais,
)
from .fiscal_complementar import (
    emitir_nfse, consultar_status_nfse, cancelar_nfse,
    emitir_cte, consultar_status_cte, cancelar_cte,
    emitir_mdfe, encerrar_mdfe, consultar_status_mdfe,
    download_danfe, download_xml,
    upload_certificado, listar_certificados, consultar_certificado_focusnfe,
    inutilizar_nfe, listar_inutilizacoes,
)
from .estoque_inicial_e_financeiro_avulso import (
    lancar_estoque_inicial,
    verificar_estoque_inicial,
    criar_lancamento_avulso,
    listar_lancamentos_avulsos,
)
from .serializers import (
    PedidoVendaSerializer, ClienteSerializer,
    ProdutoSerializer, ContaPagarSerializer, ContaReceberSerializer,
    GrupoClienteSerializer, TabelaPrecoSerializer, ItemTabelaPrecoSerializer,
    VeiculoSerializer, FazendaSerializer, GlebaSerializer, TalhaoSerializer,
    DevolucaoVendaSerializer, BancoSerializer,
)
from .filtros_export import get_filtros_base, exportar_pdf, exportar_excel, preparar_exportacao


# ── Mixin de exportação para ViewSets ──────────────────────────────────────────

class ExportMixin:
    """
    Adiciona suporte a ?exportar=pdf|excel em qualquer ViewSet.
    Subclasses devem definir export_titulo, export_filename e export_colunas.
    export_colunas: list[tuple[str, str]] → (campo_serializer_ou_callable, 'Nome Coluna')
    """
    export_titulo = 'Relatório'
    export_filename = 'relatorio'
    export_colunas: list = []

    def _get_valor(self, obj, campo):
        if callable(campo):
            return campo(obj)
        parts = campo.split('__')
        val = obj
        for p in parts:
            val = getattr(val, p, '') if val else ''
        if val is None:
            return ''
        return str(val)

    def list(self, request, *args, **kwargs):
        exportar = request.query_params.get('exportar')
        if exportar not in ('pdf', 'excel'):
            return super().list(request, *args, **kwargs)
        qs = self.get_queryset()
        ids_param = request.query_params.get('ids')
        if ids_param:
            try:
                ids = [int(x) for x in ids_param.split(',') if x.strip().isdigit()]
                if ids:
                    qs = qs.filter(id__in=ids)
            except (ValueError, AttributeError):
                pass
        colunas = [nome for _, nome in self.export_colunas]
        linhas = [[self._get_valor(obj, campo) for campo, _ in self.export_colunas] for obj in qs]
        titulo = self.export_titulo
        fn = self.export_filename
        if exportar == 'pdf':
            return exportar_pdf(titulo, colunas, linhas, filename=f'{fn}.pdf')
        return exportar_excel(titulo, colunas, linhas, filename=f'{fn}.xlsx')
from .models import (
    PedidoVenda, Empresa, Cliente, Produto,
    ContaPagar, ContaReceber,
    GrupoCliente, TabelaPreco, ItemTabelaPreco,
    Veiculo, Fazenda, Gleba, Talhao,
    DevolucaoVenda, Banco,
)
from .relatorios import (
    gerar_dre,
    relatorio_inadimplencia,
    relatorio_performance_vendedores,
    relatorio_comissoes_repasse,
    curva_abc_lucratividade,
    relatorio_entradas_saidas_detalhado,
    contas_aberto_por_cliente,
)
from .bi_dashboard import (
    obter_dashboard_completo,
    alertas_estoque_baixo,
    alertas_validade_lotes,
    alertas_contas_vencer,
    alertas_contas_receber_atrasadas,
    alertas_clientes_sem_comprar,
    alertas_aniversariantes,
    painel_comissoes_vendedor,
)
from .manifestacao import (
    consultar_nfes_pendentes,
    manifestar_nfe,
    cancelar_nfe,
    carta_correcao_nfe,
)
from .pdv import criar_venda_pdv, cancelar_venda_pdv


# ==========================================
# UTILITÁRIO INTERNO
# ==========================================

def _get_empresa_id(request):
    """Retorna o empresa_id do usuário logado com fallback seguro para testes."""
    if request.user.is_authenticated and hasattr(request.user, 'empresa') and request.user.empresa:
        return request.user.empresa.id
    primeira = Empresa.objects.first()
    return primeira.id if primeira else None


def _get_vendedor_id(request):
    """Retorna o ID do vendedor se o nível for 'vendedor', senão None."""
    if request.user.is_authenticated and getattr(request.user, 'nivel', None) == 'vendedor':
        return request.user.id
    return None


# ==========================================
# VIEWSET DE PEDIDOS
# ==========================================

class PedidoVendaViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = PedidoVendaSerializer
    export_titulo = 'Pedidos de Venda'
    export_filename = 'pedidos_venda'
    export_colunas = [
        (lambda o: str(o.id),                                          'Nº'),
        (lambda o: o.cliente.nome_razao if o.cliente else '',          'Cliente'),
        (lambda o: o.vendedor.get_full_name() or o.vendedor.username if o.vendedor else '', 'Vendedor'),
        (lambda o: f'R$ {o.valor_total:,.2f}',                         'Valor Total'),
        (lambda o: o.get_status_display(),                             'Status'),
        (lambda o: o.condicao_pagamento or '',                         'Condição Pagto.'),
        (lambda o: o.data_pedido.strftime('%d/%m/%Y') if o.data_pedido else '', 'Data'),
    ]

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        f = get_filtros_base(self.request)
        qs = PedidoVenda.objects.filter(empresa_id=empresa_id)
        if f['data_inicio']:
            qs = qs.filter(data_pedido__date__gte=f['data_inicio'])
        if f['data_fim']:
            qs = qs.filter(data_pedido__date__lte=f['data_fim'])
        if f['cliente_id']:
            qs = qs.filter(cliente_id=f['cliente_id'])
        if f['status']:
            qs = qs.filter(status=f['status'])
        # Vendedor só vê seus próprios pedidos
        nivel = getattr(self.request.user, 'nivel', None)
        if nivel == 'vendedor':
            qs = qs.filter(vendedor=self.request.user)
        elif f['vendedor_id'] and nivel in ['diretor', 'gerente']:
            qs = qs.filter(vendedor_id=f['vendedor_id'])
        return qs.select_related('cliente', 'vendedor').order_by('-data_pedido')


# ==========================================
# DASHBOARD COMPLETO (rota principal)
# ==========================================

@api_view(['GET'])
def api_dashboard_gestao(request):
    if not request.user.is_authenticated or not request.user.empresa:
        from .models import Usuario
        usuario = Usuario.objects.filter(is_superuser=True).first()
    else:
        usuario = request.user
    return Response(dashboard_por_perfil(usuario))


# ==========================================
# ROTAS INDIVIDUAIS DE ALERTAS
# ==========================================

@api_view(['GET'])
def api_alertas_estoque(request):
    """Produtos com estoque abaixo do mínimo."""
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)
    return Response(alertas_estoque_baixo(empresa_id))


@api_view(['GET'])
def api_alertas_validade(request):
    """Lotes com validade próxima ou vencidos."""
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)
    dias = int(request.query_params.get('dias', 45))
    return Response(alertas_validade_lotes(empresa_id, dias_alerta=dias))


@api_view(['GET'])
def api_alertas_contas_vencer(request):
    """Contas a pagar que vencem em breve."""
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)
    dias = int(request.query_params.get('dias', 7))
    return Response(alertas_contas_vencer(empresa_id, dias=dias))


@api_view(['GET'])
def api_alertas_receber_atrasados(request):
    """Contas a receber já vencidas."""
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)
    return Response(alertas_contas_receber_atrasadas(empresa_id))


@api_view(['GET'])
def api_alertas_clientes(request):
    """Clientes sem comprar há mais de X dias."""
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)
    dias = int(request.query_params.get('dias', 25))
    return Response(alertas_clientes_sem_comprar(empresa_id, dias=dias))


@api_view(['GET'])
def api_alertas_aniversariantes(request):
    """Clientes que fazem aniversário hoje ou nos próximos 7 dias."""
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)
    return Response(alertas_aniversariantes(empresa_id))


@api_view(['GET'])
def api_comissoes_vendedor(request):
    """
    Painel de comissões do vendedor logado.
    Só retorna dados se o usuário for do nível 'vendedor'.
    """
    empresa_id = _get_empresa_id(request)
    vendedor_id = _get_vendedor_id(request)

    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)

    if not vendedor_id:
        return Response({'erro': 'Acesso restrito a vendedores.'}, status=403)

    dias = int(request.query_params.get('dias', 30))
    return Response(painel_comissoes_vendedor(empresa_id, vendedor_id, dias))


# ==========================================
# VIEWSETS DE CADASTRO
# ==========================================

class ClienteViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    export_titulo = 'Clientes'
    export_filename = 'clientes'
    export_colunas = [
        (lambda o: o.nome_razao,                       'Nome / Razão Social'),
        (lambda o: o.nome_fantasia or '',               'Nome Fantasia'),
        (lambda o: o.cnpj_cpf or '',                   'CNPJ / CPF'),
        (lambda o: o.telefone or '',                   'Telefone'),
        (lambda o: o.responsavel or '',                'Responsável'),
        (lambda o: 'Ativo' if o.ativo else 'Inativo',  'Status'),
        (lambda o: f'R$ {o.limite_credito:,.2f}' if o.limite_credito else '', 'Limite de Crédito'),
    ]

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        f = get_filtros_base(self.request)
        qs = Cliente.objects.filter(empresa_id=empresa_id)
        if f['status']:
            qs = qs.filter(status=f['status'])
        busca = self.request.query_params.get('busca')
        if busca:
            from django.db.models import Q
            qs = qs.filter(
                Q(nome_razao__icontains=busca) |
                Q(nome_fantasia__icontains=busca) |
                Q(cnpj__icontains=busca)
            )
        nivel = getattr(self.request.user, 'nivel', None)
        if nivel == 'vendedor' and getattr(self.request.user, 've_apenas_seus_clientes', True):
            qs = qs.filter(pedidovenda__vendedor=self.request.user).distinct()
        return qs.order_by('nome_razao')


class ProdutoViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = ProdutoSerializer
    export_titulo = 'Produtos'
    export_filename = 'produtos'
    export_colunas = [
        (lambda o: o.nome,                                    'Nome'),
        (lambda o: o.sku or '',                               'SKU'),
        (lambda o: o.ncm or '',                               'NCM'),
        (lambda o: o.unidade_medida or '',                    'Unidade'),
        (lambda o: f'R$ {o.preco_venda:,.2f}' if o.preco_venda else '', 'Preço Venda'),
        (lambda o: str(o.quantidade or 0),                    'Qtd. Estoque'),
        (lambda o: str(o.estoque_minimo or 0),                'Estoque Mínimo'),
        (lambda o: 'Ativo' if o.ativo else 'Inativo',         'Status'),
    ]

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        qs = Produto.objects.filter(empresa_id=empresa_id)
        busca = self.request.query_params.get('busca')
        if busca:
            from django.db.models import Q
            qs = qs.filter(
                Q(nome__icontains=busca) |
                Q(sku__icontains=busca) |
                Q(ncm__icontains=busca)
            )
        # Vendedor e administrativo não veem custo/margem — serializer controla,
        # mas o queryset já fica filtrado para não expor campos sensíveis acidentalmente
        return qs.order_by('nome')


class ContaPagarViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = ContaPagarSerializer
    export_titulo = 'Contas a Pagar'
    export_filename = 'contas_pagar'
    export_colunas = [
        (lambda o: o.fornecedor.nome_razao if o.fornecedor else '', 'Fornecedor'),
        (lambda o: o.descricao or '',                               'Descrição'),
        (lambda o: f'R$ {o.valor:,.2f}',                           'Valor'),
        (lambda o: o.data_vencimento.strftime('%d/%m/%Y') if o.data_vencimento else '', 'Vencimento'),
        (lambda o: o.data_pagamento.strftime('%d/%m/%Y') if o.data_pagamento else '', 'Pagamento'),
        (lambda o: o.get_status_display() if hasattr(o, 'get_status_display') else o.status, 'Status'),
        (lambda o: o.centro_custo or '',                           'Centro de Custo'),
    ]

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        f = get_filtros_base(self.request)
        qs = ContaPagar.objects.filter(empresa_id=empresa_id)
        if f['data_inicio']:
            qs = qs.filter(data_vencimento__gte=f['data_inicio'])
        if f['data_fim']:
            qs = qs.filter(data_vencimento__lte=f['data_fim'])
        if f['fornecedor_id']:
            qs = qs.filter(fornecedor_id=f['fornecedor_id'])
        if f['status']:
            qs = qs.filter(status=f['status'])
        return qs.order_by('data_vencimento')


class ContaReceberViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = ContaReceberSerializer
    export_titulo = 'Contas a Receber'
    export_filename = 'contas_receber'
    export_colunas = [
        (lambda o: o.cliente.nome_razao if o.cliente else '', 'Cliente'),
        (lambda o: o.descricao or '',                         'Descrição'),
        (lambda o: f'R$ {o.valor:,.2f}',                     'Valor'),
        (lambda o: o.data_vencimento.strftime('%d/%m/%Y') if o.data_vencimento else '', 'Vencimento'),
        (lambda o: o.data_recebimento.strftime('%d/%m/%Y') if o.data_recebimento else '', 'Recebimento'),
        (lambda o: o.get_status_display() if hasattr(o, 'get_status_display') else o.status, 'Status'),
        (lambda o: o.pedido_venda_id and f'Pedido #{o.pedido_venda_id}' or '', 'Origem'),
    ]

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        f = get_filtros_base(self.request)
        qs = ContaReceber.objects.filter(empresa_id=empresa_id)
        if f['data_inicio']:
            qs = qs.filter(data_vencimento__gte=f['data_inicio'])
        if f['data_fim']:
            qs = qs.filter(data_vencimento__lte=f['data_fim'])
        if f['cliente_id']:
            qs = qs.filter(cliente_id=f['cliente_id'])
        if f['status']:
            qs = qs.filter(status=f['status'])
        return qs.order_by('data_vencimento')

@api_view(['GET'])
def api_notificacoes(request):
    from .models import Notificacao
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)
    notificacoes = Notificacao.objects.filter(
        empresa_id=empresa_id, lida=False,
    ).filter(usuario__in=[request.user, None]).order_by('-data_criacao')[:30]
    return Response([{
        'id': n.id, 'tipo': n.tipo, 'prioridade': n.prioridade,
        'titulo': n.titulo, 'mensagem': n.mensagem,
        'data': n.data_criacao.strftime('%d/%m/%Y %H:%M'),
    } for n in notificacoes if n.visivel])


@api_view(['POST'])
def api_marcar_notificacao_lida(request, notificacao_id):
    from .models import Notificacao
    try:
        n = Notificacao.objects.get(id=notificacao_id, empresa_id=_get_empresa_id(request))
        n.fechar()
        return Response({'status': 'ok'})
    except Notificacao.DoesNotExist:
        return Response({'erro': 'Não encontrada.'}, status=404)


@api_view(['POST'])
def api_marcar_todas_lidas(request):
    from .models import Notificacao
    Notificacao.objects.filter(
        empresa_id=_get_empresa_id(request), lida=False,
    ).update(lida=True, data_leitura=timezone.now())
    return Response({'status': 'ok'})

@api_view(['GET'])
def api_fila_aprovacao(request):
    """
    Lista pedidos aguardando aprovação.
    Acessível por gerente e diretor.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['gerente', 'diretor']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    return Response(listar_fila_aprovacao(empresa_id))


@api_view(['POST'])
def api_aprovar_pedido(request, pedido_id):
    """
    Aprova um pedido retido. Acessível por gerente e diretor.
    """
    from .models import PedidoVenda
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['gerente', 'diretor']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    try:
        pedido = PedidoVenda.objects.get(id=pedido_id, empresa_id=_get_empresa_id(request))
    except PedidoVenda.DoesNotExist:
        return Response({'erro': 'Pedido não encontrado.'}, status=404)

    observacao = request.data.get('observacao', '')
    ok, mensagem = aprovar_pedido(pedido, request.user, observacao)
    status_code = 200 if ok else 400
    return Response({'mensagem': mensagem}, status=status_code)


@api_view(['POST'])
def api_recusar_pedido(request, pedido_id):
    """
    Recusa um pedido retido. Acessível por gerente e diretor.
    """
    from .models import PedidoVenda
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['gerente', 'diretor']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    motivo = request.data.get('motivo', '')
    if not motivo:
        return Response({'erro': 'Informe o motivo da recusa.'}, status=400)

    try:
        pedido = PedidoVenda.objects.get(id=pedido_id, empresa_id=_get_empresa_id(request))
    except PedidoVenda.DoesNotExist:
        return Response({'erro': 'Pedido não encontrado.'}, status=404)

    ok, mensagem = recusar_pedido(pedido, request.user, motivo)
    status_code = 200 if ok else 400
    return Response({'mensagem': mensagem}, status=status_code)


@api_view(['POST'])
def api_expirar_pedido(request, pedido_id):
    """
    Expira manualmente um pedido aguardando aprovação.
    Acessível apenas por diretor.
    Útil para forçar expiração antes do prazo automático.
    """
    from .models import PedidoVenda, LogAuditoria

    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado. Apenas diretores.'}, status=403)

    try:
        pedido = PedidoVenda.objects.get(id=pedido_id, empresa_id=_get_empresa_id(request))
    except PedidoVenda.DoesNotExist:
        return Response({'erro': 'Pedido não encontrado.'}, status=404)

    if pedido.status != 'aguardando':
        return Response(
            {'erro': f"Pedido com status '{pedido.get_status_display()}' não pode ser expirado."},
            status=400,
        )

    pedido.status = 'expirado'
    pedido.save(update_fields=['status'])

    LogAuditoria.registrar(
        empresa=pedido.empresa,
        usuario=request.user,
        acao='expiracao_manual',
        modelo_afetado='PedidoVenda',
        registro_id=pedido.id,
        valor_anterior='aguardando',
        valor_novo='expirado',
        descricao=f"Expirado manualmente por {request.user.username}.",
    )

    return Response({'mensagem': f'Pedido #{pedido.id} expirado. Estoque devolvido.'})




@api_view(['POST'])
def api_abrir_caixa(request):
    """Abre um novo caixa diário."""
    from .models import Empresa, FormaPagamento
    saldo_inicial = request.data.get('saldo_inicial', 0)
    empresa_id = _get_empresa_id(request)

    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)

    ok, mensagem, caixa = abrir_caixa(empresa, request.user, Decimal(str(saldo_inicial)))
    if not ok:
        return Response({'erro': mensagem}, status=400)
    return Response({'mensagem': mensagem, 'caixa_id': caixa.id})


@api_view(['GET'])
def api_resumo_caixa(request):
    """Retorna o resumo do caixa aberto do operador logado."""
    from .models import CaixaDiario
    caixa = CaixaDiario.objects.filter(
        empresa_id=_get_empresa_id(request),
        operador=request.user,
        status='aberto',
    ).first()

    if not caixa:
        return Response({'erro': 'Nenhum caixa aberto.'}, status=404)

    return Response(resumo_caixa(caixa))


@api_view(['POST'])
def api_fechar_caixa(request):
    """Fecha o caixa aberto do operador logado."""
    from .models import CaixaDiario
    caixa = CaixaDiario.objects.filter(
        empresa_id=_get_empresa_id(request),
        operador=request.user,
        status='aberto',
    ).first()

    if not caixa:
        return Response({'erro': 'Nenhum caixa aberto.'}, status=404)

    saldo_real = request.data.get('saldo_final_real')
    if saldo_real is None:
        return Response({'erro': 'Informe o saldo final real.'}, status=400)

    ok, mensagem, resumo = fechar_caixa(caixa, Decimal(str(saldo_real)), request.user)
    if not ok:
        return Response({'erro': mensagem}, status=400)
    return Response({'mensagem': mensagem, 'resumo': resumo})


@api_view(['POST'])
def api_sangria(request):
    """Registra uma sangria no caixa aberto."""
    from .models import CaixaDiario, FormaPagamento
    caixa = CaixaDiario.objects.filter(
        empresa_id=_get_empresa_id(request),
        operador=request.user,
        status='aberto',
    ).first()

    if not caixa:
        return Response({'erro': 'Nenhum caixa aberto.'}, status=404)

    valor = request.data.get('valor')
    descricao = request.data.get('descricao', 'Sangria')
    forma_id = request.data.get('forma_pagamento_id')

    if not valor or not forma_id:
        return Response({'erro': 'Informe valor e forma de pagamento.'}, status=400)

    try:
        forma = FormaPagamento.objects.get(id=forma_id)
    except FormaPagamento.DoesNotExist:
        return Response({'erro': 'Forma de pagamento não encontrada.'}, status=404)

    ok, mensagem = registrar_sangria(caixa, Decimal(str(valor)), descricao, forma, request.user)
    status_code = 200 if ok else 400
    return Response({'mensagem': mensagem}, status=status_code)


@api_view(['POST'])
def api_suprimento(request):
    """Registra um suprimento no caixa aberto."""
    from .models import CaixaDiario, FormaPagamento
    caixa = CaixaDiario.objects.filter(
        empresa_id=_get_empresa_id(request),
        operador=request.user,
        status='aberto',
    ).first()

    if not caixa:
        return Response({'erro': 'Nenhum caixa aberto.'}, status=404)

    valor = request.data.get('valor')
    descricao = request.data.get('descricao', 'Suprimento')
    forma_id = request.data.get('forma_pagamento_id')

    if not valor or not forma_id:
        return Response({'erro': 'Informe valor e forma de pagamento.'}, status=400)

    try:
        forma = FormaPagamento.objects.get(id=forma_id)
    except FormaPagamento.DoesNotExist:
        return Response({'erro': 'Forma de pagamento não encontrada.'}, status=404)

    ok, mensagem = registrar_suprimento(caixa, Decimal(str(valor)), descricao, forma, request.user)
    status_code = 200 if ok else 400
    return Response({'mensagem': mensagem}, status=status_code)

@api_view(['GET'])
def api_dre(request):
    """
    DRE Real do mês.
    Acessível por diretor, gerente e administrativo.
    Parâmetros: ?mes=3&ano=2026&exportar=pdf|excel
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
    empresa_id = _get_empresa_id(request)
    exportar = request.query_params.get('exportar')

    dados = gerar_dre(empresa_id, mes, ano)

    if exportar in ('pdf', 'excel'):
        # DRE é um dict estruturado — lineariza as linhas para exportação
        receitas = dados.get('receitas', [])
        despesas = dados.get('despesas', [])
        linhas = []
        for r in receitas:
            linhas.append([r.get('descricao', ''), 'Receita', f"R$ {r.get('valor', 0):.2f}"])
        for d in despesas:
            linhas.append([d.get('descricao', ''), 'Despesa', f"R$ {d.get('valor', 0):.2f}"])
        linhas.append(['RESULTADO', '', f"R$ {dados.get('resultado', 0):.2f}"])
        titulo = f'DRE — {mes:02d}/{ano}'
        colunas = ['Descrição', 'Tipo', 'Valor']
        fn = f'dre_{mes:02d}_{ano}'
        if exportar == 'pdf':
            return exportar_pdf(titulo, colunas, linhas, filename=f'{fn}.pdf')
        return exportar_excel(titulo, colunas, linhas, filename=f'{fn}.xlsx')

    return Response(dados)


@api_view(['GET'])
def api_inadimplencia(request):
    """
    Relatório de inadimplência com aging da dívida.
    Acessível por diretor, gerente e administrativo.
    Parâmetros: ?exportar=pdf|excel&cliente_id=X&vendedor_id=X
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    exportar = request.query_params.get('exportar')
    dados = relatorio_inadimplencia(empresa_id)

    if exportar in ('pdf', 'excel'):
        linhas_flat = []
        for faixa_nome, faixa in dados.get('aging', {}).items():
            for conta in faixa.get('contas', []):
                linhas_flat.append([
                    conta.get('cliente', ''),
                    conta.get('descricao', ''),
                    f"R$ {conta.get('valor', 0):.2f}",
                    conta.get('vencimento', ''),
                    f"{conta.get('dias_atraso', 0)} dias",
                    conta.get('vendedor', ''),
                ])
        colunas = ['Cliente', 'Descrição', 'Valor', 'Vencimento', 'Atraso', 'Vendedor']
        if exportar == 'pdf':
            return exportar_pdf('Relatório de Inadimplência', colunas, linhas_flat, filename='inadimplencia.pdf')
        return exportar_excel('Inadimplência', colunas, linhas_flat, filename='inadimplencia.xlsx')

    return Response(dados)


@api_view(['GET'])
def api_performance_vendedores(request):
    """
    Performance dos vendedores no mês.
    Acessível por diretor e gerente.
    Parâmetros: ?mes=3&ano=2026&vendedor_id=X&exportar=pdf|excel
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
    empresa_id = _get_empresa_id(request)
    exportar = request.query_params.get('exportar')
    f = get_filtros_base(request)

    dados = relatorio_performance_vendedores(empresa_id, mes, ano)

    if exportar in ('pdf', 'excel'):
        vendedores = dados.get('vendedores', dados) if isinstance(dados, dict) else dados
        linhas = []
        for v in vendedores:
            if f['vendedor_id'] and v.get('vendedor_id') != f['vendedor_id']:
                continue
            linhas.append([
                v.get('vendedor', ''),
                f"R$ {v.get('faturamento', 0):.2f}",
                f"R$ {v.get('meta', 0):.2f}",
                f"{v.get('atingimento', 0):.1f}%",
                str(v.get('pedidos', 0)),
            ])
        colunas = ['Vendedor', 'Faturamento', 'Meta', '% Atingido', 'Pedidos']
        titulo = f'Performance Vendedores — {mes:02d}/{ano}'
        fn = f'performance_{mes:02d}_{ano}'
        if exportar == 'pdf':
            return exportar_pdf(titulo, colunas, linhas, filename=f'{fn}.pdf')
        return exportar_excel(titulo, colunas, linhas, filename=f'{fn}.xlsx')

    return Response(dados)


@api_view(['GET'])
def api_comissoes_repasse(request):
    """
    Relatório de comissões para repasse.
    Acessível por diretor e gerente.
    Parâmetros: ?mes=3&ano=2026&vendedor_id=X&exportar=pdf|excel
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
    empresa_id = _get_empresa_id(request)
    exportar = request.query_params.get('exportar')
    f = get_filtros_base(request)

    dados = relatorio_comissoes_repasse(empresa_id, mes, ano)

    if exportar in ('pdf', 'excel'):
        linhas = []
        for v in dados.get('vendedores', []):
            if f['vendedor_id'] and str(v.get('vendedor_id', '')) != str(f['vendedor_id']):
                continue
            for det in v.get('detalhes', []):
                linhas.append([
                    v.get('vendedor', ''),
                    det.get('cliente', ''),
                    det.get('produto', ''),
                    str(det.get('quantidade', '')),
                    f"R$ {det.get('preco_unitario', 0):.2f}",
                    f"R$ {det.get('subtotal', 0):.2f}",
                    f"{det.get('comissao_percentual', 0):.2f}%",
                    f"R$ {det.get('valor_comissao', 0):.2f}",
                    det.get('data', ''),
                ])
        colunas = ['Vendedor', 'Cliente', 'Produto', 'Qtd', 'Preço Unit.', 'Subtotal', '% Comissão', 'Comissão R$', 'Data']
        titulo = f'Comissões — {mes:02d}/{ano}'
        fn = f'comissoes_{mes:02d}_{ano}'
        if exportar == 'pdf':
            return exportar_pdf(titulo, colunas, linhas, filename=f'{fn}.pdf')
        return exportar_excel(titulo, colunas, linhas, filename=f'{fn}.xlsx')

    return Response(dados)


@api_view(['GET'])
def api_curva_abc_lucratividade(request):
    """
    Curva ABC por lucratividade real.
    Acessível por diretor, gerente e administrativo.
    Parâmetros: ?dias=90&produto_id=X&exportar=pdf|excel
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    dias = int(request.query_params.get('dias', 90))
    empresa_id = _get_empresa_id(request)
    exportar = request.query_params.get('exportar')

    dados = curva_abc_lucratividade(empresa_id, dias)

    if exportar in ('pdf', 'excel'):
        colunas = ['Produto', 'SKU', 'Faturamento', 'Lucro', 'Margem %', '% Participação', 'Curva']
        linhas = [
            [
                p.get('nome', ''),
                p.get('sku', ''),
                f"R$ {p.get('faturamento', 0):.2f}",
                f"R$ {p.get('lucro', 0):.2f}",
                f"{p.get('margem_real', 0):.1f}%",
                f"{p.get('participacao_lucro', 0):.1f}%",
                p.get('curva', ''),
            ]
            for p in dados
        ]
        titulo = f'Curva ABC — últimos {dias} dias'
        if exportar == 'pdf':
            return exportar_pdf(titulo, colunas, linhas, filename='curva_abc.pdf')
        return exportar_excel(titulo, colunas, linhas, filename='curva_abc.xlsx')

    return Response(dados)



# ==========================================
# VIEWS DE EXPEDIÇÃO
# ==========================================

@api_view(['GET'])
def api_expedicao_lista(request):
    """
    Lista pedidos aprovados para expedição.
    Visão cega — sem valores financeiros.
    Acessível por todos os níveis.
    """
    empresa_id = _get_empresa_id(request)
    return Response(listar_pedidos_expedicao(empresa_id))


@api_view(['GET'])
def api_romaneio(request, pedido_id):
    """
    Gera romaneio de carga cego para um pedido.
    Mostra apenas produto, lote e quantidade.
    """
    empresa_id = _get_empresa_id(request)
    romaneio, erro = gerar_romaneio_cego(pedido_id, empresa_id)
    if erro:
        return Response({'erro': erro}, status=404)
    return Response(romaneio)


# ==========================================
# VIEWS DE PEDIDO DE COMPRA
# ==========================================

@api_view(['GET'])
def api_pedidos_compra(request):
    """
    Lista pedidos de compra.
    Parâmetros: ?status=enviado&fornecedor_id=X&data_inicio=&data_fim=
                &atalho=hoje|semana|mes|mes_anterior|ano
                &exportar=pdf|excel
    Acessível por diretor, gerente e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    f = get_filtros_base(request)
    status = f['status'] or request.query_params.get('status')
    exportar = request.query_params.get('exportar')

    dados = listar_pedidos_compra(empresa_id, status)

    # Filtros adicionais client-side sobre o resultado
    if f['fornecedor_id']:
        dados = [d for d in dados if d.get('fornecedor_id') == f['fornecedor_id']]
    if f['data_inicio']:
        dados = [d for d in dados if d.get('data', '') >= str(f['data_inicio'])]
    if f['data_fim']:
        dados = [d for d in dados if d.get('data', '') <= str(f['data_fim'])]

    if exportar in ('pdf', 'excel'):
        colunas = ['Nº', 'Fornecedor', 'Data', 'Previsão', 'Status', 'Total R$']
        linhas = [
            [
                str(d.get('id', '')),
                d.get('fornecedor', ''),
                d.get('data', ''),
                d.get('data_previsao', ''),
                d.get('status', ''),
                f"R$ {d.get('valor_total', 0):.2f}",
            ]
            for d in dados
        ]
        if exportar == 'pdf':
            return exportar_pdf('Pedidos de Compra', colunas, linhas, filename='pedidos_compra.pdf')
        return exportar_excel('Pedidos de Compra', colunas, linhas, filename='pedidos_compra.xlsx')

    return Response(dados)


@api_view(['POST'])
def api_criar_pedido_compra(request):
    """
    Cria um novo pedido de compra.
    Acessível por diretor e gerente.
    """
    from .models import Fornecedor, Transportadora, Empresa
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    data = request.data

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        fornecedor = Fornecedor.objects.get(id=data['fornecedor_id'], empresa=empresa)
    except Exception as e:
        return Response({'erro': str(e)}, status=400)

    transportadora = None
    if data.get('transportadora_id'):
        try:
            transportadora = Transportadora.objects.get(id=data['transportadora_id'], empresa=empresa)
        except Transportadora.DoesNotExist:
            pass

    pedido = criar_pedido_compra(
        empresa=empresa,
        fornecedor=fornecedor,
        responsavel=request.user,
        itens_data=data.get('itens', []),
        transportadora=transportadora,
        data_previsao=data.get('data_previsao'),
        observacoes=data.get('observacoes', ''),
    )

    return Response({'mensagem': 'Pedido de compra criado.', 'pedido_id': pedido.id})


@api_view(['POST'])
def api_vincular_nf_pedido_compra(request, pedido_id):
    """
    Vincula uma NF de entrada a um pedido de compra.
    Atualiza quantidades recebidas automaticamente.
    """
    from .models import PedidoCompra, NotaFiscal
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    nf_id = request.data.get('nota_fiscal_id')

    try:
        pedido = PedidoCompra.objects.get(id=pedido_id, empresa_id=empresa_id)
        nf = NotaFiscal.objects.get(id=nf_id, empresa_id=empresa_id, tipo_nota='entrada')
    except Exception as e:
        return Response({'erro': str(e)}, status=404)

    pedido_atualizado = vincular_nf_entrada(pedido, nf)
    return Response({
        'mensagem': 'NF vinculada com sucesso.',
        'status_pedido': pedido_atualizado.get_status_display(),
    })


# ==========================================
# VIEW DE PERMISSÕES GRANULARES
# ==========================================

@api_view(['GET', 'POST'])
def api_permissoes_granulares(request, usuario_id):
    """
    GET — retorna as permissões de um usuário.
    POST — atualiza as permissões (só diretor pode).
    """
    from .models import PermissaoGranular, Usuario

    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado. Apenas diretores.'}, status=403)

    empresa_id = _get_empresa_id(request)

    try:
        usuario = Usuario.objects.get(id=usuario_id, empresa_id=empresa_id)
    except Usuario.DoesNotExist:
        return Response({'erro': 'Usuário não encontrado.'}, status=404)

    permissao, _ = PermissaoGranular.objects.get_or_create(
        usuario=usuario,
        defaults={'empresa_id': empresa_id}
    )

    if request.method == 'GET':
        return Response({
            'usuario': usuario.get_full_name() or usuario.username,
            'nivel': usuario.get_nivel_display(),
            'permissoes': {
                'ver_custos': permissao.ver_custos,
                'ver_financeiro': permissao.ver_financeiro,
                'ver_dre': permissao.ver_dre,
                'ver_comissoes_outros': permissao.ver_comissoes_outros,
                'aprovar_pedido': permissao.aprovar_pedido,
                'emitir_nota': permissao.emitir_nota,
                'ajustar_estoque': permissao.ajustar_estoque,
                'ver_relatorios': permissao.ver_relatorios,
                'editar_clientes': permissao.editar_clientes,
                'editar_produtos': permissao.editar_produtos,
                'excluir_registros': permissao.excluir_registros,
                'ver_log_comportamental': permissao.ver_log_comportamental,
            }
        })

    if request.method == 'POST':
        campos = [
            'ver_custos', 'ver_financeiro', 'ver_dre', 'ver_comissoes_outros',
            'aprovar_pedido', 'emitir_nota', 'ajustar_estoque', 'ver_relatorios',
            'editar_clientes', 'editar_produtos', 'excluir_registros', 'ver_log_comportamental',
        ]
        for campo in campos:
            if campo in request.data:
                setattr(permissao, campo, bool(request.data[campo]))
        permissao.save()

        return Response({'mensagem': 'Permissões atualizadas com sucesso.'})
    
@api_view(['GET'])
def api_sugerir_tributacao(request, produto_id):
    """
    Sugere CFOP e tributação para um produto baseado no regime da empresa
    e na UF de destino.
    Parâmetros: ?uf_destino=SP
    """
    from .models import Produto
    empresa_id = _get_empresa_id(request)
    uf_destino = request.query_params.get('uf_destino', '')
 
    if not uf_destino:
        return Response({'erro': 'Informe a UF de destino (?uf_destino=SP)'}, status=400)
 
    try:
        produto = Produto.objects.get(id=produto_id, empresa_id=empresa_id)
    except Produto.DoesNotExist:
        return Response({'erro': 'Produto não encontrado.'}, status=404)
 
    sugestao = sugerir_tributacao(empresa_id, uf_destino, produto)
    return Response(sugestao)
 
 
@api_view(['POST'])
def api_emitir_nfe(request, pedido_id):
    """
    Emite NF-e via Focus NFe para um pedido aprovado.
    Acessível por diretor, gerente e quem tiver permissão de emitir nota.
    """
    from .models import PermissaoGranular
    nivel = getattr(request.user, 'nivel', None)
    empresa_id = _get_empresa_id(request)
 
    # Verifica permissão
    # Administrativo tem permissão base para emitir NF-e
    tem_permissao = nivel in ['diretor', 'gerente', 'administrativo']
    if not tem_permissao:
        try:
            perm = PermissaoGranular.objects.get(usuario=request.user)
            tem_permissao = perm.emitir_nota
        except PermissaoGranular.DoesNotExist:
            pass

    if not tem_permissao:
        return Response({'erro': 'Sem permissão para emitir NF-e.'}, status=403)
 
    ok, resultado = emitir_nfe_focusnfe(empresa_id, pedido_id)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)
 
 
@api_view(['GET'])
def api_status_nfe(request, referencia):
    """
    Consulta status de uma NF-e no Focus NFe.
    Parâmetro: referencia (ex: pedido_123)
    """
    empresa_id = _get_empresa_id(request)
    ok, resultado = consultar_status_nfe(empresa_id, referencia)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)
 
 
@api_view(['GET'])
def api_portal_contador(request):
    """
    Lista NFs do mês para o contador.
    Parâmetros: ?mes=3&ano=2026
    Acessível por diretor e gerente.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
 
    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
    empresa_id = _get_empresa_id(request)
 
    ok, resultado = gerar_zip_contador(empresa_id, mes, ano)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)
 
 
@api_view(['GET', 'POST'])
def api_configuracao_fiscal(request):
    """
    GET — retorna configuração fiscal da empresa.
    POST — atualiza configuração fiscal.
    Acessível apenas por diretor.
    """
    from .models import ConfiguracaoFiscal, Empresa
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado. Apenas diretores.'}, status=403)
 
    empresa_id = _get_empresa_id(request)
 
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)
 
    config, _ = ConfiguracaoFiscal.objects.get_or_create(empresa=empresa)
 
    if request.method == 'GET':
        return Response({
            'regime_tributario': config.regime_tributario,
            'regime_display': config.get_regime_tributario_display(),
            'cnpj': config.cnpj,
            'inscricao_estadual': config.inscricao_estadual,
            'uf': config.uf,
            'crt': config.crt,
            'aliquota_icms_interno': round(config.aliquota_icms_interno, 2),
            'aliquota_icms_interestadual': round(config.aliquota_icms_interestadual, 2),
            'sugestao_fiscal_automatica': config.sugestao_fiscal_automatica,
            'focusnfe_configurado': bool(config.focusnfe_token),
            'focusnfe_homologacao': config.focusnfe_homologacao,
        })
 
    if request.method == 'POST':
        campos = [
            'regime_tributario', 'cnpj', 'inscricao_estadual', 'uf', 'crt',
            'aliquota_icms_interno', 'aliquota_icms_interestadual',
            'sugestao_fiscal_automatica',
            'focusnfe_token', 'focusnfe_homologacao',
        ]
        for campo in campos:
            if campo in request.data:
                setattr(config, campo, request.data[campo])
 
        # Atualiza o CRT automaticamente conforme o regime
        if 'regime_tributario' in request.data:
            regime = request.data['regime_tributario']
            config.crt = '1' if regime == 'simples' else '3'
 
        config.save()
        return Response({'mensagem': 'Configuração fiscal atualizada com sucesso.'})
 
 
@api_view(['POST'])
def api_popular_dados_fiscais(request):
    """
    Popula banco com CFOPs e matriz tributária padrão.
    Executar apenas uma vez após configurar o sistema.
    Acessível apenas por diretor.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado.'}, status=403)
 
    popular_dados_fiscais()
    return Response({'mensagem': 'Dados fiscais populados com sucesso!'})

@api_view(['GET'])
def api_whitelabel(request):
    """
    Retorna configuração white-label da empresa.
    Chamada pelo frontend ao iniciar para aplicar tema e cores.
    Acessível por todos os níveis.
    """
    empresa_id = _get_empresa_id(request)
    config = obter_configuracao_whitelabel(empresa_id)
    return Response(config)
 
 
@api_view(['POST'])
def api_upload_logo(request):
    """
    Faz upload da logo da empresa para o S3.
    Extrai cores automaticamente e sugere paleta.
    Disponível apenas para indústrias — diretor.
    """
    from .models import Empresa
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado. Apenas diretores.'}, status=403)
 
    empresa_id = _get_empresa_id(request)
 
    try:
        empresa = Empresa.objects.get(id=empresa_id)
        if empresa.tipo_negocio != 'industria':
            return Response({'erro': 'White-label disponível apenas para indústrias.'}, status=403)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)
 
    arquivo = request.FILES.get('logo')
    if not arquivo:
        return Response({'erro': 'Nenhum arquivo enviado.'}, status=400)
 
    # Valida tipo do arquivo
    tipos_permitidos = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if arquivo.content_type not in tipos_permitidos:
        return Response({'erro': 'Formato inválido. Use PNG, JPG ou SVG.'}, status=400)
 
    ok, resultado = upload_logo_s3(empresa_id, arquivo)
    if not ok:
        return Response({'erro': resultado}, status=400)
 
    return Response({
        'mensagem': 'Logo enviada com sucesso!',
        'logo_url': resultado['url'],
        'cores_sugeridas': resultado['cores_sugeridas'],
    })
 
 
@api_view(['POST'])
def api_configurar_whitelabel(request):
    """
    Atualiza as configurações white-label da empresa.
    Permite ajustar cores, tema, nome e rodapé.
    Disponível apenas para indústrias — diretor.
    """
    from .models import ConfiguracaoWhiteLabel, Empresa
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado. Apenas diretores.'}, status=403)
 
    empresa_id = _get_empresa_id(request)
 
    try:
        empresa = Empresa.objects.get(id=empresa_id)
        if empresa.tipo_negocio != 'industria':
            return Response({'erro': 'White-label disponível apenas para indústrias.'}, status=403)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)
 
    config, _ = ConfiguracaoWhiteLabel.objects.get_or_create(empresa=empresa)
 
    campos = [
        'nome_sistema', 'tema', 'cor_primaria', 'cor_secundaria',
        'cor_texto', 'cor_fundo', 'rodape_personalizado', 'dominio_personalizado',
    ]
    for campo in campos:
        if campo in request.data:
            setattr(config, campo, request.data[campo])
 
    config.save()
    return Response({
        'mensagem': 'Configuração white-label atualizada.',
        'configuracao': obter_configuracao_whitelabel(empresa_id),
    })

# FUNCIONALIDADE INCOMPLETA 1:
# ENTRADAS E SAÍDAS DETALHADO
# -------------------------------------------
 
@api_view(['GET'])
def api_entradas_saidas_detalhado(request):
    """
    Extrato detalhado de movimentações de estoque.
    Parâmetros: ?data_inicio=&data_fim=&produto_id=&tipo=entrada|saida|ajuste
                &atalho=hoje|semana|mes|mes_anterior|ano
                &exportar=pdf|excel
    Acessível por diretor, gerente e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    f = get_filtros_base(request)
    tipo = request.query_params.get('tipo')
    exportar = request.query_params.get('exportar')

    dados = relatorio_entradas_saidas_detalhado(
        empresa_id=empresa_id,
        data_inicio=f['data_inicio'],
        data_fim=f['data_fim'],
        produto_id=f['produto_id'],
        tipo=tipo,
    )

    if exportar in ('pdf', 'excel'):
        movs = dados if isinstance(dados, list) else dados.get('movimentacoes', [])
        colunas = ['Data', 'Produto', 'Tipo', 'Quantidade', 'Saldo Após', 'Origem', 'Operador']
        linhas = [
            [
                m.get('data', ''),
                m.get('produto', ''),
                m.get('tipo', ''),
                str(m.get('quantidade', '')),
                str(m.get('saldo_apos_movimento', '')),
                m.get('origem', ''),
                m.get('operador', ''),
            ]
            for m in movs
        ]
        if exportar == 'pdf':
            return exportar_pdf('Entradas e Saídas de Estoque', colunas, linhas, filename='estoque_movimentacoes.pdf')
        return exportar_excel('Movimentações', colunas, linhas, filename='estoque_movimentacoes.xlsx')

    return Response(dados)

# -------------------------------------------
# FUNCIONALIDADE INCOMPLETA 2:
# LANÇAR ESTOQUE INICIAL
# -------------------------------------------
 
@api_view(['GET'])
def api_verificar_estoque_inicial(request):
    """
    Verifica se o estoque inicial já foi lançado.
    Usado para exibir/ocultar o botão no frontend.
    """
    empresa_id = _get_empresa_id(request)
    return Response(verificar_estoque_inicial(empresa_id))
 
 
@api_view(['POST'])
def api_lancar_estoque_inicial(request):
    """
    Lança o estoque inicial da empresa.
    Deve ser executado UMA VEZ no onboarding.
    Acessível por diretor.
 
    Body: {
        "itens": [
            {
                "produto_id": 1,
                "quantidade": 100,
                "custo_unitario": 25.00,
                "numero_lote": "LOTE001",
                "data_validade": "2026-12-31"
            }
        ]
    }
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado. Apenas diretores.'}, status=403)
 
    empresa_id = _get_empresa_id(request)
    itens = request.data.get('itens', [])
 
    if not itens:
        return Response({'erro': 'Informe os itens do estoque inicial.'}, status=400)
 
    ok, resultado = lancar_estoque_inicial(empresa_id, request.user, itens)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)
 
 
# -------------------------------------------
# FUNCIONALIDADE INCOMPLETA 3:
# LANÇAMENTO FINANCEIRO AVULSO
# -------------------------------------------
 
@api_view(['GET', 'POST'])
def api_lancamentos_financeiros(request):
    """
    GET — lista lançamentos financeiros avulsos.
    POST — cria novo lançamento avulso.
    Parâmetros GET: ?mes=3&ano=2026&tipo=despesa
    Acessível por diretor e gerente.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
 
    empresa_id = _get_empresa_id(request)
 
    if request.method == 'GET':
        mes = request.query_params.get('mes')
        ano = request.query_params.get('ano')
        tipo = request.query_params.get('tipo')
        return Response(listar_lancamentos_avulsos(
            empresa_id=empresa_id,
            mes=int(mes) if mes else None,
            ano=int(ano) if ano else None,
            tipo=tipo,
        ))
 
    if request.method == 'POST':
        ok, resultado = criar_lancamento_avulso(empresa_id, request.user, request.data)
        if not ok:
            return Response({'erro': resultado}, status=400)
        return Response(resultado)
 
 
# -------------------------------------------
# FUNCIONALIDADE INCOMPLETA 5:
# CONTAS EM ABERTO POR CLIENTE
# -------------------------------------------
 
@api_view(['GET'])
def api_contas_aberto_clientes(request):
    """
    Contas em aberto consolidadas por cliente.
    Parâmetros: ?cliente_id=X&data_inicio=&data_fim=
                &atalho=hoje|semana|mes|mes_anterior|ano
                &exportar=pdf|excel
    Acessível por diretor, gerente e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    f = get_filtros_base(request)
    exportar = request.query_params.get('exportar')

    dados = contas_aberto_por_cliente(
        empresa_id=empresa_id,
        cliente_id=f['cliente_id'],
    )

    if exportar in ('pdf', 'excel'):
        clientes = dados if isinstance(dados, list) else dados.get('clientes', [])
        colunas = ['Cliente', 'Total Aberto', 'Vencido', 'A Vencer', 'Qtd. Parcelas']
        linhas = [
            [
                c.get('cliente', ''),
                f"R$ {c.get('total_aberto', 0):.2f}",
                f"R$ {c.get('total_vencido', 0):.2f}",
                f"R$ {c.get('total_a_vencer', 0):.2f}",
                str(c.get('quantidade_parcelas', '')),
            ]
            for c in clientes
        ]
        if exportar == 'pdf':
            return exportar_pdf('Contas em Aberto por Cliente', colunas, linhas, filename='contas_aberto.pdf')
        return exportar_excel('Contas em Aberto', colunas, linhas, filename='contas_aberto.xlsx')

    return Response(dados)

@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    """
    Login com username e password.
    Retorna access token, refresh token e dados do usuário.
    Não requer autenticação.
    """
    from rest_framework.permissions import AllowAny
    from django.contrib.auth import authenticate
    from rest_framework_simplejwt.tokens import RefreshToken
    from .models import Usuario
 
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()
 
    if not username or not password:
        return Response({'erro': 'Informe usuário e senha.'}, status=400)
 
    user = authenticate(request, username=username, password=password)
 
    if not user:
        return Response({'erro': 'Usuário ou senha incorretos.'}, status=401)
 
    if not user.is_active:
        return Response({'erro': 'Usuário inativo. Contate o administrador.'}, status=403)

    # Superhost (is_staff sem empresa) bypassa a exigência de empresa
    is_superhost = user.is_staff and not user.empresa

    if not is_superhost and not user.empresa:
        return Response({'erro': 'Usuário sem empresa vinculada. Contate o administrador.'}, status=403)

    # Gera tokens JWT
    refresh = RefreshToken.for_user(user)

    usuario_data = {
        'id': user.id,
        'username': user.username,
        'nome': user.get_full_name() or user.username,
        'email': user.email,
        'is_superhost': is_superhost,
    }

    if is_superhost:
        usuario_data.update({
            'nivel': 'superhost',
            'nivel_display': 'SuperHost',
            'empresa_id': None,
            'empresa_nome': None,
            'tipo_negocio': None,
            'meta_mensal': 0,
            've_apenas_seus_clientes': False,
        })
    else:
        usuario_data.update({
            'nivel': user.nivel,
            'nivel_display': user.get_nivel_display(),
            'empresa_id': user.empresa.id,
            'empresa_nome': user.empresa.nome,
            'tipo_negocio': user.empresa.tipo_negocio,
            'meta_mensal': round(user.meta_mensal, 2),
            've_apenas_seus_clientes': user.ve_apenas_seus_clientes,
        })

    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'usuario': usuario_data,
    })
 
 
@api_view(['POST'])
def api_logout(request):
    """
    Invalida o refresh token do usuário.
    """
    from rest_framework_simplejwt.tokens import RefreshToken
    from rest_framework_simplejwt.exceptions import TokenError
 
    refresh_token = request.data.get('refresh')
    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass  # Token já expirado ou inválido — tudo bem
 
    return Response({'mensagem': 'Logout realizado com sucesso.'})
 
 
@api_view(['GET'])
def api_me(request):
    """
    Retorna os dados do usuário autenticado.
    Útil para o frontend validar o token ao iniciar.
    """
    user = request.user
 
    if not user.is_authenticated:
        return Response({'erro': 'Não autenticado.'}, status=401)
 
    return Response({
        'id': user.id,
        'username': user.username,
        'nome': user.get_full_name() or user.username,
        'email': user.email,
        'nivel': user.nivel,
        'nivel_display': user.get_nivel_display(),
        'empresa_id': user.empresa.id if user.empresa else None,
        'empresa_nome': user.empresa.nome if user.empresa else None,
        'tipo_negocio': user.empresa.tipo_negocio if user.empresa else None,
        'meta_mensal': round(user.meta_mensal, 2),
        've_apenas_seus_clientes': user.ve_apenas_seus_clientes,
    })
 
 
@api_view(['GET'])
def api_dossie_vendedor(request, vendedor_id):
    """
    Dossiê completo do vendedor.
    Acessível por diretor, gerente, ou pelo próprio vendedor.
    """
    from .bi_dashboard import dossie_vendedor
    nivel = getattr(request.user, 'nivel', None)
    empresa_id = _get_empresa_id(request)
 
    # Vendedor só acessa o próprio dossiê
    if nivel == 'vendedor' and request.user.id != vendedor_id:
        return Response({'erro': 'Acesso negado.'}, status=403)
 
    if nivel not in ['diretor', 'gerente', 'vendedor']:
        return Response({'erro': 'Acesso negado.'}, status=403)
 
    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
 
    return Response(dossie_vendedor(empresa_id, vendedor_id, mes, ano))
 

# ==========================================
# MANIFESTAÇÃO DE NF-e
# ==========================================

@api_view(['GET'])
def api_manifestacao_pendentes(request):
    """
    Consulta NF-es destinadas ao CNPJ da empresa que estão
    pendentes de manifestação (via Focus NFe / SEFAZ).
    Acessível por diretor, gerente e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    return Response(consultar_nfes_pendentes(empresa_id))


@api_view(['POST'])
def api_manifestar_nfe(request):
    """
    Registra uma manifestação do destinatário para uma NF-e.

    Body:
    {
        "chave_acesso":       "44 dígitos",
        "tipo_manifestacao":  "ciencia|confirmacao|desconhecimento|nao_realizada",
        "justificativa":      "texto (obrigatório apenas para nao_realizada)"
    }
    Acessível por diretor, gerente e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    chave      = request.data.get('chave_acesso', '').strip()
    tipo       = request.data.get('tipo_manifestacao', '').strip()
    just       = request.data.get('justificativa', '').strip()

    if not chave or len(chave) != 44:
        return Response({'erro': 'Informe a chave de acesso com 44 dígitos.'}, status=400)
    if not tipo:
        return Response({'erro': 'Informe o tipo_manifestacao.'}, status=400)

    ok, msg = manifestar_nfe(empresa_id, request.user, chave, tipo, just)
    if ok:
        return Response({'mensagem': msg})
    return Response({'erro': msg}, status=400)


@api_view(['POST'])
def api_cancelar_nfe(request, referencia):
    """
    Cancela uma NF-e já autorizada.
    Body: { "justificativa": "texto mínimo 15 chars" }
    Acessível por diretor e gerente.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    just = request.data.get('justificativa', '').strip()

    ok, msg = cancelar_nfe(empresa_id, request.user, referencia, just)
    if ok:
        return Response({'mensagem': msg})
    return Response({'erro': msg}, status=400)


@api_view(['POST'])
def api_carta_correcao_nfe(request, referencia):
    """
    Envia Carta de Correção Eletrônica para uma NF-e.
    Body: { "correcao": "texto mínimo 15 chars" }
    Acessível por diretor e gerente.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    correcao = request.data.get('correcao', '').strip()

    ok, resultado = carta_correcao_nfe(empresa_id, request.user, referencia, correcao)
    if ok:
        return Response(resultado)
    return Response({'erro': resultado}, status=400)


# ==========================================
# PDV — PONTO DE VENDA / FRENTE DE CAIXA
# ==========================================

@api_view(['POST'])
def api_pdv_vender(request):
    """
    Realiza uma venda no PDV (frente de caixa).

    Body:
    {
        "itens": [
            {
                "produto_id": 1,
                "quantidade": 2,
                "preco_unitario": 49.90,
                "desconto_percentual": 0
            }
        ],
        "forma_pagamento_id": 1,
        "valor_recebido": 100.00,
        "cpf_cliente": "000.000.000-00",
        "nome_cliente": "João Silva",
        "emitir_nfce": true
    }

    Acessível por administrativo, gerente e diretor.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    from .models import Empresa
    empresa_id = _get_empresa_id(request)
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)

    ok, resultado = criar_venda_pdv(
        empresa=empresa,
        operador=request.user,
        itens_data=request.data.get('itens', []),
        forma_pagamento_id=request.data.get('forma_pagamento_id'),
        valor_recebido=request.data.get('valor_recebido'),
        cpf_cliente=request.data.get('cpf_cliente', ''),
        nome_cliente=request.data.get('nome_cliente', ''),
        emitir_nfce=request.data.get('emitir_nfce', True),
    )

    if ok:
        return Response(resultado, status=201)
    return Response({'erro': resultado}, status=400)


@api_view(['GET'])
def api_pdv_vendas(request):
    """
    Lista vendas PDV da empresa com filtros.
    Parâmetros: ?data_inicio=&data_fim=&atalho=&status=&exportar=pdf|excel
    Acessível por administrativo, gerente e diretor.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    from .models import PedidoVendaPDV
    empresa_id = _get_empresa_id(request)
    f = get_filtros_base(request)
    exportar = request.query_params.get('exportar')

    qs = PedidoVendaPDV.objects.filter(empresa_id=empresa_id).select_related(
        'operador', 'forma_pagamento', 'caixa'
    )
    busca_cliente = request.query_params.get('cliente', '').strip()
    if busca_cliente:
        qs = qs.filter(
            Q(nome_cliente__icontains=busca_cliente) |
            Q(cpf_cnpj_cliente__icontains=busca_cliente)
    )
    if f['data_inicio']:
        qs = qs.filter(data_venda__date__gte=f['data_inicio'])
    if f['data_fim']:
        qs = qs.filter(data_venda__date__lte=f['data_fim'])
    if f['status']:
        qs = qs.filter(status=f['status'])
    if nivel == 'administrativo':
        qs = qs.filter(operador=request.user)

    dados = [
        {
            'id':             v.id,
            'data':           v.data_venda.strftime('%d/%m/%Y %H:%M'),
            'operador':       v.operador.get_full_name() or v.operador.username,
            'forma_pagamento': v.forma_pagamento.nome,
            'valor_total':    float(v.valor_total),
            'troco':          float(v.troco),
            'cpf_cliente':    v.cpf_cliente,
            'status':         v.get_status_display(),
            'nfce_chave':     v.nfce_chave,
            'nfce_status':    v.nfce_status,
        }
        for v in qs.order_by('-data_venda')
    ]

    if exportar in ('pdf', 'excel'):
        colunas = ['Nº', 'Data', 'Operador', 'Pagamento', 'Total R$', 'Troco', 'CPF', 'Status', 'NFC-e']
        linhas = [
            [
                str(d['id']), d['data'], d['operador'], d['forma_pagamento'],
                f"R$ {d['valor_total']:.2f}", f"R$ {d['troco']:.2f}",
                d['cpf_cliente'], d['status'], d['nfce_chave'],
            ]
            for d in dados
        ]
        if exportar == 'pdf':
            return exportar_pdf('Vendas PDV', colunas, linhas, filename='vendas_pdv.pdf')
        return exportar_excel('Vendas PDV', colunas, linhas, filename='vendas_pdv.xlsx')

    return Response({'total': len(dados), 'vendas': dados})


@api_view(['POST'])
def api_pdv_cancelar(request, venda_id):
    """
    Cancela uma venda PDV.
    Body: { "motivo": "texto mínimo 10 chars" }
    Acessível por gerente e diretor.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado. Apenas gerente ou diretor.'}, status=403)

    from .models import Empresa
    empresa_id = _get_empresa_id(request)
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)

    motivo = request.data.get('motivo', '').strip()
    ok, msg = cancelar_venda_pdv(empresa, request.user, venda_id, motivo)
    if ok:
        return Response({'mensagem': msg})
    return Response({'erro': msg}, status=400)


# ==========================================
# FASE 5 — ORÇAMENTOS, COMPRAS AVANÇADAS,
# AVALIAÇÃO DE FORNECEDORES, INVENTÁRIO
# ==========================================

from .compras_orcamentos import (
    criar_orcamento, converter_orcamento_em_pedido, listar_orcamentos,
    criar_solicitacao_compra, decidir_solicitacao, listar_solicitacoes,
    criar_cotacao, registrar_resposta_fornecedor, selecionar_vencedores,
    encerrar_cotacao, comparativo_cotacao,
    avaliar_fornecedor, resumo_fornecedor,
    iniciar_inventario, registrar_contagem, concluir_inventario, detalhe_inventario,
)


# ── ORÇAMENTOS ────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_orcamentos(request):
    """
    GET  — lista orçamentos com filtros
           Parâmetros: ?status=&cliente_id=&vendedor_id=&data_inicio=&data_fim=
                       &atalho=&exportar=pdf|excel
    POST — cria novo orçamento
           Body: {cliente_id, itens:[{produto_id,quantidade,preco_unitario,desconto_percentual}],
                  data_validade, observacoes}
    Acessível por diretor, gerente, vendedor e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        f = get_filtros_base(request)
        exportar = request.query_params.get('exportar')

        # Vendedor só vê seus próprios orçamentos
        if nivel == 'vendedor':
            f['vendedor_id'] = request.user.id

        dados = listar_orcamentos(empresa_id, f)

        if exportar in ('pdf', 'excel'):
            colunas = ['Nº', 'Cliente', 'Vendedor', 'Status', 'Total R$', 'Criado em', 'Válido até']
            linhas = [
                [str(d['id']), d['cliente'], d['vendedor'], d['status'],
                 f"R$ {d['valor_total']:.2f}", d['data_criacao'], d['data_validade'] or '—']
                for d in dados
            ]
            if exportar == 'pdf':
                return exportar_pdf('Orçamentos', colunas, linhas, filename='orcamentos.pdf')
            return exportar_excel('Orçamentos', colunas, linhas, filename='orcamentos.xlsx')

        return Response({'total': len(dados), 'orcamentos': dados})

    # POST
    from .models import Cliente, Empresa, CondicaoPagamento, FormaPagamento
    data = request.data
    try:
        empresa = Empresa.objects.get(id=empresa_id)
        cliente = Cliente.objects.get(id=data['cliente_id'], empresa=empresa)
    except Exception as e:
        return Response({'erro': str(e)}, status=400)

    try:
        ok, resultado = criar_orcamento(
            empresa=empresa,
            vendedor=request.user,
            cliente=cliente,
            itens_data=data.get('itens', []),
            data_validade=data.get('data_validade'),
            observacoes=data.get('observacoes', ''),
        )
    except ValueError as e:
        return Response({'erro': str(e)}, status=400)

    if ok:
        return Response({'mensagem': 'Orçamento criado.', 'id': resultado.id}, status=201)
    return Response({'erro': resultado}, status=400)


@api_view(['POST'])
def api_converter_orcamento(request, orcamento_id):
    """
    Converte orçamento em pedido de venda.
    Body: {condicao_pagamento_id, forma_pagamento_id}
    Acessível por vendedor (seu próprio), gerente e diretor.
    """
    from .models import Orcamento, CondicaoPagamento, FormaPagamento
    nivel = getattr(request.user, 'nivel', None)
    empresa_id = _get_empresa_id(request)

    try:
        orc = Orcamento.objects.get(id=orcamento_id, empresa_id=empresa_id)
    except Orcamento.DoesNotExist:
        return Response({'erro': 'Orçamento não encontrado.'}, status=404)

    if nivel == 'vendedor' and orc.vendedor != request.user:
        return Response({'erro': 'Acesso negado.'}, status=403)

    cond_id = request.data.get('condicao_pagamento_id')
    forma_id = request.data.get('forma_pagamento_id')
    cond = CondicaoPagamento.objects.filter(id=cond_id).first() if cond_id else None
    forma = FormaPagamento.objects.filter(id=forma_id).first() if forma_id else None

    ok, resultado = converter_orcamento_em_pedido(orc, cond, forma)
    if ok:
        return Response({'mensagem': 'Orçamento convertido em pedido.', 'pedido_id': resultado.id})
    return Response({'erro': resultado}, status=400)


# ── SOLICITAÇÕES DE COMPRA ────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_solicitacoes_compra(request):
    """
    GET  — lista solicitações. Parâmetros: ?status=&data_inicio=&data_fim=&exportar=
    POST — cria solicitação. Body: {produto_id, quantidade, justificativa}
    Acessível por todos os níveis autenticados.
    """
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)

    if request.method == 'GET':
        f = get_filtros_base(request)
        exportar = request.query_params.get('exportar')
        dados = listar_solicitacoes(empresa_id, f)

        if exportar in ('pdf', 'excel'):
            colunas = ['Nº', 'Produto', 'Qtd', 'Solicitante', 'Status', 'Data', 'Obs. Aprovador']
            linhas = [
                [str(d['id']), d['produto'], str(d['quantidade']), d['solicitante'],
                 d['status'], d['data'], d['observacao_aprovador']]
                for d in dados
            ]
            if exportar == 'pdf':
                return exportar_pdf('Solicitações de Compra', colunas, linhas, filename='solicitacoes_compra.pdf')
            return exportar_excel('Solicitações', colunas, linhas, filename='solicitacoes_compra.xlsx')

        return Response({'total': len(dados), 'solicitacoes': dados})

    # POST
    from .models import Empresa
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)

    ok, resultado = criar_solicitacao_compra(
        empresa=empresa,
        solicitante=request.user,
        produto_id=request.data.get('produto_id'),
        quantidade=request.data.get('quantidade', 0),
        justificativa=request.data.get('justificativa', ''),
    )
    if ok:
        return Response({'mensagem': 'Solicitação criada.', 'id': resultado.id}, status=201)
    return Response({'erro': resultado}, status=400)


@api_view(['POST'])
def api_decidir_solicitacao(request, sc_id):
    """
    Aprova ou recusa uma solicitação de compra.
    Body: {aprovada: true|false, observacao: "texto"}
    Acessível por gerente e diretor.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    from .models import SolicitacaoCompra
    empresa_id = _get_empresa_id(request)
    try:
        sc = SolicitacaoCompra.objects.get(id=sc_id, empresa_id=empresa_id)
    except SolicitacaoCompra.DoesNotExist:
        return Response({'erro': 'Solicitação não encontrada.'}, status=404)

    aprovada = request.data.get('aprovada', False)
    observacao = request.data.get('observacao', '')
    ok, msg = decidir_solicitacao(sc, request.user, aprovada, observacao)
    if ok:
        return Response({'mensagem': msg})
    return Response({'erro': msg}, status=400)


# ── COTAÇÕES ──────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_cotacoes(request):
    """
    GET  — lista cotações
    POST — cria cotação. Body: {titulo, itens:[{produto_id,quantidade}], data_encerramento, observacoes}
    Acessível por diretor, gerente e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        from .models import CotacaoCompra
        qs = CotacaoCompra.objects.filter(empresa_id=empresa_id).select_related('responsavel')
        f = get_filtros_base(request)
        if f['status']:
            qs = qs.filter(status=f['status'])
        dados = [
            {
                'id': c.id, 'titulo': c.titulo, 'status': c.get_status_display(),
                'status_code': c.status,
                'responsavel': c.responsavel.get_full_name() or c.responsavel.username,
                'data_criacao': c.data_criacao.strftime('%d/%m/%Y'),
                'data_encerramento': str(c.data_encerramento) if c.data_encerramento else None,
                'total_itens': c.itens.count(),
                'total_fornecedores': c.respostas.values('fornecedor').distinct().count(),
            }
            for c in qs.order_by('-data_criacao')
        ]
        return Response({'total': len(dados), 'cotacoes': dados})

    # POST
    from .models import Empresa
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)

    try:
        ok, resultado = criar_cotacao(
            empresa=empresa,
            responsavel=request.user,
            titulo=request.data.get('titulo', ''),
            itens_data=request.data.get('itens', []),
            data_encerramento=request.data.get('data_encerramento'),
            observacoes=request.data.get('observacoes', ''),
        )
    except ValueError as e:
        return Response({'erro': str(e)}, status=400)

    if ok:
        return Response({'mensagem': 'Cotação criada.', 'id': resultado.id}, status=201)
    return Response({'erro': resultado}, status=400)


@api_view(['GET'])
def api_comparativo_cotacao(request, cotacao_id):
    """Retorna o comparativo de preços por produto × fornecedor."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    dados = comparativo_cotacao(cotacao_id, empresa_id)
    if dados is None:
        return Response({'erro': 'Cotação não encontrada.'}, status=404)
    return Response(dados)


@api_view(['POST'])
def api_resposta_cotacao(request, cotacao_id):
    """
    Registra as respostas de um fornecedor para a cotação.
    Body: {fornecedor_id, respostas:[{produto_id,preco_unit,prazo_dias,observacao}]}
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import CotacaoCompra
    empresa_id = _get_empresa_id(request)
    try:
        cot = CotacaoCompra.objects.get(id=cotacao_id, empresa_id=empresa_id)
    except CotacaoCompra.DoesNotExist:
        return Response({'erro': 'Cotação não encontrada.'}, status=404)
    ok, msg = registrar_resposta_fornecedor(cot, request.data.get('fornecedor_id'), request.data.get('respostas', []))
    if ok:
        return Response({'mensagem': msg})
    return Response({'erro': msg}, status=400)


@api_view(['POST'])
def api_encerrar_cotacao(request, cotacao_id):
    """Encerra a cotação."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import CotacaoCompra
    empresa_id = _get_empresa_id(request)
    try:
        cot = CotacaoCompra.objects.get(id=cotacao_id, empresa_id=empresa_id)
    except CotacaoCompra.DoesNotExist:
        return Response({'erro': 'Cotação não encontrada.'}, status=404)
    ok, msg = encerrar_cotacao(cot)
    if ok:
        return Response({'mensagem': msg})
    return Response({'erro': msg}, status=400)


# ── AVALIAÇÃO DE FORNECEDORES ─────────────────────────────────────────────────

@api_view(['POST'])
def api_avaliar_fornecedor(request):
    """
    Registra avaliação de fornecedor após recebimento.
    Body: {fornecedor_id, nota_preco, nota_prazo, nota_qualidade, pedido_compra_id, observacao}
    Acessível por diretor, gerente e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import Empresa
    empresa_id = _get_empresa_id(request)
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)
    d = request.data
    ok, resultado = avaliar_fornecedor(
        empresa=empresa,
        avaliador=request.user,
        fornecedor_id=d.get('fornecedor_id'),
        nota_preco=int(d.get('nota_preco', 0)),
        nota_prazo=int(d.get('nota_prazo', 0)),
        nota_qualidade=int(d.get('nota_qualidade', 0)),
        pedido_compra_id=d.get('pedido_compra_id'),
        observacao=d.get('observacao', ''),
    )
    if ok:
        return Response({'mensagem': 'Avaliação registrada.', 'id': resultado.id}, status=201)
    return Response({'erro': resultado}, status=400)


@api_view(['GET'])
def api_resumo_fornecedor(request, fornecedor_id):
    """Retorna histórico e médias de avaliação de um fornecedor."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    return Response(resumo_fornecedor(empresa_id, fornecedor_id))


# ── INVENTÁRIO FÍSICO ─────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_inventario(request):
    """
    GET  — lista inventários da empresa
    POST — inicia novo inventário. Body: {observacoes}
    Acessível por diretor (iniciar/concluir) e operacional (contar).
    """
    nivel = getattr(request.user, 'nivel', None)
    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        from .models import InventarioFisico
        qs = InventarioFisico.objects.filter(empresa_id=empresa_id).select_related('responsavel')
        dados = [
            {
                'id': i.id,
                'status': i.get_status_display(),
                'status_code': i.status,
                'responsavel': i.responsavel.get_full_name() or i.responsavel.username,
                'data_inicio': i.data_inicio.strftime('%d/%m/%Y %H:%M'),
                'data_conclusao': i.data_conclusao.strftime('%d/%m/%Y %H:%M') if i.data_conclusao else None,
                'total_itens': i.itens.count(),
                'itens_contados': i.itens.filter(quantidade_contada__isnull=False).count(),
            }
            for i in qs.order_by('-data_inicio')
        ]
        return Response({'inventarios': dados})

    # POST — apenas diretor e gerente
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Apenas diretor ou gerente pode iniciar inventário.'}, status=403)

    from .models import Empresa
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)

    ok, resultado = iniciar_inventario(empresa, request.user, request.data.get('observacoes', ''))
    if ok:
        return Response({'mensagem': 'Inventário iniciado.', 'id': resultado.id}, status=201)
    return Response({'erro': resultado}, status=400)


@api_view(['GET'])
def api_inventario_detalhe(request, inv_id):
    """Retorna itens do inventário com diferenças."""
    empresa_id = _get_empresa_id(request)
    dados = detalhe_inventario(inv_id, empresa_id)
    if dados is None:
        return Response({'erro': 'Inventário não encontrado.'}, status=404)
    return Response(dados)


@api_view(['POST'])
def api_inventario_contar(request, inv_id):
    """
    Registra contagens físicas.
    Body: {contagens: [{produto_id, quantidade_contada}]}
    Acessível por qualquer nível (operacional também conta).
    """
    empresa_id = _get_empresa_id(request)
    contagens = request.data.get('contagens', [])
    ok, msg = registrar_contagem(inv_id, empresa_id, contagens)
    if ok:
        return Response({'mensagem': msg})
    return Response({'erro': msg}, status=400)


@api_view(['POST'])
def api_inventario_concluir(request, inv_id):
    """
    Conclui o inventário e aplica todos os ajustes.
    Acessível por diretor e gerente.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Apenas diretor ou gerente pode concluir o inventário.'}, status=403)
    empresa_id = _get_empresa_id(request)
    ok, msg = concluir_inventario(inv_id, empresa_id, request.user)
    if ok:
        return Response({'mensagem': msg})
    return Response({'erro': msg}, status=400)


# ══════════════════════════════════════════════════════════════════════════════
# FASE 6 — FINANCEIRO AVANÇADO
# ══════════════════════════════════════════════════════════════════════════════

from .financeiro_avancado import (
    listar_centros_custo, dre_por_centro_custo,
    gerar_lancamentos_recorrentes,
    fluxo_caixa,
    importar_ofx, conciliar_manualmente,
    gerar_boleto,
    painel_superhost, consolidado_matriz,
)


@api_view(['GET', 'POST'])
def api_centros_custo(request):
    """GET — lista | POST — cria. Acessível por diretor e gerente."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        return Response(listar_centros_custo(empresa_id))

    from .models import CentroCusto, Empresa
    empresa = Empresa.objects.get(id=empresa_id)
    nome = request.data.get('nome', '').strip()
    if not nome:
        return Response({'erro': 'Informe o nome.'}, status=400)
    cc, criado = CentroCusto.objects.get_or_create(
        empresa=empresa, nome=nome,
        defaults={'descricao': request.data.get('descricao', '')}
    )
    return Response({'id': cc.id, 'nome': cc.nome, 'criado': criado}, status=201 if criado else 200)


@api_view(['GET'])
def api_dre_centro_custo(request):
    """DRE por centro de custo. ?mes=3&ano=2026"""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    hoje = timezone.now()
    mes  = int(request.query_params.get('mes', hoje.month))
    ano  = int(request.query_params.get('ano', hoje.year))
    return Response(dre_por_centro_custo(_get_empresa_id(request), mes, ano))


@api_view(['GET'])
def api_fluxo_caixa(request):
    """
    Fluxo de caixa projeção vs realizado.
    ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD&atalho=mes
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    f = get_filtros_base(request)
    hoje = date.today()
    data_ini = f['data_inicio'] or hoje.replace(day=1)
    data_fim = f['data_fim'] or hoje
    from datetime import date as _date
    return Response(fluxo_caixa(_get_empresa_id(request), data_ini, data_fim))


@api_view(['GET', 'POST'])
def api_lancamentos_recorrentes(request):
    """GET — lista | POST — cria recorrência."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        from .models import LancamentoRecorrente
        qs = LancamentoRecorrente.objects.filter(empresa_id=empresa_id, ativo=True)
        dados = [
            {
                'id': r.id, 'tipo': r.tipo, 'descricao': r.descricao,
                'valor': float(r.valor), 'dia_vencimento': r.dia_vencimento,
                'data_inicio': str(r.data_inicio),
                'data_fim': str(r.data_fim) if r.data_fim else None,
            }
            for r in qs
        ]
        return Response(dados)

    from .models import LancamentoRecorrente, Empresa
    empresa = Empresa.objects.get(id=empresa_id)
    d = request.data
    rec = LancamentoRecorrente.objects.create(
        empresa=empresa,
        tipo=d.get('tipo', 'despesa'),
        descricao=d.get('descricao', ''),
        valor=Decimal(str(d.get('valor', 0))),
        dia_vencimento=int(d.get('dia_vencimento', 1)),
        data_inicio=d.get('data_inicio', date.today()),
        data_fim=d.get('data_fim'),
        responsavel=request.user,
        ativo=True,
    )
    return Response({'id': rec.id, 'mensagem': 'Lançamento recorrente criado.'}, status=201)


@api_view(['POST'])
def api_gerar_recorrentes_mes(request):
    """Gera ContaPagar/ContaReceber dos recorrentes para um mês. ?mes=&ano="""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
    total = gerar_lancamentos_recorrentes(_get_empresa_id(request), mes, ano)
    return Response({'gerados': total, 'mensagem': f'{total} lançamento(s) gerado(s) para {mes:02d}/{ano}.'})


@api_view(['POST'])
def api_importar_ofx(request):
    """
    Importa extrato bancário OFX. Enviar arquivo no campo 'arquivo'.
    Acessível por diretor, gerente e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    arquivo = request.FILES.get('arquivo')
    if not arquivo:
        return Response({'erro': 'Envie o arquivo OFX no campo "arquivo".'}, status=400)
    from .models import Empresa
    empresa = Empresa.objects.get(id=_get_empresa_id(request))
    ok, resultado = importar_ofx(empresa, request.user, arquivo.read(), arquivo.name)
    if ok:
        return Response(resultado, status=201)
    return Response({'erro': resultado}, status=400)


@api_view(['POST'])
def api_conciliar_transacao(request, transacao_id):
    """Vincula manualmente uma transação. Body: {conta_pagar_id} ou {conta_receber_id}."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    ok, msg = conciliar_manualmente(
        transacao_id, _get_empresa_id(request),
        request.data.get('conta_pagar_id'),
        request.data.get('conta_receber_id'),
    )
    if ok:
        return Response({'mensagem': msg})
    return Response({'erro': msg}, status=400)


@api_view(['POST'])
def api_gerar_boleto(request, conta_receber_id):
    """Gera boleto Asaas para uma conta a receber."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    ok, resultado = gerar_boleto(_get_empresa_id(request), conta_receber_id, request.user)
    if ok:
        return Response(resultado)
    return Response({'erro': resultado}, status=400)


# ══════════════════════════════════════════════════════════════════════════════
# FASE 7 — RH
# ══════════════════════════════════════════════════════════════════════════════

from .rh import (
    listar_colaboradores, registrar_ponto, relatorio_ponto,
    agendar_ferias, gerar_folha,
)


@api_view(['GET', 'POST'])
def api_colaboradores(request):
    """
    GET  — lista colaboradores (nunca para vendedor)
    POST — cria colaborador. Body: {nome_completo, cpf, cargo, salario_base, data_admissao, ...}
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel == 'vendedor':
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        so_ativos = request.query_params.get('so_ativos') == '1'
        return Response(listar_colaboradores(empresa_id, so_ativos))

    from .models import Colaborador, Empresa, Usuario
    empresa = Empresa.objects.get(id=empresa_id)
    d = request.data

    usuario = None
    usuario_id = d.get('usuario_id')
    if usuario_id:
        try:
            usuario = Usuario.objects.get(id=usuario_id, empresa=empresa)
        except Usuario.DoesNotExist:
            return Response({'erro': 'Usuário não encontrado nesta empresa.'}, status=400)

    col = Colaborador.objects.create(
        empresa=empresa,
        usuario=usuario,
        nome_completo=d.get('nome_completo', ''),
        cpf=d.get('cpf', ''),
        rg=d.get('rg', ''),
        data_nascimento=d.get('data_nascimento'),
        cargo=d.get('cargo', 'outros'),
        cargo_personalizado=d.get('cargo_personalizado', ''),
        salario_base=Decimal(str(d.get('salario_base', 0))),
        data_admissao=d.get('data_admissao', date.today()),
        email=d.get('email', ''),
        telefone=d.get('telefone', ''),
        endereco=d.get('endereco', ''),
        observacoes=d.get('observacoes', ''),
    )
    return Response({'id': col.id, 'mensagem': 'Colaborador cadastrado.'}, status=201)


@api_view(['GET', 'POST'])
def api_ponto(request):
    """
    GET  — relatório do mês. ?colaborador_id=&mes=&ano=
    POST — registra/atualiza ponto. Body: {colaborador_id, data, entrada, saida, ...}
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel == 'vendedor':
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        col_id = request.query_params.get('colaborador_id')
        hoje = timezone.now()
        mes  = int(request.query_params.get('mes', hoje.month))
        ano  = int(request.query_params.get('ano', hoje.year))
        if not col_id:
            return Response({'erro': 'Informe colaborador_id.'}, status=400)
        dados = relatorio_ponto(int(col_id), empresa_id, mes, ano)
        if dados is None:
            return Response({'erro': 'Colaborador não encontrado.'}, status=404)
        return Response(dados)

    d = request.data
    from datetime import time
    def parse_time(s):
        if not s:
            return None
        try:
            h, m = s.split(':')
            return time(int(h), int(m))
        except Exception:
            return None

    ok, resultado = registrar_ponto(
        colaborador_id=d.get('colaborador_id'),
        empresa_id=empresa_id,
        data_ref=d.get('data', date.today()),
        entrada=parse_time(d.get('entrada')),
        saida_almoco=parse_time(d.get('saida_almoco')),
        retorno_almoco=parse_time(d.get('retorno_almoco')),
        saida=parse_time(d.get('saida')),
        observacao=d.get('observacao', ''),
    )
    if ok:
        return Response({'mensagem': 'Ponto registrado.'}, status=201)
    return Response({'erro': resultado}, status=400)


@api_view(['POST'])
def api_agendar_ferias(request):
    """Agenda férias para um colaborador."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from datetime import datetime
    d = request.data
    def p(s):
        return datetime.strptime(s, '%Y-%m-%d').date() if s else None
    ok, resultado = agendar_ferias(
        colaborador_id=d.get('colaborador_id'),
        empresa_id=_get_empresa_id(request),
        periodo_aq_inicio=p(d.get('periodo_aquisitivo_inicio')),
        periodo_aq_fim=p(d.get('periodo_aquisitivo_fim')),
        data_inicio_gozo=p(d.get('data_inicio_gozo')),
        data_fim_gozo=p(d.get('data_fim_gozo')),
        abono=d.get('abono_pecuniario', False),
        observacoes=d.get('observacoes', ''),
    )
    if ok:
        return Response({'id': resultado.id, 'mensagem': 'Férias agendadas.'}, status=201)
    return Response({'erro': resultado}, status=400)


@api_view(['GET', 'POST'])
def api_folha_pagamento(request):
    """
    GET  — lista folhas. ?mes=&ano=
    POST — gera folha do mês. Body: {mes, ano}
    Apenas diretor e gerente.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        from .models import FolhaPagamento
        qs = FolhaPagamento.objects.filter(empresa_id=empresa_id).order_by('-ano', '-mes')
        dados = [
            {
                'id': f.id, 'mes': f.mes, 'ano': f.ano, 'status': f.get_status_display(),
                'total_bruto': float(f.total_bruto),
                'total_descontos': float(f.total_descontos),
                'total_liquido': float(f.total_liquido),
            }
            for f in qs
        ]
        return Response(dados)

    d = request.data
    ok, resultado = gerar_folha(
        empresa_id=empresa_id,
        mes=int(d.get('mes', timezone.now().month)),
        ano=int(d.get('ano', timezone.now().year)),
        responsavel=request.user,
    )
    if ok:
        return Response({'id': resultado.id, 'mensagem': f'Folha {resultado.mes:02d}/{resultado.ano} gerada.'}, status=201)
    return Response({'erro': resultado}, status=400)


# ══════════════════════════════════════════════════════════════════════════════
# FASE 7 — SUPERHOST E MATRIZ-FILIAL
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
def api_superhost_clientes(request):
    """Painel SuperHost — lista todos os clientes. Só para is_staff."""
    if not request.user.is_staff:
        return Response({'erro': 'Acesso negado.'}, status=403)
    return Response(painel_superhost())


@api_view(['POST'])
def api_superhost_bloquear(request, empresa_id):
    """Bloqueia/desbloqueia acesso de uma empresa. Só para is_staff."""
    if not request.user.is_staff:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import Empresa
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)
    acao = request.data.get('acao', 'bloquear')
    novo_status = 'bloqueada' if acao == 'bloquear' else 'ativa'
    if hasattr(empresa, 'status_assinatura'):
        empresa.status_assinatura = novo_status
        empresa.save(update_fields=['status_assinatura'])
    return Response({'mensagem': f'Empresa {empresa.nome} {novo_status}.'})


@api_view(['POST'])
def api_superhost_alterar_tipo(request, empresa_id):
    """
    Altera o tipo_negocio de uma empresa (revenda ↔ industria).
    Exclusivo para superadmin (is_staff). Nunca exposto ao CEO do cliente.
    """
    if not request.user.is_staff:
        return Response({'erro': 'Apenas o SuperHost pode alterar o tipo de operação.'}, status=403)
    from .models import Empresa
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)
    novo_tipo = request.data.get('tipo_negocio')
    tipos_validos = [t[0] for t in Empresa.TIPO_CHOICES]
    if novo_tipo not in tipos_validos:
        return Response({'erro': f'Tipo inválido. Escolha: {tipos_validos}'}, status=400)
    tipo_anterior = empresa.tipo_negocio
    empresa.tipo_negocio = novo_tipo
    empresa.save(update_fields=['tipo_negocio'])
    return Response({
        'mensagem': f'Tipo alterado de "{tipo_anterior}" para "{novo_tipo}".',
        'empresa': empresa.nome,
        'tipo_negocio': novo_tipo,
    })


@api_view(['GET'])
def api_matriz_consolidado(request):
    """Retorna consolidado da matriz e filiais. Apenas diretor da matriz."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    dados = consolidado_matriz(empresa_id)
    if dados is None:
        return Response({'erro': 'Esta empresa não é uma matriz ou não possui filiais.'}, status=404)
    return Response(dados)


@api_view(['GET'])
def api_matriz_filiais(request):
    """Lista filiais de uma matriz. Apenas diretor."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import Empresa
    empresa_id = _get_empresa_id(request)
    try:
        matriz = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)
    filiais = matriz.filiais.all()
    dados = [{'id': f.id, 'nome': f.nome, 'cnpj': f.cnpj, 'tipo': f.get_tipo_negocio_display()} for f in filiais]
    return Response({'matriz': matriz.nome, 'filiais': dados})


# ══════════════════════════════════════════════════════════════════════════════
# FASE 8 — SPED, EFD-REINF, IMPORTAÇÃO EM LOTE
# ══════════════════════════════════════════════════════════════════════════════

from .importacao_sped import (
    importar_xmls_lote,
    consultar_nfes_sefaz_cnpj,
    gerar_sped_fiscal,
    gerar_efd_reinf_r1000,
)


@api_view(['POST'])
def api_importar_xml_lote(request):
    """
    Importa múltiplos XMLs de NF-e de entrada.
    Enviar arquivos no campo 'xmls' (múltiplos).
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    arquivos = request.FILES.getlist('xmls')
    if not arquivos:
        return Response({'erro': 'Envie pelo menos um arquivo XML no campo "xmls".'}, status=400)
    resultado = importar_xmls_lote(
        _get_empresa_id(request),
        request.user,
        [a.read() for a in arquivos],
    )
    return Response(resultado, status=201 if not resultado.get('erro') else 400)


@api_view(['GET'])
def api_consultar_nfes_sefaz(request):
    """Consulta NF-es emitidas contra o CNPJ da empresa na SEFAZ via Focus NFe."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    ok, resultado = consultar_nfes_sefaz_cnpj(_get_empresa_id(request))
    if ok:
        return Response(resultado)
    return Response({'erro': resultado}, status=400)


@api_view(['GET'])
def api_gerar_sped(request):
    """
    Gera arquivo SPED Fiscal (EFD-ICMS/IPI) para download.
    ?mes=3&ano=2026
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
    conteudo, erro = gerar_sped_fiscal(_get_empresa_id(request), mes, ano)
    if erro:
        return Response({'erro': erro}, status=400)
    from django.http import HttpResponse
    response = HttpResponse(conteudo, content_type='text/plain; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="SPED_{mes:02d}_{ano}.txt"'
    return response


@api_view(['GET'])
def api_gerar_efd_reinf(request):
    """Gera evento R-1000 do EFD-Reinf em XML para download."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    xml, erro = gerar_efd_reinf_r1000(_get_empresa_id(request))
    if erro:
        return Response({'erro': erro}, status=400)
    from django.http import HttpResponse
    response = HttpResponse(xml, content_type='application/xml; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="EFD_Reinf_R1000.xml"'
    return response


# ══════════════════════════════════════════════════════════════════════════════
# FISCAL COMPLEMENTAR — NFS-e, CT-e, MDF-e, DANFE/XML, Certificado, Inutilização
# ══════════════════════════════════════════════════════════════════════════════

# ── NFS-e ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
def api_emitir_nfse(request):
    """
    Emite NFS-e (Nota Fiscal de Serviço) via Focus NFe.
    Acessível por diretor, gerente e administrativo.

    Body JSON:
        tomador_cnpj_cpf, tomador_nome, tomador_email (opt),
        codigo_servico, discriminacao, valor_servicos,
        deducoes (opt), aliquota_iss, municipio_prestacao,
        referencia, data_competencia (opt)
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Sem permissão para emitir NFS-e.'}, status=403)

    empresa_id = _get_empresa_id(request)
    ok, resultado = emitir_nfse(empresa_id, request.data)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado, status=201)


@api_view(['GET'])
def api_status_nfse(request, referencia):
    """Consulta status de uma NFS-e. Parâmetro: referencia."""
    empresa_id = _get_empresa_id(request)
    ok, resultado = consultar_status_nfse(empresa_id, referencia)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)


@api_view(['DELETE'])
def api_cancelar_nfse(request, referencia):
    """
    Cancela NFS-e autorizada.
    Body: { "motivo": "..." }
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Apenas diretores e gerentes podem cancelar NFS-e.'}, status=403)

    motivo = request.data.get('motivo', '')
    empresa_id = _get_empresa_id(request)
    ok, resultado = cancelar_nfse(empresa_id, request.user, referencia, motivo)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response({'mensagem': resultado})


# ── CT-e ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
def api_emitir_cte(request):
    """
    Emite CT-e (Conhecimento de Transporte) via Focus NFe.
    Acessível por diretor, gerente e administrativo.

    Body JSON:
        referencia, cfop, natureza_operacao, valor_total,
        remetente_cnpj, remetente_nome, remetente_uf,
        destinatario_cnpj, destinatario_nome, destinatario_uf,
        tomador (0-3), chaves_nfe (lista opt),
        produto_predominante, peso_bruto, modal (opt),
        aliquota_icms (opt)
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Sem permissão para emitir CT-e.'}, status=403)

    empresa_id = _get_empresa_id(request)
    ok, resultado = emitir_cte(empresa_id, request.data)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado, status=201)


@api_view(['GET'])
def api_status_cte(request, referencia):
    """Consulta status de um CT-e. Parâmetro: referencia."""
    empresa_id = _get_empresa_id(request)
    ok, resultado = consultar_status_cte(empresa_id, referencia)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)


@api_view(['DELETE'])
def api_cancelar_cte(request, referencia):
    """
    Cancela CT-e autorizado.
    Body: { "justificativa": "..." }
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Apenas diretores e gerentes podem cancelar CT-e.'}, status=403)

    justificativa = request.data.get('justificativa', '')
    empresa_id = _get_empresa_id(request)
    ok, resultado = cancelar_cte(empresa_id, request.user, referencia, justificativa)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response({'mensagem': resultado})


# ── MDF-e ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
def api_emitir_mdfe(request):
    """
    Emite MDF-e (Manifesto de Documentos Fiscais) via Focus NFe.
    Acessível por diretor, gerente e administrativo.

    Body JSON:
        referencia, uf_inicio, uf_fim, data_viagem (opt),
        placa_veiculo, rntrc, cidades_percurso (lista de cód. IBGE),
        documentos (lista de { chave, tipo: 'nfe'|'cte' })
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Sem permissão para emitir MDF-e.'}, status=403)

    empresa_id = _get_empresa_id(request)
    ok, resultado = emitir_mdfe(empresa_id, request.data)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado, status=201)


@api_view(['POST'])
def api_encerrar_mdfe(request, referencia):
    """
    Encerra MDF-e ao final da viagem.
    Body: { "municipio_encerramento": 3550308 }
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Sem permissão para encerrar MDF-e.'}, status=403)

    municipio = request.data.get('municipio_encerramento')
    if not municipio:
        return Response({'erro': 'Informe o municipio_encerramento (código IBGE).'}, status=400)

    empresa_id = _get_empresa_id(request)
    ok, resultado = encerrar_mdfe(empresa_id, request.user, referencia, municipio)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response({'mensagem': resultado})


@api_view(['GET'])
def api_status_mdfe(request, referencia):
    """Consulta status de um MDF-e. Parâmetro: referencia."""
    empresa_id = _get_empresa_id(request)
    ok, resultado = consultar_status_mdfe(empresa_id, referencia)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)


# ── DANFE / XML ────────────────────────────────────────────────────────────

@api_view(['GET'])
def api_download_danfe(request, referencia):
    """
    Retorna a URL do DANFE (PDF) de uma NF-e.
    Parâmetro de rota: referencia (ex: pedido_42)
    """
    empresa_id = _get_empresa_id(request)
    ok, resultado = download_danfe(empresa_id, referencia)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)


@api_view(['GET'])
def api_download_xml(request, referencia):
    """
    Retorna a URL do XML de qualquer documento fiscal.
    Query param: ?tipo=nfe (padrão) | nfse | cte | mdfe
    """
    tipo = request.query_params.get('tipo', 'nfe')
    empresa_id = _get_empresa_id(request)
    ok, resultado = download_xml(empresa_id, referencia, tipo)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)


# ── Certificado Digital ────────────────────────────────────────────────────

@api_view(['POST'])
def api_upload_certificado(request):
    """
    Faz upload do certificado A1 (.pfx/.p12) para o Focus NFe.
    Apenas diretores.

    Multipart form:
        certificado : arquivo .pfx ou .p12
        senha       : senha do certificado
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Apenas diretores podem gerenciar certificados digitais.'}, status=403)

    arquivo = request.FILES.get('certificado')
    senha = request.data.get('senha', '')

    if not arquivo:
        return Response({'erro': 'Envie o arquivo do certificado (.pfx ou .p12).'}, status=400)
    if not senha:
        return Response({'erro': 'Informe a senha do certificado.'}, status=400)

    extensao = arquivo.name.lower().split('.')[-1]
    if extensao not in ('pfx', 'p12'):
        return Response({'erro': 'Formato inválido. Envie um arquivo .pfx ou .p12.'}, status=400)

    empresa_id = _get_empresa_id(request)
    ok, resultado = upload_certificado(empresa_id, request.user, arquivo.read(), senha)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado, status=201)


@api_view(['GET'])
def api_listar_certificados(request):
    """
    Lista certificados digitais da empresa com alertas de vencimento.
    Apenas diretores.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    resultado = listar_certificados(empresa_id)
    return Response({'certificados': resultado})


@api_view(['GET'])
def api_consultar_certificado_focusnfe(request):
    """
    Consulta os dados do certificado ativo direto no Focus NFe.
    Apenas diretores.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    ok, resultado = consultar_certificado_focusnfe(empresa_id)
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)


# ── Inutilização de NF ─────────────────────────────────────────────────────

@api_view(['POST'])
def api_inutilizar_nfe(request):
    """
    Inutiliza faixa de numeração de NF-e na SEFAZ.
    Apenas diretores.

    Body JSON:
        serie          : série da NF-e (ex: "1")
        numero_inicial : primeiro número (int)
        numero_final   : último número (int)
        justificativa  : mínimo 15 caracteres
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Apenas diretores podem inutilizar numeração de NF-e.'}, status=403)

    serie = request.data.get('serie')
    numero_inicial = request.data.get('numero_inicial')
    numero_final = request.data.get('numero_final')
    justificativa = request.data.get('justificativa', '')

    if not all([serie, numero_inicial, numero_final]):
        return Response({'erro': 'Informe serie, numero_inicial e numero_final.'}, status=400)

    empresa_id = _get_empresa_id(request)
    ok, resultado = inutilizar_nfe(
        empresa_id, request.user,
        serie, int(numero_inicial), int(numero_final), justificativa
    )
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado, status=201)


@api_view(['GET'])
def api_listar_inutilizacoes(request):
    """
    Lista todas as inutilizações de NF da empresa.
    Acessível por diretor e gerente.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    resultado = listar_inutilizacoes(empresa_id)
    return Response({'inutilizacoes': resultado})


# ════════════════════════════════════════════════════════
# CADASTROS GERAIS — ViewSets dos novos modelos
# ════════════════════════════════════════════════════════

class GrupoClienteViewSet(viewsets.ModelViewSet):
    serializer_class = GrupoClienteSerializer

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        return GrupoCliente.objects.filter(empresa_id=empresa_id).order_by('nome')

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)


class TabelaPrecoViewSet(viewsets.ModelViewSet):
    serializer_class = TabelaPrecoSerializer

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        return TabelaPreco.objects.filter(empresa_id=empresa_id).order_by('nome')

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)


@api_view(['GET', 'POST'])
def api_itens_tabela_preco(request, tabela_id):
    empresa_id = _get_empresa_id(request)
    tabela = TabelaPreco.objects.filter(id=tabela_id, empresa_id=empresa_id).first()
    if not tabela:
        return Response({'erro': 'Tabela não encontrada.'}, status=404)
    if request.method == 'GET':
        itens = ItemTabelaPreco.objects.filter(tabela=tabela).select_related('produto')
        from .serializers import ItemTabelaPrecoSerializer
        return Response(ItemTabelaPrecoSerializer(itens, many=True).data)
    serializer = ItemTabelaPrecoSerializer(data={**request.data, 'tabela': tabela.id})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


class VeiculoViewSet(viewsets.ModelViewSet):
    serializer_class = VeiculoSerializer

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        return Veiculo.objects.filter(empresa_id=empresa_id).order_by('descricao')

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)


class FazendaViewSet(viewsets.ModelViewSet):
    serializer_class = FazendaSerializer

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        return Fazenda.objects.filter(empresa_id=empresa_id).order_by('nome')

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)


class GlebaViewSet(viewsets.ModelViewSet):
    serializer_class = GlebaSerializer

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        fazenda_id = self.request.query_params.get('fazenda')
        qs = Gleba.objects.filter(fazenda__empresa_id=empresa_id)
        if fazenda_id:
            qs = qs.filter(fazenda_id=fazenda_id)
        return qs.order_by('nome')


class TalhaoViewSet(viewsets.ModelViewSet):
    serializer_class = TalhaoSerializer

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        gleba_id = self.request.query_params.get('gleba')
        qs = Talhao.objects.filter(gleba__fazenda__empresa_id=empresa_id)
        if gleba_id:
            qs = qs.filter(gleba_id=gleba_id)
        return qs.order_by('nome')


class DevolucaoVendaViewSet(viewsets.ModelViewSet):
    serializer_class = DevolucaoVendaSerializer

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        return DevolucaoVenda.objects.filter(empresa_id=empresa_id).order_by('-criado_em')

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id, usuario=self.request.user)


class BancoViewSet(viewsets.ModelViewSet):
    serializer_class = BancoSerializer

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        qs = Banco.objects.filter(empresa_id=empresa_id)
        if self.request.query_params.get('so_ativos') == '1':
            qs = qs.filter(ativo=True)
        return qs.order_by('nome')

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)