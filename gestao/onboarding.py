# ==========================================
# gestao/onboarding.py
# Cadastro de novos clientes no sistema.
# Cria a empresa e o primeiro usuário Diretor
# em uma única transação atômica.
# Rota pública — não requer autenticação.
# ==========================================

from django.db import transaction
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


@api_view(['POST'])
@permission_classes([AllowAny])
def api_onboarding(request):
    """
    Cadastra uma nova empresa cliente no sistema.

    Payload esperado:
    {
        "empresa_nome":   "Agro Silva Ltda",
        "cnpj":           "12.345.678/0001-99",
        "tipo_negocio":   "revenda",          // revenda | industria
        "diretor_nome":   "João Silva",
        "diretor_email":  "joao@agrosilva.com.br",
        "diretor_usuario": "joaosilva",
        "diretor_senha":  "SenhaForte@123"
    }

    Retorna os tokens JWT do Diretor recém-criado para que
    o frontend já entre logado após o cadastro.
    """
    from .models import Empresa, Usuario

    # ── Campos obrigatórios ────────────────────────────────────────────────
    campos = [
        'empresa_nome', 'cnpj', 'tipo_negocio',
        'diretor_nome', 'diretor_email', 'diretor_usuario', 'diretor_senha',
    ]
    faltando = [c for c in campos if not request.data.get(c, '').strip()]
    if faltando:
        return Response(
            {'erro': f'Campos obrigatórios ausentes: {", ".join(faltando)}'},
            status=400,
        )

    empresa_nome   = request.data['empresa_nome'].strip()
    cnpj           = request.data['cnpj'].strip()
    tipo_negocio   = request.data['tipo_negocio'].strip()
    diretor_nome   = request.data['diretor_nome'].strip()
    diretor_email  = request.data['diretor_email'].strip()
    diretor_usuario = request.data['diretor_usuario'].strip()
    diretor_senha  = request.data['diretor_senha']

    # ── Validações básicas ─────────────────────────────────────────────────
    tipos_validos = ['revenda', 'industria']
    if tipo_negocio not in tipos_validos:
        return Response(
            {'erro': f'tipo_negocio inválido. Use: {", ".join(tipos_validos)}'},
            status=400,
        )

    if Empresa.objects.filter(cnpj=cnpj).exists():
        return Response(
            {'erro': 'Já existe uma empresa cadastrada com este CNPJ.'},
            status=400,
        )

    if Usuario.objects.filter(username=diretor_usuario).exists():
        return Response(
            {'erro': 'Este nome de usuário já está em uso.'},
            status=400,
        )

    if Usuario.objects.filter(email=diretor_email).exists():
        return Response(
            {'erro': 'Este e-mail já está cadastrado.'},
            status=400,
        )

    # ── Valida força da senha ──────────────────────────────────────────────
    try:
        validate_password(diretor_senha)
    except DjangoValidationError as e:
        return Response({'erro': list(e.messages)}, status=400)

    # ── Criação atômica — empresa + diretor ────────────────────────────────
    try:
        with transaction.atomic():
            empresa = Empresa.objects.create(
                nome=empresa_nome,
                cnpj=cnpj,
                tipo_negocio=tipo_negocio,
            )

            # Separa primeiro e último nome
            partes_nome = diretor_nome.split(' ', 1)
            first_name = partes_nome[0]
            last_name  = partes_nome[1] if len(partes_nome) > 1 else ''

            diretor = Usuario.objects.create_user(
                username=diretor_usuario,
                email=diretor_email,
                password=diretor_senha,
                first_name=first_name,
                last_name=last_name,
                empresa=empresa,
                nivel='diretor',
                is_active=True,
            )

    except Exception as e:
        return Response(
            {'erro': f'Erro ao criar conta: {str(e)}'},
            status=500,
        )

    # ── Retorna tokens JWT para login automático ───────────────────────────
    refresh = RefreshToken.for_user(diretor)

    return Response({
        'mensagem': 'Conta criada com sucesso!',
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'usuario': {
            'id': diretor.id,
            'username': diretor.username,
            'nome': diretor.get_full_name() or diretor.username,
            'email': diretor.email,
            'nivel': 'diretor',
            'nivel_display': 'Nível 1 - Diretor',
            'empresa_id': empresa.id,
            'empresa_nome': empresa.nome,
            'tipo_negocio': empresa.tipo_negocio,
            'meta_mensal': 0,
            've_apenas_seus_clientes': False,
            'is_superhost': False,
        },
    }, status=201)
