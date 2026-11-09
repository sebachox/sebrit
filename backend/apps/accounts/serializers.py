from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import translation
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.incidents.serializers import errores
from apps.organizations.serializers import VacioComoNullMixin

from .models import Usuario


def datos_usuario(u):
    return {
        "id": u.id,
        "username": u.username,
        "nombre": u.get_full_name() or u.username,
        "rol": u.rol,
    }


class LoginSerializer(TokenObtainPairSerializer):
    """Login JWT que además devuelve los datos básicos del usuario."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["rol"] = user.rol
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["usuario"] = datos_usuario(self.user)
        return data


MSG_NOMBRE_LARGO = {"max_length": "Usa máximo 150 caracteres."}


class PerfilSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    """Datos personales del usuario de la sesión. Usuario, rol y organización son de solo lectura."""

    texto_opcional = ["nombres", "apellidos", "correo"]

    nombres = serializers.CharField(
        source="first_name", required=False, allow_blank=True, max_length=150, error_messages=MSG_NOMBRE_LARGO
    )
    apellidos = serializers.CharField(
        source="last_name", required=False, allow_blank=True, max_length=150, error_messages=MSG_NOMBRE_LARGO
    )
    correo = serializers.EmailField(
        source="email",
        required=False,
        allow_blank=True,
        max_length=254,
        error_messages={"invalid": "Escribe un correo válido.", "max_length": "Usa máximo 254 caracteres."},
    )
    nombre_completo = serializers.SerializerMethodField()
    organizacion = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ["id", "username", "nombres", "apellidos", "nombre_completo", "correo", "rol", "organizacion"]
        read_only_fields = ["username", "rol"]

    def get_nombre_completo(self, u):
        return u.get_full_name() or u.username

    def get_organizacion(self, u):
        return {"id": u.organizacion_id, "nombre": u.organizacion.nombre} if u.organizacion else None


class CambiarClaveSerializer(serializers.Serializer):
    clave_actual = serializers.CharField(
        trim_whitespace=False,
        max_length=128,
        error_messages={**errores("Escribe tu contraseña actual."), "max_length": "La contraseña actual no es correcta."},
    )
    clave_nueva = serializers.CharField(
        trim_whitespace=False,
        max_length=128,
        error_messages={**errores("Escribe la nueva contraseña."), "max_length": "Usa máximo 128 caracteres."},
    )

    def validate_clave_actual(self, valor):
        if not self.context["usuario"].check_password(valor):
            raise serializers.ValidationError("La contraseña actual no es correcta.")
        return valor

    def validate_clave_nueva(self, valor):
        usuario = self.context["usuario"]
        if usuario.check_password(valor):
            raise serializers.ValidationError("La nueva contraseña debe ser distinta de la actual.")
        # LANGUAGE_CODE es en-us: sin esto, Django explicaría el rechazo en inglés.
        with translation.override("es"):
            try:
                validate_password(valor, usuario)
            except DjangoValidationError as e:
                raise serializers.ValidationError(list(e.messages))
        return valor

    def save(self):
        usuario = self.context["usuario"]
        usuario.set_password(self.validated_data["clave_nueva"])
        usuario.save(update_fields=["password"])
        return usuario
