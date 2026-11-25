"""Catálogo ficticio para `seed_completo`. Nombres, NIT y correos inventados (dominios .example)."""

EMPRESAS = [
    {
        "nombre": "Clínica Santa Lucía del Sur", "sigla": "clinica", "nit": "900481237-4", "sector": "Salud",
        "ciudad": "Pasto", "direccion": "Calle 18 # 32-45, barrio Las Cuadras", "telefono": "6027312450",
        "contacto": ("Mariana Rodríguez", "Jefe de sistemas", "3157208841"), "plan": "premium",
        "servidores": 18, "redes": 11, "activa": True,
        "usuarios": [("Mariana", "Rodríguez"), ("Felipe", "Guerrero")],
    },
    {
        "nombre": "Distribuidora Andina de Alimentos S.A.S.", "sigla": "andina", "nit": "901122350-8",
        "sector": "Comercio", "ciudad": "Cali", "direccion": "Carrera 1 # 47-120, bodega 3",
        "telefono": "6024869012", "contacto": ("Jorge Castillo", "Gerente administrativo", "3186402217"),
        "plan": "estandar", "servidores": 12, "redes": 8, "activa": True,
        "usuarios": [("Jorge", "Castillo"), ("Paola", "Muñoz")],
    },
    {
        "nombre": "Colegio Nuevo Horizonte", "sigla": "horizonte", "nit": "800573194-1", "sector": "Educación",
        "ciudad": "Pasto", "direccion": "Avenida Panamericana # 12-60", "telefono": "6027230981",
        "contacto": ("Sandra Erazo", "Coordinadora administrativa", "3006125734"), "plan": "basico",
        "servidores": 6, "redes": 7, "activa": True,
        "usuarios": [("Sandra", "Erazo"), ("Diego", "Cabrera")],
    },
    {
        "nombre": "Transportes del Pacífico Ltda.", "sigla": "pacifico", "nit": "890310462-5", "sector": "Logística",
        "ciudad": "Buenaventura", "direccion": "Avenida Simón Bolívar km 4, patio 2", "telefono": "6022418836",
        "contacto": ("Hernán Valencia", "Director de operaciones", "3127756093"), "plan": "estandar",
        "servidores": 10, "redes": 8, "activa": True,
        "usuarios": [("Hernán", "Valencia"), ("Luisa", "Mosquera")],
    },
    {
        "nombre": "Constructora Galeras S.A.S.", "sigla": "galeras", "nit": "901287613-2", "sector": "Construcción",
        "ciudad": "Pasto", "direccion": "Calle 20 # 25-18, piso 4", "telefono": "6027365520",
        "contacto": ("Ricardo Burbano", "Gerente general", "3168830412"), "plan": "premium",
        "servidores": 14, "redes": 9, "activa": True,
        "usuarios": [("Ricardo", "Burbano"), ("Natalia", "Ordóñez")],
    },
    {
        "nombre": "Cooperativa Agraria del Sur", "sigla": "agraria", "nit": "814002736-9", "sector": "Agroindustria",
        "ciudad": "Ipiales", "direccion": "Carrera 6 # 14-33", "telefono": "6027734105",
        "contacto": ("Alba Chamorro", "Contadora", "3218450067"), "plan": "basico",
        "servidores": 7, "redes": 5, "activa": True,
        "usuarios": [("Alba", "Chamorro"), ("Óscar", "Pantoja")],
    },
    {
        "nombre": "Hotel Mirador del Lago", "sigla": "mirador", "nit": "900765921-0", "sector": "Turismo",
        "ciudad": "Pasto", "direccion": "Kilómetro 22 vía al Encano", "telefono": "6027219044",
        "contacto": ("Camilo Delgado", "Administrador", "3145590328"), "plan": "estandar",
        "servidores": 9, "redes": 9, "activa": True,
        "usuarios": [("Camilo", "Delgado"), ("Juliana", "Insuasty")],
    },
    {
        "nombre": "Laboratorio Óptico Visión Clara", "sigla": "vision", "nit": "900338410-6", "sector": "Salud",
        "ciudad": "Popayán", "direccion": "Calle 5 # 9-27, local 2", "telefono": "6028241177",
        "contacto": ("Teresa Muñoz", "Propietaria", "3112847760"), "plan": "basico",
        "servidores": 5, "redes": 4, "activa": False,
        "usuarios": [("Teresa", "Muñoz"), ("Andrés", "Bolaños")],
    },
]

TECNICOS = [
    ("dmartinez", "Daniela", "Martínez"),
    ("arosero", "Andrés", "Rosero"),
    ("cbenavides", "Camila", "Benavides"),
    ("jortega", "Julián", "Ortega"),
    ("vpaz", "Valentina", "Paz"),
]

# (prefijo, función, sistemas operativos posibles, tamaño de un backup completo en GB, backup diario)
ROLES_SERVIDOR = [
    ("DB", "Base de datos", ["Ubuntu Server 22.04 LTS", "Windows Server 2022"], 120, True),
    ("ERP", "Sistema contable", ["Windows Server 2022", "Windows Server 2019"], 90, True),
    ("AD", "Directorio activo", ["Windows Server 2022"], 15, True),
    ("FS", "Archivos compartidos", ["Windows Server 2019", "TrueNAS SCALE 24.04"], 350, False),
    ("APP", "Aplicaciones", ["Ubuntu Server 22.04 LTS", "Debian 12"], 40, False),
    ("WEB", "Sitio web y correo", ["Debian 12", "Ubuntu Server 24.04 LTS"], 25, False),
    ("HV", "Virtualización", ["Proxmox VE 8.2", "VMware ESXi 8.0"], 60, False),
]

EQUIPOS_SERVIDOR = [
    ("Dell", "PowerEdge R650"), ("Dell", "PowerEdge R740"), ("HPE", "ProLiant DL380 Gen10"),
    ("Lenovo", "ThinkSystem SR650"), ("Dell", "PowerEdge T350"),
]

# (prefijo, función, fabricante, modelo, sistema)
ROLES_RED = [
    ("FW", "Firewall", "Fortinet", "FortiGate 60F", "FortiOS 7.2"),
    ("SW", "Switch", "Cisco", "Catalyst 9200L", "IOS XE 17.9"),
    ("AP", "Access point", "Ubiquiti", "UniFi U6 Pro", "UniFi OS 3.2"),
    ("RT", "Router", "MikroTik", "CCR2004-1G-12S+2XS", "RouterOS 7.14"),
]

UBICACIONES = [
    "Sala de servidores, rack A", "Sala de servidores, rack B", "Cuarto técnico piso 2",
    "Sede norte, cuarto de red", "Oficina administrativa",
]

NOTAS_ACTIVO = [
    "Garantía del fabricante vigente hasta 2027.",
    "Revisar ventiladores en el próximo mantenimiento.",
    "Fuente redundante instalada en marzo.",
    "",
    "",
    "",
]

# categoría, título, descripción, tipo de activo relacionado (o None), solución
PLANTILLAS_TICKET = [
    ("hardware", "La impresora de facturación no imprime", "La impresora del área de facturación muestra atasco de papel aunque no hay hojas atascadas.", None, "Se limpió el sensor de papel y se reinstaló el controlador."),
    ("hardware", "Computador de recepción no enciende", "El equipo de recepción no da imagen desde esta mañana.", None, "Se reemplazó la fuente de poder del equipo."),
    ("hardware", "Ruido extraño en el servidor", "Se escucha un pitido constante en la sala de servidores.", "servidor", "Se cambió un ventilador defectuoso y se verificó la temperatura."),
    ("hardware", "Pantalla parpadea en contabilidad", "El monitor de la contadora parpadea cada pocos minutos.", None, "Se cambió el cable de video dañado."),
    ("software", "Error al abrir el sistema contable", "Al ingresar al sistema contable aparece un error de conexión con la base de datos.", "servidor", "Se reinició el servicio de base de datos y se ajustó el límite de conexiones."),
    ("software", "Office pide activación", "Varios equipos muestran el aviso de que Office no está activado.", None, "Se reasignaron las licencias desde la consola de administración."),
    ("software", "El sistema de citas está muy lento", "Cargar la agenda de citas tarda más de un minuto.", "servidor", "Se depuraron registros antiguos y se reconstruyeron los índices de la base de datos."),
    ("software", "No se generan los reportes en PDF", "Al exportar reportes a PDF el sistema se queda cargando.", "servidor", "Se actualizó el componente de reportes del servidor de aplicaciones."),
    ("software", "Actualización de Windows bloqueada", "Un equipo se quedó en el 30 % de una actualización.", None, "Se reparó la actualización desde el modo de recuperación."),
    ("red", "Sin internet en el segundo piso", "Los equipos del segundo piso no tienen salida a internet.", "red", "Se reinició el switch del piso y se reemplazó un patch cord dañado."),
    ("red", "El wifi de invitados no funciona", "Los visitantes no logran conectarse a la red de invitados.", "red", "Se renovó el certificado del portal cautivo del access point."),
    ("red", "La VPN se desconecta constantemente", "Los usuarios remotos pierden la VPN cada pocos minutos.", "red", "Se ajustó el tiempo de inactividad del túnel en el firewall."),
    ("red", "Internet muy lento en la tarde", "Entre las 2 y las 5 p. m. la navegación es muy lenta.", "red", "Se configuró control de ancho de banda para descargas y actualizaciones."),
    ("seguridad", "Correo sospechoso recibido por varios usuarios", "Llegó un correo que pide actualizar la clave del banco con un enlace extraño.", None, "Se bloqueó el remitente, se eliminó el correo de los buzones y se avisó al personal."),
    ("seguridad", "Antivirus detectó una amenaza", "El antivirus de un equipo de caja reporta un archivo malicioso en una memoria USB.", None, "Se puso en cuarentena el archivo y se escaneó el equipo completo sin más hallazgos."),
    ("seguridad", "Intentos de acceso fallidos al servidor", "El firewall reporta muchos intentos de acceso remoto desde el exterior.", "red", "Se cerró el puerto expuesto y se restringió el acceso remoto a la VPN."),
    ("accesos", "Crear usuario para nueva empleada", "Ingresa una nueva auxiliar administrativa el lunes y necesita correo y acceso al sistema.", None, "Se creó la cuenta de correo, el usuario del sistema y se entregaron las credenciales."),
    ("accesos", "Desbloquear cuenta de usuario", "Un usuario bloqueó su cuenta por intentos fallidos.", None, "Se desbloqueó la cuenta y se pidió al usuario cambiar su contraseña."),
    ("accesos", "Permisos a la carpeta de nómina", "La nueva jefa de talento humano no puede abrir la carpeta de nómina.", "servidor", "Se agregaron los permisos de lectura y escritura al grupo de talento humano."),
    ("accesos", "Retirar accesos de un exempleado", "Un empleado se retiró ayer y hay que bloquear sus accesos.", None, "Se deshabilitaron la cuenta, el correo y el acceso VPN, y se respaldó su buzón."),
    ("otro", "Cotización de computadores nuevos", "Necesitamos cotizar tres computadores para el área comercial.", None, "Se envió la cotización con tres opciones y tiempos de entrega."),
    ("otro", "Configurar sala de videoconferencia", "Hay una reunión importante el jueves y la cámara de la sala no funciona bien.", None, "Se actualizó el firmware de la cámara y se probó la conexión con el cliente."),
    ("otro", "Asesoría para respaldar computadores", "Queremos saber cómo respaldar la información de los portátiles del área comercial.", None, "Se configuró la copia automática de las carpetas de trabajo en la nube corporativa."),
]

COMENTARIOS_CLIENTE = [
    "Quedo atenta a cualquier novedad.",
    "Es urgente porque afecta la atención al público.",
    "Sigue pasando en otro equipo del mismo piso.",
    "Gracias, ya pudimos trabajar de nuevo.",
    "¿Tienen un estimado de cuándo queda listo?",
]

COMENTARIOS_EQUIPO = [
    "Estamos revisando el caso; le avisamos en cuanto tengamos novedades.",
    "Ya identificamos la causa y estamos aplicando la corrección.",
    "Necesitamos acceso remoto al equipo esta tarde, ¿es posible?",
    "Aplicamos un cambio; por favor confirme si el problema continúa.",
]

NOTAS_INTERNAS = [
    "Revisar logs del equipo antes de tocar la configuración.",
    "Pendiente comprar repuesto; avisé a compras.",
    "El cliente ya reportó algo parecido el mes pasado.",
    "Escalar a Andrés si no se resuelve hoy.",
]

MOTIVOS_PRIORIDAD = [
    "Afecta la facturación del cierre de mes.",
    "El gerente pidió atención inmediata.",
    "Ya existe una solución alternativa; puede esperar.",
]

# título, descripción, impacto, tipo de activo, acciones, solución, causa raíz, ticket asociado
PLANTILLAS_INCIDENTE = [
    ("Caída del servidor de base de datos", "El servidor de base de datos dejó de responder y las aplicaciones no cargan.", "total", "servidor",
     ["Se revisó el estado del servidor: sin respuesta por red.", "Se reinició el servicio de base de datos.", "Se verificó la integridad de las tablas principales."],
     "Se reinició el motor de base de datos y se liberó espacio en el disco de registros.", "El disco de registros se llenó por falta de rotación de logs.",
     "No carga el sistema de facturación"),
    ("Sin internet en toda la sede", "Ningún equipo de la sede tiene salida a internet.", "total", "red",
     ["Se confirmó la caída del enlace principal con el proveedor.", "Se activó el enlace de respaldo en el firewall.", "El proveedor reportó daño en la fibra del sector."],
     "Se operó por el enlace de respaldo hasta que el proveedor reparó la fibra.", "Corte de fibra óptica del proveedor por obras en la vía.",
     "No hay internet en la oficina"),
    ("Correo electrónico intermitente", "Los correos tardan horas en llegar y algunos rebotan.", "parcial", "servidor",
     ["Se revisó la cola de correo saliente.", "Se encontró una cuenta enviando correo masivo.", "Se bloqueó la cuenta y se limpió la cola."],
     "Se depuró la cola de correo y se restableció la entrega normal.", "Una cuenta con contraseña débil fue usada para enviar correo masivo.",
     "Los correos no llegan"),
    ("Lentitud general en el sistema contable", "El sistema contable responde muy lento para todos los usuarios.", "degradado", "servidor",
     ["Se midió el uso de CPU y memoria del servidor.", "Se identificó un proceso de respaldo en horario laboral.", "Se reprogramó el respaldo para la madrugada."],
     "Se movió la tarea de respaldo fuera del horario laboral.", "Una tarea programada de respaldo se ejecutaba a media mañana.",
     "El sistema contable está muy lento"),
    ("Falla del switch principal", "Varias áreas perdieron conexión a la red interna.", "parcial", "red",
     ["Se detectó que el switch principal se reinicia solo.", "Se conectaron las áreas críticas a un switch de respaldo.", "Se pidió garantía al fabricante."],
     "Se reemplazó el switch principal por el equipo de respaldo configurado.", "Falla de la fuente de poder interna del switch.",
     "Sin red en contabilidad"),
    ("Servidor de archivos inaccesible", "Las carpetas compartidas no abren desde ningún equipo.", "parcial", "servidor",
     ["Se verificó que el servicio de archivos estaba detenido.", "Se revisó el estado de los discos del arreglo.", "Se reconstruyó el arreglo con el disco de repuesto."],
     "Se reemplazó un disco dañado y se reconstruyó el arreglo de discos.", "Falla física de un disco del arreglo RAID.",
     "No abren las carpetas compartidas"),
    ("Certificado vencido en el portal web", "Los navegadores muestran que el sitio no es seguro.", "degradado", "servidor",
     ["Se confirmó que el certificado venció a medianoche.", "Se generó un certificado nuevo."],
     "Se instaló el certificado renovado y se configuró la renovación automática.", "La renovación automática del certificado estaba deshabilitada.",
     "El sitio web muestra advertencia de seguridad"),
    ("VPN fuera de servicio", "Ningún usuario remoto puede conectarse a la VPN.", "parcial", "red",
     ["Se revisó el servicio VPN del firewall.", "Se encontró una licencia vencida.", "Se gestionó la renovación con el fabricante."],
     "Se renovó la licencia y se reactivó el servicio VPN.", "La licencia del servicio VPN venció sin alerta previa.",
     "No conecta la VPN"),
    ("Corte de energía en la sala de servidores", "Los servidores se apagaron por un corte de energía prolongado.", "total", "servidor",
     ["Se confirmó que la UPS agotó su batería.", "Se encendieron los servidores en orden después del restablecimiento.", "Se verificó que todos los servicios quedaran arriba."],
     "Se restableció la energía y se encendieron los servicios en orden.", "Las baterías de la UPS estaban degradadas y no sostuvieron la carga.",
     "Todo el sistema está caído"),
    ("Ataque de ransomware contenido", "El antivirus detectó cifrado de archivos en un equipo de la red.", "parcial", "servidor",
     ["Se aisló el equipo afectado de la red.", "Se verificó que el servidor de archivos no fue cifrado.", "Se restauraron los archivos afectados desde el respaldo."],
     "Se restauraron los archivos desde el último respaldo y se reinstaló el equipo afectado.", "Un usuario abrió un adjunto malicioso en un correo de suplantación.",
     "Archivos con extensión extraña"),
]

ACCIONES_EXTRA = [
    "Se informó al cliente el estado del incidente.",
    "Se dejó monitoreo reforzado durante la tarde.",
]
