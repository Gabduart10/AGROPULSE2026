from rest_framework.permissions import AllowAny
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .dashboard_perfil import dashboard_por_perfil
from .aprovacoes import verificar_travas_pedido, reter_pedido_para_aprovacao, aprovar_pedido, recusar_pedido, listar_fila_aprovacao
from .caixa import abrir_caixa, fechar_caixa, registrar_sangria, registrar_suprimento, resumo_caixa
from django.utils import timezone
from decimal import Decimal, InvalidOperation
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
    PedidoVendaSerializer, ClienteSerializer, FornecedorSerializer,
    ProdutoSerializer, ContaPagarSerializer, ContaReceberSerializer,
    GrupoClienteSerializer, TabelaPrecoSerializer, ItemTabelaPrecoSerializer,
    VeiculoSerializer, FazendaSerializer, GlebaSerializer, TalhaoSerializer,
    DevolucaoVendaSerializer, BancoSerializer, LogAuditoriaSerializer,
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

    def destroy(self, request, *args, **kwargs):
        nivel = getattr(request.user, 'nivel', None)
        tem_acesso = nivel == 'diretor'
        if not tem_acesso:
            perm = _get_perm(request.user)
            tem_acesso = perm is not None and perm.excluir_registros
        if not tem_acesso:
            return Response({'erro': 'Sem permissão para excluir registros.'}, status=403)
        confirmacao = (request.data or {}).get('confirmar_senha', '').strip()
        if not confirmacao:
            return Response({
                'erro': 'Exclusão permanente requer confirmação. Envie "confirmar_senha" no corpo da requisição.',
                'requer_confirmacao': True,
            }, status=428)
        if not request.user.check_password(confirmacao):
            return Response({'erro': 'Senha incorreta. Exclusão negada.'}, status=403)
        return super().destroy(request, *args, **kwargs)
from .models import (
    PedidoVenda, Empresa, Cliente, Produto, Fornecedor,
    ContaPagar, ContaReceber,
    GrupoCliente, TabelaPreco, ItemTabelaPreco,
    Veiculo, Fazenda, Gleba, Talhao,
    DevolucaoVenda, Banco, LogAuditoria, LogComportamental,
    MetaVendedor, VisitaCliente,
    AplicacaoInsumo, LoteEstoque,
    GrupoContabil, ContaContabil, MapaContabil, LancamentoContabil,
    OrdemProducao, ItemOrdemProducao, BeneficiamentoLote,
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
    """Retorna o empresa_id do usuário logado.

    SuperHost (is_staff sem empresa): pode passar ?empresa_id=X para navegar
    pelo ambiente de qualquer cliente. Sem o parâmetro, retorna a primeira
    empresa do banco (comportamento de dev/fallback).

    Diretor de matriz: pode enviar o cabeçalho X-Empresa-Id para operar no
    contexto de uma filial sem novo login. Validado contra a lista de filiais.

    Gerente com empresas_adicionais: pode enviar X-Empresa-Id para operar em
    qualquer empresa para a qual o CEO concedeu acesso explícito.
    """
    if getattr(request.user, 'is_staff', False):
        param = request.query_params.get('empresa_id') or request.data.get('empresa_id')
        if param:
            return int(param)
    if request.user.is_authenticated and hasattr(request.user, 'empresa') and request.user.empresa:
        user_empresa_id = request.user.empresa.id
        header_id = request.META.get('HTTP_X_EMPRESA_ID')
        if header_id:
            try:
                target_id = int(header_id)
                if target_id != user_empresa_id:
                    nivel = getattr(request.user, 'nivel', None)
                    # Diretor de matriz: acesso às filiais
                    if nivel == 'diretor' and Empresa.objects.filter(
                        id=target_id, empresa_matriz_id=user_empresa_id
                    ).exists():
                        return target_id
                    # Qualquer nível: acesso se CEO concedeu via empresas_adicionais
                    from .models import PermissaoGranular
                    perm = PermissaoGranular.objects.filter(usuario=request.user).first()
                    if perm and perm.empresas_adicionais.filter(id=target_id).exists():
                        return target_id
            except (ValueError, TypeError):
                pass
        return user_empresa_id
    primeira = Empresa.objects.first()
    return primeira.id if primeira else None


def _get_vendedor_id(request):
    """Retorna o ID do vendedor se o nível for 'vendedor', senão None."""
    if request.user.is_authenticated and getattr(request.user, 'nivel', None) == 'vendedor':
        return request.user.id
    return None


def _get_perm(user):
    """Retorna PermissaoGranular do usuário, ou None se não existir."""
    from .models import PermissaoGranular
    try:
        return PermissaoGranular.objects.get(usuario=user)
    except PermissaoGranular.DoesNotExist:
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
    """Contas a pagar que vencem em breve. Bloqueado para operacional."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel == 'operacional':
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)
    dias = int(request.query_params.get('dias', 7))
    return Response(alertas_contas_vencer(empresa_id, dias=dias))


@api_view(['GET'])
def api_alertas_receber_atrasados(request):
    """Contas a receber já vencidas. Bloqueado para operacional."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel == 'operacional':
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)
    return Response(alertas_contas_receber_atrasadas(empresa_id))


@api_view(['GET'])
def api_alertas_clientes(request):
    """Clientes sem comprar. Bloqueado para operacional (contexto de vendas)."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel == 'operacional':
        return Response({'erro': 'Acesso negado.'}, status=403)
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
            qs = qs.filter(
                Q(vendedor_responsavel=self.request.user) |
                Q(pedidovenda__vendedor=self.request.user)
            ).distinct()
        return qs.order_by('nome_razao')

    def update(self, request, *args, **kwargs):
        nivel = getattr(request.user, 'nivel', None)
        tem_acesso = nivel in ['diretor', 'gerente']
        if not tem_acesso:
            perm = _get_perm(request.user)
            tem_acesso = perm is not None and perm.editar_clientes
        if not tem_acesso:
            return Response({'erro': 'Sem permissão para editar clientes.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao='criacao', modelo_afetado='Cliente',
            registro_id=serializer.instance.id,
            descricao=f'Cliente "{serializer.instance.nome_razao}" criado.',
            request=self.request,
        )

    def perform_update(self, serializer):
        obj = self.get_object()
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)
        empresa = Empresa.objects.get(id=empresa_id)
        LogComportamental.registrar(
            request=self.request,
            acao='alterou_cadastro',
            descricao=f'Cliente "{obj.nome_razao}" editado',
            modelo_afetado='Cliente',
            id_afetado=obj.id,
        )
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao='edicao', modelo_afetado='Cliente',
            registro_id=obj.id,
            descricao=f'Cliente "{obj.nome_razao}" editado.',
            request=self.request,
        )

    def perform_destroy(self, instance):
        empresa = Empresa.objects.get(id=_get_empresa_id(self.request))
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao='exclusao', modelo_afetado='Cliente',
            registro_id=instance.id,
            descricao=f'Cliente "{instance.nome_razao}" excluído.',
            request=self.request,
        )
        instance.delete()


class ProdutoViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = ProdutoSerializer
    export_titulo = 'Produtos'
    export_filename = 'produtos'
    export_colunas = [
        (lambda o: o.nome,                                    'Nome'),
        (lambda o: o.sku or '',                               'SKU'),
        (lambda o: o.ncm or '',                               'NCM'),
        (lambda o: o.unidade_medida or '',                    'Unidade'),
        (lambda o: f'{o.comissao_percentual:.2f}%' if o.comissao_percentual is not None else '', 'Comissão (%)'),
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

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        empresa = Empresa.objects.get(id=empresa_id)
        comissao = serializer.validated_data.get('comissao_percentual')
        if comissao is None:
            comissao = empresa.comissao_padrao
        serializer.save(empresa_id=empresa_id, comissao_percentual=comissao)
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao='criacao', modelo_afetado='Produto',
            registro_id=serializer.instance.id,
            descricao=f'Produto "{serializer.instance.nome}" criado.',
            request=self.request,
        )

    def perform_update(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        empresa = Empresa.objects.get(id=empresa_id)
        obj = self.get_object()
        preco_anterior = obj.preco_venda
        if 'comissao_percentual' in serializer.validated_data and serializer.validated_data.get('comissao_percentual') is None:
            serializer.save(empresa_id=empresa_id, comissao_percentual=empresa.comissao_padrao)
        else:
            serializer.save(empresa_id=empresa_id)
        preco_novo = serializer.instance.preco_venda
        houve_preco = preco_anterior != preco_novo
        LogComportamental.registrar(
            request=self.request,
            acao='alterou_preco' if houve_preco else 'alterou_cadastro',
            descricao=f'Produto "{obj.nome}" editado' + (
                f' — preço {preco_anterior} → {preco_novo}' if houve_preco else ''
            ),
            modelo_afetado='Produto',
            id_afetado=obj.id,
            valor_anterior=str(preco_anterior) if houve_preco else None,
            valor_novo=str(preco_novo) if houve_preco else None,
        )
        acao_audit = 'alteracao_preco' if houve_preco else 'edicao'
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao=acao_audit, modelo_afetado='Produto',
            registro_id=obj.id,
            campo_alterado='preco_venda' if houve_preco else None,
            valor_anterior=str(preco_anterior) if houve_preco else None,
            valor_novo=str(preco_novo) if houve_preco else None,
            descricao=f'Produto "{obj.nome}" editado.',
            request=self.request,
        )

    def perform_destroy(self, instance):
        empresa = Empresa.objects.get(id=_get_empresa_id(self.request))
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao='exclusao', modelo_afetado='Produto',
            registro_id=instance.id,
            descricao=f'Produto "{instance.nome}" excluído.',
            request=self.request,
        )
        instance.delete()

    def update(self, request, *args, **kwargs):
        nivel = getattr(request.user, 'nivel', None)
        tem_acesso = nivel in ['diretor', 'gerente']
        if not tem_acesso:
            perm = _get_perm(request.user)
            tem_acesso = perm is not None and perm.editar_produtos
        if not tem_acesso:
            return Response({'erro': 'Sem permissão para editar produtos.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


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

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao='criacao', modelo_afetado='ContaPagar',
            registro_id=serializer.instance.id,
            descricao=f'Conta a pagar "{serializer.instance.descricao}" criada.',
            request=self.request,
        )

    def perform_update(self, serializer):
        obj = self.get_object()
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao='edicao', modelo_afetado='ContaPagar',
            registro_id=obj.id,
            descricao=f'Conta a pagar "{obj.descricao}" editada.',
            request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        from .models import TransacaoBancaria
        if TransacaoBancaria.objects.filter(conta_pagar=obj, status='conciliado').exists():
            return Response(
                {'erro': 'Este lançamento está conciliado bancariamente e não pode ser excluído.'},
                status=400
            )
        empresa = Empresa.objects.get(id=_get_empresa_id(request))
        LogAuditoria.registrar(
            empresa=empresa, usuario=request.user,
            acao='exclusao', modelo_afetado='ContaPagar',
            registro_id=obj.id,
            descricao=f'Conta a pagar "{obj.descricao}" excluída.',
            request=request,
        )
        return super().destroy(request, *args, **kwargs)


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

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao='criacao', modelo_afetado='ContaReceber',
            registro_id=serializer.instance.id,
            descricao=f'Conta a receber "{serializer.instance.descricao}" criada.',
            request=self.request,
        )

    def perform_update(self, serializer):
        obj = self.get_object()
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=self.request.user,
            acao='edicao', modelo_afetado='ContaReceber',
            registro_id=obj.id,
            descricao=f'Conta a receber "{obj.descricao}" editada.',
            request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        from .models import TransacaoBancaria
        if TransacaoBancaria.objects.filter(conta_receber=obj, status='conciliado').exists():
            return Response(
                {'erro': 'Este lançamento está conciliado bancariamente e não pode ser excluído.'},
                status=400
            )
        empresa = Empresa.objects.get(id=_get_empresa_id(request))
        LogAuditoria.registrar(
            empresa=empresa, usuario=request.user,
            acao='exclusao', modelo_afetado='ContaReceber',
            registro_id=obj.id,
            descricao=f'Conta a receber "{obj.descricao}" excluída.',
            request=request,
        )
        return super().destroy(request, *args, **kwargs)


@api_view(['GET'])
def api_notificacoes(request):
    from .models import Notificacao
    empresa_id = _get_empresa_id(request)
    if not empresa_id:
        return Response({'erro': 'Empresa não encontrada.'}, status=400)

    nivel = getattr(request.user, 'nivel', None)

    qs = Notificacao.objects.filter(
        empresa_id=empresa_id, lida=False,
    ).filter(
        models.Q(usuario=request.user) | models.Q(usuario__isnull=True)
    ).order_by('-prioridade', '-data_criacao')[:50]

    resultado = []
    for n in qs:
        if not n.visivel:
            continue
        # Filtra por nível quando visivel_para_nivel está preenchido
        if n.visivel_para_nivel and nivel:
            niveis_alvo = [v.strip() for v in n.visivel_para_nivel.split(',')]
            if nivel not in niveis_alvo:
                continue
        resultado.append({
            'id': n.id,
            'tipo': n.tipo,
            'prioridade': n.prioridade,
            'titulo': n.titulo,
            'mensagem': n.mensagem,
            'data': n.data_criacao.strftime('%d/%m/%Y %H:%M'),
        })
        if len(resultado) == 30:
            break

    return Response(resultado)


@api_view(['POST'])
def api_marcar_notificacao_lida(request, notificacao_id):
    from .models import Notificacao
    try:
        n = Notificacao.objects.get(id=notificacao_id, empresa_id=_get_empresa_id(request))
        n.fechar()
        LogComportamental.registrar(
            request=request,
            acao='fechou_notificacao',
            descricao=f'Notificação #{notificacao_id} — {n.titulo[:80]}',
            modelo_afetado='Notificacao',
            id_afetado=notificacao_id,
        )
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
    Aprova um pedido retido. Acessível por gerente e diretor,
    ou por usuário com switch aprovar_pedido ativo.
    """
    from .models import PedidoVenda
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['gerente', 'diretor']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.aprovar_pedido
    if not tem_acesso:
        return Response({'erro': 'Acesso negado.'}, status=403)

    try:
        pedido = PedidoVenda.objects.get(id=pedido_id, empresa_id=_get_empresa_id(request))
    except PedidoVenda.DoesNotExist:
        return Response({'erro': 'Pedido não encontrado.'}, status=404)

    observacao = request.data.get('observacao', '')
    ok, mensagem = aprovar_pedido(pedido, request.user, observacao)
    if ok:
        LogComportamental.registrar(
            request=request,
            acao='aprovou_pedido',
            descricao=f'Pedido #{pedido_id} aprovado',
            modelo_afetado='PedidoVenda',
            id_afetado=pedido_id,
        )
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
    if ok:
        LogComportamental.registrar(
            request=request,
            acao='recusou_pedido',
            descricao=f'Pedido #{pedido_id} recusado — {motivo[:100]}',
            modelo_afetado='PedidoVenda',
            id_afetado=pedido_id,
        )
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
    Acessível por diretor, gerente e administrativo,
    ou por usuário com switch ver_dre ativo.
    Parâmetros: ?mes=3&ano=2026&exportar=pdf|excel
    """
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente', 'administrativo']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_dre
    if not tem_acesso:
        return Response({'erro': 'Acesso negado.'}, status=403)

    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
    empresa_id = _get_empresa_id(request)
    exportar = request.query_params.get('exportar')

    LogComportamental.registrar(
        request=request,
        acao='exportou_relatorio' if exportar else 'visualizou_relatorio',
        descricao=f'DRE {mes:02d}/{ano}' + (' — exportado' if exportar else ''),
        modelo_afetado='DRE',
    )

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
    Acessível por diretor, gerente e administrativo,
    ou por usuário com switch ver_relatorios ativo.
    Parâmetros: ?exportar=pdf|excel&cliente_id=X&vendedor_id=X
    """
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente', 'administrativo']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_relatorios
    if not tem_acesso:
        return Response({'erro': 'Acesso negado.'}, status=403)

    LogComportamental.registrar(
        request=request,
        acao='exportou_relatorio' if request.query_params.get('exportar') else 'visualizou_relatorio',
        descricao='Inadimplência' + (' — exportado' if request.query_params.get('exportar') else ''),
        modelo_afetado='Inadimplencia',
    )

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
    Acessível por diretor e gerente,
    ou por usuário com switch ver_relatorios ou ver_custos ativo.
    Parâmetros: ?mes=3&ano=2026&vendedor_id=X&exportar=pdf|excel
    """
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and (perm.ver_relatorios or perm.ver_custos)
    if not tem_acesso:
        return Response({'erro': 'Acesso negado.'}, status=403)

    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
    empresa_id = _get_empresa_id(request)
    exportar = request.query_params.get('exportar')
    f = get_filtros_base(request)

    LogComportamental.registrar(
        request=request,
        acao='exportou_relatorio' if exportar else 'visualizou_relatorio',
        descricao=f'Performance vendedores {mes:02d}/{ano}' + (' — exportado' if exportar else ''),
        modelo_afetado='PerformanceVendedores',
    )

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
    Acessível por diretor e gerente,
    ou por usuário com switch ver_comissoes_outros ativo.
    Parâmetros: ?mes=3&ano=2026&vendedor_id=X&exportar=pdf|excel
    """
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_comissoes_outros
    if not tem_acesso:
        return Response({'erro': 'Acesso negado.'}, status=403)

    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))
    empresa_id = _get_empresa_id(request)
    exportar = request.query_params.get('exportar')
    f = get_filtros_base(request)

    LogComportamental.registrar(
        request=request,
        acao='exportou_relatorio' if exportar else 'visualizou_relatorio',
        descricao=f'Comissões repasse {mes:02d}/{ano}' + (' — exportado' if exportar else ''),
        modelo_afetado='ComissoesRepasse',
    )

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
    Acessível por diretor, gerente e administrativo,
    ou por usuário com switch ver_custos ativo.
    Parâmetros: ?dias=90&produto_id=X&exportar=pdf|excel
    """
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente', 'administrativo']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_custos
    if not tem_acesso:
        return Response({'erro': 'Acesso negado.'}, status=403)

    dias = int(request.query_params.get('dias', 90))
    empresa_id = _get_empresa_id(request)
    exportar = request.query_params.get('exportar')

    LogComportamental.registrar(
        request=request,
        acao='exportou_relatorio' if exportar else 'visualizou_relatorio',
        descricao=f'Curva ABC lucratividade ({dias} dias)' + (' — exportado' if exportar else ''),
        modelo_afetado='CurvaABC',
    )

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
                'empresas_adicionais': list(
                    permissao.empresas_adicionais.values('id', 'nome')
                ),
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

        # empresas_adicionais: lista de IDs de empresas do mesmo grupo
        if 'empresas_adicionais' in request.data:
            ids = request.data['empresas_adicionais']
            if not isinstance(ids, list):
                return Response({'erro': 'empresas_adicionais deve ser uma lista de IDs.'}, status=400)
            # Valida que todas as empresas pertencem ao mesmo grupo que a empresa do diretor
            empresa_diretor = request.user.empresa
            empresas_validas = Empresa.objects.filter(
                id__in=ids
            ).filter(
                models.Q(empresa_matriz=empresa_diretor) |
                models.Q(empresa_matriz=empresa_diretor.empresa_matriz) |
                models.Q(id=empresa_diretor.empresa_matriz_id)
            )
            permissao.empresas_adicionais.set(empresas_validas)

        LogAuditoria.registrar(
            empresa=usuario.empresa,
            usuario=request.user,
            acao='alteracao_permissao',
            modelo_afetado='PermissaoGranular',
            registro_id=permissao.id,
            descricao=f'Permissões de {usuario.username} atualizadas por {request.user.username}',
            request=request,
        )

        return Response({'mensagem': 'Permissões atualizadas com sucesso.'})


# ==========================================
# GERENCIAMENTO DE USUÁRIOS
# ==========================================

@api_view(['GET', 'POST'])
def api_usuarios(request):
    """
    GET  — lista usuários da empresa (diretor only).
    POST — cria novo usuário com perfil de acesso (diretor only).
    Body POST: {username, senha, first_name, last_name, email, nivel}
    """
    from .models import Usuario, PermissaoGranular, Empresa

    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado. Apenas diretores.'}, status=403)

    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        usuarios = Usuario.objects.filter(empresa_id=empresa_id).order_by('first_name', 'username')
        return Response([{
            'id': u.id,
            'username': u.username,
            'nome': u.get_full_name() or u.username,
            'email': u.email,
            'nivel': u.nivel,
            'nivel_display': u.get_nivel_display(),
            'ativo': u.is_active,
            'colaborador_id': u.colaborador.id if hasattr(u, 'colaborador') and u.colaborador else None,
        } for u in usuarios])

    d = request.data
    username = d.get('username', '').strip()
    senha = d.get('senha', '').strip()
    nivel_novo = d.get('nivel', 'vendedor')

    if not username or not senha:
        return Response({'erro': 'username e senha são obrigatórios.'}, status=400)

    if Usuario.objects.filter(username=username).exists():
        return Response({'erro': 'Username já existe.'}, status=400)

    niveis_validos = [n[0] for n in Usuario.NIVEIS_CHOICES]
    if nivel_novo not in niveis_validos:
        return Response({'erro': f'Nível inválido. Opções: {niveis_validos}'}, status=400)

    empresa = Empresa.objects.get(id=empresa_id)
    usuario = Usuario.objects.create_user(
        username=username,
        email=d.get('email', '').strip(),
        password=senha,
        first_name=d.get('first_name', '').strip(),
        last_name=d.get('last_name', '').strip(),
        nivel=nivel_novo,
        empresa=empresa,
    )
    PermissaoGranular.objects.create(usuario=usuario, empresa=empresa)

    LogAuditoria.registrar(
        empresa=empresa,
        usuario=request.user,
        acao='alteracao_usuario',
        modelo_afetado='Usuario',
        registro_id=usuario.id,
        descricao=f'Usuário {usuario.username} criado com nível {nivel_novo} por {request.user.username}',
        request=request,
    )

    return Response({
        'id': usuario.id,
        'username': usuario.username,
        'mensagem': 'Usuário criado com sucesso.',
    }, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
def api_usuario_detalhe(request, usuario_id):
    """
    GET    — retorna dados do usuário.
    PATCH  — atualiza nivel, nome, email, senha ou ativo.
    DELETE — desativa o usuário (is_active=False). Não apaga.
    """
    from .models import Usuario

    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado. Apenas diretores.'}, status=403)

    empresa_id = _get_empresa_id(request)

    try:
        usuario = Usuario.objects.get(id=usuario_id, empresa_id=empresa_id)
    except Usuario.DoesNotExist:
        return Response({'erro': 'Usuário não encontrado.'}, status=404)

    if request.method == 'GET':
        return Response({
            'id': usuario.id,
            'username': usuario.username,
            'first_name': usuario.first_name,
            'last_name': usuario.last_name,
            'email': usuario.email,
            'nivel': usuario.nivel,
            'nivel_display': usuario.get_nivel_display(),
            'ativo': usuario.is_active,
        })

    if request.method == 'PATCH':
        d = request.data
        for campo in ('first_name', 'last_name', 'email'):
            if campo in d:
                setattr(usuario, campo, d[campo])
        if 'nivel' in d:
            niveis_validos = [n[0] for n in Usuario.NIVEIS_CHOICES]
            if d['nivel'] not in niveis_validos:
                return Response({'erro': 'Nível inválido.'}, status=400)
            usuario.nivel = d['nivel']
        if 'senha' in d and d['senha']:
            usuario.set_password(d['senha'])
        if 'ativo' in d:
            usuario.is_active = bool(d['ativo'])
        usuario.save()
        LogAuditoria.registrar(
            empresa=usuario.empresa,
            usuario=request.user,
            acao='alteracao_usuario',
            modelo_afetado='Usuario',
            registro_id=usuario.id,
            descricao=f'Dados de {usuario.username} atualizados por {request.user.username}',
            request=request,
        )
        return Response({'mensagem': 'Usuário atualizado.'})

    # DELETE — desativa sem apagar
    usuario.is_active = False
    usuario.save(update_fields=['is_active'])
    if hasattr(usuario, 'colaborador') and usuario.colaborador:
        col = usuario.colaborador
        if col.status == 'ativo':
            col.status = 'inativo'
            col.save(update_fields=['status'])
    LogAuditoria.registrar(
        empresa=usuario.empresa,
        usuario=request.user,
        acao='alteracao_usuario',
        modelo_afetado='Usuario',
        registro_id=usuario.id,
        descricao=f'Usuário {usuario.username} desativado por {request.user.username}',
        request=request,
    )
    return Response({'mensagem': 'Usuário desativado.'})


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
    Acessível por diretor, gerente e administrativo,
    ou por usuário com switch ver_financeiro ativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente', 'administrativo']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_financeiro
    if not tem_acesso:
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
    Acessível por diretor, gerente e administrativo,
    ou por usuário com switch ver_financeiro ativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente', 'administrativo']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_financeiro
    if not tem_acesso:
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

    # 2FA obrigatório para SuperHost — bloqueia login se não configurado
    if is_superhost and not getattr(user, 'totp_habilitado', False):
        return Response({
            'erro': '2FA obrigatório para SuperHost. Configure o autenticador antes de continuar.',
            'requires_2fa_setup': True,
        }, status=403)

    # Verifica 2FA se habilitado (SuperHost sempre cai aqui após o bloco acima)
    if getattr(user, 'totp_habilitado', False) and user.totp_secret:
        totp_code = request.data.get('totp_code', '').strip()
        if not totp_code:
            return Response({'requires_2fa': True}, status=200)
        import pyotp
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(totp_code, valid_window=1):
            return Response({'erro': 'Código 2FA inválido.'}, status=401)

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
            'is_matriz': user.empresa.is_matriz,
            'is_filial': user.empresa.is_filial,
        })

    if user.empresa:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')
        LogComportamental.objects.create(
            empresa=user.empresa,
            usuario=user,
            acao='login',
            descricao=f'Login de {user.username}',
            ip_address=ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
        )

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
 
    LogComportamental.registrar(
        request=request,
        acao='logout',
        descricao=f'Logout de {request.user.username}',
    )

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
    Body: { "justificativa": "texto mínimo 15 chars", "confirmacao_senha": "..." }
    Acessível por diretor e gerente. Exige confirmação de senha (ação irreversível).
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    confirmacao = request.data.get('confirmacao_senha', '').strip()
    if not confirmacao:
        return Response({
            'erro': 'Cancelamento de NF-e é irreversível junto à SEFAZ. Informe sua senha em "confirmacao_senha" para confirmar.',
            'requer_confirmacao': True,
        }, status=428)
    if not request.user.check_password(confirmacao):
        return Response({'erro': 'Senha incorreta. Cancelamento negado.'}, status=403)

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
    painel_superhost, consolidado_matriz, detalhe_filial,
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
    """DRE por centro de custo. ?mes=3&ano=2026
    Acessível por diretor e gerente, ou com switch ver_dre ativo."""
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_dre
    if not tem_acesso:
        return Response({'erro': 'Acesso negado.'}, status=403)
    hoje = timezone.now()
    mes  = int(request.query_params.get('mes', hoje.month))
    ano  = int(request.query_params.get('ano', hoje.year))
    LogComportamental.registrar(
        request=request,
        acao='visualizou_relatorio',
        descricao=f'DRE por centro de custo {mes:02d}/{ano}',
        modelo_afetado='DRECentroCusto',
    )
    return Response(dre_por_centro_custo(_get_empresa_id(request), mes, ano))


@api_view(['GET'])
def api_fluxo_caixa(request):
    """
    Fluxo de caixa projeção vs realizado.
    ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD&atalho=mes
    Acessível por diretor e gerente, ou com switch ver_financeiro ativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_financeiro
    if not tem_acesso:
        return Response({'erro': 'Acesso negado.'}, status=403)
    LogComportamental.registrar(
        request=request,
        acao='visualizou_relatorio',
        descricao='Fluxo de caixa',
        modelo_afetado='FluxoCaixa',
    )
    f = get_filtros_base(request)
    hoje = date.today()
    data_ini = f['data_inicio'] or hoje.replace(day=1)
    data_fim = f['data_fim'] or hoje
    from datetime import date as _date
    return Response(fluxo_caixa(_get_empresa_id(request), data_ini, data_fim))


@api_view(['GET', 'POST'])
def api_lancamentos_recorrentes(request):
    """GET — lista | POST — cria recorrência.
    Acessível por diretor e gerente, ou com switch ver_financeiro ativo."""
    nivel = getattr(request.user, 'nivel', None)
    tem_acesso = nivel in ['diretor', 'gerente']
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_financeiro
    if not tem_acesso:
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
    GET  — lista colaboradores (diretor, gerente, administrativo)
    POST — cria colaborador (diretor, gerente, administrativo)
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
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
    Apenas diretor, gerente e administrativo.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
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
    from .models import LogAuditoria
    # Log uma entrada por acesso ao painel (usa a primeira empresa como âncora)
    primeira = Empresa.objects.first()
    if primeira:
        LogAuditoria.registrar(
            empresa=primeira,
            usuario=request.user,
            acao='acesso_superhost',
            modelo_afetado='Empresa',
            registro_id=0,
            descricao='SuperHost acessou painel geral de clientes',
            request=request,
        )
    return Response(painel_superhost())


@api_view(['POST'])
def api_superhost_bloquear(request, empresa_id):
    """Bloqueia/desbloqueia acesso de uma empresa. Só para is_staff."""
    if not request.user.is_staff:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import LogAuditoria
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)
    acao = request.data.get('acao', 'bloquear')
    status_anterior = getattr(empresa, 'status_assinatura', '—')
    novo_status = 'bloqueada' if acao == 'bloquear' else 'ativa'
    if hasattr(empresa, 'status_assinatura'):
        empresa.status_assinatura = novo_status
        empresa.save(update_fields=['status_assinatura'])
    LogAuditoria.registrar(
        empresa=empresa,
        usuario=request.user,
        acao='bloqueio_empresa',
        modelo_afetado='Empresa',
        registro_id=empresa.id,
        campo_alterado='status_assinatura',
        valor_anterior=status_anterior,
        valor_novo=novo_status,
        descricao=f'SuperHost alterou status da empresa "{empresa.nome}" para {novo_status}',
        request=request,
    )
    return Response({'mensagem': f'Empresa {empresa.nome} {novo_status}.'})


@api_view(['POST'])
def api_superhost_alterar_tipo(request, empresa_id):
    """
    Altera o tipo_negocio de uma empresa (revenda ↔ industria).
    Exclusivo para SuperHost (is_staff). Nunca exposto ao CEO do cliente.
    """
    if not request.user.is_staff:
        return Response({'erro': 'Apenas o SuperHost pode alterar o tipo de operação.'}, status=403)
    from .models import LogAuditoria
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
    LogAuditoria.registrar(
        empresa=empresa,
        usuario=request.user,
        acao='alteracao_tipo_empresa',
        modelo_afetado='Empresa',
        registro_id=empresa.id,
        campo_alterado='tipo_negocio',
        valor_anterior=tipo_anterior,
        valor_novo=novo_tipo,
        descricao=f'SuperHost alterou tipo de negócio de "{empresa.nome}": {tipo_anterior} → {novo_tipo}',
        request=request,
    )
    return Response({
        'mensagem': f'Tipo alterado de "{tipo_anterior}" para "{novo_tipo}".',
        'empresa': empresa.nome,
        'tipo_negocio': novo_tipo,
    })


@api_view(['POST'])
def api_superhost_acessar(request, empresa_id):
    """
    Registra acesso ao ambiente de um cliente com justificativa obrigatória.
    Retorna confirmação — o frontend já gerencia o impersonation via localStorage.
    """
    if not request.user.is_staff:
        return Response({'erro': 'Acesso negado.'}, status=403)
    justificativa = request.data.get('justificativa', '').strip()
    if len(justificativa) < 10:
        return Response({'erro': 'Informe uma justificativa com pelo menos 10 caracteres.'}, status=400)
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)
    from .models import LogAuditoria
    LogAuditoria.registrar(
        empresa=empresa,
        usuario=request.user,
        acao='acesso_superhost',
        modelo_afetado='Empresa',
        registro_id=empresa.id,
        descricao=f'SuperHost acessou ambiente de "{empresa.nome}"',
        justificativa=justificativa,
        request=request,
    )
    return Response({'ok': True, 'empresa_nome': empresa.nome})


@api_view(['GET', 'PATCH'])
def api_superhost_plano(request, empresa_id):
    """Lê e atualiza plano, limites e módulos de um tenant. Só is_staff."""
    if not request.user.is_staff:
        return Response({'erro': 'Acesso negado.'}, status=403)
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)

    modulos = empresa.modulos_habilitados or Empresa.MODULOS_PADRAO.copy()

    if request.method == 'GET':
        return Response({
            'plano': empresa.plano,
            'max_usuarios': empresa.max_usuarios,
            'modulos_habilitados': modulos,
            'total_usuarios': empresa.usuarios.count() if hasattr(empresa, 'usuarios') else 0,
        })

    planos_validos = [p[0] for p in Empresa.PLANO_CHOICES]
    update_fields = []

    if 'plano' in request.data:
        if request.data['plano'] not in planos_validos:
            return Response({'erro': f'Plano inválido. Opções: {planos_validos}'}, status=400)
        empresa.plano = request.data['plano']
        update_fields.append('plano')

    if 'max_usuarios' in request.data:
        try:
            empresa.max_usuarios = max(1, int(request.data['max_usuarios']))
            update_fields.append('max_usuarios')
        except (ValueError, TypeError):
            return Response({'erro': 'max_usuarios deve ser inteiro.'}, status=400)

    if 'modulos_habilitados' in request.data:
        novos = request.data['modulos_habilitados']
        if not isinstance(novos, dict):
            return Response({'erro': 'modulos_habilitados deve ser um objeto.'}, status=400)
        modulos.update({k: bool(v) for k, v in novos.items()})
        empresa.modulos_habilitados = modulos
        update_fields.append('modulos_habilitados')

    if update_fields:
        empresa.save(update_fields=update_fields)

    return Response({
        'mensagem': 'Plano atualizado.',
        'plano': empresa.plano,
        'max_usuarios': empresa.max_usuarios,
        'modulos_habilitados': empresa.modulos_habilitados,
    })


@api_view(['GET', 'POST'])
def api_superhost_unidades(request, empresa_id):
    """Lista e cria filiais de um tenant. Só is_staff."""
    if not request.user.is_staff:
        return Response({'erro': 'Acesso negado.'}, status=403)
    try:
        matriz = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)

    if request.method == 'GET':
        filiais = Empresa.objects.filter(empresa_matriz=matriz).values(
            'id', 'nome', 'cnpj', 'tipo_negocio', 'plano', 'max_usuarios'
        )
        return Response({
            'matriz': {'id': matriz.id, 'nome': matriz.nome, 'cnpj': matriz.cnpj},
            'filiais': list(filiais),
        })

    nome = request.data.get('nome', '').strip()
    cnpj = request.data.get('cnpj', '').strip()
    if not nome or not cnpj:
        return Response({'erro': 'Campos obrigatórios: nome, cnpj.'}, status=400)
    if Empresa.objects.filter(cnpj=cnpj).exists():
        return Response({'erro': 'CNPJ já cadastrado.'}, status=400)

    filial = Empresa.objects.create(
        nome=nome,
        cnpj=cnpj,
        tipo_negocio=request.data.get('tipo_negocio', matriz.tipo_negocio),
        empresa_matriz=matriz,
        plano=matriz.plano,
        max_usuarios=int(request.data.get('max_usuarios', 5)),
        modulos_habilitados=matriz.modulos_habilitados or Empresa.MODULOS_PADRAO.copy(),
    )
    return Response({'id': filial.id, 'mensagem': f'Filial "{filial.nome}" criada.'}, status=201)


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


@api_view(['GET'])
def api_filial_detalhe(request, filial_id):
    """Indicadores completos de uma filial. Apenas diretor da matriz."""
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    dados = detalhe_filial(empresa_matriz_id=empresa_id, filial_id=filial_id)
    if dados is None:
        return Response({'erro': 'Filial não encontrada ou não pertence a esta matriz.'}, status=404)
    return Response(dados)


# ══════════════════════════════════════════════════════════════════════════════
# CARTEIRA DO TIME — GERENTE
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
def api_gerente_carteira(request):
    """
    Resumo da carteira de clientes por vendedor da unidade.
    Retorna métricas de faturamento e clientes por vendedor.
    Apenas gerente e diretor.
    """
    from .models import Usuario, PedidoVenda
    from django.db.models import Sum, Count, Max

    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    hoje = timezone.now()

    vendedores = Usuario.objects.filter(
        empresa_id=empresa_id, nivel='vendedor', is_active=True
    ).order_by('first_name', 'username')

    resultado = []
    for v in vendedores:
        total_clientes = Cliente.objects.filter(
            empresa_id=empresa_id, vendedor_responsavel=v, ativo=True
        ).count()

        pedidos_qs = PedidoVenda.objects.filter(
            empresa_id=empresa_id, vendedor=v,
            status__in=['aprovado', 'faturado'],
        )
        stats_total = pedidos_qs.aggregate(
            faturamento_total=Sum('valor_total'),
            total_pedidos=Count('id'),
            ultimo_pedido=Max('data_pedido'),
        )
        stats_mes = pedidos_qs.filter(
            data_pedido__year=hoje.year, data_pedido__month=hoje.month,
        ).aggregate(
            faturamento_mes=Sum('valor_total'),
            pedidos_mes=Count('id'),
        )

        resultado.append({
            'vendedor_id': v.id,
            'vendedor': v.get_full_name() or v.username,
            'total_clientes_carteira': total_clientes,
            'faturamento_mes': float(stats_mes['faturamento_mes'] or 0),
            'pedidos_mes': stats_mes['pedidos_mes'] or 0,
            'faturamento_total': float(stats_total['faturamento_total'] or 0),
            'total_pedidos': stats_total['total_pedidos'] or 0,
            'ultimo_pedido': stats_total['ultimo_pedido'],
        })

    return Response(resultado)


@api_view(['PATCH'])
def api_gerente_redistribuir_carteira(request):
    """
    Reatribui um cliente a outro vendedor (ou remove atribuição).
    Body: {cliente_id, vendedor_id}  — omitir vendedor_id para desatribuir.
    Apenas gerente e diretor.
    """
    from .models import Usuario

    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    cliente_id = request.data.get('cliente_id')
    vendedor_id = request.data.get('vendedor_id')

    if not cliente_id:
        return Response({'erro': 'Informe cliente_id.'}, status=400)

    try:
        cliente = Cliente.objects.get(id=cliente_id, empresa_id=empresa_id)
    except Cliente.DoesNotExist:
        return Response({'erro': 'Cliente não encontrado.'}, status=404)

    anterior_nome = (
        cliente.vendedor_responsavel.get_full_name() or cliente.vendedor_responsavel.username
        if cliente.vendedor_responsavel else 'Sem responsável'
    )

    if vendedor_id:
        try:
            vendedor = Usuario.objects.get(
                id=vendedor_id, empresa_id=empresa_id, nivel='vendedor'
            )
        except Usuario.DoesNotExist:
            return Response({'erro': 'Vendedor não encontrado nesta empresa.'}, status=404)
        cliente.vendedor_responsavel = vendedor
        novo_nome = vendedor.get_full_name() or vendedor.username
    else:
        cliente.vendedor_responsavel = None
        novo_nome = 'Sem responsável'

    cliente.save(update_fields=['vendedor_responsavel'])

    LogAuditoria.registrar(
        empresa=cliente.empresa,
        usuario=request.user,
        acao='transferencia_carteira',
        modelo_afetado='Cliente',
        registro_id=cliente.id,
        valor_anterior=anterior_nome,
        valor_novo=novo_nome,
        descricao=f'Carteira de {cliente.nome_razao} reatribuída: {anterior_nome} → {novo_nome}',
        request=request,
    )
    LogComportamental.registrar(
        request=request,
        acao='alterou_cadastro',
        descricao=f'Reatribuiu carteira de {cliente.nome_razao} para {novo_nome}',
        modelo_afetado='Cliente',
        id_afetado=cliente.id,
    )

    return Response({'mensagem': f'Carteira de {cliente.nome_razao} reatribuída para {novo_nome}.'})


@api_view(['GET'])
def api_gerente_agenda(request):
    """
    Agenda do time: clientes em alerta de recompra por vendedor.
    Inclui apenas clientes com vendedor_responsavel atribuído.
    Apenas gerente e diretor.
    """
    from .models import Empresa, PedidoVenda
    from django.db.models import Max

    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    hoje = timezone.now().date()

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        prazo_padrao = empresa.prazo_recompra_padrao or 30
    except Empresa.DoesNotExist:
        prazo_padrao = 30

    clientes = (
        Cliente.objects
        .filter(empresa_id=empresa_id, ativo=True, vendedor_responsavel__isnull=False)
        .select_related('vendedor_responsavel')
        .annotate(
            ultima_compra=Max(
                'pedidovenda__data_pedido',
                filter=Q(pedidovenda__status__in=['aprovado', 'faturado'])
            )
        )
    )

    agenda = {}
    for cliente in clientes:
        dias = (hoje - cliente.ultima_compra.date()).days if cliente.ultima_compra else None
        prazo = cliente.prazo_recompra or prazo_padrao
        if dias is None or dias < prazo:
            continue
        v_id = cliente.vendedor_responsavel_id
        if v_id not in agenda:
            v = cliente.vendedor_responsavel
            agenda[v_id] = {
                'vendedor_id': v_id,
                'vendedor': v.get_full_name() or v.username,
                'clientes_pendentes': [],
            }
        agenda[v_id]['clientes_pendentes'].append({
            'cliente_id': cliente.id,
            'nome': cliente.nome_razao,
            'dias_sem_comprar': dias,
            'prazo_recompra': prazo,
            'telefone': cliente.telefone,
        })

    resultado = sorted(
        agenda.values(),
        key=lambda x: len(x['clientes_pendentes']),
        reverse=True,
    )
    return Response(list(resultado))


# ══════════════════════════════════════════════════════════════════════════════
# METAS DE VENDEDOR
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
def api_vendedor_metas(request):
    """
    Retorna meta e faturamento realizado do vendedor logado.
    Apenas nivel='vendedor'. Filtros: ?mes=3&ano=2026
    """
    from django.db.models import Sum

    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'vendedor':
        return Response({'erro': 'Acesso restrito a vendedores.'}, status=403)

    empresa_id = _get_empresa_id(request)
    hoje = timezone.now()
    mes = int(request.query_params.get('mes', hoje.month))
    ano = int(request.query_params.get('ano', hoje.year))

    try:
        meta_obj = MetaVendedor.objects.get(
            usuario=request.user, empresa_id=empresa_id, mes=mes, ano=ano
        )
        valor_meta = float(meta_obj.valor_meta)
    except MetaVendedor.DoesNotExist:
        valor_meta = None

    faturado = float(
        PedidoVenda.objects.filter(
            empresa_id=empresa_id,
            vendedor=request.user,
            status__in=['aprovado', 'faturado'],
            data_pedido__year=ano,
            data_pedido__month=mes,
        ).aggregate(total=Sum('valor_total'))['total'] or 0
    )

    percentual = round(faturado / valor_meta * 100, 1) if valor_meta else None

    return Response({
        'mes': mes,
        'ano': ano,
        'valor_meta': valor_meta,
        'faturamento_realizado': faturado,
        'percentual_atingido': percentual,
        'meta_atingida': percentual >= 100 if percentual is not None else False,
    })


@api_view(['GET', 'POST'])
def api_gerente_metas(request):
    """
    GET  — lista metas + realizado de todos os vendedores. ?mes=&ano=
    POST — define/atualiza meta de um vendedor.
           Body: {usuario_id, mes, ano, valor_meta}
    Apenas gerente e diretor.
    """
    from .models import Usuario
    from django.db.models import Sum

    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    hoje = timezone.now()

    if request.method == 'GET':
        mes = int(request.query_params.get('mes', hoje.month))
        ano = int(request.query_params.get('ano', hoje.year))

        vendedores = Usuario.objects.filter(
            empresa_id=empresa_id, nivel='vendedor', is_active=True
        ).order_by('first_name', 'username')

        resultado = []
        for v in vendedores:
            try:
                meta_obj = MetaVendedor.objects.get(
                    usuario=v, empresa_id=empresa_id, mes=mes, ano=ano
                )
                valor_meta = float(meta_obj.valor_meta)
                meta_id = meta_obj.id
            except MetaVendedor.DoesNotExist:
                valor_meta = None
                meta_id = None

            faturado = float(
                PedidoVenda.objects.filter(
                    empresa_id=empresa_id,
                    vendedor=v,
                    status__in=['aprovado', 'faturado'],
                    data_pedido__year=ano,
                    data_pedido__month=mes,
                ).aggregate(total=Sum('valor_total'))['total'] or 0
            )

            percentual = round(faturado / valor_meta * 100, 1) if valor_meta else None

            resultado.append({
                'meta_id': meta_id,
                'vendedor_id': v.id,
                'vendedor': v.get_full_name() or v.username,
                'mes': mes,
                'ano': ano,
                'valor_meta': valor_meta,
                'faturamento_realizado': faturado,
                'percentual_atingido': percentual,
                'meta_atingida': percentual >= 100 if percentual is not None else False,
            })

        return Response(resultado)

    # POST — define/atualiza
    from .models import Usuario
    d = request.data
    usuario_id = d.get('usuario_id')
    mes = d.get('mes')
    ano = d.get('ano')
    valor_meta = d.get('valor_meta')

    if not all([usuario_id, mes, ano, valor_meta]):
        return Response({'erro': 'Campos obrigatórios: usuario_id, mes, ano, valor_meta.'}, status=400)

    try:
        usuario = Usuario.objects.get(id=usuario_id, empresa_id=empresa_id, nivel='vendedor')
    except Usuario.DoesNotExist:
        return Response({'erro': 'Vendedor não encontrado nesta empresa.'}, status=404)

    try:
        valor_meta = Decimal(str(valor_meta))
        if valor_meta <= 0:
            raise ValueError
    except (ValueError, TypeError, InvalidOperation):
        return Response({'erro': 'valor_meta deve ser um número positivo.'}, status=400)

    meta, criada = MetaVendedor.objects.update_or_create(
        usuario=usuario,
        empresa_id=empresa_id,
        mes=int(mes),
        ano=int(ano),
        defaults={'valor_meta': valor_meta},
    )

    LogAuditoria.registrar(
        empresa=usuario.empresa,
        usuario=request.user,
        acao='alteracao_usuario',
        modelo_afetado='MetaVendedor',
        registro_id=meta.id,
        descricao=f'Meta de {usuario.get_full_name() or usuario.username} — {mes}/{ano}: R$ {valor_meta}',
        request=request,
    )

    return Response(
        {'id': meta.id, 'mensagem': 'Meta ' + ('definida' if criada else 'atualizada') + ' com sucesso.'},
        status=201 if criada else 200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# CRM — VISITAS A CLIENTES
# ══════════════════════════════════════════════════════════════════════════════

def _visita_to_dict(v):
    return {
        'id': v.id,
        'vendedor_id': v.vendedor_id,
        'vendedor': v.vendedor.get_full_name() or v.vendedor.username,
        'cliente_id': v.cliente_id,
        'cliente': v.cliente.nome_razao,
        'tipo': v.tipo,
        'tipo_display': v.get_tipo_display(),
        'data_visita': v.data_visita,
        'observacoes': v.observacoes,
        'resultado': v.resultado,
        'resultado_display': v.get_resultado_display(),
        'proximo_contato': v.proximo_contato,
        'criado_em': v.criado_em,
    }


@api_view(['GET', 'POST'])
def api_visitas_crm(request):
    """
    GET  — lista visitas. Vendedor só vê as suas; gerente/diretor vê todas da unidade.
           Filtros: ?cliente_id=&vendedor_id=
    POST — registra nova visita.
           Body: {cliente_id, tipo, data_visita, observacoes, resultado, proximo_contato}
    Bloqueado para operacional.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel == 'operacional':
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)

    if request.method == 'GET':
        qs = VisitaCliente.objects.filter(empresa_id=empresa_id).select_related('vendedor', 'cliente')

        if nivel == 'vendedor':
            qs = qs.filter(vendedor=request.user)

        cliente_id = request.query_params.get('cliente_id')
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)

        vendedor_id = request.query_params.get('vendedor_id')
        if vendedor_id and nivel in ['diretor', 'gerente']:
            qs = qs.filter(vendedor_id=vendedor_id)

        return Response([_visita_to_dict(v) for v in qs])

    # POST
    cliente_id = request.data.get('cliente_id')
    data_visita = request.data.get('data_visita')
    if not cliente_id or not data_visita:
        return Response({'erro': 'Campos obrigatórios: cliente_id, data_visita.'}, status=400)

    try:
        cliente = Cliente.objects.get(id=cliente_id, empresa_id=empresa_id)
    except Cliente.DoesNotExist:
        return Response({'erro': 'Cliente não encontrado.'}, status=404)

    if nivel == 'vendedor':
        na_carteira = Cliente.objects.filter(
            id=cliente_id, empresa_id=empresa_id
        ).filter(
            Q(vendedor_responsavel=request.user) |
            Q(pedidovenda__vendedor=request.user)
        ).exists()
        if not na_carteira:
            return Response({'erro': 'Este cliente não pertence à sua carteira.'}, status=403)

    visita = VisitaCliente.objects.create(
        empresa_id=empresa_id,
        vendedor=request.user,
        cliente=cliente,
        tipo=request.data.get('tipo', 'presencial'),
        data_visita=data_visita,
        observacoes=request.data.get('observacoes', ''),
        resultado=request.data.get('resultado', 'neutro'),
        proximo_contato=request.data.get('proximo_contato') or None,
    )

    LogComportamental.registrar(
        request=request,
        acao='alterou_cadastro',
        descricao=f'Visita registrada: {cliente.nome_razao} ({visita.get_tipo_display()})',
        modelo_afetado='VisitaCliente',
        id_afetado=visita.id,
    )

    return Response({'id': visita.id, 'mensagem': 'Visita registrada com sucesso.'}, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
def api_visita_detalhe(request, visita_id):
    """
    GET    — detalhe completo.
    PATCH  — edita observações, resultado, tipo ou próximo contato.
    DELETE — remove (vendedor só remove as suas; gerente/diretor removem qualquer).
    Bloqueado para operacional.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel == 'operacional':
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)

    try:
        visita = VisitaCliente.objects.select_related('vendedor', 'cliente').get(
            id=visita_id, empresa_id=empresa_id
        )
    except VisitaCliente.DoesNotExist:
        return Response({'erro': 'Visita não encontrada.'}, status=404)

    if nivel == 'vendedor' and visita.vendedor != request.user:
        return Response({'erro': 'Acesso negado.'}, status=403)

    if request.method == 'GET':
        return Response(_visita_to_dict(visita))

    if request.method == 'PATCH':
        for campo in ('observacoes', 'resultado', 'proximo_contato', 'tipo', 'data_visita'):
            if campo in request.data:
                setattr(visita, campo, request.data[campo] or None if campo == 'proximo_contato' else request.data[campo])
        visita.save()
        return Response({'mensagem': 'Visita atualizada.'})

    # DELETE
    visita.delete()
    return Response({'mensagem': 'Visita removida.'})


# ══════════════════════════════════════════════════════════════════════════════
# 2FA — AUTENTICAÇÃO DE DOIS FATORES
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
def api_2fa_habilitar(request):
    """Gera segredo TOTP e retorna URI para QR Code. Não ativa ainda."""
    import pyotp
    user = request.user
    secret = pyotp.random_base32()
    user.totp_secret = secret
    user.totp_habilitado = False
    user.save(update_fields=['totp_secret', 'totp_habilitado'])
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email or user.username, issuer_name='AgroPulse')
    return Response({'secret': secret, 'uri': uri})


@api_view(['POST'])
def api_2fa_confirmar(request):
    """Verifica código e ativa 2FA definitivamente."""
    import pyotp
    user = request.user
    if not user.totp_secret:
        return Response({'erro': 'Inicie o processo de habilitação primeiro.'}, status=400)
    code = request.data.get('code', '').strip()
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code, valid_window=1):
        return Response({'erro': 'Código inválido. Tente novamente.'}, status=400)
    user.totp_habilitado = True
    user.save(update_fields=['totp_habilitado'])
    return Response({'mensagem': '2FA ativado com sucesso.'})


@api_view(['POST'])
def api_2fa_desabilitar(request):
    """Desativa 2FA. Exige confirmação com o código atual."""
    import pyotp
    user = request.user
    if not user.totp_habilitado:
        return Response({'erro': '2FA não está ativo.'}, status=400)
    code = request.data.get('code', '').strip()
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code, valid_window=1):
        return Response({'erro': 'Código inválido.'}, status=400)
    user.totp_secret = None
    user.totp_habilitado = False
    user.save(update_fields=['totp_secret', 'totp_habilitado'])
    return Response({'mensagem': '2FA desativado.'})


@api_view(['GET'])
def api_2fa_status(request):
    """Retorna se 2FA está habilitado para o usuário autenticado."""
    return Response({'totp_habilitado': bool(getattr(request.user, 'totp_habilitado', False))})


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURAÇÕES COMERCIAIS DA EMPRESA
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET', 'PATCH'])
def api_config_comercial(request):
    """
    Lê e atualiza configurações comerciais da empresa.
    Apenas diretor pode alterar.
    Campos gerenciados: prazo_recompra_padrao, prazo_expiracao_pedido, comissao_padrao.
    """
    empresa_id = _get_empresa_id(request)
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)

    if request.method == 'GET':
        return Response({
            'prazo_recompra_padrao': empresa.prazo_recompra_padrao,
            'prazo_expiracao_pedido': empresa.prazo_expiracao_pedido,
            'comissao_padrao': float(empresa.comissao_padrao),
        })

    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Apenas o Diretor pode alterar configurações comerciais.'}, status=403)

    campos_permitidos = ['prazo_recompra_padrao', 'prazo_expiracao_pedido', 'comissao_padrao']
    update_fields = []
    erros = {}

    for campo in campos_permitidos:
        if campo in request.data:
            valor = request.data[campo]
            if campo == 'comissao_padrao':
                try:
                    valor = Decimal(str(valor))
                    if valor < 0 or valor > 100:
                        raise ValueError
                except (ValueError, TypeError, Decimal.InvalidOperation):
                    erros[campo] = 'Deve ser um número entre 0 e 100.'
                    continue
            else:
                try:
                    valor = int(valor)
                    if valor < 1:
                        raise ValueError
                except (ValueError, TypeError):
                    erros[campo] = 'Deve ser um inteiro maior que zero.'
                    continue
            setattr(empresa, campo, valor)
            update_fields.append(campo)

    if erros:
        return Response({'erros': erros}, status=400)

    if update_fields:
        empresa.save(update_fields=update_fields)

    return Response({
        'prazo_recompra_padrao': empresa.prazo_recompra_padrao,
        'prazo_expiracao_pedido': empresa.prazo_expiracao_pedido,
        'comissao_padrao': float(empresa.comissao_padrao),
        'mensagem': 'Configurações atualizadas.',
    })


@api_view(['GET'])
def api_auditoria_comercial(request):
    """Lista logs de auditoria da empresa. Apenas diretor e superadmin (is_staff)."""
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)
    is_staff = getattr(request.user, 'is_staff', False)
    if nivel != 'diretor' and not is_staff:
        return Response({'erro': 'Acesso negado. Apenas o CEO e o superadmin.'}, status=403)

    limite = request.query_params.get('limit', 100)
    try:
        limite = min(max(int(limite), 1), 200)
    except (ValueError, TypeError):
        limite = 100

    logs = LogAuditoria.objects.filter(empresa_id=empresa_id).select_related('usuario').order_by('-data_hora')[:limite]
    serializer = LogAuditoriaSerializer(logs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def api_log_comportamental(request):
    """
    Lista logs comportamentais da empresa.
    Diretor sempre tem acesso. Outros precisam do switch ver_log_comportamental.
    Filtros: ?usuario_id=X&acao=Y&limit=100
    """
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)

    tem_acesso = nivel == 'diretor'
    if not tem_acesso:
        perm = _get_perm(request.user)
        tem_acesso = perm is not None and perm.ver_log_comportamental
    if not tem_acesso:
        return Response({'erro': 'Acesso negado.'}, status=403)

    try:
        limite = min(max(int(request.query_params.get('limit', 100)), 1), 500)
    except (ValueError, TypeError):
        limite = 100

    qs = LogComportamental.objects.filter(empresa_id=empresa_id).select_related('usuario').order_by('-data_hora')

    usuario_id = request.query_params.get('usuario_id')
    if usuario_id:
        qs = qs.filter(usuario_id=usuario_id)

    acao = request.query_params.get('acao')
    if acao:
        qs = qs.filter(acao=acao)

    return Response([{
        'id': l.id,
        'usuario_id': l.usuario_id,
        'usuario': l.usuario.get_full_name() or l.usuario.username if l.usuario else None,
        'acao': l.acao,
        'acao_display': l.get_acao_display(),
        'descricao': l.descricao,
        'modelo_afetado': l.modelo_afetado,
        'id_afetado': l.id_afetado,
        'valor_anterior': l.valor_anterior,
        'valor_novo': l.valor_novo,
        'ip_address': l.ip_address,
        'data_hora': l.data_hora,
    } for l in qs[:limite]])


@api_view(['GET'])
def api_empresas_acessiveis(request):
    """
    Retorna a empresa do usuário logado e, se for diretor de uma matriz,
    também todas as filiais. Se tiver empresas_adicionais configuradas pelo
    CEO, essas também são incluídas. Usado pelo frontend para montar o seletor de contexto.
    """
    if not request.user.is_authenticated or not getattr(request.user, 'empresa', None):
        return Response({'erro': 'Usuário sem empresa vinculada.'}, status=400)

    empresa = request.user.empresa
    ids_incluidos = {empresa.id}
    resultado = [{
        'id': empresa.id,
        'nome': empresa.nome,
        'tipo': 'matriz' if empresa.is_matriz else ('filial' if empresa.is_filial else 'standalone'),
        'current': True,
    }]

    if getattr(request.user, 'nivel', None) == 'diretor' and empresa.is_matriz:
        for filial in empresa.filiais.all().order_by('nome'):
            if filial.id not in ids_incluidos:
                ids_incluidos.add(filial.id)
                resultado.append({
                    'id': filial.id,
                    'nome': filial.nome,
                    'tipo': 'filial',
                    'current': False,
                })

    # Empresas adicionais concedidas pelo CEO
    from .models import PermissaoGranular
    perm = PermissaoGranular.objects.filter(usuario=request.user).first()
    if perm:
        for emp_adicional in perm.empresas_adicionais.order_by('nome'):
            if emp_adicional.id not in ids_incluidos:
                ids_incluidos.add(emp_adicional.id)
                resultado.append({
                    'id': emp_adicional.id,
                    'nome': emp_adicional.nome,
                    'tipo': 'adicional',
                    'current': False,
                })

    return Response(resultado)


# ══════════════════════════════════════════════════════════════════════════════
# DATAS COMEMORATIVAS
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET', 'POST'])
def api_datas_comemorativas(request):
    """Lista e cria datas comemorativas. Apenas diretor e gerente podem criar."""
    from .models import DataComemorativa, Usuario
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)

    if request.method == 'GET':
        qs = DataComemorativa.objects.filter(empresa_id=empresa_id).prefetch_related('vendedores')
        dados = []
        for d in qs:
            dados.append({
                'id': d.id,
                'nome': d.nome,
                'dia': d.dia,
                'mes': d.mes,
                'dias_antecedencia': d.dias_antecedencia,
                'para_todos_vendedores': d.para_todos_vendedores,
                'vendedores': list(d.vendedores.values('id', 'nome')),
                'ativo': d.ativo,
            })
        return Response(dados)

    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    nome = request.data.get('nome', '').strip()
    dia = request.data.get('dia')
    mes = request.data.get('mes')
    if not nome or not dia or not mes:
        return Response({'erro': 'Campos obrigatórios: nome, dia, mes.'}, status=400)

    try:
        dia, mes = int(dia), int(mes)
        if not (1 <= dia <= 31 and 1 <= mes <= 12):
            raise ValueError
    except (ValueError, TypeError):
        return Response({'erro': 'dia e mes devem ser inteiros válidos.'}, status=400)

    dc, criado = DataComemorativa.objects.get_or_create(
        empresa_id=empresa_id, nome=nome, dia=dia, mes=mes,
        defaults={
            'dias_antecedencia': int(request.data.get('dias_antecedencia', 3)),
            'para_todos_vendedores': request.data.get('para_todos_vendedores', True),
            'ativo': True,
            'criado_por': request.user,
        }
    )
    if not criado:
        return Response({'erro': 'Já existe uma data comemorativa com esse nome, dia e mês.'}, status=400)

    vendedor_ids = request.data.get('vendedores', [])
    if vendedor_ids and not dc.para_todos_vendedores:
        dc.vendedores.set(Usuario.objects.filter(id__in=vendedor_ids, empresa_id=empresa_id))

    return Response({'id': dc.id, 'mensagem': 'Data comemorativa criada.'}, status=201)


@api_view(['PUT', 'PATCH', 'DELETE'])
def api_data_comemorativa_detalhe(request, pk):
    """Edita ou remove uma data comemorativa. Apenas diretor e gerente."""
    from .models import DataComemorativa, Usuario
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    try:
        dc = DataComemorativa.objects.get(id=pk, empresa_id=empresa_id)
    except DataComemorativa.DoesNotExist:
        return Response({'erro': 'Não encontrada.'}, status=404)

    if request.method == 'DELETE':
        dc.delete()
        return Response({'mensagem': 'Removida.'})

    for campo in ['nome', 'dia', 'mes', 'dias_antecedencia', 'para_todos_vendedores', 'ativo']:
        if campo in request.data:
            setattr(dc, campo, request.data[campo])
    dc.save()

    vendedor_ids = request.data.get('vendedores')
    if vendedor_ids is not None and not dc.para_todos_vendedores:
        dc.vendedores.set(Usuario.objects.filter(id__in=vendedor_ids, empresa_id=empresa_id))

    return Response({'mensagem': 'Atualizada.'})


# ══════════════════════════════════════════════════════════════════════════════
# FASE 8 — SPED, EFD-REINF, IMPORTAÇÃO EM LOTE
# ══════════════════════════════════════════════════════════════════════════════

from .importacao_sped import (
    importar_xmls_lote,
    consultar_nfes_sefaz_cnpj,
    gerar_sped_fiscal,
    gerar_efd_reinf_r1000,
    gerar_efd_contribuicoes,
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
    Gera arquivo SPED Fiscal (EFD-ICMS/IPI) ou EFD Contribuições para download.
    ?tipo=sped_fiscal|sped_contribuicoes&mes=3&ano=2026
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    hoje = timezone.now()
    mes  = int(request.query_params.get('mes', hoje.month))
    ano  = int(request.query_params.get('ano', hoje.year))
    tipo = request.query_params.get('tipo', 'sped_fiscal')

    from django.http import HttpResponse
    if tipo == 'sped_contribuicoes':
        conteudo, erro = gerar_efd_contribuicoes(_get_empresa_id(request), mes, ano)
        if erro:
            return Response({'erro': erro}, status=400)
        response = HttpResponse(conteudo, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="EFD_Contribuicoes_{mes:02d}_{ano}.txt"'
        return response

    conteudo, erro = gerar_sped_fiscal(_get_empresa_id(request), mes, ano)
    if erro:
        return Response({'erro': erro}, status=400)
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
# FISCAL — Novos endpoints: Funrural, GNRE, NF-e Complementar, Contingência
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
def api_funrural_calcular(request):
    """
    Calcula Funrural para uma operação agropecuária.
    Body: { "tipo_produtor": "pf"|"pj", "valor_operacao": 1000.00 }
    """
    tipo_produtor  = request.data.get('tipo_produtor', 'pf')
    valor_operacao = Decimal(str(request.data.get('valor_operacao', 0)))

    if tipo_produtor == 'pf':
        aliq_funrural = Decimal('1.2')
        aliq_gilrat   = Decimal('0.1')
        aliq_senar    = Decimal('0.2')
    else:
        aliq_funrural = Decimal('1.5')
        aliq_gilrat   = Decimal('0.1')
        aliq_senar    = Decimal('0.25')

    funrural = (valor_operacao * aliq_funrural / 100).quantize(Decimal('0.01'))
    gilrat   = (valor_operacao * aliq_gilrat   / 100).quantize(Decimal('0.01'))
    senar    = (valor_operacao * aliq_senar    / 100).quantize(Decimal('0.01'))

    return Response({
        'tipo_produtor':     tipo_produtor,
        'valor_operacao':    float(valor_operacao),
        'aliquota_funrural': float(aliq_funrural),
        'aliquota_gilrat':   float(aliq_gilrat),
        'aliquota_senar':    float(aliq_senar),
        'funrural':          float(funrural),
        'gilrat':            float(gilrat),
        'senar':             float(senar),
        'total':             float(funrural + gilrat + senar),
        'liquido_produtor':  float(valor_operacao - funrural - gilrat - senar),
    })


@api_view(['GET'])
def api_gnre_list(request):
    """
    Lista GNREs calculadas para operações interestaduais com ST no mês atual.
    Cada linha usa MVA de 35% (padrão agro) — contador ajusta por NCM/UF.
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)

    empresa_id = _get_empresa_id(request)
    from .models import PedidoVenda, ConfiguracaoFiscal
    import datetime as dt_module

    hoje   = timezone.now().date()
    inicio = hoje.replace(day=1)

    try:
        config = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except ConfiguracaoFiscal.DoesNotExist:
        return Response([])

    pedidos = PedidoVenda.objects.filter(
        empresa_id=empresa_id,
        status='faturado',
        data_pedido__gte=inicio,
    ).select_related('cliente').prefetch_related('itens__produto')

    gnre_rows = []
    for pedido in pedidos:
        uf_destino = getattr(pedido.cliente, 'uf', None)
        if not uf_destino or uf_destino == config.uf:
            continue

        for item in pedido.itens.all():
            produto = item.produto
            if not produto or not produto.ncm:
                continue

            mva = Decimal('35.00')
            subtotal = item.preco_unitario * item.quantidade
            base_st  = subtotal * (1 + mva / 100)
            aliq_interna       = Decimal('17.00')
            aliq_interestadual = Decimal('12.00')
            gnre = base_st * aliq_interna / 100 - subtotal * aliq_interestadual / 100

            if gnre <= 0:
                continue

            vencimento = ''
            if hasattr(pedido.data_pedido, 'strftime'):
                vencimento = (pedido.data_pedido + dt_module.timedelta(days=30)).strftime('%d/%m/%Y')

            gnre_rows.append({
                'nfe_numero':  f"pedido_{pedido.id}",
                'destinatario': pedido.cliente.nome_razao,
                'uf_destino':  uf_destino,
                'ncm':         produto.ncm,
                'mva_pct':     float(mva),
                'base_st':     float(round(base_st, 2)),
                'valor_gnre':  float(round(gnre, 2)),
                'vencimento':  vencimento,
                'pago':        False,
            })

    return Response(gnre_rows)


@api_view(['POST'])
def api_nfe_complementar(request, pedido_id):
    """
    Emite NF-e Complementar (finalidade 3) referenciando a NF-e original.
    Body: { "chave_nfe_original": "...", "motivo": "Complementação de ICMS" }
    """
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Sem permissão para emitir NF-e Complementar.'}, status=403)

    empresa_id = _get_empresa_id(request)
    chave_original = request.data.get('chave_nfe_original', '').strip()
    motivo = request.data.get('motivo', 'Complementação de valores').strip()

    if not chave_original:
        return Response({'erro': 'Informe a chave da NF-e original (campo chave_nfe_original).'}, status=400)

    from .models import PedidoVenda, ConfiguracaoFiscal
    from .fiscal import sugerir_tributacao, calcular_impostos_item
    import requests as req_lib

    try:
        pedido = PedidoVenda.objects.get(id=pedido_id, empresa_id=empresa_id)
    except PedidoVenda.DoesNotExist:
        return Response({'erro': 'Pedido não encontrado.'}, status=404)

    try:
        config = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except ConfiguracaoFiscal.DoesNotExist:
        return Response({'erro': 'Configuração fiscal não encontrada.'}, status=400)

    if not config.focusnfe_token:
        return Response({'erro': 'Token Focus NFe não configurado.'}, status=400)

    base_url = 'https://homologacao.focusnfe.com.br' if config.focusnfe_homologacao else 'https://api.focusnfe.com.br'

    itens_nfe = []
    for item in pedido.itens.all():
        sugestao = sugerir_tributacao(empresa_id, getattr(pedido.cliente, 'endereco', None) or config.uf, item.produto)
        impostos = calcular_impostos_item(
            preco_unitario=item.preco_unitario, quantidade=item.quantidade,
            regime=config.regime_tributario,
            aliquota_icms=sugestao.get('aliquota_icms', 12),
            cst_pis=sugestao.get('cst_pis', '07'), aliquota_pis=sugestao.get('aliquota_pis', 0),
            cst_cofins=sugestao.get('cst_cofins', '07'), aliquota_cofins=sugestao.get('aliquota_cofins', 0),
        )
        itens_nfe.append({
            'numero_item': len(itens_nfe) + 1,
            'codigo_produto': item.produto.sku, 'descricao': item.produto.nome,
            'ncm': item.produto.ncm or '00000000',
            'cfop': sugestao.get('cfop_sugerido', '5102'),
            'unidade_comercial': item.produto.unidade_medida,
            'quantidade_comercial': float(item.quantidade),
            'valor_unitario_comercial': float(item.preco_unitario),
            'valor_bruto': float(impostos['subtotal']),
            'origem': item.produto.origem,
            'icms_situacao_tributaria': sugestao.get('csosn') or sugestao.get('cst_icms', '102'),
            'icms_aliquota': float(sugestao.get('aliquota_icms', 0)),
            'icms_base_calculo': float(impostos['subtotal']),
            'icms_valor': float(impostos['valor_icms']),
            'pis_situacao_tributaria': sugestao.get('cst_pis', '07'),
            'pis_aliquota_percentual': float(sugestao.get('aliquota_pis', 0)),
            'pis_base_calculo': float(impostos['subtotal']),
            'pis_valor': float(impostos['valor_pis']),
            'cofins_situacao_tributaria': sugestao.get('cst_cofins', '07'),
            'cofins_aliquota_percentual': float(sugestao.get('aliquota_cofins', 0)),
            'cofins_base_calculo': float(impostos['subtotal']),
            'cofins_valor': float(impostos['valor_cofins']),
        })

    payload = {
        'natureza_operacao': motivo,
        'finalidade_emissao': '3',  # NF-e complementar
        'tipo_documento': '1',
        'local_destino': '1',
        'codigo_municipio_fato_gerador': '3550308',
        'tipo_impressao_danfe': '1',
        'processo_emissao': '0',
        'chave_nfe_referenciada': chave_original,
        'cnpj_emitente': config.cnpj,
        'nome_emitente': pedido.empresa.nome,
        'regime_tributario_emitente': config.crt,
        'cpf_cnpj_destinatario': pedido.cliente.cnpj_cpf,
        'nome_destinatario': pedido.cliente.nome_razao,
        'items': itens_nfe,
    }

    try:
        ref = f"complementar_{pedido_id}"
        response = req_lib.post(
            f"{base_url}/v2/nfe?ref={ref}",
            json=payload,
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except Exception as e:
        return Response({'erro': f'Erro de comunicação com Focus NFe: {str(e)}'}, status=500)

    if response.status_code in (200, 201):
        return Response({
            'status': data.get('status'),
            'chave_nfe': data.get('chave_nfe'),
            'numero': data.get('numero'),
            'serie': data.get('serie'),
            'mensagem': 'NF-e Complementar enviada para processamento.',
        })
    return Response({'erro': data.get('mensagem', 'Erro ao emitir NF-e Complementar.')}, status=400)


@api_view(['GET'])
def api_contingencia_status(request):
    """
    Retorna status de contingência SEFAZ com cronômetro legal de 168h.
    Usa a NF-e mais antiga em contingência como referência do prazo.
    """
    empresa_id = _get_empresa_id(request)
    from .models import NotaFiscal

    qs = NotaFiscal.objects.filter(empresa_id=empresa_id, status='contingencia').order_by('data_emissao')
    total_pendentes = qs.count()
    primeira = qs.first()

    if primeira and primeira.data_emissao:
        ativada_em = primeira.data_emissao
        horas_desde_ativacao = (timezone.now() - ativada_em).total_seconds() / 3600
        horas_restantes = max(0.0, 168.0 - horas_desde_ativacao)
        modo = primeira.modo_contingencia or 'FSDA'
        modo_display = dict(NotaFiscal.MODO_CONTINGENCIA_CHOICES).get(modo, modo)
        return Response({
            'sefaz_status': 'offline',
            'contingencia_ativa': True,
            'modo_contingencia': modo,
            'modo_contingencia_display': modo_display,
            'total_nfe_pendentes': total_pendentes,
            'ativada_em': ativada_em.isoformat(),
            'horas_desde_ativacao': round(horas_desde_ativacao, 1),
            'horas_restantes': round(horas_restantes, 1),
            'alerta_critico': horas_restantes < 24,
        })

    return Response({
        'sefaz_status': 'online',
        'contingencia_ativa': False,
        'total_nfe_pendentes': 0,
        'horas_restantes': None,
    })


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


class FornecedorViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = FornecedorSerializer
    export_titulo = 'Fornecedores'
    export_filename = 'fornecedores'
    export_colunas = [
        (lambda o: o.nome_razao,   'Nome / Razão Social'),
        (lambda o: o.cnpj or '',   'CNPJ'),
    ]

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        qs = Fornecedor.objects.filter(empresa_id=empresa_id)
        busca = self.request.query_params.get('busca')
        if busca:
            qs = qs.filter(
                Q(nome_razao__icontains=busca) | Q(cnpj__icontains=busca)
            )
        return qs.order_by('nome_razao')

    def _tem_permissao_edicao(self, request):
        nivel = getattr(request.user, 'nivel', None)
        if nivel in ['diretor', 'gerente']:
            return True
        perm = _get_perm(request.user)
        return perm is not None and perm.editar_clientes

    def create(self, request, *args, **kwargs):
        if not self._tem_permissao_edicao(request):
            return Response({'erro': 'Sem permissão para criar fornecedores.'}, status=403)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        empresa_id = _get_empresa_id(self.request)
        serializer.save(empresa_id=empresa_id)
        LogComportamental.registrar(
            request=self.request,
            acao='alterou_cadastro',
            descricao=f'Fornecedor "{serializer.instance.nome_razao}" criado',
            modelo_afetado='Fornecedor',
            id_afetado=serializer.instance.id,
        )

    def update(self, request, *args, **kwargs):
        if not self._tem_permissao_edicao(request):
            return Response({'erro': 'Sem permissão para editar fornecedores.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def perform_update(self, serializer):
        obj = self.get_object()
        serializer.save(empresa_id=_get_empresa_id(self.request))
        LogComportamental.registrar(
            request=self.request,
            acao='alterou_cadastro',
            descricao=f'Fornecedor "{obj.nome_razao}" editado',
            modelo_afetado='Fornecedor',
            id_afetado=obj.id,
        )


class TabelaPrecoViewSet(viewsets.ModelViewSet):
    serializer_class = TabelaPrecoSerializer

    def get_queryset(self):
        empresa_id = _get_empresa_id(self.request)
        return TabelaPreco.objects.filter(empresa_id=empresa_id).order_by('nome')

    def _check_write(self, request):
        nivel = getattr(request.user, 'nivel', None)
        if nivel not in ['diretor', 'gerente']:
            return Response({'erro': 'Apenas diretor ou gerente pode alterar tabelas de preço.'}, status=403)
        return None

    def create(self, request, *args, **kwargs):
        err = self._check_write(request)
        if err:
            return err
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(empresa_id=_get_empresa_id(self.request))

    def update(self, request, *args, **kwargs):
        err = self._check_write(request)
        if err:
            return err
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        err = self._check_write(request)
        if err:
            return err
        return super().destroy(request, *args, **kwargs)


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
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Apenas diretor ou gerente pode alterar itens de tabela de preço.'}, status=403)
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

# ══════════════════════════════════════════════════════════════════════════════
# COBRANÇA E CRÉDITO RURAL
# ══════════════════════════════════════════════════════════════════════════════

from .credito_cobranca import (
    calcular_score_cliente,
    calcular_aging_carteira,
    painel_carteira,
    calcular_pdd,
    gerar_lista_cobranca_diaria,
    gerar_pacote_juridico,
    aprovar_ficha_credito,
    recusar_ficha_credito,
    registrar_snapshot_inadimplencia,
    listar_historico_inadimplencia,
)


@api_view(['GET'])
def api_credito_painel(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    return Response(painel_carteira(_get_empresa_id(request)))


@api_view(['GET'])
def api_credito_aging(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    return Response(calcular_aging_carteira(_get_empresa_id(request)))


@api_view(['GET'])
def api_credito_pdd(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    return Response(calcular_pdd(_get_empresa_id(request)))


@api_view(['GET'])
def api_credito_score(request, cliente_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import ScoreCredito
    empresa_id = _get_empresa_id(request)
    try:
        score = ScoreCredito.objects.get(empresa_id=empresa_id, cliente_id=cliente_id)
        return Response({
            'cliente_id':                  cliente_id,
            'score_total':                 float(score.score_total),
            'classificacao':               score.classificacao,
            'score_historico_pagamento':   float(score.score_historico_pagamento),
            'score_tempo_relacionamento':  float(score.score_tempo_relacionamento),
            'score_volume_compras':        float(score.score_volume_compras),
            'score_dados_cadastrais':      float(score.score_dados_cadastrais),
            'calculado_em':                score.calculado_em.strftime('%d/%m/%Y %H:%M'),
        })
    except ScoreCredito.DoesNotExist:
        return Response({'erro': 'Score não calculado ainda. Use POST /recalcular/'}, status=404)


@api_view(['POST'])
def api_credito_score_recalcular(request, cliente_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    resultado, erro = calcular_score_cliente(_get_empresa_id(request), cliente_id)
    if erro:
        return Response({'erro': erro}, status=400)
    return Response(resultado)


@api_view(['GET', 'POST'])
def api_credito_fichas(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    from .models import FichaAnaliseCredito, Cliente

    if request.method == 'GET':
        fichas = FichaAnaliseCredito.objects.filter(empresa_id=empresa_id).select_related('cliente', 'analista', 'aprovado_por')
        return Response([{
            'id':               f.id,
            'cliente':          f.cliente.nome_fantasia or f.cliente.nome_razao,
            'cliente_id':       f.cliente_id,
            'status':           f.status,
            'limite_solicitado': float(f.limite_solicitado),
            'limite_aprovado':  float(f.limite_aprovado) if f.limite_aprovado else None,
            'analista':         f.analista.nome if f.analista else None,
            'aprovado_por':     f.aprovado_por.nome if f.aprovado_por else None,
            'proxima_revisao':  f.proxima_revisao.strftime('%d/%m/%Y') if f.proxima_revisao else None,
            'criado_em':        f.criado_em.strftime('%d/%m/%Y'),
            'cultura_principal': f.cultura_principal,
            'area_plantada_ha': float(f.area_plantada_ha) if f.area_plantada_ha else None,
        } for f in fichas])

    # POST — cria nova ficha
    data = request.data
    try:
        cliente = Cliente.objects.get(id=data['cliente_id'], empresa_id=empresa_id)
    except Cliente.DoesNotExist:
        return Response({'erro': 'Cliente não encontrado.'}, status=404)

    ficha = FichaAnaliseCredito.objects.create(
        empresa_id=empresa_id,
        cliente=cliente,
        analista=request.user,
        area_plantada_ha=data.get('area_plantada_ha'),
        cultura_principal=data.get('cultura_principal', ''),
        produtividade_historica=data.get('produtividade_historica', ''),
        renda_estimada_anual=data.get('renda_estimada_anual'),
        endividamento_declarado=data.get('endividamento_declarado', 0),
        garantias=data.get('garantias', ''),
        limite_solicitado=data['limite_solicitado'],
        proxima_revisao=data.get('proxima_revisao'),
        observacoes=data.get('observacoes', ''),
    )
    return Response({'id': ficha.id, 'mensagem': 'Ficha criada.'}, status=201)


@api_view(['POST'])
def api_credito_ficha_aprovar(request, ficha_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado. Apenas gerente ou diretor podem aprovar.'}, status=403)
    limite = request.data.get('limite_aprovado')
    if not limite:
        return Response({'erro': 'Informe limite_aprovado.'}, status=400)
    ok, resultado = aprovar_ficha_credito(
        _get_empresa_id(request), ficha_id, request.user, limite,
        request.data.get('observacoes', ''),
    )
    if not ok:
        return Response({'erro': resultado}, status=400)
    return Response(resultado)


@api_view(['POST'])
def api_credito_ficha_recusar(request, ficha_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    motivo = request.data.get('motivo', '').strip()
    if len(motivo) < 10:
        return Response({'erro': 'Informe o motivo (mín. 10 caracteres).'}, status=400)
    ok, msg = recusar_ficha_credito(_get_empresa_id(request), ficha_id, request.user, motivo)
    if not ok:
        return Response({'erro': msg}, status=400)
    return Response({'mensagem': msg})


@api_view(['GET'])
def api_credito_lista_cobranca(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    return Response(gerar_lista_cobranca_diaria(_get_empresa_id(request)))


@api_view(['POST'])
def api_credito_registrar_tentativa(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    from .models import TentativaCobranca, Cliente, ContaReceber

    data = request.data
    try:
        cliente = Cliente.objects.get(id=data['cliente_id'], empresa_id=empresa_id)
    except Cliente.DoesNotExist:
        return Response({'erro': 'Cliente não encontrado.'}, status=404)

    conta = None
    if data.get('conta_receber_id'):
        try:
            conta = ContaReceber.objects.get(id=data['conta_receber_id'], empresa_id=empresa_id)
        except ContaReceber.DoesNotExist:
            pass

    t = TentativaCobranca.objects.create(
        empresa_id=empresa_id,
        cliente=cliente,
        conta_receber=conta,
        usuario=request.user,
        tipo_contato=data['tipo_contato'],
        resultado=data['resultado'],
        observacao=data.get('observacao', ''),
        proxima_acao=data.get('proxima_acao', ''),
        proxima_acao_data=data.get('proxima_acao_data'),
    )
    return Response({'id': t.id, 'mensagem': 'Tentativa registrada.'}, status=201)


@api_view(['GET'])
def api_credito_tentativas_cliente(request, cliente_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import TentativaCobranca
    tentativas = TentativaCobranca.objects.filter(
        empresa_id=_get_empresa_id(request), cliente_id=cliente_id
    ).select_related('usuario', 'conta_receber')
    return Response([{
        'id':               t.id,
        'tipo_contato':     t.get_tipo_contato_display(),
        'resultado':        t.get_resultado_display(),
        'observacao':       t.observacao,
        'proxima_acao':     t.proxima_acao,
        'proxima_acao_data': t.proxima_acao_data.strftime('%d/%m/%Y') if t.proxima_acao_data else None,
        'usuario':          t.usuario.nome if t.usuario else None,
        'criado_em':        t.criado_em.strftime('%d/%m/%Y %H:%M'),
        'conta_descricao':  t.conta_receber.descricao if t.conta_receber else None,
    } for t in tentativas])


@api_view(['GET', 'POST'])
def api_credito_titulos_disputa(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    from .models import TituloEmDisputa, ContaReceber

    if request.method == 'GET':
        titulos = TituloEmDisputa.objects.filter(empresa_id=empresa_id).select_related('conta_receber__cliente')
        return Response([{
            'id':           t.id,
            'cliente':      t.conta_receber.cliente.nome_razao,
            'cliente_id':   t.conta_receber.cliente_id,
            'valor':        float(round(t.conta_receber.valor, 2)),
            'vencimento':   t.conta_receber.data_vencimento.strftime('%d/%m/%Y'),
            'motivo':       t.motivo,
            'status':       t.status,
            'status_label': t.get_status_display(),
            'docs_gerados': t.documentos_gerados,
            'criado_em':    t.criado_em.strftime('%d/%m/%Y'),
        } for t in titulos])

    data = request.data
    try:
        conta = ContaReceber.objects.get(id=data['conta_receber_id'], empresa_id=empresa_id)
    except ContaReceber.DoesNotExist:
        return Response({'erro': 'Conta a receber não encontrada.'}, status=404)

    t = TituloEmDisputa.objects.create(
        empresa_id=empresa_id,
        conta_receber=conta,
        usuario=request.user,
        motivo=data.get('motivo', ''),
    )
    return Response({'id': t.id, 'mensagem': 'Título marcado como em disputa.'}, status=201)


@api_view(['POST'])
def api_credito_titulo_resolver(request, titulo_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import TituloEmDisputa
    try:
        titulo = TituloEmDisputa.objects.get(id=titulo_id, empresa_id=_get_empresa_id(request))
    except TituloEmDisputa.DoesNotExist:
        return Response({'erro': 'Título não encontrado.'}, status=404)
    resolucao = request.data.get('resolucao', 'resolvido_pago')
    titulo.status = resolucao
    titulo.resolvido_em = timezone.now()
    titulo.save(update_fields=['status', 'resolvido_em'])
    return Response({'mensagem': 'Título resolvido.'})


@api_view(['POST'])
def api_credito_titulo_juridico(request, titulo_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    pacote, erro = gerar_pacote_juridico(_get_empresa_id(request), titulo_id)
    if erro:
        return Response({'erro': erro}, status=404)
    return Response(pacote)


@api_view(['GET', 'POST'])
def api_credito_acordos(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    from .models import AcordoJudicial, ParcelaAcordoJudicial, Cliente, TituloEmDisputa
    from datetime import date, timedelta

    if request.method == 'GET':
        acordos = AcordoJudicial.objects.filter(empresa_id=empresa_id).select_related('cliente')
        resultado = []
        for a in acordos:
            parcelas_pagas = a.parcelas.filter(status='paga').count()
            resultado.append({
                'id':              a.id,
                'cliente':         a.cliente.nome_fantasia or a.cliente.nome_razao,
                'cliente_id':      a.cliente_id,
                'valor_total':     float(round(a.valor_total, 2)),
                'numero_parcelas': a.numero_parcelas,
                'parcelas_pagas':  parcelas_pagas,
                'status':          a.status,
                'status_label':    a.get_status_display(),
                'criado_em':       a.criado_em.strftime('%d/%m/%Y'),
            })
        return Response(resultado)

    data = request.data
    try:
        cliente = Cliente.objects.get(id=data['cliente_id'], empresa_id=empresa_id)
    except Cliente.DoesNotExist:
        return Response({'erro': 'Cliente não encontrado.'}, status=404)

    titulo = None
    if data.get('titulo_disputa_id'):
        try:
            titulo = TituloEmDisputa.objects.get(id=data['titulo_disputa_id'], empresa_id=empresa_id)
        except TituloEmDisputa.DoesNotExist:
            pass

    valor_total     = Decimal(str(data['valor_total']))
    num_parcelas    = int(data['numero_parcelas'])
    valor_parcela   = (valor_total / num_parcelas).quantize(Decimal('0.01'))
    data_primeira   = date.fromisoformat(data.get('data_primeira_parcela', date.today().isoformat()))

    acordo = AcordoJudicial.objects.create(
        empresa_id=empresa_id,
        cliente=cliente,
        titulo_disputa=titulo,
        valor_total=valor_total,
        numero_parcelas=num_parcelas,
        observacoes=data.get('observacoes', ''),
    )

    for i in range(num_parcelas):
        ParcelaAcordoJudicial.objects.create(
            acordo=acordo,
            numero=i + 1,
            valor=valor_parcela,
            data_vencimento=data_primeira + timedelta(days=30 * i),
        )

    return Response({'id': acordo.id, 'mensagem': f'Acordo criado com {num_parcelas} parcelas.'}, status=201)


@api_view(['GET'])
def api_credito_acordo_parcelas(request, acordo_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import AcordoJudicial
    try:
        acordo = AcordoJudicial.objects.get(id=acordo_id, empresa_id=_get_empresa_id(request))
    except AcordoJudicial.DoesNotExist:
        return Response({'erro': 'Acordo não encontrado.'}, status=404)
    hoje = timezone.now().date()
    return Response([{
        'id':              p.id,
        'numero':          p.numero,
        'valor':           float(round(p.valor, 2)),
        'data_vencimento': p.data_vencimento.strftime('%d/%m/%Y'),
        'data_pagamento':  p.data_pagamento.strftime('%d/%m/%Y') if p.data_pagamento else None,
        'status':          p.status,
        'atrasada':        p.status == 'pendente' and p.data_vencimento < hoje,
    } for p in acordo.parcelas.all()])


@api_view(['POST'])
def api_credito_parcela_pagar(request, acordo_id, parcela_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import AcordoJudicial, ParcelaAcordoJudicial
    try:
        parcela = ParcelaAcordoJudicial.objects.get(
            id=parcela_id, acordo_id=acordo_id,
            acordo__empresa_id=_get_empresa_id(request),
        )
    except ParcelaAcordoJudicial.DoesNotExist:
        return Response({'erro': 'Parcela não encontrada.'}, status=404)
    parcela.status = 'paga'
    parcela.data_pagamento = timezone.now().date()
    parcela.save(update_fields=['status', 'data_pagamento'])
    # Verifica se todas as parcelas foram pagas
    acordo = parcela.acordo
    if not acordo.parcelas.exclude(status='paga').exists():
        acordo.status = 'cumprido'
        acordo.save(update_fields=['status'])
    return Response({'mensagem': 'Parcela marcada como paga.'})


@api_view(['GET', 'POST'])
def api_credito_configuracao(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor']:
        return Response({'erro': 'Apenas o Diretor pode alterar as configurações de crédito.'}, status=403)
    from .models import ConfiguracaoCreditoCobranca, Empresa
    empresa_id = _get_empresa_id(request)

    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'erro': 'Empresa não encontrada.'}, status=404)

    config, _ = ConfiguracaoCreditoCobranca.objects.get_or_create(empresa=empresa)

    if request.method == 'GET':
        return Response({
            'dias_atraso_bloqueio':       config.dias_atraso_bloqueio,
            'limite_alcada_gerente':      float(config.limite_alcada_gerente),
            'limite_alcada_diretor':      float(config.limite_alcada_diretor),
            'peso_historico_pagamento':   config.peso_historico_pagamento,
            'peso_tempo_relacionamento':  config.peso_tempo_relacionamento,
            'peso_volume_compras':        config.peso_volume_compras,
            'peso_dados_cadastrais':      config.peso_dados_cadastrais,
            'pct_concentracao_alerta':    float(config.pct_concentracao_alerta),
            'pdd_1_30_dias':              float(config.pdd_1_30_dias),
            'pdd_31_60_dias':             float(config.pdd_31_60_dias),
            'pdd_61_90_dias':             float(config.pdd_61_90_dias),
            'pdd_91_180_dias':            float(config.pdd_91_180_dias),
            'pdd_acima_180_dias':         float(config.pdd_acima_180_dias),
        })

    data = request.data
    for campo in [
        'dias_atraso_bloqueio', 'limite_alcada_gerente', 'limite_alcada_diretor',
        'peso_historico_pagamento', 'peso_tempo_relacionamento',
        'peso_volume_compras', 'peso_dados_cadastrais',
        'pct_concentracao_alerta',
        'pdd_1_30_dias', 'pdd_31_60_dias', 'pdd_61_90_dias',
        'pdd_91_180_dias', 'pdd_acima_180_dias',
    ]:
        if campo in data:
            setattr(config, campo, data[campo])
    config.save()
    return Response({'mensagem': 'Configurações salvas.'})


@api_view(['GET'])
def api_credito_historico_inadimplencia(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente', 'administrativo']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    meses = int(request.query_params.get('meses', 12))
    return Response(listar_historico_inadimplencia(_get_empresa_id(request), meses=meses))


@api_view(['POST'])
def api_credito_snapshot_inadimplencia(request):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    _, criado = registrar_snapshot_inadimplencia(_get_empresa_id(request))
    return Response({'mensagem': 'Snapshot registrado.', 'criado': criado})


# ══════════════════════════════════════════════════════════════════════════════
# CONTRATOS AGRÍCOLAS — CPR, BARTER, TERMO
# ══════════════════════════════════════════════════════════════════════════════

from .contratos import (
    listar_cprs, registrar_entrega_cpr, liquidar_cpr_financeira, alertas_cpr,
    listar_barters, registrar_entrega_barter,
    listar_termos, formalizar_entrega_termo, painel_termos_por_safra,
    alertas_contratos, consultar_preco_mercado,
)


def _nivel_contrato(nivel):
    return nivel in ['diretor', 'gerente', 'administrativo', 'vendedor']


# ── CPR ───────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_cprs(request):
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    if request.method == 'GET':
        status = request.query_params.get('status')
        return Response(listar_cprs(empresa_id, status=status))
    data = request.data
    from .models import CPR, Cliente, Produto, PedidoVenda
    try:
        emitente = Cliente.objects.get(id=data['emitente_id'], empresa_id=empresa_id)
        produto  = Produto.objects.get(id=data['produto_id'], empresa_id=empresa_id)
    except (Cliente.DoesNotExist, Produto.DoesNotExist) as e:
        return Response({'erro': str(e)}, status=400)
    pedido = None
    if data.get('pedido_venda_id'):
        pedido = PedidoVenda.objects.filter(id=data['pedido_venda_id'], empresa_id=empresa_id).first()
    cpr = CPR.objects.create(
        empresa_id=empresa_id,
        numero=data['numero'],
        emitente=emitente,
        produto=produto,
        quantidade_sacas=data['quantidade_sacas'],
        qualidade_minima=data.get('qualidade_minima', ''),
        local_entrega=data.get('local_entrega', ''),
        data_emissao=data['data_emissao'],
        data_vencimento=data['data_vencimento'],
        valor_credito=data['valor_credito'],
        garantias=data.get('garantias', ''),
        pedido_venda=pedido,
        observacoes=data.get('observacoes', ''),
    )
    return Response({'id': cpr.id, 'mensagem': 'CPR criada.'}, status=201)


@api_view(['POST'])
def api_cpr_entregar(request, cpr_id):
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    data = request.data
    resultado, erro = registrar_entrega_cpr(
        _get_empresa_id(request), cpr_id,
        data['data_entrega'], data['quantidade'],
        data.get('nota_fiscal', ''), data.get('observacoes', ''),
    )
    if erro:
        return Response({'erro': erro}, status=400)
    return Response(resultado)


@api_view(['POST'])
def api_cpr_liquidar_financeira(request, cpr_id):
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ['diretor', 'gerente']:
        return Response({'erro': 'Acesso negado.'}, status=403)
    data = request.data
    resultado, erro = liquidar_cpr_financeira(
        _get_empresa_id(request), cpr_id,
        data['preco_mercado'], data.get('fonte_preco', 'manual'),
    )
    if erro:
        return Response({'erro': erro}, status=400)
    return Response(resultado)


@api_view(['GET'])
def api_cpr_alertas(request):
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    return Response(alertas_cpr(_get_empresa_id(request)))


@api_view(['GET'])
def api_cotacao_mercado(request):
    produto = request.query_params.get('produto', '')
    fonte   = request.query_params.get('fonte', 'cbot')
    preco, erro = consultar_preco_mercado(produto, fonte)
    return Response({'preco': preco, 'fonte': fonte, 'erro': erro})


# ── BARTER ────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_barters(request):
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    if request.method == 'GET':
        status = request.query_params.get('status')
        return Response(listar_barters(empresa_id, status=status))
    data = request.data
    from .models import ContratosBarter, Cliente, Produto
    try:
        produtor        = Cliente.objects.get(id=data['produtor_id'], empresa_id=empresa_id)
        produto_receber = Produto.objects.get(id=data['produto_receber_id'], empresa_id=empresa_id)
    except (Cliente.DoesNotExist, Produto.DoesNotExist) as e:
        return Response({'erro': str(e)}, status=400)
    contrato = ContratosBarter.objects.create(
        empresa_id=empresa_id,
        numero=data['numero'],
        produtor=produtor,
        produto_receber=produto_receber,
        safra=data.get('safra', ''),
        quantidade_sacas=data['quantidade_sacas'],
        preco_referencia_manual=data.get('preco_referencia_manual'),
        fonte_preco_referencia=data.get('fonte_preco_referencia', 'manual'),
        data_contrato=data['data_contrato'],
        data_entrega_prevista=data['data_entrega_prevista'],
        valor_insumos=data.get('valor_insumos', 0),
        observacoes=data.get('observacoes', ''),
    )
    return Response({'id': contrato.id, 'mensagem': 'Contrato Barter criado.'}, status=201)


@api_view(['POST'])
def api_barter_entregar(request, contrato_id):
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    data = request.data
    resultado, erro = registrar_entrega_barter(
        _get_empresa_id(request), contrato_id,
        data['data_entrega'], data['quantidade'],
        data['preco_entrega_manual'],
        data.get('fonte_preco', 'manual'),
        data.get('nota_fiscal', ''), data.get('observacoes', ''),
    )
    if erro:
        return Response({'erro': erro}, status=400)
    return Response(resultado)


# ── CONTRATO A TERMO ──────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_termos(request):
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    empresa_id = _get_empresa_id(request)
    if request.method == 'GET':
        status = request.query_params.get('status')
        return Response(listar_termos(empresa_id, status=status))
    data = request.data
    from .models import ContratoTermo, Cliente, Produto
    produto = Produto.objects.filter(id=data['produto_id'], empresa_id=empresa_id).first()
    if not produto:
        return Response({'erro': 'Produto não encontrado.'}, status=400)
    contraparte = Cliente.objects.filter(id=data.get('contraparte_id'), empresa_id=empresa_id).first() if data.get('contraparte_id') else None
    termo = ContratoTermo.objects.create(
        empresa_id=empresa_id,
        numero=data['numero'],
        tipo=data['tipo'],
        contraparte=contraparte,
        contraparte_nome=data.get('contraparte_nome', ''),
        produto=produto,
        quantidade=data['quantidade'],
        preco_travado=data['preco_travado'],
        data_contrato=data['data_contrato'],
        data_entrega=data['data_entrega'],
        safra=data.get('safra', ''),
        observacoes=data.get('observacoes', ''),
    )
    return Response({'id': termo.id, 'mensagem': 'Contrato a termo criado.'}, status=201)


@api_view(['POST'])
def api_termo_atualizar_preco(request, termo_id):
    """Atualiza preço de mercado para cálculo de exposição."""
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    from .models import ContratoTermo
    try:
        termo = ContratoTermo.objects.get(id=termo_id, empresa_id=_get_empresa_id(request))
    except ContratoTermo.DoesNotExist:
        return Response({'erro': 'Contrato não encontrado.'}, status=404)
    data = request.data
    termo.preco_mercado_manual = data.get('preco_mercado_manual')
    termo.fonte_preco_mercado  = data.get('fonte_preco_mercado', 'manual')
    termo.save(update_fields=['preco_mercado_manual', 'fonte_preco_mercado'])
    return Response({'exposicao_mercado': termo.exposicao_mercado()})


@api_view(['POST'])
def api_termo_entregar(request, termo_id):
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    data = request.data
    resultado, erro = formalizar_entrega_termo(
        _get_empresa_id(request), termo_id,
        data['data_entrega'], data['quantidade'], data['preco_entrega'],
        data.get('nota_fiscal', ''), data.get('observacoes', ''),
    )
    if erro:
        return Response({'erro': erro}, status=400)
    return Response(resultado)


@api_view(['GET'])
def api_termos_painel_safra(request):
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    return Response(painel_termos_por_safra(_get_empresa_id(request)))


@api_view(['GET'])
def api_contratos_alertas(request):
    nivel = getattr(request.user, 'nivel', None)
    if not _nivel_contrato(nivel):
        return Response({'erro': 'Acesso negado.'}, status=403)
    return Response(alertas_contratos(_get_empresa_id(request)))


# ══════════════════════════════════════════════════════════════════════════════
# RASTREABILIDADE — Aplicação de Insumos por Talhão
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET', 'POST'])
def api_aplicacoes_insumo(request):
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)

    if request.method == 'GET':
        qs = AplicacaoInsumo.objects.filter(empresa_id=empresa_id).select_related(
            'talhao', 'produto', 'lote', 'operador'
        )
        talhao_id = request.query_params.get('talhao_id')
        produto_id = request.query_params.get('produto_id')
        safra = request.query_params.get('safra')
        data_inicio = request.query_params.get('data_inicio')
        data_fim = request.query_params.get('data_fim')

        if talhao_id:
            qs = qs.filter(talhao_id=talhao_id)
        if produto_id:
            qs = qs.filter(produto_id=produto_id)
        if safra:
            qs = qs.filter(safra__icontains=safra)
        if data_inicio:
            qs = qs.filter(data_aplicacao__gte=data_inicio)
        if data_fim:
            qs = qs.filter(data_aplicacao__lte=data_fim)

        dados = [{
            'id': a.id,
            'talhao_id': a.talhao_id,
            'talhao_nome': a.talhao.nome,
            'gleba_nome': a.talhao.gleba.nome if hasattr(a.talhao, 'gleba') and a.talhao.gleba else None,
            'produto_id': a.produto_id,
            'produto_nome': a.produto.nome,
            'produto_sku': a.produto.sku,
            'lote_id': a.lote_id,
            'lote_numero': a.lote.numero_lote if a.lote else None,
            'quantidade': float(a.quantidade),
            'unidade_medida': a.unidade_medida or a.produto.unidade_medida,
            'data_aplicacao': a.data_aplicacao.isoformat(),
            'operador_nome': a.operador.get_full_name() if a.operador else None,
            'safra': a.safra,
            'cultura': a.cultura,
            'numero_receita_agronomica': a.numero_receita_agronomica,
            'crea_responsavel': a.crea_responsavel,
            'observacoes': a.observacoes,
            'criado_em': a.criado_em.isoformat(),
        } for a in qs.order_by('-data_aplicacao')]
        return Response(dados)

    # POST — qualquer nível exceto diretor pode registrar (operacional e vendedor também)
    data = request.data
    talhao_id = data.get('talhao_id')
    produto_id = data.get('produto_id')
    quantidade = data.get('quantidade')
    data_aplicacao = data.get('data_aplicacao')

    if not all([talhao_id, produto_id, quantidade, data_aplicacao]):
        return Response({'erro': 'talhao_id, produto_id, quantidade e data_aplicacao são obrigatórios.'}, status=400)

    try:
        talhao = Talhao.objects.get(id=talhao_id)
        # Valida que o talhão pertence a uma fazenda da empresa
        if talhao.gleba.fazenda.empresa_id != empresa_id:
            return Response({'erro': 'Talhão não pertence à empresa.'}, status=403)
    except Talhao.DoesNotExist:
        return Response({'erro': 'Talhão não encontrado.'}, status=404)

    try:
        produto = Produto.objects.get(id=produto_id, empresa_id=empresa_id)
    except Produto.DoesNotExist:
        return Response({'erro': 'Produto não encontrado.'}, status=404)

    lote = None
    lote_id = data.get('lote_id')
    if lote_id:
        try:
            lote = LoteEstoque.objects.get(id=lote_id, produto=produto)
        except LoteEstoque.DoesNotExist:
            return Response({'erro': 'Lote não encontrado para este produto.'}, status=404)

    aplicacao = AplicacaoInsumo.objects.create(
        empresa_id=empresa_id,
        talhao=talhao,
        produto=produto,
        lote=lote,
        quantidade=quantidade,
        unidade_medida=data.get('unidade_medida', ''),
        data_aplicacao=data_aplicacao,
        operador=request.user,
        safra=data.get('safra', ''),
        cultura=data.get('cultura', ''),
        numero_receita_agronomica=data.get('numero_receita_agronomica', ''),
        crea_responsavel=data.get('crea_responsavel', ''),
        observacoes=data.get('observacoes', ''),
    )

    from .models import Empresa as EmpresaModel
    LogAuditoria.registrar(
        empresa=EmpresaModel.objects.get(id=empresa_id),
        usuario=request.user,
        acao='criacao',
        modelo_afetado='AplicacaoInsumo',
        registro_id=aplicacao.id,
        descricao=f'Aplicação de {produto.nome} no talhão {talhao.nome} registrada.',
    )

    return Response({'id': aplicacao.id, 'mensagem': 'Aplicação registrada com sucesso.'}, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
def api_aplicacao_insumo_detalhe(request, aplicacao_id):
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)

    try:
        aplicacao = AplicacaoInsumo.objects.get(id=aplicacao_id, empresa_id=empresa_id)
    except AplicacaoInsumo.DoesNotExist:
        return Response({'erro': 'Aplicação não encontrada.'}, status=404)

    if request.method == 'GET':
        return Response({
            'id': aplicacao.id,
            'talhao_id': aplicacao.talhao_id,
            'talhao_nome': aplicacao.talhao.nome,
            'produto_id': aplicacao.produto_id,
            'produto_nome': aplicacao.produto.nome,
            'lote_id': aplicacao.lote_id,
            'lote_numero': aplicacao.lote.numero_lote if aplicacao.lote else None,
            'quantidade': float(aplicacao.quantidade),
            'unidade_medida': aplicacao.unidade_medida,
            'data_aplicacao': aplicacao.data_aplicacao.isoformat(),
            'safra': aplicacao.safra,
            'cultura': aplicacao.cultura,
            'numero_receita_agronomica': aplicacao.numero_receita_agronomica,
            'crea_responsavel': aplicacao.crea_responsavel,
            'observacoes': aplicacao.observacoes,
        })

    if request.method == 'PATCH':
        if nivel not in ('diretor', 'gerente', 'administrativo'):
            return Response({'erro': 'Apenas gerente ou diretor podem editar aplicações.'}, status=403)
        campos_editaveis = ('quantidade', 'unidade_medida', 'data_aplicacao', 'safra',
                            'cultura', 'numero_receita_agronomica', 'crea_responsavel', 'observacoes')
        for campo in campos_editaveis:
            if campo in request.data:
                setattr(aplicacao, campo, request.data[campo])
        aplicacao.save()
        return Response({'mensagem': 'Aplicação atualizada.'})

    if request.method == 'DELETE':
        if nivel not in ('diretor',):
            return Response({'erro': 'Apenas o diretor pode excluir aplicações.'}, status=403)
        aplicacao.delete()
        return Response({'mensagem': 'Aplicação excluída.'})


# ══════════════════════════════════════════════════════════════════════════════
# PLANO DE CONTAS — Contabilidade Gerencial
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET', 'POST'])
def api_grupos_contabeis(request):
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)

    if request.method == 'GET':
        qs = GrupoContabil.objects.filter(
            models.Q(empresa_id=empresa_id) | models.Q(empresa__isnull=True)
        ).order_by('codigo')
        dados = [{
            'id': g.id,
            'codigo': g.codigo,
            'nome': g.nome,
            'parent_id': g.parent_id,
            'parent_nome': g.parent.nome if g.parent else None,
            'empresa_id': g.empresa_id,
            'sistema': g.empresa_id is None,
        } for g in qs]
        return Response(dados)

    if nivel not in ('diretor', 'gerente', 'administrativo'):
        return Response({'erro': 'Acesso negado.'}, status=403)

    codigo = request.data.get('codigo')
    nome = request.data.get('nome')
    if not codigo or not nome:
        return Response({'erro': 'codigo e nome são obrigatórios.'}, status=400)

    grupo = GrupoContabil.objects.create(
        empresa_id=empresa_id,
        codigo=codigo,
        nome=nome,
        parent_id=request.data.get('parent_id'),
    )
    return Response({'id': grupo.id, 'mensagem': 'Grupo contábil criado.'}, status=201)


@api_view(['GET', 'POST'])
def api_contas_contabeis(request):
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)

    if nivel not in ('diretor', 'gerente', 'administrativo'):
        return Response({'erro': 'Acesso negado.'}, status=403)

    if request.method == 'GET':
        qs = ContaContabil.objects.filter(
            models.Q(empresa_id=empresa_id) | models.Q(empresa__isnull=True)
        ).select_related('grupo').order_by('codigo')

        tipo_filtro = request.query_params.get('tipo')
        classe_filtro = request.query_params.get('classe')
        grupo_id = request.query_params.get('grupo_id')
        busca = request.query_params.get('q')

        if tipo_filtro:
            qs = qs.filter(tipo=tipo_filtro)
        if classe_filtro:
            qs = qs.filter(classe=classe_filtro)
        if grupo_id:
            qs = qs.filter(grupo_id=grupo_id)
        if busca:
            qs = qs.filter(models.Q(nome__icontains=busca) | models.Q(codigo__icontains=busca))

        dados = [{
            'id': c.id,
            'codigo': c.codigo,
            'nome': c.nome,
            'tipo': c.tipo,
            'tipo_label': c.get_tipo_display(),
            'classe': c.classe,
            'classe_label': c.get_classe_display(),
            'grupo_id': c.grupo_id,
            'grupo_nome': c.grupo.nome if c.grupo else None,
            'aceita_lancamento': c.aceita_lancamento,
            'ativo': c.ativo,
            'empresa_id': c.empresa_id,
            'sistema': c.empresa_id is None,
        } for c in qs]
        return Response(dados)

    codigo = request.data.get('codigo')
    nome = request.data.get('nome')
    tipo = request.data.get('tipo')
    classe = request.data.get('classe')
    if not all([codigo, nome, tipo, classe]):
        return Response({'erro': 'codigo, nome, tipo e classe são obrigatórios.'}, status=400)

    if ContaContabil.objects.filter(empresa_id=empresa_id, codigo=codigo).exists():
        return Response({'erro': 'Já existe uma conta com este código para esta empresa.'}, status=400)

    conta = ContaContabil.objects.create(
        empresa_id=empresa_id,
        grupo_id=request.data.get('grupo_id'),
        codigo=codigo,
        nome=nome,
        tipo=tipo,
        classe=classe,
        aceita_lancamento=request.data.get('aceita_lancamento', True),
    )
    return Response({'id': conta.id, 'mensagem': 'Conta contábil criada.'}, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
def api_conta_contabil_detalhe(request, conta_id):
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)

    if nivel not in ('diretor', 'gerente', 'administrativo'):
        return Response({'erro': 'Acesso negado.'}, status=403)

    try:
        conta = ContaContabil.objects.get(id=conta_id)
        if conta.empresa_id and conta.empresa_id != empresa_id:
            return Response({'erro': 'Acesso negado.'}, status=403)
    except ContaContabil.DoesNotExist:
        return Response({'erro': 'Conta não encontrada.'}, status=404)

    if request.method == 'GET':
        return Response({
            'id': conta.id, 'codigo': conta.codigo, 'nome': conta.nome,
            'tipo': conta.tipo, 'tipo_label': conta.get_tipo_display(),
            'classe': conta.classe, 'classe_label': conta.get_classe_display(),
            'grupo_id': conta.grupo_id, 'aceita_lancamento': conta.aceita_lancamento,
            'ativo': conta.ativo,
        })

    if conta.empresa_id is None:
        return Response({'erro': 'Contas do sistema não podem ser alteradas.'}, status=403)

    if request.method == 'PATCH':
        for campo in ('nome', 'tipo', 'classe', 'grupo_id', 'aceita_lancamento', 'ativo'):
            if campo in request.data:
                setattr(conta, campo, request.data[campo])
        conta.save()
        return Response({'mensagem': 'Conta atualizada.'})

    if request.method == 'DELETE':
        if nivel != 'diretor':
            return Response({'erro': 'Apenas o diretor pode excluir contas contábeis.'}, status=403)
        conta.delete()
        return Response({'mensagem': 'Conta excluída.'})


# ══════════════════════════════════════════════════════════════════════════════
# PRODUÇÃO — Ordens de Produção (Indústrias)
# ══════════════════════════════════════════════════════════════════════════════

def _check_industria(request):
    empresa_id = _get_empresa_id(request)
    from .models import Empresa as EmpresaModel
    try:
        emp = EmpresaModel.objects.get(id=empresa_id)
        if emp.tipo_negocio != 'industria':
            return None, Response({'erro': 'Módulo de produção disponível apenas para indústrias.'}, status=403)
    except EmpresaModel.DoesNotExist:
        return None, Response({'erro': 'Empresa não encontrada.'}, status=404)
    return empresa_id, None


@api_view(['GET', 'POST'])
def api_ordens_producao(request):
    empresa_id, err = _check_industria(request)
    if err:
        return err
    nivel = getattr(request.user, 'nivel', None)

    if request.method == 'GET':
        qs = OrdemProducao.objects.filter(empresa_id=empresa_id).select_related(
            'produto_final', 'responsavel'
        )
        status_filtro = request.query_params.get('status')
        produto_id = request.query_params.get('produto_id')
        if status_filtro:
            qs = qs.filter(status=status_filtro)
        if produto_id:
            qs = qs.filter(produto_final_id=produto_id)

        dados = [{
            'id': op.id,
            'numero': op.numero,
            'produto_final_id': op.produto_final_id,
            'produto_final_nome': op.produto_final.nome,
            'quantidade_planejada': float(op.quantidade_planejada),
            'quantidade_produzida': float(op.quantidade_produzida),
            'percentual_conclusao': op.percentual_conclusao,
            'status': op.status,
            'status_label': op.get_status_display(),
            'data_prevista': op.data_prevista.isoformat(),
            'data_inicio': op.data_inicio.isoformat() if op.data_inicio else None,
            'data_conclusao': op.data_conclusao.isoformat() if op.data_conclusao else None,
            'responsavel_nome': op.responsavel.get_full_name() if op.responsavel else None,
            'criado_em': op.criado_em.isoformat(),
        } for op in qs.order_by('-criado_em')]
        return Response(dados)

    if nivel not in ('diretor', 'gerente', 'administrativo'):
        return Response({'erro': 'Acesso negado para criar ordens de produção.'}, status=403)

    numero = request.data.get('numero')
    produto_final_id = request.data.get('produto_final_id')
    quantidade_planejada = request.data.get('quantidade_planejada')
    data_prevista = request.data.get('data_prevista')

    if not all([numero, produto_final_id, quantidade_planejada, data_prevista]):
        return Response({'erro': 'numero, produto_final_id, quantidade_planejada e data_prevista são obrigatórios.'}, status=400)

    if OrdemProducao.objects.filter(empresa_id=empresa_id, numero=numero).exists():
        return Response({'erro': 'Já existe uma OP com este número.'}, status=400)

    try:
        produto_final = Produto.objects.get(id=produto_final_id, empresa_id=empresa_id)
    except Produto.DoesNotExist:
        return Response({'erro': 'Produto não encontrado.'}, status=404)

    op = OrdemProducao.objects.create(
        empresa_id=empresa_id,
        numero=numero,
        produto_final=produto_final,
        quantidade_planejada=quantidade_planejada,
        data_prevista=data_prevista,
        responsavel=request.user,
        observacoes=request.data.get('observacoes', ''),
    )

    insumos_data = request.data.get('insumos', [])
    for ins in insumos_data:
        try:
            prod = Produto.objects.get(id=ins.get('produto_id'), empresa_id=empresa_id)
            ItemOrdemProducao.objects.create(
                ordem=op,
                produto=prod,
                lote_id=ins.get('lote_id'),
                quantidade_planejada=ins.get('quantidade_planejada', 0),
            )
        except Produto.DoesNotExist:
            pass

    from .models import Empresa as EmpresaModel
    LogAuditoria.registrar(
        empresa=EmpresaModel.objects.get(id=empresa_id),
        usuario=request.user,
        acao='criacao',
        modelo_afetado='OrdemProducao',
        registro_id=op.id,
        descricao=f'OP {op.numero} criada para {produto_final.nome}.',
    )
    return Response({'id': op.id, 'numero': op.numero, 'mensagem': 'Ordem de produção criada.'}, status=201)


@api_view(['GET', 'PATCH'])
def api_ordem_producao_detalhe(request, op_id):
    empresa_id, err = _check_industria(request)
    if err:
        return err
    nivel = getattr(request.user, 'nivel', None)

    try:
        op = OrdemProducao.objects.get(id=op_id, empresa_id=empresa_id)
    except OrdemProducao.DoesNotExist:
        return Response({'erro': 'Ordem de produção não encontrada.'}, status=404)

    if request.method == 'GET':
        insumos = [{
            'id': item.id,
            'produto_id': item.produto_id,
            'produto_nome': item.produto.nome,
            'lote_id': item.lote_id,
            'lote_numero': item.lote.numero_lote if item.lote else None,
            'quantidade_planejada': float(item.quantidade_planejada),
            'quantidade_consumida': float(item.quantidade_consumida),
        } for item in op.insumos.select_related('produto', 'lote').all()]
        return Response({
            'id': op.id, 'numero': op.numero,
            'produto_final_id': op.produto_final_id,
            'produto_final_nome': op.produto_final.nome,
            'quantidade_planejada': float(op.quantidade_planejada),
            'quantidade_produzida': float(op.quantidade_produzida),
            'percentual_conclusao': op.percentual_conclusao,
            'status': op.status,
            'status_label': op.get_status_display(),
            'data_prevista': op.data_prevista.isoformat(),
            'data_inicio': op.data_inicio.isoformat() if op.data_inicio else None,
            'data_conclusao': op.data_conclusao.isoformat() if op.data_conclusao else None,
            'responsavel_nome': op.responsavel.get_full_name() if op.responsavel else None,
            'observacoes': op.observacoes,
            'insumos': insumos,
        })

    if nivel not in ('diretor', 'gerente', 'administrativo'):
        return Response({'erro': 'Acesso negado.'}, status=403)

    novo_status = request.data.get('status')
    quantidade_produzida = request.data.get('quantidade_produzida')

    if novo_status:
        transicoes_validas = {
            'rascunho': ['liberada', 'cancelada'],
            'liberada': ['em_producao', 'cancelada'],
            'em_producao': ['concluida', 'cancelada'],
            'concluida': [],
            'cancelada': [],
        }
        if novo_status not in transicoes_validas.get(op.status, []):
            return Response({'erro': f'Transição {op.status} → {novo_status} não permitida.'}, status=400)

        op.status = novo_status
        if novo_status == 'em_producao' and not op.data_inicio:
            op.data_inicio = timezone.now()
        if novo_status == 'concluida':
            op.data_conclusao = timezone.now()

    if quantidade_produzida is not None:
        op.quantidade_produzida = quantidade_produzida

    for campo in ('observacoes', 'data_prevista'):
        if campo in request.data:
            setattr(op, campo, request.data[campo])

    op.save()
    from .models import Empresa as EmpresaModel
    LogAuditoria.registrar(
        empresa=EmpresaModel.objects.get(id=empresa_id),
        usuario=request.user,
        acao='edicao',
        modelo_afetado='OrdemProducao',
        registro_id=op.id,
        descricao=f'OP {op.numero} atualizada — status: {op.status}.',
    )
    return Response({'mensagem': 'Ordem de produção atualizada.', 'status': op.status})


# ══════════════════════════════════════════════════════════════════════════════
# BENEFICIAMENTO — Transformação de Lotes (Indústrias)
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET', 'POST'])
def api_beneficiamentos(request):
    empresa_id, err = _check_industria(request)
    if err:
        return err
    nivel = getattr(request.user, 'nivel', None)

    if request.method == 'GET':
        qs = BeneficiamentoLote.objects.filter(empresa_id=empresa_id).select_related(
            'produto_entrada', 'produto_saida', 'lote_entrada', 'operador'
        )
        status_filtro = request.query_params.get('status')
        if status_filtro:
            qs = qs.filter(status=status_filtro)

        dados = [{
            'id': b.id,
            'produto_entrada_id': b.produto_entrada_id,
            'produto_entrada_nome': b.produto_entrada.nome,
            'lote_entrada_id': b.lote_entrada_id,
            'lote_entrada_numero': b.lote_entrada.numero_lote if b.lote_entrada else None,
            'quantidade_entrada': float(b.quantidade_entrada),
            'produto_saida_id': b.produto_saida_id,
            'produto_saida_nome': b.produto_saida.nome if b.produto_saida else None,
            'quantidade_saida': float(b.quantidade_saida),
            'rendimento_percentual': float(b.rendimento_percentual),
            'status': b.status,
            'status_label': b.get_status_display(),
            'data_inicio': b.data_inicio.isoformat(),
            'data_conclusao': b.data_conclusao.isoformat() if b.data_conclusao else None,
            'operador_nome': b.operador.get_full_name() if b.operador else None,
            'criado_em': b.criado_em.isoformat(),
        } for b in qs.order_by('-criado_em')]
        return Response(dados)

    if nivel not in ('diretor', 'gerente', 'administrativo', 'operacional'):
        return Response({'erro': 'Acesso negado.'}, status=403)

    produto_entrada_id = request.data.get('produto_entrada_id')
    quantidade_entrada = request.data.get('quantidade_entrada')
    data_inicio = request.data.get('data_inicio')

    if not all([produto_entrada_id, quantidade_entrada, data_inicio]):
        return Response({'erro': 'produto_entrada_id, quantidade_entrada e data_inicio são obrigatórios.'}, status=400)

    try:
        produto_entrada = Produto.objects.get(id=produto_entrada_id, empresa_id=empresa_id)
    except Produto.DoesNotExist:
        return Response({'erro': 'Produto de entrada não encontrado.'}, status=404)

    benef = BeneficiamentoLote.objects.create(
        empresa_id=empresa_id,
        produto_entrada=produto_entrada,
        lote_entrada_id=request.data.get('lote_entrada_id'),
        quantidade_entrada=quantidade_entrada,
        produto_saida_id=request.data.get('produto_saida_id'),
        quantidade_saida=request.data.get('quantidade_saida', 0),
        data_inicio=data_inicio,
        operador=request.user,
        observacoes=request.data.get('observacoes', ''),
    )
    return Response({'id': benef.id, 'mensagem': 'Beneficiamento registrado.'}, status=201)


@api_view(['GET', 'PATCH'])
def api_beneficiamento_detalhe(request, benef_id):
    empresa_id, err = _check_industria(request)
    if err:
        return err
    nivel = getattr(request.user, 'nivel', None)

    try:
        benef = BeneficiamentoLote.objects.get(id=benef_id, empresa_id=empresa_id)
    except BeneficiamentoLote.DoesNotExist:
        return Response({'erro': 'Beneficiamento não encontrado.'}, status=404)

    if request.method == 'GET':
        return Response({
            'id': benef.id,
            'produto_entrada_nome': benef.produto_entrada.nome,
            'lote_entrada_numero': benef.lote_entrada.numero_lote if benef.lote_entrada else None,
            'quantidade_entrada': float(benef.quantidade_entrada),
            'produto_saida_nome': benef.produto_saida.nome if benef.produto_saida else None,
            'quantidade_saida': float(benef.quantidade_saida),
            'rendimento_percentual': float(benef.rendimento_percentual),
            'status': benef.status,
            'status_label': benef.get_status_display(),
            'data_inicio': benef.data_inicio.isoformat(),
            'data_conclusao': benef.data_conclusao.isoformat() if benef.data_conclusao else None,
            'lote_saida_gerado_id': benef.lote_saida_gerado_id,
            'observacoes': benef.observacoes,
        })

    if nivel not in ('diretor', 'gerente', 'administrativo'):
        return Response({'erro': 'Acesso negado para editar beneficiamento.'}, status=403)

    for campo in ('produto_saida_id', 'quantidade_saida', 'data_conclusao',
                  'status', 'lote_saida_gerado_id', 'observacoes'):
        if campo in request.data:
            setattr(benef, campo, request.data[campo])

    benef.save()
    return Response({'mensagem': 'Beneficiamento atualizado.', 'rendimento_percentual': float(benef.rendimento_percentual)})


# ══════════════════════════════════════════════════════════════════════════════
# MAPA CONTÁBIL — Configuração de operações → contas
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET', 'POST'])
def api_mapa_contabil(request):
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ('diretor', 'gerente', 'administrativo'):
        return Response({'erro': 'Acesso negado.'}, status=403)

    if request.method == 'GET':
        qs = MapaContabil.objects.filter(empresa_id=empresa_id).select_related(
            'conta_debito', 'conta_credito'
        )
        return Response([{
            'id': m.id,
            'tipo_operacao': m.tipo_operacao,
            'tipo_operacao_label': m.get_tipo_operacao_display(),
            'conta_debito_id': m.conta_debito_id,
            'conta_debito': f"{m.conta_debito.codigo} — {m.conta_debito.nome}",
            'conta_credito_id': m.conta_credito_id,
            'conta_credito': f"{m.conta_credito.codigo} — {m.conta_credito.nome}",
            'ativo': m.ativo,
        } for m in qs])

    # POST
    tipo = request.data.get('tipo_operacao')
    debito_id = request.data.get('conta_debito_id')
    credito_id = request.data.get('conta_credito_id')
    if not all([tipo, debito_id, credito_id]):
        return Response({'erro': 'tipo_operacao, conta_debito_id e conta_credito_id são obrigatórios.'}, status=400)

    validos = [c[0] for c in MapaContabil.OPERACAO_CHOICES]
    if tipo not in validos:
        return Response({'erro': f'tipo_operacao inválido. Opções: {validos}'}, status=400)

    mapa, created = MapaContabil.objects.update_or_create(
        empresa_id=empresa_id,
        tipo_operacao=tipo,
        defaults={
            'conta_debito_id': debito_id,
            'conta_credito_id': credito_id,
            'ativo': request.data.get('ativo', True),
        },
    )
    return Response({'id': mapa.id, 'criado': created, 'mensagem': 'Mapeamento salvo.'}, status=201 if created else 200)


@api_view(['DELETE'])
def api_mapa_contabil_detalhe(request, mapa_id):
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)
    if nivel != 'diretor':
        return Response({'erro': 'Apenas o Diretor pode remover mapeamentos.'}, status=403)
    try:
        mapa = MapaContabil.objects.get(id=mapa_id, empresa_id=empresa_id)
    except MapaContabil.DoesNotExist:
        return Response({'erro': 'Mapeamento não encontrado.'}, status=404)
    mapa.delete()
    return Response({'mensagem': 'Mapeamento removido.'})


# ══════════════════════════════════════════════════════════════════════════════
# LANÇAMENTOS CONTÁBEIS — Consulta do razão (append-only)
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET', 'POST'])
def api_lancamentos_contabeis(request):
    empresa_id = _get_empresa_id(request)
    nivel = getattr(request.user, 'nivel', None)
    if nivel not in ('diretor', 'gerente', 'administrativo'):
        return Response({'erro': 'Acesso negado.'}, status=403)

    if request.method == 'GET':
        qs = LancamentoContabil.objects.filter(empresa_id=empresa_id).select_related(
            'conta_debito', 'conta_credito'
        )
        data_inicio = request.query_params.get('data_inicio')
        data_fim = request.query_params.get('data_fim')
        conta_id = request.query_params.get('conta_id')
        origem_tipo = request.query_params.get('origem_tipo')
        if data_inicio:
            qs = qs.filter(data__gte=data_inicio)
        if data_fim:
            qs = qs.filter(data__lte=data_fim)
        if conta_id:
            qs = qs.filter(
                models.Q(conta_debito_id=conta_id) | models.Q(conta_credito_id=conta_id)
            )
        if origem_tipo:
            qs = qs.filter(origem_tipo=origem_tipo)
        return Response([{
            'id': lc.id,
            'data': lc.data.isoformat(),
            'conta_debito': f"{lc.conta_debito.codigo} — {lc.conta_debito.nome}",
            'conta_credito': f"{lc.conta_credito.codigo} — {lc.conta_credito.nome}",
            'valor': float(lc.valor),
            'historico': lc.historico,
            'origem_tipo': lc.origem_tipo,
            'origem_id': lc.origem_id,
            'criado_em': lc.criado_em.isoformat(),
        } for lc in qs])

    # POST — lançamento manual (diretor/gerente/administrativo)
    required = ['data', 'conta_debito_id', 'conta_credito_id', 'valor', 'historico']
    for field in required:
        if not request.data.get(field):
            return Response({'erro': f'Campo obrigatório: {field}'}, status=400)

    lc = LancamentoContabil.objects.create(
        empresa_id=empresa_id,
        data=request.data['data'],
        conta_debito_id=request.data['conta_debito_id'],
        conta_credito_id=request.data['conta_credito_id'],
        valor=request.data['valor'],
        historico=request.data['historico'],
        origem_tipo='manual',
        origem_id=None,
    )
    return Response({'id': lc.id, 'mensagem': 'Lançamento contábil registrado.'}, status=201)
