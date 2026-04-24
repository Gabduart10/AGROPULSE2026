from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='gestao.Colaborador')
def sincronizar_status_usuario(sender, instance, **kwargs):
    """
    Quando um Colaborador é desativado (status != 'ativo'),
    bloqueia automaticamente o Usuario vinculado (is_active=False).
    Quando reativado, restaura o acesso (is_active=True).
    """
    if instance.usuario_id is None:
        return

    usuario = instance.usuario
    deve_estar_ativo = instance.status == 'ativo'

    if usuario.is_active != deve_estar_ativo:
        usuario.is_active = deve_estar_ativo
        usuario.save(update_fields=['is_active'])
