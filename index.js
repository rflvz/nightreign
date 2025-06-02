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
    
    // Array de cola de espera: [userId1, userId2, ...]
    waitingQueue: [],
    
    // Map de configuración: guildId → { lobbyChannelId, categoryId }
    guildSettings: new Map(),
    
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

// Función de limpieza de canales inactivos
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