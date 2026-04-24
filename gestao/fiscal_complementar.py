# ==========================================
# ARQUIVO NOVO: gestao/fiscal_complementar.py
# Complementa o gestao/fiscal.py existente com:
#   1. Emissão NFS-e (Nota Fiscal de Serviço)
#   2. Emissão CT-e (Conhecimento de Transporte)
#   3. Emissão / Encerramento MDF-e (Manifesto)
#   4. Download individual DANFE e XML
#   5. Gestão de Certificado Digital A1/A3
#   6. Inutilização de numeração de NF
#
# Todos os módulos usam Focus NFe como gateway,
# respeitam isolamento multi-tenant (empresa_id)
# e registram LogAuditoria quando relevante.
# ==========================================

import requests
from django.utils import timezone


# ──────────────────────────────────────────────
# Helpers internos (mesmo padrão do manifestacao.py)
# ──────────────────────────────────────────────

def _get_config(empresa_id):
    """Retorna ConfiguracaoFiscal ou levanta ValueError com mensagem clara."""
    from .models import ConfiguracaoFiscal
    try:
        config = ConfiguracaoFiscal.objects.get(empresa_id=empresa_id)
    except ConfiguracaoFiscal.DoesNotExist:
        raise ValueError('Configuração fiscal não encontrada para esta empresa.')
    if not config.focusnfe_token:
        raise ValueError('Token do Focus NFe não configurado. Acesse Configurações > Fiscal.')
    return config


def _base_url(config):
    if config.focusnfe_homologacao:
        return 'https://homologacao.focusnfe.com.br'
    return 'https://api.focusnfe.com.br'


# ══════════════════════════════════════════════════════════════════════════════
# 1. NFS-e — Nota Fiscal de Serviço Eletrônica
# ══════════════════════════════════════════════════════════════════════════════

def emitir_nfse(empresa_id, dados):
    """
    Emite NFS-e (modelo 1 — nota de serviço municipal) via Focus NFe.

    Args:
        empresa_id : ID da empresa prestadora
        dados (dict):
            tomador_cnpj_cpf    — CNPJ ou CPF do tomador (obrigatório)
            tomador_nome        — nome/razão social do tomador
            tomador_email       — e-mail do tomador (opcional)
            codigo_servico      — código LC 116/2003 (ex: '0107' para agricultura)
            discriminacao       — descrição detalhada do serviço
            valor_servicos      — valor total dos serviços
            deducoes            — deduções da base de cálculo (default 0)
            aliquota_iss        — alíquota ISS em % (ex: 3.0)
            municipio_prestacao — código IBGE do município (ex: 3550308 para SP)
            referencia          — referência única (ex: 'servico_42')
            data_competencia    — 'YYYY-MM-DD' (opcional, usa hoje se omitido)

    Retorna (sucesso: bool, resultado: dict | str)
    """
    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    base_url = _base_url(config)

    valor = float(dados['valor_servicos'])
    deducoes = float(dados.get('deducoes', 0))
    aliquota = float(dados.get('aliquota_iss', 2))
    base_calculo = valor - deducoes
    valor_iss = base_calculo * aliquota / 100

    payload = {
        'cnpj_prestador':               config.cnpj,
        'inscricao_municipal':          getattr(config, 'inscricao_municipal', '') or '',
        'data_emissao':                 dados.get('data_competencia', timezone.now().strftime('%Y-%m-%d')),
        'optante_simples_nacional':     '1' if config.regime_tributario == 'simples' else '2',
        'natureza_operacao':            '1',
        'formato_especial_tributacao':  '0',
        'valor_servicos':               valor,
        'deducoes':                     deducoes,
        'valor_pis':                    0,
        'valor_cofins':                 0,
        'valor_inss':                   0,
        'valor_ir':                     0,
        'valor_csll':                   0,
        'iss_retido':                   dados.get('iss_retido', '2'),
        'valor_iss':                    round(valor_iss, 2),
        'base_calculo':                 round(base_calculo, 2),
        'aliquota_issqn':               aliquota,
        'codigo_servico':               dados['codigo_servico'],
        'municipio_prestacao':          dados.get('municipio_prestacao', ''),
        'discriminacao':                dados['discriminacao'],
        'tomador_cpf_cnpj':             dados['tomador_cnpj_cpf'],
        'tomador_razao_social':         dados.get('tomador_nome', ''),
        'tomador_email':                dados.get('tomador_email', ''),
    }

    try:
        ref = dados.get('referencia', f"nfse_{timezone.now().strftime('%Y%m%d%H%M%S')}")
        response = requests.post(
            f"{base_url}/v2/nfse?ref={ref}",
            json=payload,
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação com Focus NFe: {str(e)}'

    if response.status_code in (200, 201):
        return True, {
            'status':             data.get('status'),
            'numero_nfse':        data.get('numero_nfse'),
            'codigo_verificacao': data.get('codigo_verificacao'),
            'url_nfse':           data.get('url_nfse'),
            'referencia':         ref,
            'mensagem':           'NFS-e enviada para processamento.',
        }
    return False, data.get('mensagem', 'Erro ao emitir NFS-e.')


def consultar_status_nfse(empresa_id, referencia):
    """
    Consulta o status de uma NFS-e no Focus NFe.
    Retorna (sucesso: bool, dados: dict | str)
    """
    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        response = requests.get(
            f"{_base_url(config)}/v2/nfse/{referencia}",
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        return True, response.json()
    except requests.exceptions.RequestException as e:
        return False, str(e)


def cancelar_nfse(empresa_id, usuario, referencia, motivo):
    """
    Cancela NFS-e já autorizada via Focus NFe.
    O cancelamento depende de autorização do município.

    Args:
        referencia : referência da NFS-e emitida (ex: 'servico_42')
        motivo     : mínimo 15 caracteres
    """
    from .models import LogAuditoria, Empresa

    if len(motivo.strip()) < 15:
        return False, 'O motivo deve ter pelo menos 15 caracteres.'

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        response = requests.delete(
            f"{_base_url(config)}/v2/nfse/{referencia}",
            json={'motivo': motivo.strip()},
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json() if response.content else {}
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    sucesso = response.status_code in (200, 204)

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=usuario,
            acao='cancelamento_nfe', modelo_afetado='NFS-e',
            registro_id=0,
            descricao=f"Cancelamento NFS-e ref '{referencia}': {'OK' if sucesso else data.get('mensagem', 'ERRO')}",
        )
    except Exception:
        pass

    if sucesso:
        return True, 'NFS-e cancelada com sucesso.'
    return False, data.get('mensagem', 'Erro ao cancelar NFS-e.')


# ══════════════════════════════════════════════════════════════════════════════
# 2. CT-e — Conhecimento de Transporte Eletrônico
# ══════════════════════════════════════════════════════════════════════════════

def emitir_cte(empresa_id, dados):
    """
    Emite CT-e (modelo 57) via Focus NFe.

    Args:
        empresa_id : ID da empresa transportadora
        dados (dict):
            referencia          — referência única (ex: 'cte_frete_99')
            cfop                — '5353' interno ou '6353' interestadual
            natureza_operacao   — ex: 'Prestação de serviço de transporte'
            valor_total         — valor total do frete
            remetente_cnpj      — CNPJ do remetente
            remetente_nome      — nome do remetente
            remetente_uf        — UF de origem
            destinatario_cnpj   — CNPJ do destinatário
            destinatario_nome   — nome do destinatário
            destinatario_uf     — UF de destino
            tomador             — '0'=Remetente|'1'=Expedidor|'2'=Recebedor|'3'=Destinatário
            chaves_nfe          — lista de chaves NF-e vinculadas (opcional)
            produto_predominante— ex: 'Insumos agrícolas'
            peso_bruto          — peso total em kg
            modal               — '01'=Rodoviário (padrão)
            aliquota_icms       — alíquota ICMS do frete (padrão 12%)

    Retorna (sucesso: bool, resultado: dict | str)
    """
    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    documentos = [
        {'tipo_documento': '1', 'chave_nfe': chave}
        for chave in dados.get('chaves_nfe', [])
    ]

    valor = float(dados['valor_total'])
    aliquota = float(dados.get('aliquota_icms', 12))

    payload = {
        'cfop':                  dados.get('cfop', '5353'),
        'natureza_operacao':     dados.get('natureza_operacao', 'Prestação de serviço de transporte'),
        'data_emissao':          timezone.now().strftime('%Y-%m-%dT%H:%M:%S-03:00'),
        'tipo_documento':        '0',
        'modal':                 dados.get('modal', '01'),
        'tipo_servico':          '0',
        'cnpj_emitente':         config.cnpj,
        'nome_emitente':         dados.get('nome_emitente', ''),
        'uf_inicio':             dados.get('remetente_uf', config.uf),
        'uf_fim':                dados.get('destinatario_uf', ''),
        'remetente_cnpj':        dados['remetente_cnpj'],
        'remetente_nome':        dados['remetente_nome'],
        'destinatario_cnpj':     dados['destinatario_cnpj'],
        'destinatario_nome':     dados['destinatario_nome'],
        'tomador':               dados.get('tomador', '3'),
        'valor_total':           valor,
        'produto_predominante':  dados.get('produto_predominante', 'Mercadoria'),
        'peso_bruto':            float(dados.get('peso_bruto', 0)),
        'documentos':            documentos,
        'cst':                   '00',
        'base_calculo':          valor,
        'aliquota':              aliquota,
        'valor_imposto':         round(valor * aliquota / 100, 2),
    }

    try:
        ref = dados.get('referencia', f"cte_{timezone.now().strftime('%Y%m%d%H%M%S')}")
        response = requests.post(
            f"{_base_url(config)}/v2/cte?ref={ref}",
            json=payload,
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    if response.status_code in (200, 201):
        return True, {
            'status':     data.get('status'),
            'chave_cte':  data.get('chave_cte'),
            'numero':     data.get('numero'),
            'serie':      data.get('serie'),
            'referencia': ref,
            'mensagem':   'CT-e enviado para processamento.',
        }
    return False, data.get('mensagem', 'Erro ao emitir CT-e.')


def consultar_status_cte(empresa_id, referencia):
    """Consulta o status de um CT-e no Focus NFe."""
    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        response = requests.get(
            f"{_base_url(config)}/v2/cte/{referencia}",
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        return True, response.json()
    except requests.exceptions.RequestException as e:
        return False, str(e)


def cancelar_cte(empresa_id, usuario, referencia, justificativa):
    """
    Cancela CT-e já autorizado via Focus NFe.

    Args:
        referencia    : referência do CT-e emitido (ex: 'cte_frete_99')
        justificativa : mínimo 15 caracteres
    """
    from .models import LogAuditoria, Empresa

    if len(justificativa.strip()) < 15:
        return False, 'A justificativa deve ter pelo menos 15 caracteres.'

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        response = requests.delete(
            f"{_base_url(config)}/v2/cte/{referencia}",
            json={'justificativa': justificativa.strip()},
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json() if response.content else {}
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    sucesso = response.status_code in (200, 204)

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=usuario,
            acao='cancelamento_nfe', modelo_afetado='CT-e',
            registro_id=0,
            descricao=f"Cancelamento CT-e ref '{referencia}': {'OK' if sucesso else data.get('mensagem', 'ERRO')}",
        )
    except Exception:
        pass

    if sucesso:
        return True, 'CT-e cancelado com sucesso.'
    return False, data.get('mensagem', 'Erro ao cancelar CT-e.')


# ══════════════════════════════════════════════════════════════════════════════
# 3. MDF-e — Manifesto Eletrônico de Documentos Fiscais
# ══════════════════════════════════════════════════════════════════════════════

def emitir_mdfe(empresa_id, dados):
    """
    Emite MDF-e (modelo 58) via Focus NFe.
    Obrigatório para transportadoras com múltiplos documentos em trânsito.

    Args:
        empresa_id : ID da empresa transportadora
        dados (dict):
            referencia        — referência única (ex: 'mdfe_viagem_7')
            uf_inicio         — UF de início do percurso
            uf_fim            — UF de fim do percurso
            data_viagem       — 'YYYY-MM-DDTHH:MM:SS-03:00' (opcional, usa agora)
            placa_veiculo     — placa do veículo (ex: 'ABC1D23')
            rntrc             — RNTRC do transportador
            cidades_percurso  — lista de códigos IBGE das cidades do percurso
            documentos        — lista de { chave, tipo: 'nfe' | 'cte' }

    Retorna (sucesso: bool, resultado: dict | str)
    """
    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    percurso = [{'cMun': str(cod)} for cod in dados.get('cidades_percurso', [])]

    docs_payload = []
    for doc in dados.get('documentos', []):
        if doc['tipo'] == 'nfe':
            docs_payload.append({'chave_nfe': doc['chave']})
        elif doc['tipo'] == 'cte':
            docs_payload.append({'chave_cte': doc['chave']})

    payload = {
        'modal':         '01',
        'serie':         '1',
        'data_viagem':   dados.get('data_viagem', timezone.now().strftime('%Y-%m-%dT%H:%M:%S-03:00')),
        'uf_inicio':     dados['uf_inicio'],
        'uf_fim':        dados['uf_fim'],
        'cnpj_emitente': config.cnpj,
        'placa_veiculo': dados.get('placa_veiculo', ''),
        'rntrc':         dados.get('rntrc', ''),
        'percurso':      percurso,
        'documentos':    docs_payload,
        'total_nfe':     sum(1 for d in dados.get('documentos', []) if d['tipo'] == 'nfe'),
        'total_cte':     sum(1 for d in dados.get('documentos', []) if d['tipo'] == 'cte'),
    }

    try:
        ref = dados.get('referencia', f"mdfe_{timezone.now().strftime('%Y%m%d%H%M%S')}")
        response = requests.post(
            f"{_base_url(config)}/v2/mdfe?ref={ref}",
            json=payload,
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    if response.status_code in (200, 201):
        return True, {
            'status':     data.get('status'),
            'chave_mdfe': data.get('chave_mdfe'),
            'numero':     data.get('numero'),
            'referencia': ref,
            'mensagem':   'MDF-e enviado para processamento.',
        }
    return False, data.get('mensagem', 'Erro ao emitir MDF-e.')


def encerrar_mdfe(empresa_id, usuario, referencia, municipio_encerramento):
    """
    Encerra um MDF-e autorizado ao final da viagem.

    Args:
        referencia             : referência do MDF-e emitido
        municipio_encerramento : código IBGE do município de encerramento
    """
    from .models import LogAuditoria, Empresa

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    payload = {
        'data_encerramento': timezone.now().strftime('%Y-%m-%d'),
        'municipio':         str(municipio_encerramento),
    }

    try:
        response = requests.post(
            f"{_base_url(config)}/v2/mdfe/{referencia}/encerramento",
            json=payload,
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json() if response.content else {}
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    sucesso = response.status_code in (200, 201)

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa, usuario=usuario,
            acao='cancelamento_nfe', modelo_afetado='MDF-e',
            registro_id=0,
            descricao=f"Encerramento MDF-e ref '{referencia}': {'OK' if sucesso else data.get('mensagem', 'ERRO')}",
        )
    except Exception:
        pass

    if sucesso:
        return True, 'MDF-e encerrado com sucesso.'
    return False, data.get('mensagem', 'Erro ao encerrar MDF-e.')


def consultar_status_mdfe(empresa_id, referencia):
    """Consulta o status de um MDF-e no Focus NFe."""
    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        response = requests.get(
            f"{_base_url(config)}/v2/mdfe/{referencia}",
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        return True, response.json()
    except requests.exceptions.RequestException as e:
        return False, str(e)


# ══════════════════════════════════════════════════════════════════════════════
# 4. DANFE / XML — Download individual
# ══════════════════════════════════════════════════════════════════════════════

def download_danfe(empresa_id, referencia):
    """
    Retorna a URL do DANFE (PDF) de uma NF-e via Focus NFe.

    Args:
        referencia : referência da NF-e emitida (ex: 'pedido_42')

    Retorna (sucesso: bool, resultado: dict | str)
    """
    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        response = requests.get(
            f"{_base_url(config)}/v2/nfe/{referencia}",
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    if response.status_code != 200:
        return False, data.get('mensagem', 'Nota não encontrada.')

    caminho_danfe = data.get('caminho_danfe')
    if not caminho_danfe:
        return False, 'DANFE ainda não disponível. Verifique o status da nota.'

    return True, {
        'url_danfe':    caminho_danfe,
        'chave_nfe':    data.get('chave_nfe', ''),
        'numero':       data.get('numero', ''),
        'status':       data.get('status', ''),
        'data_emissao': data.get('data_emissao', ''),
    }


def download_xml(empresa_id, referencia, tipo='nfe'):
    """
    Retorna a URL do XML de qualquer documento fiscal via Focus NFe.

    Args:
        referencia : referência do documento emitido
        tipo       : 'nfe' | 'nfse' | 'cte' | 'mdfe'

    Retorna (sucesso: bool, resultado: dict | str)
    """
    if tipo not in ('nfe', 'nfse', 'cte', 'mdfe'):
        return False, "Tipo inválido. Use: nfe, nfse, cte ou mdfe."

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        response = requests.get(
            f"{_base_url(config)}/v2/{tipo}/{referencia}",
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    if response.status_code != 200:
        return False, data.get('mensagem', 'Documento não encontrado.')

    url_xml = (
        data.get('caminho_xml_nota_fiscal') or
        data.get('caminho_xml') or
        data.get('xml_url')
    )

    if not url_xml:
        return False, 'XML ainda não disponível. Verifique o status do documento.'

    return True, {
        'url_xml':    url_xml,
        'tipo':       tipo,
        'referencia': referencia,
        'chave':      data.get('chave_nfe') or data.get('chave_cte') or data.get('chave_mdfe', ''),
        'numero':     data.get('numero', ''),
        'status':     data.get('status', ''),
    }


# ══════════════════════════════════════════════════════════════════════════════
# 5. Certificado Digital — A1 e A3
# ══════════════════════════════════════════════════════════════════════════════

def upload_certificado(empresa_id, usuario, arquivo_pfx, senha_pfx):
    """
    Faz upload do certificado digital A1 (.pfx / .p12) para o Focus NFe
    e salva os metadados no banco (validade, CN, data de upload).

    IMPORTANTE: O arquivo .pfx NUNCA é salvo no banco — apenas os metadados.
    O certificado fica armazenado no Focus NFe.

    Args:
        arquivo_pfx : bytes do arquivo .pfx / .p12
        senha_pfx   : senha do certificado (string)

    Retorna (sucesso: bool, resultado: dict | str)
    """
    import base64
    from .models import CertificadoDigital, LogAuditoria, Empresa

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    pfx_b64 = base64.b64encode(arquivo_pfx).decode('utf-8')

    try:
        response = requests.post(
            f"{_base_url(config)}/v2/certificados",
            json={
                'cnpj':        config.cnpj,
                'certificado': pfx_b64,
                'senha':       senha_pfx,
            },
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    if response.status_code not in (200, 201):
        return False, data.get('mensagem', 'Erro ao enviar certificado.')

    # Extrai data de validade retornada pelo Focus NFe
    validade_str = data.get('data_validade') or data.get('validade', '')
    data_validade = None
    if validade_str:
        from datetime import datetime
        for fmt in ('%Y-%m-%d', '%d/%m/%Y'):
            try:
                data_validade = datetime.strptime(validade_str[:10], fmt).date()
                break
            except ValueError:
                continue

    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return False, 'Empresa não encontrada.'

    # Desativa certificados anteriores da empresa
    CertificadoDigital.objects.filter(empresa=empresa, ativo=True).update(ativo=False)

    cert = CertificadoDigital.objects.create(
        empresa=empresa,
        tipo='a1',
        cn=data.get('razao_social') or data.get('cn', ''),
        cnpj=config.cnpj,
        data_validade=data_validade,
        ativo=True,
        enviado_focusnfe=True,
    )

    LogAuditoria.registrar(
        empresa=empresa, usuario=usuario,
        acao='cancelamento_nfe', modelo_afetado='CertificadoDigital',
        registro_id=cert.pk,
        descricao=f"Upload de certificado A1 — validade: {data_validade or 'não informada'}",
    )

    return True, {
        'id':            cert.pk,
        'cn':            cert.cn,
        'data_validade': str(data_validade) if data_validade else None,
        'ativo':         True,
        'mensagem':      'Certificado enviado com sucesso ao Focus NFe.',
    }


def listar_certificados(empresa_id):
    """
    Lista os certificados digitais cadastrados para a empresa
    com alerta automático para vencimentos em até 30 dias.

    Retorna lista de dicts.
    """
    from .models import CertificadoDigital
    from datetime import date

    certs = CertificadoDigital.objects.filter(
        empresa_id=empresa_id
    ).order_by('-data_upload')

    hoje = date.today()
    resultado = []
    for c in certs:
        dias_para_vencer = None
        alerta = None
        if c.data_validade:
            dias_para_vencer = (c.data_validade - hoje).days
            if dias_para_vencer < 0:
                alerta = 'VENCIDO'
            elif dias_para_vencer <= 30:
                alerta = f'Vence em {dias_para_vencer} dias'

        resultado.append({
            'id':               c.pk,
            'tipo':             c.tipo.upper(),
            'cn':               c.cn,
            'cnpj':             c.cnpj,
            'data_validade':    str(c.data_validade) if c.data_validade else None,
            'data_upload':      c.data_upload.strftime('%d/%m/%Y %H:%M') if c.data_upload else None,
            'ativo':            c.ativo,
            'alerta':           alerta,
            'dias_para_vencer': dias_para_vencer,
        })

    return resultado


def consultar_certificado_focusnfe(empresa_id):
    """
    Consulta os dados do certificado ativo diretamente no Focus NFe.
    Útil para verificar a validade sem depender do banco local.

    Retorna (sucesso: bool, dados: dict | str)
    """
    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        response = requests.get(
            f"{_base_url(config)}/v2/certificados/{config.cnpj}",
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, str(e)

    if response.status_code == 200:
        return True, data
    return False, data.get('mensagem', 'Certificado não encontrado no Focus NFe.')


# ══════════════════════════════════════════════════════════════════════════════
# 6. Inutilização de NF — Envio à SEFAZ
# ══════════════════════════════════════════════════════════════════════════════

def inutilizar_nfe(empresa_id, usuario, serie, numero_inicial, numero_final, justificativa):
    """
    Inutiliza uma faixa de números de NF-e na SEFAZ via Focus NFe.

    Quando usar: numeração pulada, erro de configuração, notas não emitidas
    que não podem ser reaproveitadas.
    Base legal: NT 2013.005 — deve ser feita no mesmo ano-calendário.

    Args:
        serie          : série da NF-e (ex: '1')
        numero_inicial : primeiro número a inutilizar (int)
        numero_final   : último número a inutilizar (int)
        justificativa  : mínimo 15 caracteres

    Retorna (sucesso: bool, resultado: dict | str)
    """
    from .models import InutilizacaoNF, LogAuditoria, Empresa

    if len(justificativa.strip()) < 15:
        return False, 'A justificativa deve ter pelo menos 15 caracteres.'

    if numero_inicial > numero_final:
        return False, 'Número inicial não pode ser maior que o número final.'

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return False, 'Empresa não encontrada.'

    # Verifica sobreposição com inutilizações já autorizadas
    sobreposta = InutilizacaoNF.objects.filter(
        empresa=empresa,
        serie=str(serie),
        numero_inicial__lte=numero_final,
        numero_final__gte=numero_inicial,
        status='autorizado',
    ).exists()
    if sobreposta:
        return False, 'Já existe uma inutilização autorizada que abrange parte desta faixa.'

    payload = {
        'cnpj':           config.cnpj,
        'serie':          str(serie),
        'numero_inicial': int(numero_inicial),
        'numero_final':   int(numero_final),
        'justificativa':  justificativa.strip(),
        'ano':            timezone.now().year,
    }

    try:
        response = requests.post(
            f"{_base_url(config)}/v2/nfe/inutilizacao",
            json=payload,
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação: {str(e)}'

    sucesso = response.status_code in (200, 201)
    protocolo = data.get('protocolo') or data.get('numero_protocolo', '')

    # Sempre salva o registro para rastreabilidade
    inut = InutilizacaoNF.objects.create(
        empresa=empresa,
        usuario=usuario,
        serie=str(serie),
        numero_inicial=numero_inicial,
        numero_final=numero_final,
        justificativa=justificativa.strip(),
        status='autorizado' if sucesso else 'erro',
        protocolo_sefaz=protocolo,
        resposta_sefaz=data.get('mensagem', ''),
    )

    LogAuditoria.registrar(
        empresa=empresa, usuario=usuario,
        acao='cancelamento_nfe', modelo_afetado='InutilizacaoNF',
        registro_id=inut.pk,
        descricao=(
            f"Inutilização série {serie} números {numero_inicial}–{numero_final}: "
            f"{'AUTORIZADO' if sucesso else 'ERRO — ' + data.get('mensagem', '')}"
        ),
    )

    if sucesso:
        return True, {
            'id':             inut.pk,
            'protocolo':      protocolo,
            'serie':          str(serie),
            'numero_inicial': numero_inicial,
            'numero_final':   numero_final,
            'mensagem':       'Inutilização autorizada pela SEFAZ.',
        }
    return False, data.get('mensagem', 'Erro ao inutilizar NF-e.')


def listar_inutilizacoes(empresa_id):
    """
    Lista todas as inutilizações de NF realizadas pela empresa.
    Retorna lista de dicts ordenada por data decrescente.
    """
    from .models import InutilizacaoNF

    inutilizacoes = InutilizacaoNF.objects.filter(
        empresa_id=empresa_id
    ).order_by('-data_solicitacao')

    return [{
        'id':             i.pk,
        'serie':          i.serie,
        'numero_inicial': i.numero_inicial,
        'numero_final':   i.numero_final,
        'justificativa':  i.justificativa,
        'status':         i.status,
        'protocolo':      i.protocolo_sefaz,
        'data':           i.data_solicitacao.strftime('%d/%m/%Y %H:%M') if i.data_solicitacao else None,
        'usuario':        i.usuario.nome if i.usuario else None,
    } for i in inutilizacoes]
