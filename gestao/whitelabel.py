import boto3
import io
from decimal import Decimal
 
 
def upload_logo_s3(empresa_id, arquivo):
    """
    Faz upload da logo para o S3 e retorna a URL pública.
    Requer configuração de AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    e AWS_S3_BUCKET_NAME no settings.py.
    """
    from django.conf import settings
    from .models import ConfiguracaoWhiteLabel, Empresa
 
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return False, 'Empresa não encontrada.'
 
    # Só disponível para indústrias
    if empresa.tipo_negocio != 'industria':
        return False, 'White-label disponível apenas para indústrias.'
 
    s3_client = boto3.client(
        's3',
        aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', ''),
        aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', ''),
        region_name=getattr(settings, 'AWS_S3_REGION', 'us-east-1'),
    )
 
    bucket = getattr(settings, 'AWS_S3_BUCKET_NAME', '')
    if not bucket:
        return False, 'Bucket S3 não configurado no settings.py.'
 
    # Nome único do arquivo
    import uuid
    extensao = arquivo.name.split('.')[-1].lower()
    s3_key = f"logos/{empresa_id}/{uuid.uuid4()}.{extensao}"
 
    try:
        s3_client.upload_fileobj(
            arquivo,
            bucket,
            s3_key,
            ExtraArgs={'ContentType': f'image/{extensao}', 'ACL': 'public-read'},
        )
        url = f"https://{bucket}.s3.amazonaws.com/{s3_key}"
 
        # Salva no banco
        config, _ = ConfiguracaoWhiteLabel.objects.get_or_create(empresa=empresa)
        config.logo_url = url
        config.logo_s3_key = s3_key
 
        # Extrai cores automaticamente
        cores = extrair_cores_logo(arquivo)
        if cores:
            config.cor_primaria = cores['primaria']
            config.cor_secundaria = cores['secundaria']
            config.cor_texto = cores['texto']
            config.cor_fundo = cores['fundo']
 
        config.save()
        return True, {'url': url, 'cores_sugeridas': cores}
 
    except Exception as e:
        return False, f"Erro no upload: {str(e)}"
 
 
def extrair_cores_logo(arquivo):
    """
    Extrai cores dominantes da logo usando colorthief.
    Sugere paleta clara e escura baseada nas cores encontradas.
    Requer: pip install colorthief Pillow
    """
    try:
        from colorthief import ColorThief
        from PIL import Image
 
        # Lê o arquivo
        imagem = Image.open(arquivo)
        arquivo.seek(0)
 
        # Salva temporariamente em memória
        buffer = io.BytesIO()
        imagem.save(buffer, format='PNG')
        buffer.seek(0)
 
        ct = ColorThief(buffer)
        cor_dominante = ct.get_color(quality=1)
        paleta = ct.get_palette(color_count=3, quality=1)
 
        # Converte RGB para HEX
        def rgb_para_hex(rgb):
            return '#{:02X}{:02X}{:02X}'.format(*rgb)
 
        primaria = rgb_para_hex(cor_dominante)
        secundaria = rgb_para_hex(paleta[1]) if len(paleta) > 1 else primaria
 
        # Detecta se a cor é clara ou escura
        # Fórmula de luminância relativa
        r, g, b = cor_dominante
        luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
 
        if luminancia > 0.5:
            # Cor clara → texto escuro
            texto = '#1B1B1B'
            fundo = '#FFFFFF'
        else:
            # Cor escura → texto claro
            texto = '#FFFFFF'
            fundo = '#F5F5F5'
 
        return {
            'primaria': primaria,
            'secundaria': secundaria,
            'texto': texto,
            'fundo': fundo,
            'tema_sugerido': 'claro' if luminancia > 0.5 else 'escuro',
        }
 
    except ImportError:
        # colorthief não instalado — retorna cores padrão
        return {
            'primaria': '#1B5E20',
            'secundaria': '#4CAF50',
            'texto': '#1B1B1B',
            'fundo': '#FFFFFF',
            'tema_sugerido': 'claro',
        }
    except Exception:
        return None
 
 
def obter_configuracao_whitelabel(empresa_id):
    """
    Retorna a configuração white-label da empresa.
    Se não for indústria ou não tiver configuração,
    retorna o padrão do AgroPulse.
    """
    from .models import Empresa, ConfiguracaoWhiteLabel
 
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return _config_padrao()
 
    # Só retorna white-label customizado para indústrias
    if empresa.tipo_negocio != 'industria':
        return _config_padrao()
 
    try:
        config = ConfiguracaoWhiteLabel.objects.get(empresa=empresa)
        return {
            'nome_sistema': config.nome_sistema or 'AgroPulse',
            'logo_url': config.logo_url,
            'tema': config.tema,
            'cores': {
                'primaria': config.cor_primaria,
                'secundaria': config.cor_secundaria,
                'texto': config.cor_texto,
                'fundo': config.cor_fundo,
            },
            'rodape': config.gerar_rodape(),
            'dominio_personalizado': config.dominio_personalizado,
            'white_label_ativo': True,
        }
    except ConfiguracaoWhiteLabel.DoesNotExist:
        return _config_padrao()
 
 
def _config_padrao():
    """Configuração padrão do AgroPulse."""
    return {
        'nome_sistema': 'AgroPulse',
        'logo_url': None,
        'tema': 'claro',
        'cores': {
            'primaria': '#1B5E20',
            'secundaria': '#4CAF50',
            'texto': '#1B1B1B',
            'fundo': '#FFFFFF',
        },
        'rodape': 'AgroPulse — Sistemas para o Agronegócio',
        'dominio_personalizado': None,
        'white_label_ativo': False,
    }