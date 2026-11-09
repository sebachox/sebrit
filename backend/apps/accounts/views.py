from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.assets.permissions import EsAdminOTecnico
from apps.incidents.views import cuerpo

from .models import Usuario
from .serializers import CambiarClaveSerializer, LoginSerializer, PerfilSerializer, datos_usuario


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class UsuarioActualView(APIView):
    def get(self, request):
        return Response(datos_usuario(request.user))


class PerfilView(APIView):
    """Datos personales de quien tiene la sesión; nunca los de otra persona."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(PerfilSerializer(request.user).data)

    def patch(self, request):
        entrada = PerfilSerializer(request.user, data=cuerpo(request), partial=True)
        entrada.is_valid(raise_exception=True)
        entrada.save()
        return Response(entrada.data)


class CambiarClaveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        entrada = CambiarClaveSerializer(data=cuerpo(request), context={"usuario": request.user})
        entrada.is_valid(raise_exception=True)
        entrada.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TecnicosView(APIView):
    """Personas a las que se les puede asignar trabajo (selector de técnico)."""

    permission_classes = [EsAdminOTecnico]

    def get(self, request):
        usuarios = Usuario.objects.filter(is_active=True, rol__in=["admin", "tecnico"])
        tecnicos = [{"id": u.id, "nombre": u.get_full_name() or u.username} for u in usuarios]
        return Response(sorted(tecnicos, key=lambda t: t["nombre"].casefold()))
