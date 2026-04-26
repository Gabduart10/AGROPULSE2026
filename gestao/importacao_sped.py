# ==========================================
# gestao/importacao_sped.py — Fase 8
#
# - Importação em lote de XMLs de NF-e
# - Consulta SEFAZ via Focus NFe (pelo CNPJ)
# - SPED Fiscal (EFD-ICMS/IPI) — estrutura básica
# - EFD-Reinf — estrutura básica
# ==========================================

import xml.etree.ElementTree as ET
from decimal import Decimal
from datetime import date


# ══════════════════════════════════════════════════════════════════════════════
# IMPORTAÇÃO EM LOTE DE XMLs
# ══════════════════════════════════════════════════════════════════════════════

def importar_xmls_lote(empresa_id, usuario, arquivos_xml):
    """
    Processa uma lista de arquivos XML de NF-e de entrada.
    Para cada XML: extrai fornecedor, produtos e cria/atualiza registros.

    Args:
        arquivos_xml: lista de bytes (conteúdo de cada XML)

    Returns dict com totais de criados, atualizados e erros.
    """
    from .models import Empresa
    from .processador_xml import processar_xml_nfe

    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return {'erro': 'Empresa não encontrada.'}

    resultado = {
        'total': len(arquivos_xml),
        'processados': 0,
        'erros': [],
        'fornecedores_criados': 0,
        'produtos_criados': 0,
        'notas_importadas': 0,
    }

    for i, xml_bytes in enumerate(arquivos_xml):
        try:
            xml_str = xml_bytes.decode('utf-8', errors='replace')
            ok, dados = processar_xml_nfe(empresa, xml_str, usuario)
            if ok:
                resultado['processados'] += 1
                resultado['fornecedores_criados'] += dados.get('fornecedor_criado', 0)
                resultado['produtos_criados'] += dados.get('produtos_criados', 0)
                resultado['notas_importadas'] += 1
            else:
                resultado['erros'].append(f'XML #{i+1}: {dados}')
        except Exception as e:
            resultado['erros'].append(f'XML #{i+1}: {str(e)}')

    return resultado


def consultar_nfes_sefaz_cnpj(empresa_id):
    """
    Consulta na SEFAZ (via Focus NFe) todas as NF-es emitidas contra
    o CNPJ da empresa nos últimos 90 dias.
    Extrai fornecedores, produtos e histórico de compras automaticamente.

    Returns (sucesso, resultado_dict_ou_erro)
    """
    import requests
    from .models import ConfiguracaoFiscal, Empresa

    try:
        config = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except ConfiguracaoFiscal.DoesNotExist:
        return False, 'Configuração fiscal não encontrada.'

    if not config.focusnfe_token:
        return False, 'Token do Focus NFe não configurado.'

    base_url = (
        'https://homologacao.focusnfe.com.br'
        if config.focusnfe_homologacao
        else 'https://api.focusnfe.com.br'
    )

    try:
        resp = requests.get(
            f'{base_url}/v2/nfe/destinadas',
            params={'cnpj': config.cnpj, 'versao': 'completa'},
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    if resp.status_code != 200:
        return False, f'Erro SEFAZ: {resp.text[:200]}'

    nfes = resp.json()
    extraidos = []
    for nfe in nfes:
        extraidos.append({
            'chave':      nfe.get('chave_nfe', ''),
            'emitente':   nfe.get('nome_emitente', ''),
            'cnpj_emit':  nfe.get('cnpj_emitente', ''),
            'data':       nfe.get('data_emissao', ''),
            'valor':      nfe.get('valor_total', 0),
            'itens':      nfe.get('items', []),
        })

    return True, {
        'total': len(extraidos),
        'nfes': extraidos,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SPED FISCAL (EFD-ICMS/IPI) — Estrutura básica
# Gera o arquivo TXT no formato do SPED Fiscal conforme leiaute ENCAT.
# ══════════════════════════════════════════════════════════════════════════════

def gerar_sped_fiscal(empresa_id, mes, ano):
    """
    Gera o arquivo EFD-ICMS/IPI (SPED Fiscal) para o período.
    Retorna o conteúdo do arquivo como string para download.

    Registros gerados:
      0000 — Abertura
      0001 — Abertura do Bloco 0
      0100 — Dados do Contabilista (placeholder)
      0150 — Tabela de cadastro do participante
      0190 — Identificação das unidades de medida
      0200 — Tabela de identificação do item
      C100 — Documento fiscal (NF-e de saída)
      C170 — Itens do documento
      C190 — Registro analítico do documento
      9001 — Abertura do Bloco 9
      9900 — Registros do arquivo
      9990 — Encerramento Bloco 9
      9999 — Encerramento do arquivo
    """
    from .models import (
        ConfiguracaoFiscal, Empresa, NotaFiscal, ItemNotaFiscal,
        Cliente, Fornecedor, Produto
    )
    from datetime import datetime

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        config  = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except Exception as e:
        return None, f'Configuração não encontrada: {str(e)}'

    inicio = date(ano, mes, 1)
    fim    = date(ano, mes + 1, 1) if mes < 12 else date(ano + 1, 1, 1)
    # fim exclusive para o queryset mas formatado como último dia do mês
    fim_display = (fim - __import__('datetime').timedelta(days=1)).strftime('%d%m%Y')

    linhas = []
    contagem = {}  # {registro: count}

    def add(registro, campos):
        linha = '|' + '|'.join(str(c) for c in campos) + '|'
        linhas.append(linha)
        contagem[registro] = contagem.get(registro, 0) + 1

    # ── Bloco 0 ────────────────────────────────────────────────────────────
    cnpj = (config.cnpj or '').replace('.','').replace('/','').replace('-','')
    add('0000', [
        '0000', '002', '0',
        inicio.strftime('%d%m%Y'), fim_display,
        empresa.nome, cnpj,
        config.uf or 'SP', config.inscricao_estadual or '',
        '', '', config.crt or '1',
    ])
    add('0001', ['0001', '0'])

    # Dados contabilista — placeholder
    add('0100', ['0100', '', '', '', '', '', '', '', '', '', ''])

    # Participantes (clientes das NFs de saída)
    clientes_adicionados = set()
    notas = NotaFiscal.objects.filter(
        empresa=empresa,
        data_emissao__gte=inicio,
        data_emissao__lt=fim,
    ).select_related('cliente')

    for nf in notas:
        if nf.cliente_id and nf.cliente_id not in clientes_adicionados:
            c = nf.cliente
            cnpj_c = (c.cnpj_cpf or '').replace('.','').replace('/','').replace('-','')
            add('0150', [
                '0150', str(c.id), '', 'PJ' if len(cnpj_c) == 14 else 'PF',
                cnpj_c, c.inscricao_estadual if hasattr(c, 'inscricao_estadual') else '',
                c.nome_razao, '',
                c.endereco if hasattr(c, 'endereco') else '', '',
                c.cidade if hasattr(c, 'cidade') else '',
                c.uf if hasattr(c, 'uf') else '',
                c.email if hasattr(c, 'email') else '',
                c.telefone if hasattr(c, 'telefone') else '',
            ])
            clientes_adicionados.add(c.id)

    # Unidades de medida
    unidades_usadas = set()
    for nf in notas:
        for item in nf.itens.select_related('produto').all():
            u = item.produto.unidade_medida if item.produto else 'UN'
            unidades_usadas.add(u)
    for u in unidades_usadas:
        add('0190', ['0190', u, u])

    # Produtos
    produtos_adicionados = set()
    for nf in notas:
        for item in nf.itens.select_related('produto').all():
            if item.produto_id and item.produto_id not in produtos_adicionados:
                p = item.produto
                add('0200', [
                    '0200', p.sku, p.nome,
                    p.sku, p.unidade_medida, p.ncm or '00000000',
                    '', '', p.origem or '0', '', '', '',
                ])
                produtos_adicionados.add(p.id)

    add('0990', ['0990', str(contagem.get('0000', 0) + contagem.get('0001', 0) + contagem.get('0100', 0) + len(clientes_adicionados) + len(unidades_usadas) + len(produtos_adicionados) + 1)])

    # ── Bloco C (documentos fiscais) ──────────────────────────────────────
    add('C001', ['C001', '0'])

    for nf in notas:
        chave = nf.chave_nfe or ''
        cnpj_dest = ''
        if nf.cliente:
            cnpj_dest = (nf.cliente.cnpj_cpf or '').replace('.','').replace('/','').replace('-','')

        add('C100', [
            'C100', '1', '1', str(nf.cliente_id or ''),
            '55', nf.serie or '1', nf.numero or '0',
            chave, nf.data_emissao.strftime('%d%m%Y') if nf.data_emissao else '',
            nf.data_emissao.strftime('%d%m%Y') if nf.data_emissao else '',
            '1', '',
            float(nf.valor_total or 0), '',
            float(nf.valor_total or 0), '', '', '', '', '', '',
        ])

        for item in nf.itens.select_related('produto').all():
            add('C170', [
                'C170', item.id,
                item.produto.sku if item.produto else '',
                item.produto.nome if item.produto else '',
                float(item.quantidade or 0),
                item.produto.unidade_medida if item.produto else 'UN',
                float(item.valor_unitario or 0),
                float(item.valor_total or 0), '', '', '', '',
                item.produto.ncm or '00000000' if item.produto else '',
                '', '', item.cfop or '5102', '',
                '', '', '', '', '', '', '', '',
            ])

        add('C190', [
            'C190', item.cfop if nf.itens.exists() else '5102',
            '', float(nf.valor_total or 0), '',
            '', '', '',
        ])

    total_c = sum(v for k, v in contagem.items() if k.startswith('C'))
    add('C990', ['C990', str(total_c + 1)])

    # ── Bloco 9 ────────────────────────────────────────────────────────────
    add('9001', ['9001', '0'])
    for reg, qtd in sorted(contagem.items()):
        add('9900', ['9900', reg, str(qtd)])
    add('9900', ['9900', '9900', str(contagem.get('9900', 0) + 1)])

    total_linhas = len(linhas) + 2  # +9990 +9999
    add('9990', ['9990', str(total_linhas + 1)])
    add('9999', ['9999', str(total_linhas + 2)])

    return '\r\n'.join(linhas), None


# ══════════════════════════════════════════════════════════════════════════════
# EFD-REINF — Estrutura básica (R-1000 + R-2010)
# ══════════════════════════════════════════════════════════════════════════════

def gerar_efd_reinf_r1000(empresa_id):
    """
    Gera o evento R-1000 (Informações do Contribuinte) em XML.
    Este é o evento de abertura obrigatório do EFD-Reinf.
    """
    from .models import ConfiguracaoFiscal, Empresa
    from datetime import datetime

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        config  = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except Exception as e:
        return None, str(e)

    cnpj = (config.cnpj or '').replace('.','').replace('/','').replace('-','')
    agora = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Reinf xmlns="http://www.reinf.esocial.gov.br/schema/evt/evtInfoContribuinte/v1_04_00">
  <evtInfoContribuinte id="ID{cnpj}{agora.replace('-','').replace(':','').replace('T','')}">
    <ideEvento>
      <indUnifContr>N</indUnifContr>
      <nrRec></nrRec>
    </ideEvento>
    <ideContri>
      <tpInsc>1</tpInsc>
      <nrInsc>{cnpj}</nrInsc>
    </ideContri>
    <infoContri>
      <inclusao>
        <idePeriodo>
          <iniValid>{datetime.now().strftime('%Y-%m')}</iniValid>
        </idePeriodo>
        <infoCadastro>
          <nmRazao>{empresa.nome}</nmRazao>
          <classTrib>{config.crt or '01'}</classTrib>
          <indEscrituracao>1</indEscrituracao>
          <indDesoneracao>N</indDesoneracao>
          <contato>
            <nmCtt>Responsável</nmCtt>
          </contato>
        </infoCadastro>
      </inclusao>
    </infoContri>
  </evtInfoContribuinte>
</Reinf>"""

    return xml, None


# ══════════════════════════════════════════════════════════════════════════════
# EFD CONTRIBUIÇÕES (PIS/COFINS) — IN RFB 2.005/2021
# ══════════════════════════════════════════════════════════════════════════════

def gerar_efd_contribuicoes(empresa_id, mes, ano):
    """
    Gera o arquivo EFD Contribuições (PIS/COFINS) para o período.

    Registros gerados:
      0000/0001/0990 — Bloco 0
      0100 — Dados contribuinte
      0110 — Regime apuração PIS/COFINS
      0150 — Participantes
      0200 — Itens
      A001/A990 — Bloco A (NFS-e) vazio
      C001/C100/C170/C190/C990 — Bloco C (NF-e)
      D001/D990 — Bloco D vazio
      F001/F990 — Bloco F vazio
      M001/M100/M200/M500/M600/M990 — Apuração
      1001/1990 — Bloco 1 vazio
      9001/9900/9990/9999 — Encerramento
    """
    from .models import ConfiguracaoFiscal, Empresa, NotaFiscal
    from datetime import timedelta

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        config  = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except Exception as e:
        return None, f'Configuração não encontrada: {str(e)}'

    inicio  = date(ano, mes, 1)
    fim_exc = date(ano, mes + 1, 1) if mes < 12 else date(ano + 1, 1, 1)
    fim_inc = fim_exc - timedelta(days=1)

    linhas   = []
    contagem = {}

    def add(reg, campos):
        linha = '|' + '|'.join(str(c) for c in campos) + '|'
        linhas.append(linha)
        contagem[reg] = contagem.get(reg, 0) + 1

    cnpj = (config.cnpj or '').replace('.', '').replace('/', '').replace('-', '')
    ie   = (config.inscricao_estadual or '').replace('.', '').replace('-', '').replace('/', '')
    # 1=cumulativo (LP/Simples), 2=não-cumulativo (LR)
    regime_pis = '1' if config.regime_tributario in ('simples', 'presumido') else '2'

    # ── Bloco 0 ──────────────────────────────────────────────────────────────
    add('0000', [
        '0000', '006', '0',
        inicio.strftime('%d%m%Y'), fim_inc.strftime('%d%m%Y'),
        empresa.nome, cnpj, config.uf or 'SP', ie,
        '', '', config.crt or '1', regime_pis, '0',
    ])
    add('0001', ['0001', '0'])
    add('0100', ['0100', '', cnpj, '', '', '', ie, '', '', '', '', ''])
    add('0110', ['0110', regime_pis, 'N', '', '', '', ''])

    notas = NotaFiscal.objects.filter(
        empresa=empresa,
        data_emissao__gte=inicio,
        data_emissao__lt=fim_exc,
    ).select_related('cliente').prefetch_related('itens__produto')

    clientes_adicionados = set()
    for nf in notas:
        if nf.cliente_id and nf.cliente_id not in clientes_adicionados:
            c = nf.cliente
            cnpj_c = (c.cnpj_cpf or '').replace('.', '').replace('/', '').replace('-', '')
            add('0150', [
                '0150', str(c.id), '', 'PJ' if len(cnpj_c) == 14 else 'PF',
                cnpj_c, '', c.nome_razao, '',
                getattr(c, 'endereco', ''), '',
                getattr(c, 'cidade', ''), getattr(c, 'uf', ''),
                getattr(c, 'email', ''), getattr(c, 'telefone', ''),
            ])
            clientes_adicionados.add(c.id)

    produtos_adicionados = set()
    for nf in notas:
        for item in nf.itens.select_related('produto').all():
            p = item.produto
            if p and p.id not in produtos_adicionados:
                add('0200', ['0200', p.sku, p.nome, p.unidade_medida, p.ncm or '', '', '', '', '', '', '', ''])
                produtos_adicionados.add(p.id)

    add('0990', ['0990', len(linhas) + 1])

    # ── Bloco A (NFS-e) — vazio ───────────────────────────────────────────────
    add('A001', ['A001', '1'])
    add('A990', ['A990', 2])

    # ── Bloco C (NF-e) ───────────────────────────────────────────────────────
    add('C001', ['C001', '0'])

    total_pis    = Decimal('0.00')
    total_cofins = Decimal('0.00')
    aliq_pis    = Decimal('0.65') if regime_pis == '1' else Decimal('1.65')
    aliq_cofins = Decimal('3.00') if regime_pis == '1' else Decimal('7.60')

    for nf in notas:
        cnpj_dest = ''
        if nf.cliente_id:
            cnpj_dest = (nf.cliente.cnpj_cpf or '').replace('.', '').replace('/', '').replace('-', '')

        add('C100', [
            'C100', '1', '0', cnpj_dest, '55',
            nf.serie or '1', nf.numero_nota or '', '',
            nf.data_emissao.strftime('%d%m%Y') if nf.data_emissao else '',
            nf.data_emissao.strftime('%d%m%Y') if nf.data_emissao else '',
            getattr(nf.cliente, 'uf', '') if nf.cliente_id else '',
            round(nf.valor_total or 0, 2),
            '', '', round(nf.valor_total or 0, 2),
            '0', '0', '0', '0', '0', '0', '0', '',
        ])

        n_item = 0
        for item in nf.itens.select_related('produto').all():
            n_item += 1
            subtotal  = Decimal(str(item.valor_total or 0))
            vl_pis    = (subtotal * aliq_pis    / 100).quantize(Decimal('0.01'))
            vl_cofins = (subtotal * aliq_cofins / 100).quantize(Decimal('0.01'))
            total_pis    += vl_pis
            total_cofins += vl_cofins

            add('C170', [
                'C170', n_item,
                item.produto.sku if item.produto else '',
                item.produto.nome if item.produto else '',
                float(item.quantidade or 0),
                item.produto.unidade_medida if item.produto else 'UN',
                float(item.valor_unitario or 0),
                float(subtotal),
                '', '', '', '',
                '01', float(aliq_pis), float(vl_pis),
                '01', float(aliq_cofins), float(vl_cofins), '',
            ])

        add('C190', ['C190', '55', '', round(nf.valor_total or 0, 2), 0, 0, 0])

    add('C990', ['C990', sum(1 for l in linhas if l.startswith('|C')) + 1])

    # ── Blocos D e F — vazios ─────────────────────────────────────────────────
    add('D001', ['D001', '1'])
    add('D990', ['D990', 2])
    add('F001', ['F001', '1'])
    add('F990', ['F990', 2])

    # ── Bloco M — Apuração ────────────────────────────────────────────────────
    add('M001', ['M001', '0'])
    add('M100', ['M100', '1', regime_pis, '', 0, '', '', '', '', '', '', '', ''])
    add('M200', [
        'M200',
        float(total_pis), 0, 0, 0, 0, float(total_pis),
        0, 0, 0,
        float(total_pis), 0, float(total_pis),
        inicio.strftime('%d%m%Y'), fim_inc.strftime('%d%m%Y'),
    ])
    add('M500', ['M500', '1', regime_pis, '', 0, '', '', '', '', '', '', '', ''])
    add('M600', [
        'M600',
        float(total_cofins), 0, 0, 0, 0, float(total_cofins),
        0, 0, 0,
        float(total_cofins), 0, float(total_cofins),
        inicio.strftime('%d%m%Y'), fim_inc.strftime('%d%m%Y'),
    ])
    add('M990', ['M990', sum(1 for l in linhas if l.startswith('|M')) + 1])

    # ── Bloco 1 — vazio ───────────────────────────────────────────────────────
    add('1001', ['1001', '1'])
    add('1990', ['1990', 2])

    # ── Bloco 9 — encerramento ────────────────────────────────────────────────
    add('9001', ['9001', '0'])
    for reg, qtd in sorted(contagem.items()):
        add('9900', ['9900', reg, qtd])
    total_linhas = len(linhas) + 3
    add('9990', ['9990', total_linhas])
    add('9999', ['9999', len(linhas) + 1])

    return '\n'.join(linhas), None
