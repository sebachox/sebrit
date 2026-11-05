from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


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
