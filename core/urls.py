from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from gestao.onboarding import api_onboarding
from gestao.views import (
    # Auth
    api_login, api_logout, api_me,
    # Dashboard
    api_dashboard_gestao,
    # Alertas
    api_alertas_estoque, api_alertas_validade, api_alertas_contas_vencer,
    api_alertas_receber_atrasados, api_alertas_clientes, api_alertas_aniversariantes,
    # Notificações
    api_notificacoes, api_marcar_notificacao_lida, api_marcar_todas_lidas,
    # Aprovações
    api_fila_aprovacao, api_aprovar_pedido, api_recusar_pedido, api_expirar_pedido,
    # Caixa
    api_abrir_caixa, api_resumo_caixa, api_fechar_caixa, api_sangria, api_suprimento,
    # Relatórios
    api_dre, api_inadimplencia, api_performance_vendedores,
    api_comissoes_repasse, api_curva_abc_lucratividade,
    # Expedição
    api_expedicao_lista, api_romaneio,
    # Pedidos de compra
    api_pedidos_compra, api_criar_pedido_compra, api_vincular_nf_pedido_compra,
    # Permissões
    api_permissoes_granulares,
    # Fiscal
    api_configuracao_fiscal, api_sugerir_tributacao, api_emitir_nfe,
    api_status_nfe, api_portal_contador, api_popular_dados_fiscais,
    # White-label
    api_whitelabel, api_upload_logo, api_configurar_whitelabel,
    # Comissões
    api_comissoes_vendedor,
    # Dossiê vendedor
    api_dossie_vendedor,
    # Estoque inicial
    api_verificar_estoque_inicial, api_lancar_estoque_inicial,
    # Financeiro avulso
    api_lancamentos_financeiros,
    # Contas em aberto
    api_contas_aberto_clientes,
    # Entradas e saídas
    api_entradas_saidas_detalhado,
    # Manifestação NF-e
    api_manifestacao_pendentes, api_manifestar_nfe,
    api_cancelar_nfe, api_carta_correcao_nfe,
    # Fiscal complementar
    api_emitir_nfse, api_status_nfse, api_cancelar_nfse,
    api_emitir_cte, api_status_cte, api_cancelar_cte,
    api_emitir_mdfe, api_encerrar_mdfe, api_status_mdfe,
    api_download_danfe, api_download_xml,
    api_upload_certificado, api_listar_certificados, api_consultar_certificado_focusnfe,
    api_inutilizar_nfe, api_listar_inutilizacoes,
    # PDV
    api_pdv_vender, api_pdv_vendas, api_pdv_cancelar,
    # Fase 5 — Orçamentos
    api_orcamentos, api_converter_orcamento,
    # Fase 5 — Solicitações de compra
    api_solicitacoes_compra, api_decidir_solicitacao,
    # Fase 5 — Cotações
    api_cotacoes, api_comparativo_cotacao, api_resposta_cotacao, api_encerrar_cotacao,
    # Fase 5 — Avaliação de fornecedores
    api_avaliar_fornecedor, api_resumo_fornecedor,
    # Fase 5 — Inventário
    api_inventario, api_inventario_detalhe, api_inventario_contar, api_inventario_concluir,
    # Fase 6 — Financeiro avançado
    api_centros_custo, api_dre_centro_custo, api_fluxo_caixa,
    api_lancamentos_recorrentes, api_gerar_recorrentes_mes,
    api_importar_ofx, api_conciliar_transacao, api_gerar_boleto,
    # Fase 7 — RH
    api_colaboradores, api_ponto, api_agendar_ferias, api_folha_pagamento,
    # Fase 7 — SuperHost e Matriz-Filial
    api_superhost_clientes, api_superhost_bloquear, api_superhost_alterar_tipo,
    api_matriz_consolidado, api_matriz_filiais,
    # Fase 8 — SPED e importação
    api_importar_xml_lote, api_consultar_nfes_sefaz,
    api_gerar_sped, api_gerar_efd_reinf,
    # ViewSets existentes
    PedidoVendaViewSet, ClienteViewSet, ProdutoViewSet,
    ContaPagarViewSet, ContaReceberViewSet,
    # Cadastros Gerais — novos ViewSets
    GrupoClienteViewSet, TabelaPrecoViewSet, VeiculoViewSet,
    FazendaViewSet, GlebaViewSet, TalhaoViewSet,
    DevolucaoVendaViewSet, api_itens_tabela_preco,
    BancoViewSet,
)
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'pedidos',           PedidoVendaViewSet,    basename='pedido')
router.register(r'clientes',          ClienteViewSet,        basename='cliente')
router.register(r'produtos',          ProdutoViewSet,        basename='produto')
router.register(r'contas-pagar',      ContaPagarViewSet,     basename='conta-pagar')
router.register(r'contas-receber',    ContaReceberViewSet,   basename='conta-receber')
router.register(r'grupos-cliente',    GrupoClienteViewSet,   basename='grupo-cliente')
router.register(r'tabelas-preco',     TabelaPrecoViewSet,    basename='tabela-preco')
router.register(r'veiculos',          VeiculoViewSet,        basename='veiculo')
router.register(r'fazendas',          FazendaViewSet,        basename='fazenda')
router.register(r'glebas',            GlebaViewSet,          basename='gleba')
router.register(r'talhoes',           TalhaoViewSet,         basename='talhao')
router.register(r'devolucoes',        DevolucaoVendaViewSet, basename='devolucao')
router.register(r'bancos',            BancoViewSet,          basename='banco')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),

    # ==========================================
    # ONBOARDING — rota pública, sem autenticação
    # ==========================================
    path('api/onboarding/', api_onboarding),

    # ==========================================
    # AUTENTICAÇÃO
    # ==========================================
    path('api/auth/login/', api_login),
    path('api/auth/logout/', api_logout),
    path('api/auth/me/', api_me),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ==========================================
    # DASHBOARD
    # ==========================================
    path('api/dashboard/', api_dashboard_gestao),

    # ==========================================
    # ALERTAS
    # ==========================================
    path('api/alertas/estoque/', api_alertas_estoque),
    path('api/alertas/validade/', api_alertas_validade),
    path('api/alertas/contas-vencer/', api_alertas_contas_vencer),
    path('api/alertas/receber-atrasados/', api_alertas_receber_atrasados),
    path('api/alertas/clientes/', api_alertas_clientes),
    path('api/alertas/aniversariantes/', api_alertas_aniversariantes),

    # ==========================================
    # NOTIFICAÇÕES
    # ==========================================
    path('api/notificacoes/', api_notificacoes),
    path('api/notificacoes/<int:notificacao_id>/lida/', api_marcar_notificacao_lida),
    path('api/notificacoes/marcar-todas-lidas/', api_marcar_todas_lidas),

    # ==========================================
    # APROVAÇÕES
    # ==========================================
    path('api/aprovacoes/', api_fila_aprovacao),
    path('api/aprovacoes/<int:pedido_id>/aprovar/', api_aprovar_pedido),
    path('api/aprovacoes/<int:pedido_id>/recusar/', api_recusar_pedido),
    path('api/aprovacoes/<int:pedido_id>/expirar/', api_expirar_pedido),

    # ==========================================
    # CAIXA
    # ==========================================
    path('api/caixa/abrir/', api_abrir_caixa),
    path('api/caixa/resumo/', api_resumo_caixa),
    path('api/caixa/fechar/', api_fechar_caixa),
    path('api/caixa/sangria/', api_sangria),
    path('api/caixa/suprimento/', api_suprimento),

    # ==========================================
    # RELATÓRIOS
    # ==========================================
    path('api/relatorios/dre/', api_dre),
    path('api/relatorios/inadimplencia/', api_inadimplencia),
    path('api/relatorios/performance-vendedores/', api_performance_vendedores),
    path('api/relatorios/comissoes-repasse/', api_comissoes_repasse),
    path('api/relatorios/curva-abc-lucratividade/', api_curva_abc_lucratividade),

    # ==========================================
    # EXPEDIÇÃO
    # ==========================================
    path('api/expedicao/', api_expedicao_lista),
    path('api/expedicao/<int:pedido_id>/romaneio/', api_romaneio),

    # ==========================================
    # PEDIDOS DE COMPRA
    # ==========================================
    path('api/pedidos-compra/', api_pedidos_compra),
    path('api/pedidos-compra/criar/', api_criar_pedido_compra),
    path('api/pedidos-compra/<int:pedido_id>/vincular-nf/', api_vincular_nf_pedido_compra),

    # ==========================================
    # PERMISSÕES
    # ==========================================
    path('api/permissoes/<int:usuario_id>/', api_permissoes_granulares),

    # ==========================================
    # FISCAL
    # ==========================================
    path('api/fiscal/configuracao/', api_configuracao_fiscal),
    path('api/fiscal/sugerir/<int:produto_id>/', api_sugerir_tributacao),
    path('api/fiscal/emitir-nfe/<int:pedido_id>/', api_emitir_nfe),
    path('api/fiscal/status-nfe/<str:referencia>/', api_status_nfe),
    path('api/fiscal/contador/', api_portal_contador),
    path('api/fiscal/popular-dados/', api_popular_dados_fiscais),

    # ==========================================
    # WHITE-LABEL
    # ==========================================
    path('api/whitelabel/', api_whitelabel),
    path('api/whitelabel/upload-logo/', api_upload_logo),
    path('api/whitelabel/configurar/', api_configurar_whitelabel),

    # ==========================================
    # COMISSÕES E DOSSIÊ
    # ==========================================
    path('api/comissoes/', api_comissoes_vendedor),
    path('api/vendedor/<int:vendedor_id>/dossie/', api_dossie_vendedor),

    # ==========================================
    # ESTOQUE
    # ==========================================
    path('api/estoque/inicial/verificar/', api_verificar_estoque_inicial),
    path('api/estoque/inicial/lancar/', api_lancar_estoque_inicial),
    path('api/estoque/entradas-saidas/', api_entradas_saidas_detalhado),

    # ==========================================
    # FINANCEIRO AVULSO
    # ==========================================
    path('api/financeiro/lancamentos/', api_lancamentos_financeiros),
    path('api/financeiro/contas-aberto/', api_contas_aberto_clientes),

    # ==========================================
    # MANIFESTAÇÃO DE NF-e (MD-e)
    # ==========================================
    path('api/fiscal/manifestacao/pendentes/', api_manifestacao_pendentes),
    path('api/fiscal/manifestacao/', api_manifestar_nfe),
    path('api/fiscal/cancelar/<str:referencia>/', api_cancelar_nfe),
    path('api/fiscal/carta-correcao/<str:referencia>/', api_carta_correcao_nfe),

    # ── NFS-e
    path('api/nfse/emitir/', api_emitir_nfse),
    path('api/nfse/status/<str:referencia>/', api_status_nfse),
    path('api/nfse/cancelar/<str:referencia>/', api_cancelar_nfse),

    # ── CT-e
    path('api/cte/emitir/', api_emitir_cte),
    path('api/cte/status/<str:referencia>/', api_status_cte),
    path('api/cte/cancelar/<str:referencia>/', api_cancelar_cte),

    # ── MDF-e
    path('api/mdfe/emitir/', api_emitir_mdfe),
    path('api/mdfe/<str:referencia>/encerrar/', api_encerrar_mdfe),
    path('api/mdfe/status/<str:referencia>/', api_status_mdfe),

    # ── DANFE / XML download individual
    path('api/fiscal/danfe/<str:referencia>/', api_download_danfe),
    path('api/fiscal/xml/<str:referencia>/', api_download_xml),

    # ── Certificado Digital
    path('api/fiscal/certificado/', api_listar_certificados),
    path('api/fiscal/certificado/upload/', api_upload_certificado),
    path('api/fiscal/certificado/focusnfe/', api_consultar_certificado_focusnfe),

    # ── Inutilização de NF
    path('api/fiscal/inutilizar/', api_inutilizar_nfe),
    path('api/fiscal/inutilizacoes/', api_listar_inutilizacoes),

    # ==========================================
    # PDV — PONTO DE VENDA / FRENTE DE CAIXA
    # ==========================================
    path('api/pdv/vender/', api_pdv_vender),
    path('api/pdv/vendas/', api_pdv_vendas),
    path('api/pdv/<int:venda_id>/cancelar/', api_pdv_cancelar),

    # ==========================================
    # FASE 5 — ORÇAMENTOS
    # ==========================================
    path('api/orcamentos/', api_orcamentos),
    path('api/orcamentos/<int:orcamento_id>/converter/', api_converter_orcamento),

    # ==========================================
    # FASE 5 — SOLICITAÇÕES DE COMPRA
    # ==========================================
    path('api/compras/solicitacoes/', api_solicitacoes_compra),
    path('api/compras/solicitacoes/<int:sc_id>/decidir/', api_decidir_solicitacao),

    # ==========================================
    # FASE 5 — COTAÇÕES DE FORNECEDORES
    # ==========================================
    path('api/compras/cotacoes/', api_cotacoes),
    path('api/compras/cotacoes/<int:cotacao_id>/comparativo/', api_comparativo_cotacao),
    path('api/compras/cotacoes/<int:cotacao_id>/resposta/', api_resposta_cotacao),
    path('api/compras/cotacoes/<int:cotacao_id>/encerrar/', api_encerrar_cotacao),

    # ==========================================
    # FASE 5 — AVALIAÇÃO DE FORNECEDORES
    # ==========================================
    path('api/fornecedores/avaliar/', api_avaliar_fornecedor),
    path('api/fornecedores/<int:fornecedor_id>/resumo/', api_resumo_fornecedor),

    # ==========================================
    # FASE 5 — INVENTÁRIO FÍSICO
    # ==========================================
    path('api/estoque/inventario/', api_inventario),
    path('api/estoque/inventario/<int:inv_id>/', api_inventario_detalhe),
    path('api/estoque/inventario/<int:inv_id>/contar/', api_inventario_contar),
    path('api/estoque/inventario/<int:inv_id>/concluir/', api_inventario_concluir),

    # ==========================================
    # FASE 6 — FINANCEIRO AVANÇADO
    # ==========================================
    path('api/financeiro/centros-custo/', api_centros_custo),
    path('api/financeiro/dre-centro-custo/', api_dre_centro_custo),
    path('api/financeiro/fluxo-caixa/', api_fluxo_caixa),
    path('api/financeiro/recorrentes/', api_lancamentos_recorrentes),
    path('api/financeiro/recorrentes/gerar/', api_gerar_recorrentes_mes),
    path('api/financeiro/conciliacao/importar/', api_importar_ofx),
    path('api/financeiro/conciliacao/<int:transacao_id>/conciliar/', api_conciliar_transacao),
    path('api/financeiro/boleto/<int:conta_receber_id>/', api_gerar_boleto),

    # ==========================================
    # FASE 7 — RH
    # ==========================================
    path('api/rh/colaboradores/', api_colaboradores),
    path('api/rh/ponto/', api_ponto),
    path('api/rh/ferias/', api_agendar_ferias),
    path('api/rh/folha/', api_folha_pagamento),

    # ==========================================
    # FASE 7 — SUPERHOST E MATRIZ-FILIAL
    # ==========================================
    path('api/superhost/clientes/', api_superhost_clientes),
    path('api/superhost/bloquear/<int:empresa_id>/', api_superhost_bloquear),
    path('api/superhost/alterar-tipo/<int:empresa_id>/', api_superhost_alterar_tipo),
    path('api/matriz/consolidado/', api_matriz_consolidado),
    path('api/matriz/filiais/', api_matriz_filiais),

    # ==========================================
    # FASE 8 — SPED, EFD-REINF, IMPORTAÇÃO EM LOTE
    # ==========================================
    path('api/importacao/xml-lote/', api_importar_xml_lote),
    path('api/importacao/sefaz-consulta/', api_consultar_nfes_sefaz),
    path('api/fiscal/sped/', api_gerar_sped),
    path('api/fiscal/efd-reinf/', api_gerar_efd_reinf),

    # ==========================================
    # CADASTROS GERAIS — rotas extras
    # ==========================================
    path('api/tabelas-preco/<int:tabela_id>/itens/', api_itens_tabela_preco),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)