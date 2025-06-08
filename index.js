const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();

// Crear cliente del bot con intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,        // Para comandos con prefijo (futuro)
        GatewayIntentBits.MessageContent        // Para leer mensajes (futuro)
    ]
});

// Almacenamiento en memoria para el sistema de matchmaking
client.matchmaking = {
    // Map de canales activos: channelId → { líderId, miembros, timestamp }
    activeChannels: new Map(),
    
    // Colas de espera por plataforma: platform → [userId1, userId2, ...]
    waitingQueues: {
        pc: [],
        xbox: [],
        play: []
    },
    
    // Sistema de detección de grupos automática
    groupDetection: {
        // Usuarios que han entrado recientemente por plataforma: platform → [{ userId, timestamp }, ...]
        recentJoins: {
            pc: [],
            xbox: [],
            play: []
        },
        // Grupos detectados automáticamente: groupId → { users: [], platform, timestamp, isIntentional: true }
        detectedGroups: new Map(),
        // Tiempo límite para considerar usuarios como grupo (30 segundos)
        groupDetectionWindow: 30000,
        // Tamaño mínimo de grupo para ser considerado intencional
        minimumGroupSize: 3
    },
    
    // Set de usuarios en cooldown para comandos
    cooldowns: new Set(),
    
    // Configuración por defecto
    config: {
        teamSize: 3,
        maxTeamSize: 10,
        cooldownTime: 3000
    }
};

// Colección de comandos
client.commands = new Collection();

// Cargar comandos
const fs = require('fs');
const path = require('path');

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// Inicializar el sistema de matchmaking
const MatchmakingSystem = require('./utils/matchmaking');
client.matchmakingSystem = new MatchmakingSystem(client);

// Cargar eventos
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

// Registrar comandos slash globalmente
async function deployCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    
    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command) {
                commands.push(command.data.toJSON());
            }
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`🔄 Registrando ${commands.length} comandos slash...`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ ${data.length} comandos slash registrados exitosamente.`);
    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
    }
}

// Función de limpieza de canales inactivos y datos de detección de grupos
function cleanupInactiveChannels() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hora en millisegundos
    
    client.matchmaking.activeChannels.forEach(async (channelData, channelId) => {
        // Limpiar canales que han estado activos por más de 1 hora sin actividad
        if (now - channelData.timestamp > oneHour) {
            try {
                const channel = await client.channels.fetch(channelId);
                if (channel && channel.members.size === 0) {
                    await channel.delete('Limpieza automática - canal inactivo');
                    client.matchmaking.activeChannels.delete(channelId);
                    console.log(`🧹 Canal ${channelId} eliminado por inactividad`);
                }
            } catch (error) {
                // Si el canal ya no existe, solo lo removemos del Map
                client.matchmaking.activeChannels.delete(channelId);
            }
        }
    });
    
    // Limpiar datos de detección de grupos antiguos
    const { groupDetection } = client.matchmaking;
    
    // Limpiar entradas recientes antiguas (mayores a la ventana de detección)
    for (const platform of ['pc', 'xbox', 'play']) {
        groupDetection.recentJoins[platform] = groupDetection.recentJoins[platform].filter(
            entry => (now - entry.timestamp) <= groupDetection.groupDetectionWindow
        );
    }
    
    // Limpiar grupos detectados antiguos (después de 10 minutos)
    let cleanedGroups = 0;
    for (const [groupId, groupData] of groupDetection.detectedGroups) {
        if (now - groupData.timestamp > 600000) { // 10 minutos
            groupDetection.detectedGroups.delete(groupId);
            cleanedGroups++;
        }
    }
    
    if (cleanedGroups > 0) {
        console.log(`🧹 ${cleanedGroups} grupo(s) de detección limpiados por antigüedad`);
    }
    
    // Limpiar auto-uniones pendientes antiguas
    if (client.matchmakingSystem) {
        client.matchmakingSystem.cleanupPendingAutoJoins();
    }
}

// Ejecutar limpieza cada 30 minutos
setInterval(cleanupInactiveChannels, 30 * 60 * 1000);

// Manejar cierre del bot
process.on('SIGINT', () => {
    console.log('🛑 Cerrando bot...');
    client.destroy();
    process.exit(0);
});

// Manejar errores no capturados
process.on('unhandledRejection', error => {
    console.error('❌ Error no manejado:', error);
});

// Iniciar el bot
client.login(process.env.DISCORD_TOKEN).then(() => {
    deployCommands();
}); 