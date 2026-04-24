# AgroPulse — Sistema de Gestão para o Agronegócio
# Arquivo de contexto para o Claude Code
# Lido automaticamente a cada sessão

## Identidade do Projeto
- **Nome comercial:** AgroPulse
- **Para indústrias:** cliente escolhe prefixo (ex: "Aura") → vira "AuraPulse". O "Pulse" é sempre fixo.
- **Repositório:** AgroVitoria_v2 (GitHub Codespaces)
- **Backend:** Django 4.2.29 + Django REST Framework
- **Frontend:** Lovable (React + TypeScript + Tailwind)
- **Banco dev:** SQLite | **Banco prod:** PostgreSQL (Railway)
- **Storage:** Amazon S3
- **NF-e:** Focus NFe (API terceirizada)
- **Deploy:** Railway (ainda não feito)

## Estrutura do Projeto
```
AgroVitoria_v2/
├── core/
│   ├── settings.py        # Configurado com python-decouple + JWT + CORS
│   ├── urls.py            # Todas as rotas incluindo JWT auth
│   └── wsgi.py
├── gestao/
│   ├── models.py          # Todos os models
│   ├── views.py           # Todas as views/endpoints
│   ├── serializers.py
│   ├── admin.py
│   ├── bi_dashboard.py    # Cálculos financeiros e alertas (OTIMIZADO)
│   ├── dashboard_perfil.py # Dashboard por perfil (OTIMIZADO)
│   ├── aprovacoes.py      # Fila de aprovações (OTIMIZADO)
│   ├── caixa.py           # Abertura/fechamento de caixa
│   ├── relatorios.py      # DRE, inadimplência, performance (OTIMIZADO)
│   ├── expedicao.py       # Romaneio de carga cego
│   ├── pedido_compra.py   # Pedidos de compra
│   ├── fiscal.py          # Motor fiscal, CFOP, Focus NFe
│   ├── whitelabel.py      # White-label para indústrias (S3 + colorthief)
│   ├── estoque_inicial_e_financeiro_avulso.py  # Estoque inicial + lançamento avulso
│   ├── processador_xml.py # Processador de XML de NF-e de entrada
│   └── middleware.py      # AutomaticLoginMiddleware (SÓ DEV — remover em produção)
├── Procfile               # Deploy Railway
├── railway.json           # Configuração Railway
├── requirements.txt       # Dependências Python
├── manage.py
└── db.sqlite3             # Banco de desenvolvimento
```

## Tipos de Cliente (tipo_negocio na Empresa)
- `industria` — Indústrias. Têm white-label disponível e módulo de produção futuro.
- `varejo` — Revendas e distribuidoras de insumos agrícolas.
- `representacao` — Empresas de representação comercial (sprint futuro).

## Hierarquia de Usuários (nivel no Usuario)
- `diretor` — Acesso total. Único que libera permissões e vê logs comportamentais.
- `gerente` — Acesso amplo. Aprova pedidos e vê financeiro.
- `vendedor` — Vê só seus clientes e suas vendas/comissões.
- `operacional` — Visão cega. Só estoque SEM valores financeiros.

## Regras Críticas — NUNCA VIOLAR

1. **Isolamento multi-tenant:** Todo queryset DEVE filtrar por `empresa_id`.
2. **Visão cega:** `operacional` NUNCA vê preços, custos, margens ou valores financeiros.
3. **Logs imutáveis:** `LogAuditoria` e `LogComportamental` só têm append. Nunca delete/update.
4. **Estoque só baixa ao faturar:** Baixa APENAS quando `PedidoVenda.status` muda para `faturado`.
5. **Comissão fotografada:** `ItemPedido.comissao_aplicada` guarda o % no momento da venda. Nunca recalcular retroativamente.
6. **White-label só para indústrias:** `ConfiguracaoWhiteLabel` só para `tipo_negocio='industria'`.
7. **Nunca modificar código existente sem avisar:** Sempre alertar e pedir confirmação antes de alterar algo que já existe.
8. **AutomaticLoginMiddleware:** Está em `middleware.py` e DEVE ser removido antes do deploy em produção.

## Autenticação (Sprint 7)
- JWT via `djangorestframework-simplejwt`
- `POST /api/auth/login/` → retorna access + refresh + dados do usuário
- `POST /api/auth/logout/` → invalida refresh token
- `GET /api/auth/me/` → retorna dados do usuário autenticado
- `POST /api/auth/refresh/` → renova access token
- Access token: 8 horas | Refresh token: 7 dias

## APIs Disponíveis

### Auth
- `POST /api/onboarding/` — cadastro de nova empresa + diretor (rota pública)
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`
- `POST /api/auth/refresh/`

### Dashboard
- `GET /api/dashboard/`

### Alertas
- `GET /api/alertas/estoque/`
- `GET /api/alertas/validade/`
- `GET /api/alertas/contas-vencer/`
- `GET /api/alertas/receber-atrasados/`
- `GET /api/alertas/clientes/`
- `GET /api/alertas/aniversariantes/`

### Notificações
- `GET /api/notificacoes/`
- `POST /api/notificacoes/<id>/lida/`
- `POST /api/notificacoes/marcar-todas-lidas/`

### Aprovações
- `GET /api/aprovacoes/`
- `POST /api/aprovacoes/<id>/aprovar/`
- `POST /api/aprovacoes/<id>/recusar/`

### Caixa
- `POST /api/caixa/abrir/`
- `GET /api/caixa/resumo/`
- `POST /api/caixa/fechar/`
- `POST /api/caixa/sangria/`
- `POST /api/caixa/suprimento/`

### Relatórios
- `GET /api/relatorios/dre/?mes=3&ano=2026`
- `GET /api/relatorios/inadimplencia/`
- `GET /api/relatorios/performance-vendedores/`
- `GET /api/relatorios/comissoes-repasse/`
- `GET /api/relatorios/curva-abc-lucratividade/`

### Estoque
- `GET /api/estoque/entradas-saidas/`
- `GET /api/estoque/inicial/verificar/`
- `POST /api/estoque/inicial/lancar/`

### Financeiro
- `GET/POST /api/financeiro/lancamentos/`
- `GET /api/financeiro/contas-aberto/`

### Fiscal
- `GET/POST /api/fiscal/configuracao/`
- `GET /api/fiscal/sugerir/<produto_id>/?uf_destino=SP`
- `POST /api/fiscal/emitir-nfe/<pedido_id>/`
- `GET /api/fiscal/status-nfe/<referencia>/`
- `GET /api/fiscal/contador/`
- `POST /api/fiscal/popular-dados/`

### White-label
- `GET /api/whitelabel/`
- `POST /api/whitelabel/upload-logo/`
- `POST /api/whitelabel/configurar/`

### Expedição
- `GET /api/expedicao/`
- `GET /api/expedicao/<pedido_id>/romaneio/`

### Pedidos de Compra
- `GET /api/pedidos-compra/`
- `POST /api/pedidos-compra/criar/`
- `POST /api/pedidos-compra/<id>/vincular-nf/`

### Comissões e Dossiê
- `GET /api/comissoes/`
- `GET /api/vendedor/<id>/dossie/`

### Permissões
- `GET/POST /api/permissoes/<usuario_id>/`

### ViewSets (CRUD completo)
- `/api/pedidos/`
- `/api/clientes/`
- `/api/produtos/`
- `/api/contas-pagar/`
- `/api/contas-receber/`

## Frontend Lovable

### Arquivos existentes:
- `src/contexts/PrivacyContext.tsx` — toggle privacidade
- `src/hooks/use-mobile.tsx` — detecção mobile
- `src/components/AppLayout.tsx` — layout principal
- `src/components/AppSidebar.tsx` — sidebar
- `src/pages/Index.tsx`, `Sales.tsx`, `Stock.tsx`, `Expedition.tsx`
- `src/pages/Financial.tsx`, `Fiscal.tsx`, `Reports.tsx`
- `src/pages/UsersPage.tsx`, `Setup.tsx`, `Companies.tsx`, `Products.tsx`

### A criar/atualizar (Sprint 7 em andamento):
- `src/contexts/AuthContext.tsx` — JWT (CRIAR)
- `src/hooks/useApi.ts` — hook de API (CRIAR)
- `src/pages/Login.tsx` — tela de login (CRIAR)
- `src/components/ProtectedRoute.tsx` — proteção de rotas (CRIAR)
- `src/App.tsx` — AuthProvider + rotas protegidas (ATUALIZAR)
- `src/pages/Index.tsx` — dados reais da API (ATUALIZAR)
- `src/components/AppLayout.tsx` — usuário logado + logout (ATUALIZAR)
- `.env` — `VITE_API_URL=http://localhost:8000` (CRIAR)

## Fases 6, 7 e 8 — Financeiro Avançado + RH + SuperHost + SPED (CONCLUÍDAS)

### Fase 6 — Financeiro Avançado
Novo arquivo: gestao/financeiro_avancado.py
- Centros de custo (criar, listar, DRE por centro)
- Lançamentos recorrentes (geração automática mensal de ContaPagar)
- Fluxo de caixa (projeção vs realizado, linha do tempo diária)
- Conciliação bancária OFX — import, match automático por valor/data, conciliação manual
- Boletos via Asaas API (gerar para ContaReceber)
- painel_superhost() e consolidado_matriz() centralizados aqui

Novos models: CentroCusto, LancamentoRecorrente, ConciliacaoBancaria,
              TransacaoBancaria, ConfiguracaoFinanceira

Novos endpoints (8):
  GET/POST /api/financeiro/centros-custo/
  GET      /api/financeiro/dre-centro-custo/
  GET      /api/financeiro/fluxo-caixa/
  GET/POST /api/financeiro/recorrentes/
  POST     /api/financeiro/recorrentes/gerar/
  POST     /api/financeiro/conciliacao/importar/
  POST     /api/financeiro/conciliacao/<id>/conciliar/
  POST     /api/financeiro/boleto/<id>/

### Fase 7 — RH + SuperHost + Matriz-Filial
Novo arquivo: gestao/rh.py
- INSS e IRRF calculados automaticamente pela tabela 2024
- Folha gerada em transação atômica para todos os colaboradores ativos

Novos models: Colaborador, RegistroPonto, Ferias, Afastamento,
              FolhaPagamento, ItemFolhaPagamento

Novos endpoints RH (4):
  GET/POST /api/rh/colaboradores/
  GET/POST /api/rh/ponto/
  POST     /api/rh/ferias/
  GET/POST /api/rh/folha/

Novos endpoints SuperHost e Matriz (4):
  GET  /api/superhost/clientes/
  POST /api/superhost/bloquear/<id>/
  GET  /api/matriz/consolidado/
  GET  /api/matriz/filiais/

### Fase 8 — SPED, EFD-Reinf, Importação em Lote
Novo arquivo: gestao/importacao_sped.py
- importar_xmls_lote() — batch de XMLs usando processador_xml existente
- consultar_nfes_sefaz_cnpj() — consulta Focus NFe pelo CNPJ
- gerar_sped_fiscal() — EFD-ICMS/IPI em TXT (blocos 0, C, 9)
- gerar_efd_reinf_r1000() — evento R-1000 em XML

Novos endpoints (4):
  POST /api/importacao/xml-lote/
  GET  /api/importacao/sefaz-consulta/
  GET  /api/fiscal/sped/
  GET  /api/fiscal/efd-reinf/

### Migration
- 0010_fases6_7_8.py

### Novo arquivo: gestao/compras_orcamentos.py
Contém toda a lógica de negócio da fase:
- Orçamentos: criar, listar, converter em PedidoVenda
- Solicitações de compra: criar (qualquer nível), aprovar/recusar (gerente/diretor)
- Cotações: criar, registrar respostas de fornecedores, comparativo, encerrar
- Avaliação de fornecedores: registrar nota por pedido, resumo com médias
- Inventário físico: iniciar (popula todos os produtos), registrar contagem,
  concluir (aplica ajustes automáticos no estoque via MovimentacaoEstoque)

### Novos models em gestao/models.py
- Orcamento + ItemOrcamento
- SolicitacaoCompra
- CotacaoCompra + ItemCotacao + RespostaFornecedorCotacao
- AvaliacaoFornecedor
- InventarioFisico + ItemInventario

### Novos endpoints (15 rotas)
- GET/POST  /api/orcamentos/
- POST      /api/orcamentos/<id>/converter/
- GET/POST  /api/compras/solicitacoes/
- POST      /api/compras/solicitacoes/<id>/decidir/
- GET/POST  /api/compras/cotacoes/
- GET       /api/compras/cotacoes/<id>/comparativo/
- POST      /api/compras/cotacoes/<id>/resposta/
- POST      /api/compras/cotacoes/<id>/encerrar/
- POST      /api/fornecedores/avaliar/
- GET       /api/fornecedores/<id>/resumo/
- GET/POST  /api/estoque/inventario/
- GET       /api/estoque/inventario/<id>/
- POST      /api/estoque/inventario/<id>/contar/
- POST      /api/estoque/inventario/<id>/concluir/

### Migration
- 0009_fase5_orcamentos_compras_inventario.py

### Novo arquivo: gestao/manifestacao.py
- `consultar_nfes_pendentes(empresa_id)` — lista NF-es destinadas ao CNPJ via Focus NFe
- `manifestar_nfe(empresa_id, usuario, chave, tipo, justificativa)` — registra Ciência,
  Confirmação, Desconhecimento ou Operação não Realizada. Salva em ManifestacaoNFe + LogAuditoria
- `cancelar_nfe(empresa_id, usuario, referencia, justificativa)` — cancela NF-e via Focus NFe
- `carta_correcao_nfe(empresa_id, usuario, referencia, correcao)` — envia CC-e via Focus NFe

### Novo arquivo: gestao/pdv.py
- `criar_venda_pdv(...)` — venda completa: valida estoque, calcula troco, baixa estoque FEFO,
  registra no caixa, emite NFC-e automaticamente
- `cancelar_venda_pdv(...)` — devolve estoque, estorna no caixa, cancela NFC-e
- `emitir_nfce_pdv(empresa_id, venda)` — emite NFC-e (modelo 65) via Focus NFe

### Novos models em gestao/models.py
- ManifestacaoNFe — registra cada manifestação com chave, tipo, status, resposta da SEFAZ
- PedidoVendaPDV — venda de balcão com campos de NFC-e, troco e CPF opcional
- ItemPedidoPDV — itens da venda PDV com preço final e desconto
- LogAuditoria.ACAO_CHOICES — adicionados: manifestacao_nfe, cancelamento_nfe,
  carta_correcao_nfe, venda_pdv, cancelamento_pdv

### Novos endpoints em gestao/views.py + core/urls.py
- GET  /api/fiscal/manifestacao/pendentes/    — lista NF-es para manifestar
- POST /api/fiscal/manifestacao/              — manifesta uma NF-e
- POST /api/fiscal/cancelar/<referencia>/     — cancela NF-e
- POST /api/fiscal/carta-correcao/<ref>/      — envia CC-e
- POST /api/pdv/vender/                       — realiza venda PDV
- GET  /api/pdv/vendas/                       — lista vendas PDV (com filtros e exportação)
- POST /api/pdv/<id>/cancelar/                — cancela venda PDV

### Migration
- 0008_fase4_manifestacao_pdv.py

### Novo arquivo: gestao/filtros_export.py
- `get_filtros_base(request)` — helper padronizado que extrai data_inicio, data_fim,
  cliente_id, fornecedor_id, vendedor_id, produto_id, status de qualquer request.
  Suporta atalhos via ?atalho=hoje|semana|mes|mes_anterior|ano
- `exportar_pdf(titulo, colunas, linhas, filename)` — gera PDF formatado com reportlab
- `exportar_excel(titulo, colunas, linhas, filename)` — gera .xlsx formatado com openpyxl
- `preparar_exportacao(dados, mapeamento)` — converte lista de dicts para (colunas, linhas)

### requirements.txt
- Adicionados: reportlab, openpyxl

### ViewSets atualizados com filtros
- PedidoVendaViewSet — filtros: data, cliente, status, vendedor (vendedor só vê seus pedidos)
- ClienteViewSet — filtros: status + busca por nome/CNPJ
- ProdutoViewSet — busca por nome/SKU/NCM
- ContaPagarViewSet — filtros: data_vencimento, fornecedor, status
- ContaReceberViewSet — filtros: data_vencimento, cliente, status

### Views de relatório atualizadas com filtros + exportação
Todos aceitam ?exportar=pdf ou ?exportar=excel:
- api_dre — filtros: mes, ano
- api_inadimplencia — exportação completa com aging
- api_performance_vendedores — filtros: mes, ano, vendedor_id
- api_comissoes_repasse — filtros: mes, ano, vendedor_id (detalhe por item)
- api_curva_abc_lucratividade — filtros: dias
- api_entradas_saidas_detalhado — filtros: data, produto, tipo + atalhos
- api_pedidos_compra — filtros: data, fornecedor, status
- api_contas_aberto_clientes — filtros: cliente

### Empresa
- Adicionado campo `empresa_matriz` (FK self, nullable) — define hierarquia matriz/filial
- Adicionado campo `prazo_expiracao_pedido` (int, default=2) — configurável pelo Diretor
- Adicionadas properties `is_matriz` e `is_filial`

### Usuario
- Adicionado nível `administrativo` ao NIVEIS_CHOICES (entre vendedor e operacional)

### PedidoVenda
- Adicionado status `expirado` ao STATUS_CHOICES
- Adicionado campo `data_expiracao` (DateTimeField, nullable) — preenchido ao entrar em 'aguardando'
- Adicionado campo `estoque_baixado` (bool) — evita dupla baixa
- **COMPORTAMENTO ALTERADO:** estoque baixa ao criar pedido (status 'aguardando'), não ao faturar
- Adicionada função `devolver_estoque_logico()` — chamada ao recusar ou expirar
- `faturar_pedido()` atualizado — aceita status 'aprovado' e 'aguardando'

### Notificacao
- Adicionados tipos: `pedido_aprovado`, `pedido_expirado`, `meta_atingida`
- Adicionado campo `visivel_para_nivel` — filtragem por perfil no dashboard

### aprovacoes.py
- `verificar_travas_pedido()` — adicionada TRAVA 3: estoque insuficiente por item
- `aprovar_pedido()` — agora notifica o vendedor ao aprovar (tipo: pedido_aprovado)
- `recusar_pedido()` — notificação ao vendedor com visivel_para_nivel='vendedor'
- `reter_pedido_para_aprovacao()` — notificação com visivel_para_nivel='gerente,diretor'
- `expirar_pedidos_vencidos()` — nova função, chamada pelo management command
- `listar_fila_aprovacao()` — agora inclui data_expiracao no retorno

### views.py
- Administrativo adicionado como nível permitido em: DRE, inadimplência, curva ABC,
  pedidos de compra, portal contador, entradas/saídas, lançamentos financeiros,
  contas em aberto, emissão de NF-e
- Novo endpoint: `POST /api/aprovacoes/<id>/expirar/` — apenas diretor

### Management command
- `python manage.py expirar_pedidos` — expira pedidos vencidos
- Agendar no Railway: `0 3 * * * python manage.py expirar_pedidos`

### Migration
- `0007_fase2_empresa_usuario_pedido_notificacao.py`

### Funcionalidades críticas pendentes:
1. Manifestação de NF-e — obrigatório por lei
2. Lançamentos Recorrentes
3. Tabela de Preços
4. Boletos
5. SPED Fiscal
6. EFD Contribuições (PIS/COFINS)
7. NFC-e

### Sprints futuros:
- Automações WhatsApp
- Perfil de Representação
- Módulo de Produção (indústrias)

## Como Rodar
```bash
cd /workspaces/AgroVitoria_v2
python manage.py runserver
```

## Regras de Trabalho
- NUNCA concordar por conveniência
- NUNCA modificar código existente sem avisar e pedir confirmação
- Sempre verificar o que já existe antes de criar algo novo
- Sistema deve funcionar como ecossistema único — tudo integrado
- Sem duplicidade de funcionalidades

## Bugs Identificados — CORRIGIR ANTES DO DEPLOY

### ✅ RESOLVIDO — Bug 1: Login exige empresa vinculada para todos os usuários
- Corrigido em `gestao/views.py` → `api_login()`
- Superuser com `is_staff=True` e sem empresa é reconhecido como SuperHost e bypassa a exigência
- Retorna `nivel: 'superhost'` e `empresa_id: None` no payload JWT

### ✅ RESOLVIDO — Bug 2: Onboarding de cliente não existia
- Criado `gestao/onboarding.py` com endpoint `POST /api/onboarding/`
- Cria empresa + primeiro usuário Diretor em transação atômica
- Rota pública (AllowAny) registrada em `core/urls.py`
- Retorna tokens JWT do Diretor para login automático após cadastro
- Frontend: criar `src/pages/Onboarding.tsx` com rota pública `/cadastro`

### ✅ RESOLVIDO — Bug 3: AutomaticLoginMiddleware
- Já estava comentado em `core/settings.py`
- Comentário limpo e documentado