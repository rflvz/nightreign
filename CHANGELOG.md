# Changelog

## [v2.1.0] - 2024-12-20

### 🛡️ Sistema Híbrido de Protección (DOBLE PROTECCIÓN)

#### ⏳ Nuevo Sistema de Delay de Auto-Unión
- **Delay inteligente**: 12 segundos de espera antes de auto-unir a canales existentes
- **Protección robusta**: Tiempo suficiente para que amigos entren juntos
- **Cancelación automática**: Se cancela si se detecta formación de grupo
- **Verificación múltiple**: Verifica disponibilidad antes de auto-unir

#### 🎯 Mejoras en Detección de Grupos
- **Protección de grupos potenciales**: Detecta usuarios que podrían formar grupos
- **Limpieza inteligente**: Elimina usuarios ya en canales activos de detección
- **Doble verificación**: Combina detección temporal + protección por delay

#### 🔧 Nuevas Funciones Técnicas
- `scheduleDelayedAutoJoin()`: Programa auto-unión con delay
- `cancelPendingAutoJoin()`: Cancela auto-uniones pendientes
- `canUserAutoJoin()`: Verifica si usuario puede ser auto-unido
- `cleanupPendingAutoJoins()`: Limpia delays expirados
- `isUserPotentialGroupMember()`: Detecta grupos potenciales

#### 📊 Comando Debug Mejorado
- **Auto-uniones pendientes**: Muestra delays activos con tiempo restante
- **Información completa**: Estado de toda la protección híbrida

### 🏗️ Arquitectura Híbrida
**Primera línea de defensa**: Delay de 12 segundos antes de auto-unión  
**Segunda línea de defensa**: Sistema de detección de grupos intencionales  
**Resultado**: CERO separaciones accidentales de grupos de amigos

---

## [v2.0.0] - 2024-12-20

### ✨ Nuevas Características

#### 🎯 Sistema de Detección de Grupos Automática
- **Detección inteligente**: El bot ahora detecta automáticamente cuando 3 amigos entran juntos al matchmaking
- **Ventana de tiempo**: Los usuarios que entran en un periodo de 30 segundos se consideran un grupo intencional
- **Preservación de grupos**: Los grupos de amigos se mantienen juntos sin ser separados automáticamente
- **Prioridad de grupos**: Los grupos intencionales tienen prioridad sobre la unión automática a canales existentes
- **Funcionamiento transparente**: No requiere comandos adicionales - funciona automáticamente

#### 🔧 Nuevos Comandos
- **`/debug`**: Comando para administradores que muestra estadísticas del sistema de detección de grupos
  - Estadísticas de colas de matchmaking
  - Información de grupos detectados
  - Estado de canales activos
  - Entradas recientes de usuarios

#### 🛠️ Mejoras Técnicas
- **Estructura de datos mejorada**: Nuevas estructuras para almacenar información de detección de grupos
- **Limpieza automática**: Sistema de limpieza automática para datos de detección expirados
- **Logging mejorado**: Mensajes de consola más informativos para tracking de grupos
- **Filtrado inteligente**: Solo usuarios individuales se unen automáticamente a canales existentes

### 🔄 Cambios en el Comportamiento

#### Flujo de Matchmaking Actualizado:
1. **Detección de grupos**: Al entrar al matchmaking, se detecta si el usuario forma parte de un grupo intencional
2. **Creación de grupos**: Si 3+ usuarios entran en 30 segundos, se crea automáticamente un canal para el grupo
3. **Protección de grupos**: Los grupos intencionales no se separan automáticamente
4. **Unión individual**: Solo usuarios individuales se unen a canales existentes con espacios libres
5. **Cola normal**: Si no hay grupos o canales disponibles, funciona como el sistema anterior

### 🏗️ Arquitectura
- **Nuevo sistema**: `groupDetection` añadido al objeto `matchmaking` del cliente
- **Funciones agregadas**: 
  - `detectIntentionalGroup()`
  - `cleanupOldGroupDetectionEntries()`
  - `isUserInIntentionalGroup()`
  - `createTeamForIntentionalGroup()`
- **Inicialización mejorada**: El MatchmakingSystem se inicializa correctamente al arrancar el bot

### 📝 Documentación
- **README actualizado**: Nueva sección explicando el sistema de detección de grupos
- **Comando help actualizado**: Información sobre la funcionalidad de grupos de amigos
- **Comentarios mejorados**: Documentación técnica más detallada en el código

---

## [v1.0.0] - 2024-12-19

### 🚀 Lanzamiento Inicial
- Sistema de matchmaking automático básico
- Soporte para 3 plataformas (PC, Xbox, PlayStation)
- Comandos de gestión para líderes de equipo
- Auto-eliminación de canales vacíos 