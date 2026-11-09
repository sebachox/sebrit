from django.db.models.functions import Lower
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.assets.permissions import EsAdminOTecnico
from apps.incidents.views import cuerpo
from apps.organizations.models import Organizacion
from apps.organizations.permissions import EsAdminOTecnicoLectura

from .models import Usuario
from .serializers import (
    CambiarClaveSerializer,
    DefinirClaveSerializer,
    LoginSerializer,
    PerfilSerializer,
    UsuarioEmpresaCrearSerializer,
    UsuarioEmpresaSerializer,
    datos_usuario,
)


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


def _organizacion(org_id):
    return get_object_or_404(Organizacion, pk=org_id)


def _cliente(org_id, uid):
    """Solo cuentas `cliente` de esa empresa: las internas no se alcanzan desde aquí."""
    return get_object_or_404(Usuario, pk=uid, rol=Usuario.Rol.CLIENTE, organizacion=_organizacion(org_id))


class UsuariosEmpresaView(APIView):
    permission_classes = [EsAdminOTecnicoLectura]

    def get(self, request, org_id):
        usuarios = Usuario.objects.filter(rol=Usuario.Rol.CLIENTE, organizacion=_organizacion(org_id))
        return Response(UsuarioEmpresaSerializer(usuarios.order_by(Lower("username"), "id"), many=True).data)

    def post(self, request, org_id):
        entrada = UsuarioEmpresaCrearSerializer(
            data=cuerpo(request), context={"organizacion": _organizacion(org_id)}
        )
        entrada.is_valid(raise_exception=True)
        return Response(UsuarioEmpresaSerializer(entrada.save()).data, status=status.HTTP_201_CREATED)


class UsuarioEmpresaView(APIView):
    permission_classes = [EsAdminOTecnicoLectura]

    def patch(self, request, org_id, uid):
        entrada = UsuarioEmpresaSerializer(_cliente(org_id, uid), data=cuerpo(request), partial=True)
        entrada.is_valid(raise_exception=True)
        entrada.save()
        return Response(entrada.data)


class ClaveUsuarioEmpresaView(APIView):
    permission_classes = [EsAdminOTecnicoLectura]

    def post(self, request, org_id, uid):
        entrada = DefinirClaveSerializer(data=cuerpo(request), context={"usuario": _cliente(org_id, uid)})
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
