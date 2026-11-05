from rest_framework import serializers

from .models import Organizacion


class OrganizacionListaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organizacion
        fields = [
            "id", "nombre", "nit", "ciudad", "plan",
            "contacto_nombre", "fecha_fin_contrato", "activa",
        ]


class OrganizacionDetalleSerializer(serializers.ModelSerializer):
    resumen = serializers.SerializerMethodField()

    class Meta:
        model = Organizacion
        fields = [
            "id", "nombre", "nit", "sector", "telefono", "correo", "direccion", "ciudad",
            "contacto_nombre", "contacto_cargo", "contacto_correo", "contacto_telefono",
            "plan", "fecha_inicio_contrato", "fecha_fin_contrato", "activa",
            "creado_en", "actualizado_en", "resumen",
        ]
        read_only_fields = ["creado_en", "actualizado_en"]

    def get_resumen(self, obj):
        return {"activos": 0, "tickets_abiertos": 0, "incidentes_activos": 0, "usuarios": 0}
