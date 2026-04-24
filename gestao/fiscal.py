# ==========================================
# ARQUIVO NOVO: gestao/fiscal.py
# Crie esse arquivo na pasta gestao/
# ==========================================

from decimal import Decimal


# ==========================================
# DADOS PRÉ-CONFIGURADOS (fontes oficiais)
# CONFAZ + Receita Federal
# ==========================================

# Relacionamento CFOP entrada → saída mais usados no agro
CFOPS_AGRO = [
    {
        'cfop_entrada': '1102',
        'descricao_entrada': 'Compra para comercialização dentro do estado',
        'cfop_saida_interno': '5102',
        'cfop_saida_externo': '6102',
        'descricao_saida': 'Venda de mercadoria adquirida de terceiros',
    },
    {
        'cfop_entrada': '2102',
        'descricao_entrada': 'Compra para comercialização de outro estado',
        'cfop_saida_interno': '5102',
        'cfop_saida_externo': '6102',
        'descricao_saida': 'Venda de mercadoria adquirida de terceiros',
    },
    {
        'cfop_entrada': '1403',
        'descricao_entrada': 'Compra para comercialização com ST dentro do estado',
        'cfop_saida_interno': '5405',
        'cfop_saida_externo': '6404',
        'descricao_saida': 'Venda com substituição tributária',
    },
    {
        'cfop_entrada': '2403',
        'descricao_entrada': 'Compra para comercialização com ST de outro estado',
        'cfop_saida_interno': '5405',
        'cfop_saida_externo': '6404',
        'descricao_saida': 'Venda com substituição tributária',
    },
    {
        'cfop_entrada': '1101',
        'descricao_entrada': 'Compra para industrialização dentro do estado',
        'cfop_saida_interno': '5101',
        'cfop_saida_externo': '6101',
        'descricao_saida': 'Venda de produção do estabelecimento',
    },
    {
        'cfop_entrada': '2101',
        'descricao_entrada': 'Compra para industrialização de outro estado',
        'cfop_saida_interno': '5101',
        'cfop_saida_externo': '6101',
        'descricao_saida': 'Venda de produção do estabelecimento',
    },
]

# Matriz tributária por regime (valores oficiais — Receita Federal)
MATRIZ_TRIBUTARIA = [
    # ---- SIMPLES NACIONAL ----
    # PIS/COFINS já estão no DAS — saem com alíquota 0% na NF-e
    # CSOSN 102 = tributada sem permissão de crédito
    {
        'regime': 'simples',
        'descricao': 'Venda tributada (sem ST)',
        'csosn': '102',
        'cst_icms': None,
        'cst_pis': '07',   # Operação isenta da contribuição
        'aliquota_pis': Decimal('0.00'),
        'cst_cofins': '07',
        'aliquota_cofins': Decimal('0.00'),
        'padrao': True,
    },
    # CSOSN 400 = não tributada pelo ICMS
    {
        'regime': 'simples',
        'descricao': 'Venda não tributada pelo ICMS',
        'csosn': '400',
        'cst_icms': None,
        'cst_pis': '07',
        'aliquota_pis': Decimal('0.00'),
        'cst_cofins': '07',
        'aliquota_cofins': Decimal('0.00'),
        'padrao': False,
    },
    # CSOSN 500 = ICMS cobrado anteriormente por ST
    {
        'regime': 'simples',
        'descricao': 'Venda com ST (ICMS já recolhido)',
        'csosn': '500',
        'cst_icms': None,
        'cst_pis': '07',
        'aliquota_pis': Decimal('0.00'),
        'cst_cofins': '07',
        'aliquota_cofins': Decimal('0.00'),
        'padrao': False,
    },

    # ---- LUCRO PRESUMIDO ----
    # PIS 0,65% + COFINS 3,00% — regime cumulativo
    # CST ICMS 000 = tributada integralmente
    {
        'regime': 'presumido',
        'descricao': 'Venda tributada normal',
        'csosn': None,
        'cst_icms': '000',
        'cst_pis': '01',   # Operação tributável com alíquota básica
        'aliquota_pis': Decimal('0.65'),
        'cst_cofins': '01',
        'aliquota_cofins': Decimal('3.00'),
        'padrao': True,
    },
    # CST ICMS 060 = cobrado anteriormente por ST
    {
        'regime': 'presumido',
        'descricao': 'Venda com ST (ICMS já recolhido)',
        'csosn': None,
        'cst_icms': '060',
        'cst_pis': '01',
        'aliquota_pis': Decimal('0.65'),
        'cst_cofins': '01',
        'aliquota_cofins': Decimal('3.00'),
        'padrao': False,
    },
    # CST ICMS 040 = isenta
    {
        'regime': 'presumido',
        'descricao': 'Venda isenta de ICMS',
        'csosn': None,
        'cst_icms': '040',
        'cst_pis': '06',   # Operação tributável a alíquota zero
        'aliquota_pis': Decimal('0.00'),
        'cst_cofins': '06',
        'aliquota_cofins': Decimal('0.00'),
        'padrao': False,
    },

    # ---- LUCRO REAL ----
    # PIS 1,65% + COFINS 7,60% — regime não cumulativo (com crédito)
    {
        'regime': 'real',
        'descricao': 'Venda tributada normal',
        'csosn': None,
        'cst_icms': '000',
        'cst_pis': '01',
        'aliquota_pis': Decimal('1.65'),
        'cst_cofins': '01',
        'aliquota_cofins': Decimal('7.60'),
        'padrao': True,
    },
    {
        'regime': 'real',
        'descricao': 'Venda com ST (ICMS já recolhido)',
        'csosn': None,
        'cst_icms': '060',
        'cst_pis': '01',
        'aliquota_pis': Decimal('1.65'),
        'cst_cofins': '01',
        'aliquota_cofins': Decimal('7.60'),
        'padrao': False,
    },
    {
        'regime': 'real',
        'descricao': 'Venda isenta de ICMS',
        'csosn': None,
        'cst_icms': '040',
        'cst_pis': '06',
        'aliquota_pis': Decimal('0.00'),
        'cst_cofins': '06',
        'aliquota_cofins': Decimal('0.00'),
        'padrao': False,
    },
]


def popular_dados_fiscais():
    """
    Popula o banco com os CFOPs e matriz tributária padrão.
    Execute uma vez após as migrations:
    python manage.py shell
    from gestao.fiscal import popular_dados_fiscais
    popular_dados_fiscais()
    """
    from .models import RelacionadorCFOP, MatrizTributaria

    # CFOPs globais (sem empresa específica)
    for cfop in CFOPS_AGRO:
        RelacionadorCFOP.objects.get_or_create(
            cfop_entrada=cfop['cfop_entrada'],
            empresa=None,
            defaults={
                'descricao_entrada': cfop['descricao_entrada'],
                'cfop_saida_interno': cfop['cfop_saida_interno'],
                'cfop_saida_externo': cfop['cfop_saida_externo'],
                'descricao_saida': cfop['descricao_saida'],
            }
        )

    # Matriz tributária
    for matriz in MATRIZ_TRIBUTARIA:
        MatrizTributaria.objects.get_or_create(
            regime=matriz['regime'],
            descricao=matriz['descricao'],
            defaults={
                'csosn': matriz['csosn'],
                'cst_icms': matriz['cst_icms'],
                'cst_pis': matriz['cst_pis'],
                'aliquota_pis': matriz['aliquota_pis'],
                'cst_cofins': matriz['cst_cofins'],
                'aliquota_cofins': matriz['aliquota_cofins'],
                'padrao': matriz['padrao'],
            }
        )

    print("Dados fiscais populados com sucesso!")


def sugerir_tributacao(empresa_id, uf_destino, produto):
    """
    Sugere CFOP de saída e tributação baseado no regime da empresa
    e na UF de destino.
    Retorna um dicionário com os campos sugeridos para a NF-e.
    O usuário pode editar qualquer campo antes de emitir.
    """
    from .models import ConfiguracaoFiscal, RelacionadorCFOP, MatrizTributaria

    try:
        config = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except ConfiguracaoFiscal.DoesNotExist:
        return {'erro': 'Configuração fiscal não encontrada. Cadastre o regime tributário da empresa.'}

    # Respeita a chavinha de sugestão automática
    if not config.sugestao_fiscal_automatica:
        return {'sugestao_ativa': False, 'mensagem': 'Sugestão fiscal automática desabilitada. Preencha os campos manualmente.'}

    # Define se é operação interna ou interestadual
    operacao_interna = (config.uf == uf_destino)

    # Busca CFOP de saída baseado no CFOP de entrada do produto
    cfop_entrada = produto.cfop_padrao_interno if operacao_interna else produto.cfop_padrao_externo
    cfop_saida = None

    if cfop_entrada:
        # Busca primeiro na tabela da empresa, depois na global
        relacionador = (
            RelacionadorCFOP.objects.filter(
                cfop_entrada=cfop_entrada, empresa_id=empresa_id, ativo=True
            ).first() or
            RelacionadorCFOP.objects.filter(
                cfop_entrada=cfop_entrada, empresa=None, ativo=True
            ).first()
        )
        if relacionador:
            cfop_saida = relacionador.cfop_saida_interno if operacao_interna else relacionador.cfop_saida_externo

    # Fallback: CFOP padrão se não encontrar relacionamento
    if not cfop_saida:
        cfop_saida = '5102' if operacao_interna else '6102'

    # Busca tributação padrão do regime
    tributacao = MatrizTributaria.objects.filter(
        regime=config.regime_tributario,
        padrao=True
    ).first()

    # Alíquota ICMS
    aliquota_icms = config.aliquota_icms_interno if operacao_interna else config.aliquota_icms_interestadual

    # Calcula DIFAL se for interestadual e consumidor final
    difal = Decimal('0.00')
    if not operacao_interna:
        # DIFAL = diferença entre alíquota interna do destino e interestadual
        # Regra geral pós EC 87/2015 — 50% origem / 50% destino (a partir de 2019, 100% destino)
        # Deixamos como campo editável pois varia por estado
        difal = Decimal('0.00')  # Cliente ajusta com contador

    resultado = {
        'cfop_sugerido': cfop_saida,
        'operacao': 'interna' if operacao_interna else 'interestadual',
        'regime': config.get_regime_tributario_display(),
        'crt': config.crt,
        'aliquota_icms': round(aliquota_icms, 2),
        'difal': round(difal, 2),
        'aviso': 'Sugestão automática — confirme com seu contador antes de emitir.',
    }

    if tributacao:
        resultado.update({
            'csosn': tributacao.csosn,
            'cst_icms': tributacao.cst_icms,
            'cst_pis': tributacao.cst_pis,
            'aliquota_pis': round(tributacao.aliquota_pis, 2),
            'cst_cofins': tributacao.cst_cofins,
            'aliquota_cofins': round(tributacao.aliquota_cofins, 2),
        })

    return resultado


def calcular_impostos_item(preco_unitario, quantidade, regime, aliquota_icms,
                            cst_pis, aliquota_pis, cst_cofins, aliquota_cofins):
    """
    Calcula os impostos de um item da NF-e.
    """
    subtotal = Decimal(str(preco_unitario)) * Decimal(str(quantidade))
    aliquota_icms = Decimal(str(aliquota_icms))
    aliquota_pis = Decimal(str(aliquota_pis))
    aliquota_cofins = Decimal(str(aliquota_cofins))

    valor_icms = subtotal * (aliquota_icms / 100)
    valor_pis = subtotal * (aliquota_pis / 100)
    valor_cofins = subtotal * (aliquota_cofins / 100)

    return {
        'subtotal': round(subtotal, 2),
        'valor_icms': round(valor_icms, 2),
        'valor_pis': round(valor_pis, 2),
        'valor_cofins': round(valor_cofins, 2),
        'total_tributos': round(valor_icms + valor_pis + valor_cofins, 2),
    }


def emitir_nfe_focusnfe(empresa_id, pedido_venda_id):
    """
    Envia os dados para o Focus NFe e solicita emissão da NF-e.
    Retorna o status e a chave de acesso se autorizada.
    """
    import requests
    from .models import ConfiguracaoFiscal, PedidoVenda

    try:
        config = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except ConfiguracaoFiscal.DoesNotExist:
        return False, 'Configuração fiscal não encontrada.'

    if not config.focusnfe_token:
        return False, 'Token do Focus NFe não configurado.'

    try:
        pedido = PedidoVenda.objects.get(id=pedido_venda_id, empresa_id=empresa_id)
    except PedidoVenda.DoesNotExist:
        return False, 'Pedido não encontrado.'

    # Monta o payload para o Focus NFe
    # Documentação: https://focusnfe.com.br/doc/
    base_url = 'https://homologacao.focusnfe.com.br' if config.focusnfe_homologacao else 'https://api.focusnfe.com.br'

    itens_nfe = []
    for item in pedido.itens.all():
        sugestao = sugerir_tributacao(empresa_id, pedido.cliente.endereco or config.uf, item.produto)
        impostos = calcular_impostos_item(
            preco_unitario=item.preco_unitario,
            quantidade=item.quantidade,
            regime=config.regime_tributario,
            aliquota_icms=sugestao.get('aliquota_icms', 12),
            cst_pis=sugestao.get('cst_pis', '07'),
            aliquota_pis=sugestao.get('aliquota_pis', 0),
            cst_cofins=sugestao.get('cst_cofins', '07'),
            aliquota_cofins=sugestao.get('aliquota_cofins', 0),
        )

        itens_nfe.append({
            'numero_item': len(itens_nfe) + 1,
            'codigo_produto': item.produto.sku,
            'descricao': item.produto.nome,
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
        'natureza_operacao': 'Venda de mercadoria',
        'forma_pagamento': '0',
        'tipo_documento': '1',
        'local_destino': '1',
        'codigo_municipio_fato_gerador': '3550308',  # Campo editável
        'tipo_impressao_danfe': '1',
        'finalidade_emissao': '1',
        'processo_emissao': '0',
        'cnpj_emitente': config.cnpj,
        'nome_emitente': pedido.empresa.nome,
        'regime_tributario_emitente': config.crt,
        'cpf_cnpj_destinatario': pedido.cliente.cnpj_cpf,
        'nome_destinatario': pedido.cliente.nome_razao,
        'items': itens_nfe,
    }

    try:
        ref = f"pedido_{pedido_venda_id}"
        response = requests.post(
            f"{base_url}/v2/nfe?ref={ref}",
            json=payload,
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()

        if response.status_code in [200, 201]:
            return True, {
                'status': data.get('status'),
                'chave_nfe': data.get('chave_nfe'),
                'numero': data.get('numero'),
                'serie': data.get('serie'),
                'caminho_danfe': data.get('caminho_danfe'),
                'mensagem': 'NF-e enviada para processamento.',
            }
        else:
            return False, data.get('mensagem', 'Erro ao enviar NF-e.')

    except Exception as e:
        return False, f"Erro de comunicação com Focus NFe: {str(e)}"


def consultar_status_nfe(empresa_id, referencia):
    """
    Consulta o status de uma NF-e no Focus NFe.
    """
    import requests
    from .models import ConfiguracaoFiscal

    try:
        config = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except ConfiguracaoFiscal.DoesNotExist:
        return False, 'Configuração fiscal não encontrada.'

    base_url = 'https://homologacao.focusnfe.com.br' if config.focusnfe_homologacao else 'https://api.focusnfe.com.br'

    try:
        response = requests.get(
            f"{base_url}/v2/nfe/{referencia}",
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
        return True, data
    except Exception as e:
        return False, str(e)


def gerar_zip_contador(empresa_id, mes, ano):
    """
    Gera lista de XMLs e DANFEs do mês para o contador.
    Retorna URLs dos arquivos no Focus NFe.
    (O download real depende da integração com o Focus NFe)
    """
    import requests
    from .models import ConfiguracaoFiscal, NotaFiscal

    try:
        config = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except ConfiguracaoFiscal.DoesNotExist:
        return False, 'Configuração fiscal não encontrada.'

    # Busca NFs do mês no banco local
    notas = NotaFiscal.objects.filter(
        empresa_id=empresa_id,
        data_emissao__year=ano,
        data_emissao__month=mes,
        chave_acesso__isnull=False,
    ).order_by('data_emissao')

    resultado = {
        'periodo': f"{mes:02d}/{ano}",
        'total_notas': notas.count(),
        'notas': [{
            'numero': n.numero_nota,
            'tipo': n.get_tipo_nota_display(),
            'chave_acesso': n.chave_acesso,
            'data_emissao': n.data_emissao.strftime('%d/%m/%Y') if n.data_emissao else None,
            'valor': round(n.valor_total, 2) if n.valor_total else None,
            'xml_disponivel': bool(n.arquivo_xml),
        } for n in notas],
        'aviso': 'Para download do ZIP completo, acesse o painel do Focus NFe ou solicite ao suporte.',
    }

    return True, resultado