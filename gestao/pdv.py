# ==========================================
# gestao/pdv.py
#
# PDV — Ponto de Venda / Frente de Caixa
#
# Fluxo de uma venda PDV:
#   1. Abrir caixa (já existe em caixa.py)
#   2. Criar venda PDV (itens + forma de pagamento)
#   3. Finalizar — baixa estoque, gera NFC-e, registra no caixa
#   4. Cancelar — devolve estoque, cancela NFC-e se emitida
#
# Diferenças em relação ao PedidoVenda:
#   - Não passa por fila de aprovação
#   - NFC-e em vez de NF-e (consumidor final)
#   - CPF do cliente é opcional
#   - Troco calculado automaticamente para dinheiro
# ==========================================

from decimal import Decimal
from django.utils import timezone
from django.db import transaction


def criar_venda_pdv(empresa, operador, itens_data, forma_pagamento_id,
                    valor_recebido=None, cpf_cliente=None, nome_cliente=None,
                    emitir_nfce=True):
    """
    Cria e finaliza uma venda no PDV.

    Args:
        empresa          : objeto Empresa
        operador         : objeto Usuario (quem está vendendo)
        itens_data       : lista de {'produto_id': X, 'quantidade': Y, 'preco_unitario': Z}
        forma_pagamento_id: ID da FormaPagamento
        valor_recebido   : valor em dinheiro entregue (para cálculo de troco)
        cpf_cliente      : CPF do consumidor (opcional — venda sem CPF é permitida)
        nome_cliente     : nome do consumidor (opcional)
        emitir_nfce      : se True, tenta emitir NFC-e via Focus NFe

    Retorna (sucesso: bool, resultado: dict | str)
    """
    from .models import (
        PedidoVendaPDV, ItemPedidoPDV, Produto, FormaPagamento,
        CaixaDiario, LancamentoCaixa, MovimentacaoEstoque, LoteEstoque,
        LogAuditoria,
    )
    from django.db.models import F

    if not itens_data:
        return False, 'Informe pelo menos um item.'

    # ── Verifica caixa aberto ──────────────────────────────────────────────
    caixa = CaixaDiario.objects.filter(
        empresa=empresa,
        operador=operador,
        status='aberto',
    ).first()
    if not caixa:
        return False, 'Não há caixa aberto. Abra o caixa antes de realizar vendas.'

    # ── Valida forma de pagamento ──────────────────────────────────────────
    try:
        forma_pgto = FormaPagamento.objects.get(id=forma_pagamento_id, empresa=empresa)
    except FormaPagamento.DoesNotExist:
        return False, 'Forma de pagamento não encontrada.'

    # ── Valida e calcula itens ─────────────────────────────────────────────
    itens_validados = []
    valor_total = Decimal('0.00')

    for item_data in itens_data:
        try:
            produto = Produto.objects.get(id=item_data['produto_id'], empresa=empresa)
        except Produto.DoesNotExist:
            return False, f"Produto ID {item_data['produto_id']} não encontrado."

        quantidade = Decimal(str(item_data.get('quantidade', 1)))
        preco_unit = Decimal(str(item_data.get('preco_unitario', produto.preco_venda)))
        desconto   = Decimal(str(item_data.get('desconto_percentual', 0)))

        if quantidade <= 0:
            return False, f"Quantidade inválida para '{produto.nome}'."
        if preco_unit <= 0:
            return False, f"Preço inválido para '{produto.nome}'."

        # Verifica estoque
        if produto.quantidade < quantidade:
            return False, (
                f"Estoque insuficiente para '{produto.nome}'. "
                f"Disponível: {produto.quantidade} | Solicitado: {quantidade}"
            )

        preco_com_desconto = preco_unit * (1 - desconto / 100)
        subtotal = quantidade * preco_com_desconto
        valor_total += subtotal

        itens_validados.append({
            'produto': produto,
            'quantidade': quantidade,
            'preco_unitario': preco_unit,
            'desconto_percentual': desconto,
            'preco_final': preco_com_desconto,
            'subtotal': subtotal,
        })

    # ── Calcula troco ──────────────────────────────────────────────────────
    troco = Decimal('0.00')
    if forma_pgto.nome.lower() in ('dinheiro', 'espécie', 'especie', 'cash'):
        if valor_recebido is not None:
            vr = Decimal(str(valor_recebido))
            if vr < valor_total:
                return False, (
                    f"Valor recebido (R$ {vr:.2f}) é menor que o total "
                    f"da venda (R$ {valor_total:.2f})."
                )
            troco = vr - valor_total

    # ── Cria venda e baixa estoque (atômico) ───────────────────────────────
    try:
        with transaction.atomic():
            venda = PedidoVendaPDV.objects.create(
                empresa=empresa,
                operador=operador,
                caixa=caixa,
                forma_pagamento=forma_pgto,
                valor_total=valor_total,
                valor_recebido=valor_recebido,
                troco=troco,
                cpf_cliente=cpf_cliente or '',
                nome_cliente=nome_cliente or '',
                status='finalizado',
            )

            for item_v in itens_validados:
                produto = item_v['produto']

                ItemPedidoPDV.objects.create(
                    venda=venda,
                    produto=produto,
                    quantidade=item_v['quantidade'],
                    preco_unitario=item_v['preco_unitario'],
                    desconto_percentual=item_v['desconto_percentual'],
                    preco_final=item_v['preco_final'],
                    subtotal=item_v['subtotal'],
                )

                # Baixa estoque FEFO
                qtd_restante = item_v['quantidade']
                lotes = produto.lotes.filter(quantidade__gt=0).order_by(
                    F('data_validade').asc(nulls_last=True)
                )
                for lote in lotes:
                    if qtd_restante <= Decimal('0'):
                        break
                    if lote.quantidade >= qtd_restante:
                        lote.quantidade -= qtd_restante
                        lote.save()
                        qtd_restante = Decimal('0')
                    else:
                        qtd_restante -= lote.quantidade
                        lote.quantidade = Decimal('0')
                        lote.save()

                produto.quantidade -= item_v['quantidade']
                produto.save()

                MovimentacaoEstoque.objects.create(
                    produto=produto,
                    operador=operador,
                    tipo='saida',
                    quantidade=-item_v['quantidade'],
                    saldo_apos_movimento=produto.quantidade,
                    origem=f"PDV Venda #{venda.id}",
                )

            # Registra no caixa
            LancamentoCaixa.objects.create(
                caixa=caixa,
                tipo='entrada',
                descricao=f"Venda PDV #{venda.id}",
                valor=valor_total,
                forma_pagamento=forma_pgto,
            )

            LogAuditoria.registrar(
                empresa=empresa,
                usuario=operador,
                acao='venda_pdv',
                modelo_afetado='PedidoVendaPDV',
                registro_id=venda.id,
                descricao=f"Venda PDV #{venda.id} — R$ {valor_total:.2f}",
            )

    except Exception as e:
        return False, f'Erro ao registrar venda: {str(e)}'

    resultado = {
        'venda_id': venda.id,
        'valor_total': float(valor_total),
        'troco': float(troco),
        'forma_pagamento': forma_pgto.nome,
        'status': 'finalizado',
        'nfce': None,
    }

    # ── Emite NFC-e ────────────────────────────────────────────────────────
    if emitir_nfce:
        ok_nfce, resp_nfce = emitir_nfce_pdv(empresa.id, venda)
        if ok_nfce:
            resultado['nfce'] = resp_nfce
        else:
            # NFC-e não bloqueia a venda — registra o erro e segue
            resultado['nfce_erro'] = resp_nfce

    return True, resultado


def cancelar_venda_pdv(empresa, operador, venda_id, motivo):
    """
    Cancela uma venda PDV: devolve estoque, estorna no caixa e
    cancela a NFC-e se já emitida.
    """
    from .models import (
        PedidoVendaPDV, MovimentacaoEstoque, LoteEstoque,
        LancamentoCaixa, LogAuditoria,
    )

    try:
        venda = PedidoVendaPDV.objects.get(id=venda_id, empresa=empresa)
    except PedidoVendaPDV.DoesNotExist:
        return False, 'Venda não encontrada.'

    if venda.status == 'cancelado':
        return False, 'Esta venda já está cancelada.'

    if len(motivo.strip()) < 10:
        return False, 'Informe um motivo com pelo menos 10 caracteres.'

    try:
        with transaction.atomic():
            # Devolve estoque
            for item in venda.itens.select_related('produto').all():
                item.produto.quantidade += item.quantidade
                item.produto.save()

                LoteEstoque.objects.create(
                    produto=item.produto,
                    quantidade=item.quantidade,
                    data_validade=None,
                    numero_lote=f"DEV-PDV{venda.id}",
                    nota_fiscal=None,
                )

                MovimentacaoEstoque.objects.create(
                    produto=item.produto,
                    operador=operador,
                    tipo='entrada',
                    quantidade=item.quantidade,
                    saldo_apos_movimento=item.produto.quantidade,
                    origem=f"Cancelamento PDV Venda #{venda.id}",
                )

            # Estorno no caixa
            LancamentoCaixa.objects.create(
                caixa=venda.caixa,
                tipo='saida',
                descricao=f"Cancelamento Venda PDV #{venda.id} — {motivo.strip()}",
                valor=venda.valor_total,
                forma_pagamento=venda.forma_pagamento,
            )

            venda.status = 'cancelado'
            venda.motivo_cancelamento = motivo.strip()
            venda.save()

            LogAuditoria.registrar(
                empresa=empresa,
                usuario=operador,
                acao='cancelamento_pdv',
                modelo_afetado='PedidoVendaPDV',
                registro_id=venda.id,
                descricao=f"Cancelamento PDV #{venda.id}. Motivo: {motivo.strip()}",
            )

    except Exception as e:
        return False, f'Erro ao cancelar venda: {str(e)}'

    # Cancela NFC-e se emitida
    if venda.nfce_referencia:
        from .manifestacao import cancelar_nfe
        cancelar_nfe(
            empresa.id, operador, venda.nfce_referencia,
            f'Cancelamento de venda PDV #{venda.id}: {motivo.strip()}'
        )

    return True, 'Venda cancelada e estoque devolvido.'


def emitir_nfce_pdv(empresa_id, venda):
    """
    Emite NFC-e para uma venda PDV via Focus NFe.
    NFC-e = Nota Fiscal ao Consumidor Eletrônica (modelo 65).

    Args:
        venda: objeto PedidoVendaPDV já salvo

    Retorna (sucesso: bool, resultado: dict | str)
    """
    import requests as req
    from .models import ConfiguracaoFiscal
    from .fiscal import sugerir_tributacao, calcular_impostos_item

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

    itens_nfce = []
    for item in venda.itens.select_related('produto').all():
        sugestao = sugerir_tributacao(empresa_id, config.uf, item.produto)
        impostos = calcular_impostos_item(
            preco_unitario=item.preco_final,
            quantidade=item.quantidade,
            regime=config.regime_tributario,
            aliquota_icms=sugestao.get('aliquota_icms', 12),
            cst_pis=sugestao.get('cst_pis', '07'),
            aliquota_pis=sugestao.get('aliquota_pis', 0),
            cst_cofins=sugestao.get('cst_cofins', '07'),
            aliquota_cofins=sugestao.get('aliquota_cofins', 0),
        )
        itens_nfce.append({
            'numero_item': len(itens_nfce) + 1,
            'codigo_produto': item.produto.sku,
            'descricao': item.produto.nome,
            'ncm': item.produto.ncm or '00000000',
            'cfop': sugestao.get('cfop_sugerido', '5102'),
            'unidade_comercial': item.produto.unidade_medida,
            'quantidade_comercial': float(item.quantidade),
            'valor_unitario_comercial': float(item.preco_final),
            'valor_bruto': float(item.subtotal),
            'origem': item.produto.origem,
            'icms_situacao_tributaria': sugestao.get('csosn') or sugestao.get('cst_icms', '102'),
            'icms_aliquota': float(sugestao.get('aliquota_icms', 0)),
            'icms_base_calculo': float(item.subtotal),
            'icms_valor': float(impostos['valor_icms']),
            'pis_situacao_tributaria': sugestao.get('cst_pis', '07'),
            'pis_aliquota_percentual': float(sugestao.get('aliquota_pis', 0)),
            'pis_base_calculo': float(item.subtotal),
            'pis_valor': float(impostos['valor_pis']),
            'cofins_situacao_tributaria': sugestao.get('cst_cofins', '07'),
            'cofins_aliquota_percentual': float(sugestao.get('aliquota_cofins', 0)),
            'cofins_base_calculo': float(item.subtotal),
            'cofins_valor': float(impostos['valor_cofins']),
        })

    # Pagamento
    pagamentos = [{
        'forma_pagamento': _codigo_forma_pgto(venda.forma_pagamento.nome),
        'valor': float(venda.valor_total),
    }]
    if venda.troco and venda.troco > 0:
        pagamentos[0]['troco'] = float(venda.troco)

    payload = {
        'natureza_operacao': 'Venda ao consumidor',
        'forma_pagamento': '0',
        'modelo': '65',          # NFC-e
        'tipo_documento': '1',
        'finalidade_emissao': '1',
        'cnpj_emitente': config.cnpj,
        'nome_emitente': venda.empresa.nome,
        'regime_tributario_emitente': config.crt,
        'items': itens_nfce,
        'formas_pagamento': pagamentos,
    }

    # CPF do consumidor é opcional na NFC-e
    if venda.cpf_cliente:
        payload['cpf_destinatario'] = venda.cpf_cliente
        if venda.nome_cliente:
            payload['nome_destinatario'] = venda.nome_cliente

    ref = f"pdv_{venda.id}"

    try:
        response = req.post(
            f"{base_url}/v2/nfce?ref={ref}",
            json=payload,
            auth=(config.focusnfe_token, ''),
            timeout=30,
        )
        data = response.json()
    except req.exceptions.RequestException as e:
        return False, f'Erro de comunicação com Focus NFe: {str(e)}'

    if response.status_code in (200, 201):
        # Salva referência da NFC-e na venda
        venda.nfce_referencia = ref
        venda.nfce_chave = data.get('chave_nfe', '')
        venda.nfce_status = data.get('status', '')
        venda.save(update_fields=['nfce_referencia', 'nfce_chave', 'nfce_status'])
        return True, {
            'referencia': ref,
            'chave_nfe': data.get('chave_nfe', ''),
            'numero': data.get('numero', ''),
            'caminho_danfe': data.get('caminho_danfe_nfce', ''),
            'status': data.get('status', ''),
        }
    else:
        return False, data.get('mensagem', 'Erro ao emitir NFC-e.')


def _codigo_forma_pgto(nome):
    """Converte nome da forma de pagamento para código SEFAZ."""
    mapa = {
        'dinheiro': '01', 'espécie': '01', 'especie': '01',
        'cheque': '02',
        'cartão de crédito': '03', 'credito': '03', 'crédito': '03',
        'cartão de débito': '04', 'debito': '04', 'débito': '04',
        'pix': '17',
        'boleto': '15',
        'crediário': '10', 'crediario': '10',
    }
    return mapa.get(nome.lower(), '99')  # 99 = outros
