# Módulo Crédito e Cobrança Rural - Documentação API

Janela 9 do AgroPulse — Análise de crédito, monitoramento de carteira e cobrança ativa.

## Visão Geral

Este módulo gerencia:
- **Análise preventiva de risco** - Score de crédito, ficha de análise
- **Concessão de crédito** - Limite com alçadas configuráveis
- **Monitoramento contínuo** - Aging, inadimplência, concentração
- **Cobrança ativa** - Lista diária, tentativas, encaminhamento jurídico
- **Acordos e disputas** - Parcelamento e títulos em disputa

---

## Endpoints da API

### 1. CONFIGURAÇÃO DE CRÉDITO

**GET `/api/credito/config/`**
- Retorna configuração única da empresa
- Alçadas de aprovação
- Pesos do score
- Percentuais de PDD
- Limites de bloqueio
- Percentual de concentração

**PUT `/api/credito/config/`**
- Atualiza configuração (apenas Diretor)

---

### 2. ANÁLISE DE CRÉDITO

**POST `/api/credito/ficha-analise/`**
```json
{
  "cliente_id": 1,
  "area_plantada": 100.5,
  "cultura_principal": "Soja",
  "produtividade_historica": 45.5,
  "renda_estimada_anual": 150000.00,
  "endividamento_total_declarado": 50000.00,
  "divida_bancaria": 30000.00,
  "divida_fornecedores": 20000.00,
  "tem_imovel": true,
  "valor_imovel": 500000.00,
  "tem_maquinario": true,
  "valor_maquinario": 200000.00,
  "outras_garantias": "Penhor BNDES",
  "observacoes": "Ótimo histórico"
}
```

**GET `/api/credito/ficha-analise/`**
- Lista de fichas de análise da empresa

**GET `/api/credito/ficha-analise/{id}/`**
- Detalhe de uma ficha

**PUT `/api/credito/ficha-analise/{id}/`**
- Atualiza ficha existente

---

### 3. SCORE DE CRÉDITO

**GET `/api/credito/score/`**
- Lista scores de todos os clientes
- Ordenado por score_final (decrescente)

**POST `/api/credito/score/recalcular_todos/`**
- Recalcula score de TODOS os clientes da empresa
- Retorna: `{"recalculados": 123}`

**POST `/api/credito/score/{id}/recalcular/`**
- Recalcula score de um cliente específico
- Retorna: score atualizado

**Classificações do Score:**
- A: 90-100 (Excelente)
- B: 75-89 (Bom)
- C: 60-74 (Médio)
- D: 40-59 (Baixo)
- E: < 40 (Muito Baixo)

---

### 4. LIMITE DE CRÉDITO

**POST `/api/credito/limite/conceder/`**
```json
{
  "cliente_id": 1,
  "valor_limite": 50000.00,
  "observacoes": "Aprovado em reunião"
}
```
- Aprova limite automaticamente por alçada
- Gerente: até R$ X
- Diretor Comercial: até R$ Y
- CEO: acima de R$ Z

**GET `/api/credito/limite/`**
- Lista limites ativos (ativo=True)

**POST `/api/credito/limite/revisar_periodicamente/`**
- Gera notificações de revisão vencidas
- Retorna: `{"revisoes_iniciadas": 5}`

---

### 5. MONITORAMENTO DA CARTEIRA

**GET `/api/credito/carteira/aging/`**
- Aging atual em faixas
```json
{
  "a_vencer": 50000.00,
  "dias_1_15": 20000.00,
  "dias_16_30": 15000.00,
  "dias_31_60": 10000.00,
  "dias_61_90": 5000.00,
  "dias_91_180": 3000.00,
  "acima_180": 2000.00,
  "total_em_dia": 50000.00,
  "total_em_atraso": 55000.00,
  "total_carteira": 105000.00,
  "indice_inadimplencia": 52.38,
  "maior_cliente_nome": "Cliente X",
  "maior_cliente_valor": 20000.00,
  "percentual_concentracao": 19.05
}
```

**GET `/api/credito/carteira/indice_inadimplencia/`**
- Índice de inadimplência do dia: `{"indice_inadimplencia": 52.38}`

**GET `/api/credito/carteira/concentracao/`**
- Alerta de concentração de carteira

**POST `/api/credito/carteira/registrar_snapshot/`**
- Registra snapshot diário para histórico

**GET `/api/credito/carteira/historico_snapshots/`**
- Histórico de snapshots (últimos 30 dias)
- Cada snapshot inclui aging e índices

---

### 6. COBRANÇA ATIVA

**GET `/api/credito/cobranca/lista_diaria/`**
- Lista de clientes prioritários para contato
- Ordenado por: dias_atraso × valor (maior prioridade primeiro)

```json
[
  {
    "cliente_id": 1,
    "cliente_nome": "Produtor X",
    "valor_total": 55000.00,
    "dias_atraso_maximo": 45,
    "prioridade": 2475000,
    "contas": [
      {
        "id": 5,
        "descricao": "Fatura 001",
        "valor": 20000.00,
        "vencimento": "2026-02-20"
      }
    ]
  }
]
```

**POST `/api/credito/cobranca/registrar_tentativa/`**
```json
{
  "cliente_id": 1,
  "tipo_contato": "telefone",
  "resultado": "promessa_pagamento",
  "contas_ids": [5, 6],
  "observacoes": "Cliente prometeu pagar até sexta",
  "valor_negociado": 10000.00,
  "proxima_acao": "agendar_novo_contato",
  "data_proxima_acao": "2026-04-26"
}
```

**Tipos de contato:**
- telefone
- whatsapp
- email
- sms
- visitacao
- correspondencia

**Resultados:**
- contato_realizado
- nao_respondeu
- fone_incorreto
- promessa_pagamento
- pagamento_parcial
- pagamento_completo
- nega_divida
- renegociacao_solicitada
- sem_condicoes

**GET `/api/credito/cobranca/tentativas_cliente/?cliente_id=1`**
- Histórico de tentativas de um cliente

**POST `/api/credito/cobranca/encaminhamento_juridico/`**
```json
{
  "cliente_id": 1,
  "motivo": "Não atende há 30 dias e possui atraso acima de 90"
}
```
- Encaminha para processo jurídico
- Gera pacote de documentos

---

### 7. TÍTULOS EM DISPUTA

**POST `/api/credito/disputa/`**
```json
{
  "conta_receber_id": 5,
  "motivo": "nao_recebeu",
  "descricao": "Cliente alega que não recebeu a nota fiscal nº 001"
}
```

**GET `/api/credito/disputa/`**
- Lista disputas abertas

**POST `/api/credito/disputa/{id}/resolver/`**
```json
{
  "resolucao_descricao": "Reenviamos NF-e. Cliente confirmou recebimento."
}
```
- Marca como resolvida

**Motivos de disputa:**
- nao_recebeu
- quantidade_incorreta
- qualidade_produto
- valor_discordancia
- nfe_nao_corresponde
- outro

---

### 8. ACORDOS JUDICIAIS

**POST `/api/credito/acordo/criar_com_parcelas/`**
```json
{
  "cliente_id": 1,
  "numero_acordo": "ACC-2026-0001",
  "valor_original": 100000.00,
  "valor_acordo": 85000.00,
  "numero_parcelas": 10,
  "data_primeira_parcela": "2026-05-20",
  "observacoes": "Redução de 15% em multa"
}
```
- Cria acordo e gera parcelas automaticamente
- Parcelas a cada 30 dias

**GET `/api/credito/acordo/`**
- Lista acordos vigentes

**POST `/api/credito/acordo/verificar_parcelas_vencendo/`**
- Verifica parcelas vencendo nos próximos 5 dias
- Retorna: `{"parcelas_vencendo": 3, "notificacoes": [...]}`

---

### 9. PROVISÃO PDD

**GET `/api/credito/pdd/`**
- Histórico de provisões (últimos 30 dias)

**POST `/api/credito/pdd/calcular_hoje/`**
- Calcula PDD do dia baseado no aging
- Retorna:

```json
{
  "data_calculo": "2026-04-23",
  "total_pendente_31_60_dias": 10000.00,
  "total_pendente_61_90_dias": 5000.00,
  "total_pendente_91_180_dias": 3000.00,
  "total_pendente_acima_180_dias": 2000.00,
  "pdd_31_60_dias": 100.00,
  "pdd_61_90_dias": 500.00,
  "pdd_91_180_dias": 300.00,
  "pdd_acima_180_dias": 1000.00,
  "pdd_total": 1900.00
}
```

---

### 10. BLOQUEIO DE CLIENTE

**GET `/api/credito/bloqueio/verificar_bloqueio/?cliente_id=1`**
```json
{
  "cliente_id": 1,
  "bloqueado": true,
  "dias_atraso": 45,
  "acao": "Bloquear cliente"
}
```

**POST `/api/credito/bloqueio/bloquear/`**
```json
{
  "cliente_id": 1
}
```
- Bloqueia cliente impede novos pedidos (ativo=False)

---

## Fluxos de Negócio

### Fluxo 1: Concessão de Crédito
1. Criar ficha de análise com dados do cliente
2. Sistema calcula score automaticamente
3. Usar endpoint `/conceder/` com valor desejado
4. Sistema valida alçada baseado no valor
5. Limite é concedido com data de revisão (~90 dias)

### Fluxo 2: Monitoramento Diário
1. Executar `/api/credito/carteira/registrar_snapshot/` (via cron job)
2. Executar `/api/credito/pdd/calcular_hoje/` (via cron job)
3. Dashboard exibe aging, inadimplência, concentração
4. Sistema alerta se concentração > threshold

### Fluxo 3: Cobrança Ativa
1. Gerar `/api/credito/cobranca/lista_diaria/` para cobrador
2. Cobrador registra tentativas com `/registrar_tentativa/`
3. Se pagamento, contas são marcadas como 'recebido'
4. Score do cliente é recalculado
5. Se atraso > N dias, cliente é bloqueado automaticamente
6. Se atraso > M dias, encaminhar para jurídico

### Fluxo 4: Acordo Judicial
1. Criar acordo com `/criar_com_parcelas/`
2. Parcelas são geradas automaticamente
3. Sistema alerta 5 dias antes do vencimento
4. Cobrador atualiza status conforme recebimento
5. Ao cumprir todas, acordo finaliza

---

## Management Commands (Cron Jobs)

```bash
# Calcular PDD diário
python manage.py calcular_pdd --empresa-id 1

# Registrar snapshot de aging diário
python manage.py registrar_aging_snapshot --empresa-id 1

# Verificar bloqueios automáticos
python manage.py verificar_bloqueios --empresa-id 1

# Alertar parcelas vencendo
python manage.py alertar_parcelas_vencendo --empresa-id 1
```

---

## Permissões e Visibilidade

| Ação | Diretor | Gerente | Vendedor | Administrativo | Operacional |
|------|---------|---------|----------|---|---|
| Ver config | ✓ | ✓ | ✗ | ✗ | ✗ |
| Alterar config | ✓ | ✗ | ✗ | ✗ | ✗ |
| Criar ficha análise | ✓ | ✓ | ✗ | ✓ | ✗ |
| Aprovar limite | ✓ | ✓* | ✗ | ✗ | ✗ |
| Ver carteira | ✓ | ✓ | ✗ | ✓ | ✗ |
| Ver cobrança | ✓ | ✓ | Próprios | ✓ | ✗ |
| Registrar tentativa | ✓ | ✓ | ✓** | ✗ | ✗ |
| Bloquear cliente | ✓ | ✓ | ✗ | ✗ | ✗ |

\* Gerente aprova até seu limite
\*\* Vendedor de seus próprios clientes

---

## Observações Importantes

1. **Score é recalculado diariamente**: Baseado em histórico de pagamentos, tempo, volume e dados cadastrais
2. **PDD é agrupado por faixa**: 31-60, 61-90, 91-180, acima de 180 dias
3. **Alçadas são configuráveis**: Gerente, Diretor Comercial, CEO
4. **Bloqueio é automático**: Quando dias em atraso ≥ N dias configurado
5. **Aging é diário**: Snapshot registrado para análise de tendência
6. **Todos os registros são auditados**: LogAuditoria rastreia todas as ações

---

## Exemplos de Requisições

### Criar ficha de análise
```bash
curl -X POST http://localhost:8000/api/credito/ficha-analise/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 1,
    "area_plantada": 100,
    "cultura_principal": "Soja"
  }'
```

### Conceder limite
```bash
curl -X POST http://localhost:8000/api/credito/limite/conceder/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 1,
    "valor_limite": 50000,
    "observacoes": "Aprovado"
  }'
```

### Registrar tentativa de cobrança
```bash
curl -X POST http://localhost:8000/api/credito/cobranca/registrar_tentativa/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 1,
    "tipo_contato": "telefone",
    "resultado": "promessa_pagamento",
    "contas_ids": [5],
    "valor_negociado": 10000
  }'
```

### Ver aging da carteira
```bash
curl -X GET http://localhost:8000/api/credito/carteira/aging/ \
  -H "Authorization: Bearer $TOKEN"
```

---

## Frontend - Páginas Sugeridas

1. **Dashboard Crédito** - Visão geral, scoring, carteira
2. **Análise de Clientes** - Criar/editar fichas
3. **Limites** - Concessão e revisão
4. **Monitoramento** - Aging, inadimplência, concentração
5. **Cobrança** - Lista diária, tentativas, histórico
6. **Disputas** - Registro e resolução
7. **Acordos** - Criação e acompanhamento
8. **Configurações** - Alçadas, pesos, alertas
