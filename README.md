# 🎮 Bot de Discord - Sistema de Matchmaking Automático

Un bot completo de Discord desarrollado en Node.js que crea automáticamente equipos de 3 personas cuando se unen a un canal llamado **"matchmaking"**.

## ✨ Funcionamiento Automático

### 🚀 **¡Sin Configuración Necesaria!**
- Crea un canal de voz llamado **"matchmaking"** en tu servidor
- El bot automáticamente lo detecta y comienza a funcionar
- Los usuarios se unen al canal "matchmaking" y forman equipos automáticamente

### 🎯 **Flujo Súper Simple:**
1. **Crea un canal de voz** llamado `matchmaking` (mayúsculas/minúsculas no importan)
2. **Los usuarios se unen** al canal "matchmaking"
3. **Cuando hay 3 usuarios** → Se forma un equipo automáticamente
4. **Se crea un canal temporal** → "nightreign [nombre-del-líder]" justo debajo del canal matchmaking
5. **El primer usuario se convierte en líder** → Puede gestionar el canal
6. **El canal se elimina** cuando queda vacío

## ✨ Características Principales

### 🚀 Sistema de Matchmaking Automático
- **Detección automática**: Busca canales llamados "matchmaking" automáticamente
- **Cola automática**: Los usuarios se añaden automáticamente a la cola
- **Formación de equipos**: Cuando hay 3 usuarios, se crea un equipo automáticamente
- **Canales temporales**: Se generan canales de voz únicos para cada equipo
- **Posicionamiento inteligente**: Los canales de equipo aparecen justo debajo del canal matchmaking
- **Sin base de datos**: Todo funciona en memoria usando Map, Set y Arrays

### 🎯 Sistema Híbrido de Protección de Grupos
- **Doble protección**: Combina detección inteligente + delay de auto-unión
- **Delay inteligente**: 12 segundos de espera antes de auto-unir a canales existentes
- **Detección automática**: Detecta grupos de 3+ amigos que entran en 30 segundos
- **Preservación garantizada**: Los grupos NUNCA se separan automáticamente
- **Protección de grupos potenciales**: Protege usuarios que podrían formar grupos
- **Transparente**: No requiere comandos adicionales - funciona automáticamente

### 👑 Sistema de Liderazgo
- **Líder automático**: El primer usuario del equipo se convierte en líder
- **Permisos especiales**: Los líderes pueden gestionar su canal
- **Transferencia automática**: Si el líder se va, el liderazgo se transfiere
- **Comandos exclusivos**: Solo los líderes pueden usar comandos de gestión

### 🔧 Gestión de Canales Inteligente
- **Nombres dinámicos**: `nightreign [nombre-líder]`
- **Posicionamiento automático**: Los canales aparecen justo debajo del canal matchmaking
- **Auto-eliminación**: Los canales se eliminan cuando quedan vacíos
- **Permisos automáticos**: Configuración automática de permisos para líderes
- **Limpieza automática**: Elimina canales inactivos cada 30 minutos

## 🛠️ Stack Tecnológico

- **Node.js** - Runtime principal
- **discord.js v14** - Biblioteca de Discord
- **dotenv** - Variables de entorno
- **Almacenamiento en memoria** - Sin dependencias de base de datos

## 📋 Comandos Disponibles

### 🎛️ Comandos de Administración

#### `/setup <canal-lobby> [categoria]`
Configura el sistema de matchmaking en tu servidor.
- **canal-lobby**: Canal de voz donde los usuarios esperarán para formar equipos
- **categoria** (opcional): Categoría donde se crearán los canales de equipo

**Permisos requeridos**: Gestionar Canales

### 🎮 Comandos de Líder (Solo en canales de equipo)

#### `/kick <usuario>`
Expulsa un usuario del canal de voz.
- **usuario**: Usuario a expulsar del canal

#### `/limit <número>`
Cambia el límite de usuarios en el canal.
- **número**: Nuevo límite (1-10, usa 0 para sin límite)

#### `/rename <nuevo-nombre>`
Renombra el canal de voz.
- **nuevo-nombre**: Nuevo nombre para el canal (máximo 100 caracteres)

#### `/end`
Termina la partida y elimina el canal inmediatamente.

## 🚀 Instalación y Configuración

### 1. Clonar el Repositorio
```bash
git clone <repo-url>
cd discord-matchmaking-bot
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto:
```env
DISCORD_TOKEN=tu_token_del_bot_aqui
CLIENT_ID=tu_client_id_aqui
```

### 4. Crear Aplicación de Discord
1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación
3. Ve a la sección "Bot" y crea un bot
4. Copia el token y colócalo en `.env`
5. Copia el Application ID y colócalo como CLIENT_ID en `.env`

### 5. Invitar el Bot
Genera un enlace de invitación con los siguientes permisos:
- `Manage Channels` (Gestionar Canales)
- `Move Members` (Mover Miembros)
- `Connect` (Conectar)
- `View Channels` (Ver Canales)
- `Use Slash Commands` (Usar Comandos Slash)

URL de ejemplo:
```
https://discord.com/api/oauth2/authorize?client_id=TU_CLIENT_ID&permissions=285216784&scope=bot%20applications.commands
```

### 6. Ejecutar el Bot
```bash
npm start
```

## 📁 Estructura del Proyecto

```
discord-matchmaking-bot/
├── index.js                    # Archivo principal del bot
├── package.json               # Dependencias y scripts
├── .env                       # Variables de entorno
├── README.md                  # Documentación
├── commands/                  # Comandos slash
│   ├── setup.js              # Configuración del sistema
│   ├── kick.js               # Expulsar usuarios
│   ├── limit.js              # Cambiar límite de canal
│   ├── rename.js             # Renombrar canal
│   └── end.js                # Terminar partida
├── events/                    # Eventos del bot
│   ├── ready.js              # Bot conectado
│   ├── voiceStateUpdate.js   # Gestión de canales de voz
│   └── interactionCreate.js  # Handler de comandos
└── utils/
    └── matchmaking.js        # Lógica del sistema de matchmaking
```

## ⚙️ Configuración Avanzada

### Variables de Entorno Opcionales
```env
# Configuración del matchmaking
DEFAULT_TEAM_SIZE=3           # Tamaño por defecto del equipo
MAX_TEAM_SIZE=10             # Límite máximo de usuarios por canal
COMMAND_COOLDOWN=3000        # Cooldown de comandos en millisegundos
```

### Personalización de Configuración
Puedes modificar la configuración en `index.js`:

```javascript
client.matchmaking = {
    config: {
        teamSize: 3,        // Cambia el tamaño del equipo
        maxTeamSize: 10,    // Límite máximo
        cooldownTime: 3000  // Cooldown en ms
    }
};
```

## 🎯 Flujo de Funcionamiento

1. **Configuración**: Un administrador ejecuta `/setup` y selecciona el canal de lobby
2. **Unirse**: Los usuarios se unen al canal de lobby configurado
3. **Cola de espera**: Se añaden automáticamente a la cola (máximo 3 usuarios)
4. **Formación de equipo**: Cuando hay 3 usuarios, se forma un equipo automáticamente
5. **Creación de canal**: Se crea un canal de voz temporal con permisos especiales
6. **Movimiento automático**: Los 3 usuarios se mueven al nuevo canal
7. **Liderazgo**: El primer usuario recibe permisos de líder
8. **Gestión**: El líder puede usar comandos para gestionar el canal
9. **Auto-eliminación**: El canal se elimina cuando queda completamente vacío

## 🛡️ Seguridad y Permisos

### Permisos del Bot
El bot necesita los siguientes permisos en el servidor:
- **Gestionar Canales**: Para crear y eliminar canales de voz
- **Mover Miembros**: Para mover usuarios a los canales de equipo
- **Ver Canales**: Para acceder a los canales
- **Conectar**: Para verificar el estado de los canales de voz

### Permisos de Usuario
- **Administradores**: Pueden usar `/setup` para configurar el sistema
- **Líderes**: Pueden usar todos los comandos de gestión en su canal
- **Usuarios**: Pueden unirse al lobby y formar parte de equipos

### Sistema de Cooldowns
- **Cooldown global**: 3 segundos entre comandos por usuario
- **Rate limiting**: Protección contra spam de comandos
- **Validaciones**: Verificación de permisos en cada comando

## 🔧 Solución de Problemas

### El bot no responde
1. Verifica que el token en `.env` sea correcto
2. Asegúrate de que el bot esté online en Discord
3. Revisa que los comandos slash estén registrados
4. Verifica los permisos del bot en el servidor

### Los usuarios no se mueven automáticamente
1. Verifica que el bot tenga permisos de "Mover Miembros"
2. Asegúrate de que el canal de lobby esté configurado correctamente
3. Verifica que los usuarios estén realmente en el canal de lobby

### Los canales no se crean
1. Verifica permisos de "Gestionar Canales"
2. Revisa si hay límite de canales en el servidor
3. Verifica permisos en la categoría configurada

### Comandos no funcionan
1. Asegúrate de estar en un canal creado por el bot
2. Verifica que seas el líder del canal
3. Revisa el cooldown de comandos (3 segundos)

## 📊 Monitoreo y Logs

El bot incluye logging detallado para monitorear su funcionamiento:

```
✅ Bot conectado exitosamente como BotName#1234
🎮 Matchmaking Bot v1.0.0 - Sistema de equipos automático
📊 Conectado a 1 servidor(es)
🔧 Sistema de matchmaking inicializado
⚙️ Configuración actual:
   • Tamaño de equipo: 3 jugadores
   • Límite máximo: 10 jugadores
   • Cooldown de comandos: 3000ms
🚀 Bot listo para usar! Usa /setup para configurar el matchmaking
```

## 🤝 Contribución

¡Las contribuciones son bienvenidas! Si encuentras bugs o tienes ideas para mejoras:

1. Crea un fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -m 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si necesitas ayuda:

1. Revisa la documentación completa
2. Verifica la sección de solución de problemas
3. Revisa los logs del bot para errores específicos
4. Abre un issue en GitHub con detalles del problema

---

**¡Disfruta usando el bot de matchmaking automático! 🎮** 