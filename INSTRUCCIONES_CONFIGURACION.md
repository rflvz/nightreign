# 🔧 Configuración de Tokens - Paso a Paso

## 📝 **QUÉ NECESITAS PARA EL BOT:**

### ✅ **NECESARIOS:**
1. **CLIENT_ID** (Application ID)
2. **DISCORD_TOKEN** (Bot Token)

### ❌ **NO NECESARIOS:**
- **CLIENT_SECRET** (Solo para OAuth2, no para bots)

---

## 🛠️ **PASOS DE CONFIGURACIÓN:**

### **Paso 1: Obtener CLIENT_ID**
1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Selecciona tu aplicación
3. Ve a **"General Information"**
4. Copia el **"Application ID"**
5. Este es tu `CLIENT_ID`

### **Paso 2: Obtener BOT TOKEN**
1. En la misma aplicación, ve a **"Bot"** (menú izquierdo)
2. Si no has creado un bot, haz clic en **"Add Bot"**
3. En la sección **"Token"**, haz clic en **"Copy"**
4. Este es tu `DISCORD_TOKEN`

⚠️ **IMPORTANTE:** El Bot Token es secreto, no lo compartas nunca.

### **Paso 3: Configurar el archivo .env**
1. Copia el archivo `config.example.env` como `.env`
2. Reemplaza los valores:

```env
# Tu Bot Token (desde la sección Bot)
DISCORD_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OTA.Ejemplo.Token-Aqui

# Tu Application ID (desde General Information)
CLIENT_ID=123456789012345678

# Configuración opcional (puedes dejarlo así)
DEFAULT_TEAM_SIZE=3
MAX_TEAM_SIZE=10
COMMAND_COOLDOWN=3000
```

### **Paso 4: Habilitar Intents del Bot**
1. En Discord Developer Portal → Tu Aplicación → **"Bot"**
2. Baja hasta **"Privileged Gateway Intents"**
3. Habilita:
   - ✅ **Server Members Intent** (opcional)
   - ✅ **Message Content Intent** (opcional)

### **Paso 5: Invitar el Bot**
1. Ve a **"OAuth2"** → **"URL Generator"**
2. Selecciona **Scopes:**
   - ✅ `bot`
   - ✅ `applications.commands`
3. Selecciona **Bot Permissions:**
   - ✅ `Manage Channels`
   - ✅ `Move Members`
   - ✅ `Connect`
   - ✅ `View Channels`
4. Copia la URL generada e invita el bot a tu servidor

---

## 🚀 **EJECUTAR EL BOT:**

```bash
# Instalar dependencias (si no lo has hecho)
npm install

# Ejecutar el bot
npm start
```

---

## ❓ **RESOLUCIÓN DE PROBLEMAS:**

### **"Invalid Token"**
- Verifica que el `DISCORD_TOKEN` sea el Bot Token, no el Client Secret
- Regenera el token si es necesario

### **"Missing Access"**
- Verifica que el `CLIENT_ID` sea correcto
- Asegúrate de haber invitado el bot al servidor

### **"Missing Permissions"**
- Verifica que el bot tenga los permisos correctos en el servidor
- Revisa que esté usando la URL de invitación correcta

---

## 📄 **EJEMPLO DE ARCHIVO .env COMPLETO:**

```env
# ====================================
# 🎮 BOT DE DISCORD - CONFIGURACIÓN
# ====================================

# Token del bot (desde Discord Developer Portal → Bot → Token)
DISCORD_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OTA.AbCdEf.GhIjKlMnOpQrStUvWxYz123456

# ID de la aplicación (desde Discord Developer Portal → General Information → Application ID)
CLIENT_ID=1234567890123456789

# Configuración del matchmaking (opcional)
DEFAULT_TEAM_SIZE=3
MAX_TEAM_SIZE=10
COMMAND_COOLDOWN=3000
```

## 🔗 **ENLACES ÚTILES:**
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Guía oficial de Discord.js](https://discordjs.guide/)
- [Calculadora de permisos](https://discordapi.com/permissions.html) 