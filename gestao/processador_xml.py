import xml.etree.ElementTree as ET
from decimal import Decimal
from django.db import transaction
from datetime import timedelta, datetime
from django.utils import timezone

def processar_nfe_entrada(nota_fiscal):
    """
    Motor Stark: Abre a caixa do XML, cadastra produtos, gera lotes e faz a ponte financeira.
    """
    # Importação local de segurança (evita erro de referência circular com o models.py)
    from .models import Produto, LoteEstoque, ItemNotaFiscal

    ns = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}
    
    try:
        # Abertura blindada: garante que o arquivo seja lido corretamente do disco
        with nota_fiscal.arquivo_xml.open('rb') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            infNFe = root.find('.//nfe:infNFe', ns)
            
            if infNFe is None:
                print("Abortado: XML não é padrão SEFAZ.")
                return False

        with transaction.atomic():
            # 1. IDENTIFICAR O FORNECEDOR (Quem vendeu pro assinante)
            from .models import Fornecedor
            emit = infNFe.find('.//nfe:emit', ns)
            if emit is not None:
                cnpj_fornecedor = emit.find('nfe:CNPJ', ns).text
                nome_fornecedor = emit.find('nfe:xNome', ns).text
                
                fornecedor_obj, created = Fornecedor.objects.get_or_create(
                    cnpj=cnpj_fornecedor,
                    empresa=nota_fiscal.empresa,
                    defaults={'nome_razao': nome_fornecedor}
                )
                nota_fiscal.fornecedor = fornecedor_obj
                nota_fiscal.save()
                
            detalhes = infNFe.findall('.//nfe:det', ns)
            
            for det in detalhes:
                prod = det.find('nfe:prod', ns)
                
                # Coleta os dados do produto no XML
                nome_prod = prod.find('nfe:xProd', ns).text
                sku_prod = prod.find('nfe:cProd', ns).text
                ncm_prod = prod.find('nfe:NCM', ns).text if prod.find('nfe:NCM', ns) is not None else ''
                
                qtd_prod = Decimal(prod.find('nfe:qCom', ns).text)
                vUnCom = Decimal(prod.find('nfe:vUnCom', ns).text)
                vProd = Decimal(prod.find('nfe:vProd', ns).text)
                
                # 1. Procura o Produto. Se for novo, cadastra sozinho.
                produto_obj, created = Produto.objects.get_or_create(
                    sku=sku_prod,
                    empresa=nota_fiscal.empresa,
                    defaults={
                        'nome': nome_prod,
                        'ncm': ncm_prod,
                        'margem_minima': Decimal('20.00'), # Trava de margem inicial
                    }
                )
                
                # 2. Gera o Lote com a Quantidade
                numero_lote_gerado = f"LT-{nota_fiscal.numero_nota}-{sku_prod}"
                
                # Se tiver data de emissão, validade é 1 ano depois. Se não, 1 ano a partir de hoje.
                if nota_fiscal.data_emissao:
                    validade_padrao = nota_fiscal.data_emissao.date() + timedelta(days=365)
                else:
                    validade_padrao = timezone.now().date() + timedelta(days=365)
                
                # O ECOSSISTEMA: A Matemática do Fator de Divisão
                fator = produto_obj.fator_divisao_nfe
                qtd_real_estoque = qtd_prod / fator
                custo_real_unitario = vUnCom * fator
                
                lote_obj, lote_created = LoteEstoque.objects.get_or_create(
                    produto=produto_obj,
                    numero_lote=numero_lote_gerado,
                    defaults={
                        'quantidade': qtd_real_estoque,       # Injeta Galões, não Litros
                        'custo_unitario': custo_real_unitario, # Injeta custo do Galão
                        'data_validade': validade_padrao
                    }
                )
                
                if not lote_created:
                    continue
                
                # 3. Alimenta o Painel Principal do Produto
                produto_obj.quantidade += qtd_real_estoque
                produto_obj.custo_medio_ponderado = custo_real_unitario
                produto_obj.save() # Ao salvar, o nosso "Cérebro de Mão Dupla" já vai atualizar o Preço de Venda sozinho!
                
                # 4. Cria a linha da nota para o histórico (mantemos a info original da NFe aqui)
                ItemNotaFiscal.objects.create(
                    nota_fiscal=nota_fiscal,
                    produto=produto_obj,
                    lote=lote_obj,
                    quantidade=qtd_prod,
                    valor_unitario=vUnCom,
                    valor_total=vProd
                )
                # A CAIXA-PRETA: Registra a entrada automática via XML
                from .models import MovimentacaoEstoque
                MovimentacaoEstoque.objects.create(
                    produto=produto_obj,
                    operador=None, # XML entra pelo sistema (robô)
                    tipo='entrada',
                    quantidade=qtd_real_estoque,
                    saldo_apos_movimento=produto_obj.quantidade,
                    origem=f"Entrada XML NF {nota_fiscal.numero_nota}"
                )
                
            # 5. IDENTIFICAR E CRIAR O CONTAS A PAGAR (Financeiro)
            from .models import ContaPagar
            
            cobr = infNFe.find('.//nfe:cobr', ns)
            if cobr is not None:
                duplicatas = cobr.findall('.//nfe:dup', ns)
                
                # Se a nota foi parcelada, ele cria uma conta para cada parcela
                for i, dup in enumerate(duplicatas):
                    vencimento_str = dup.find('nfe:dVenc', ns).text
                    valor_str = dup.find('nfe:vDup', ns).text
                    
                    try:
                        data_vencimento = datetime.strptime(vencimento_str, '%Y-%m-%d').date()
                        valor_parcela = Decimal(valor_str)
                        
                        ContaPagar.objects.create(
                            empresa=nota_fiscal.empresa,
                            fornecedor=nota_fiscal.fornecedor,
                            nota_fiscal=nota_fiscal,
                            descricao=f"Parcela {i+1} da NF {nota_fiscal.numero_nota}",
                            valor=valor_parcela,
                            data_vencimento=data_vencimento,
                            status='pendente'
                        )
                    except Exception as e:
                        print(f"Erro ao gerar fatura {i+1}: {e}")
                        
        return True
    except Exception as e:
        print(f"Falha no Motor XML: {e}")
        return False