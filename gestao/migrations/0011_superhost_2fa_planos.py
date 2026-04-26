from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestao', '0010_contingencia_sefaz'),
    ]

    operations = [
        # Empresa — plano, limites e módulos
        migrations.AddField(
            model_name='empresa',
            name='plano',
            field=models.CharField(
                choices=[('starter', 'Starter'), ('pro', 'Pro'), ('enterprise', 'Enterprise')],
                default='starter', max_length=20, verbose_name='Plano',
            ),
        ),
        migrations.AddField(
            model_name='empresa',
            name='max_usuarios',
            field=models.PositiveIntegerField(default=10, verbose_name='Máximo de usuários'),
        ),
        migrations.AddField(
            model_name='empresa',
            name='modulos_habilitados',
            field=models.JSONField(blank=True, default=dict, verbose_name='Módulos habilitados'),
        ),

        # Usuario — 2FA
        migrations.AddField(
            model_name='usuario',
            name='totp_secret',
            field=models.CharField(blank=True, max_length=64, null=True, verbose_name='Segredo TOTP (2FA)'),
        ),
        migrations.AddField(
            model_name='usuario',
            name='totp_habilitado',
            field=models.BooleanField(default=False, verbose_name='2FA habilitado'),
        ),

        # LogAuditoria — justificativa
        migrations.AddField(
            model_name='logauditoria',
            name='justificativa',
            field=models.TextField(blank=True, null=True, verbose_name='Justificativa de acesso'),
        ),
    ]
