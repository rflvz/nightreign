const { Events } = require('discord.js');
const MatchmakingSystem = require('../utils/matchmaking');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`✅ Bot conectado exitosamente como ${client.user.tag}`);
        console.log(`🎮 Matchmaking Bot v1.0.0 - Sistema de equipos automático`);
        console.log(`📊 Conectado a ${client.guilds.cache.size} servidor(es)`);
        
        // Inicializar sistema de matchmaking
        client.matchmakingSystem = new MatchmakingSystem(client);
        console.log(`🔧 Sistema de matchmaking inicializado`);
        
        // Establecer estado del bot
        client.user.setActivity('🎮 Formando equipos automáticamente', { type: 'PLAYING' });
        
        // Mostrar información de configuración
        console.log(`⚙️ Configuración actual:`);
        console.log(`   • Tamaño de equipo: ${client.matchmaking.config.teamSize} jugadores`);
        console.log(`   • Límite máximo: ${client.matchmaking.config.maxTeamSize} jugadores`);
        console.log(`   • Cooldown de comandos: ${client.matchmaking.config.cooldownTime}ms`);
        
        // Verificar canales existentes y limpiar datos obsoletos
        await cleanupOrphanedChannels(client);
        
        console.log(`🚀 Bot listo para usar! Usa /setup para configurar el matchmaking`);
    },
};

/**
 * Limpiar canales huérfanos que ya no existen pero están en memoria
 */
async function cleanupOrphanedChannels(client) {
    const { activeChannels } = client.matchmaking;
    const orphanedChannels = [];
    
    for (const [channelId, channelData] of activeChannels) {
        try {
            await client.channels.fetch(channelId);
        } catch (error) {
            // Canal no existe, marcarlo para limpieza
            orphanedChannels.push(channelId);
        }
    }
    
    // Limpiar canales huérfanos
    orphanedChannels.forEach(channelId => {
        activeChannels.delete(channelId);
        console.log(`🧹 Canal huérfano ${channelId} eliminado de memoria`);
    });
    
    if (orphanedChannels.length > 0) {
        console.log(`🧹 Limpieza completada: ${orphanedChannels.length} canal(es) huérfano(s) eliminado(s)`);
    }
} 