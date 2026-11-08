from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.assets.permissions import EsAdminOTecnico

from .models import Usuario
from .serializers import LoginSerializer, datos_usuario


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class UsuarioActualView(APIView):
    def get(self, request):
        return Response(datos_usuario(request.user))


class TecnicosView(APIView):
    """Personas a las que se les puede asignar trabajo (selector de técnico)."""

    permission_classes = [EsAdminOTecnico]

    def get(self, request):
        usuarios = Usuario.objects.filter(is_active=True, rol__in=["admin", "tecnico"])
        tecnicos = [{"id": u.id, "nombre": u.get_full_name() or u.username} for u in usuarios]
        return Response(sorted(tecnicos, key=lambda t: t["nombre"].casefold()))
