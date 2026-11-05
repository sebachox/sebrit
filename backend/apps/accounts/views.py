from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import LoginSerializer, datos_usuario


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class UsuarioActualView(APIView):
    def get(self, request):
        return Response(datos_usuario(request.user))
