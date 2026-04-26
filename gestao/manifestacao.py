# ==========================================
# gestao/manifestacao.py
#
# Módulo de Manifestação do Destinatário (MD-e)
#
# Obrigação legal: empresas que recebem NF-e devem
# manifestar sua ciência/confirmação via SEFAZ.
# Prazo: 30 dias corridos a partir da emissão da NF-e.
# Base legal: Ajuste SINIEF 07/2005 e Cláusula 14ª.
#
# Fluxo:
#   1. consultar_nfes_pendentes() — lista NF-es que
#      chegaram no CNPJ do cliente e ainda não foram
#      manifestadas (via Focus NFe).
#   2. manifestar_nfe() — registra uma das 4 manifestações
#      possíveis (ciencia, confirmacao, desconhecimento,
#      nao_realizada) e salva no banco.
# ==========================================

import requests
from django.utils import timezone


# Tipos de manifestação aceitos pela SEFAZ
TIPOS_MANIFESTACAO = {
    'ciencia':          '210210',  # Ciência da Operação
    'confirmacao':      '210200',  # Confirmação da Operação
    'desconhecimento':  '210220',  # Desconhecimento da Operação
    'nao_realizada':    '210240',  # Operação não Realizada
}

DESCRICAO_MANIFESTACAO = {
    'ciencia':         'Ciência da Operação',
    'confirmacao':     'Confirmação da Operação',
    'desconhecimento': 'Desconhecimento da Operação',
    'nao_realizada':   'Operação não Realizada',
}


def _get_config(empresa_id):
    """Retorna ConfiguracaoFiscal ou levanta exceção com mensagem clara."""
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


def consultar_nfes_pendentes(empresa_id):
    """
    Consulta no Focus NFe as NF-es destinadas ao CNPJ da empresa
    que ainda estão pendentes de manifestação.

    Retorna lista de dicts com dados das NF-es para exibir na tela.
    """
    from .models import ManifestacaoNFe

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return {'erro': str(e)}

    base_url = _base_url(config)

    try:
        response = requests.get(
            f"{base_url}/v2/nfe/destinadas",
            params={
                'cnpj': config.cnpj,
                'manifestacao': 'pendente',
            },
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
    except requests.exceptions.RequestException as e:
        return {'erro': f'Erro de comunicação com Focus NFe: {str(e)}'}

    if response.status_code != 200:
        try:
            msg = response.json().get('mensagem', 'Erro ao consultar NF-es.')
        except Exception:
            msg = 'Erro ao consultar NF-es.'
        return {'erro': msg}

    nfes_api = response.json()

    # Chaves já manifestadas no nosso banco — para não re-exibir
    chaves_manifestadas = set(
        ManifestacaoNFe.objects.filter(
            empresa_id=empresa_id,
        ).values_list('chave_acesso', flat=True)
    )

    resultado = []
    for nfe in nfes_api:
        chave = nfe.get('chave_nfe') or nfe.get('chave_acesso', '')
        if chave in chaves_manifestadas:
            continue

        resultado.append({
            'chave_acesso':     chave,
            'numero':           nfe.get('numero', ''),
            'serie':            nfe.get('serie', ''),
            'data_emissao':     nfe.get('data_emissao', ''),
            'cnpj_emitente':    nfe.get('cnpj_emitente', ''),
            'nome_emitente':    nfe.get('nome_emitente', ''),
            'valor_total':      nfe.get('valor_total', 0),
            'natureza_operacao': nfe.get('natureza_operacao', ''),
            'status_sefaz':     nfe.get('status', ''),
        })

    return {
        'total': len(resultado),
        'nfes': resultado,
    }


def manifestar_nfe(empresa_id, usuario, chave_acesso, tipo_manifestacao, justificativa=''):
    """
    Registra uma manifestação no Focus NFe e salva no banco.

    Args:
        empresa_id     : ID da empresa
        usuario        : objeto Usuario que está realizando a ação
        chave_acesso   : chave de 44 dígitos da NF-e
        tipo_manifestacao: 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao_realizada'
        justificativa  : obrigatória apenas para 'nao_realizada' (mínimo 15 chars)

    Retorna (sucesso: bool, mensagem: str)
    """
    from .models import ManifestacaoNFe, LogAuditoria, Empresa

    if tipo_manifestacao not in TIPOS_MANIFESTACAO:
        return False, f"Tipo inválido. Use: {', '.join(TIPOS_MANIFESTACAO.keys())}"

    if tipo_manifestacao == 'nao_realizada' and len(justificativa.strip()) < 15:
        return False, "Para 'Operação não Realizada' informe uma justificativa com pelo menos 15 caracteres."

    # Verifica duplicata
    if ManifestacaoNFe.objects.filter(empresa_id=empresa_id, chave_acesso=chave_acesso).exists():
        return False, "Esta NF-e já foi manifestada."

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    base_url = _base_url(config)

    payload = {
        'cnpj': config.cnpj,
        'chave_nfe': chave_acesso,
        'tipo': TIPOS_MANIFESTACAO[tipo_manifestacao],
    }
    if justificativa:
        payload['justificativa'] = justificativa.strip()

    try:
        response = requests.post(
            f"{base_url}/v2/nfe/manifestacao",
            json=payload,
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação com Focus NFe: {str(e)}'

    sucesso = response.status_code in (200, 201)
    mensagem_api = data.get('mensagem', '')

    # Salva no banco independente do resultado para rastreabilidade
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return False, 'Empresa não encontrada.'

    ManifestacaoNFe.objects.create(
        empresa=empresa,
        usuario=usuario,
        chave_acesso=chave_acesso,
        tipo_manifestacao=tipo_manifestacao,
        justificativa=justificativa.strip(),
        status_envio='sucesso' if sucesso else 'erro',
        resposta_sefaz=mensagem_api,
        data_manifestacao=timezone.now(),
    )

    LogAuditoria.registrar(
        empresa=empresa,
        usuario=usuario,
        acao='manifestacao_nfe',
        modelo_afetado='ManifestacaoNFe',
        registro_id=0,
        descricao=(
            f"Manifestação '{DESCRICAO_MANIFESTACAO[tipo_manifestacao]}' "
            f"para NF-e {chave_acesso[:10]}... "
            f"({'OK' if sucesso else 'ERRO: ' + mensagem_api})"
        ),
    )

    if sucesso:
        return True, f"Manifestação '{DESCRICAO_MANIFESTACAO[tipo_manifestacao]}' registrada com sucesso."
    else:
        return False, f"Erro SEFAZ: {mensagem_api}"


def cancelar_nfe(empresa_id, usuario, referencia, justificativa):
    """
    Cancela uma NF-e já autorizada via Focus NFe.
    Prazo legal: até 24h após autorização (ou até 168h em alguns casos).

    Args:
        referencia : string de referência usada na emissão (ex: 'pedido_123')
        justificativa: mínimo 15 caracteres
    """
    from .models import LogAuditoria, Empresa, NotaFiscal

    if len(justificativa.strip()) < 15:
        return False, 'A justificativa deve ter pelo menos 15 caracteres.'

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    base_url = _base_url(config)

    try:
        response = requests.delete(
            f"{base_url}/v2/nfe/{referencia}",
            json={'justificativa': justificativa.strip()},
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação com Focus NFe: {str(e)}'

    sucesso = response.status_code in (200, 204)
    mensagem_api = data.get('mensagem', '') if isinstance(data, dict) else ''

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa,
            usuario=usuario,
            acao='cancelamento_nfe',
            modelo_afetado='NotaFiscal',
            registro_id=0,
            descricao=(
                f"Cancelamento NF-e ref '{referencia}': "
                f"{'OK' if sucesso else 'ERRO — ' + mensagem_api} | "
                f"Justificativa: {justificativa.strip()}"
            ),
        )
    except Exception:
        pass

    if sucesso:
        return True, 'NF-e cancelada com sucesso.'
    return False, f'Erro ao cancelar: {mensagem_api}'


def carta_correcao_nfe(empresa_id, usuario, referencia, correcao):
    """
    Envia Carta de Correção Eletrônica (CC-e) para uma NF-e já autorizada.
    Limite: até 20 CC-e por NF-e.
    A CC-e não pode alterar: destinatário, valor, item, base de cálculo de imposto.

    Args:
        referencia: string de referência da NF-e (ex: 'pedido_123')
        correcao  : texto da correção (mínimo 15 caracteres)
    """
    from .models import LogAuditoria, Empresa

    if len(correcao.strip()) < 15:
        return False, 'O texto da correção deve ter pelo menos 15 caracteres.'

    # Enforce 20 CC-e limit per NF-e (NT 2013.001 — SEFAZ)
    from .models import LogAuditoria
    count_cce = LogAuditoria.objects.filter(
        empresa_id=empresa_id,
        acao='carta_correcao_nfe',
        descricao__contains=f"ref '{referencia}': OK",
    ).count()
    if count_cce >= 20:
        return False, (
            f'Limite de 20 CC-e atingido para esta NF-e ({count_cce}/20). '
            'Não é possível enviar mais correções. Se necessário, cancele e reemita a nota.'
        )

    try:
        config = _get_config(empresa_id)
    except ValueError as e:
        return False, str(e)

    base_url = _base_url(config)

    try:
        response = requests.post(
            f"{base_url}/v2/nfe/{referencia}/carta_correcao",
            json={'correcao': correcao.strip()},
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except requests.exceptions.RequestException as e:
        return False, f'Erro de comunicação com Focus NFe: {str(e)}'

    sucesso = response.status_code in (200, 201)
    mensagem_api = data.get('mensagem', '') if isinstance(data, dict) else ''

    try:
        empresa = Empresa.objects.get(id=empresa_id)
        LogAuditoria.registrar(
            empresa=empresa,
            usuario=usuario,
            acao='carta_correcao_nfe',
            modelo_afetado='NotaFiscal',
            registro_id=0,
            descricao=(
                f"CC-e NF-e ref '{referencia}': "
                f"{'OK' if sucesso else 'ERRO — ' + mensagem_api}"
            ),
        )
    except Exception:
        pass

    if sucesso:
        return True, {
            'mensagem': 'Carta de Correção enviada com sucesso.',
            'numero_sequencial': data.get('numero_sequencial', ''),
            'caminho_cce': data.get('caminho_cce', ''),
        }
    return False, f'Erro ao enviar CC-e: {mensagem_api}'
