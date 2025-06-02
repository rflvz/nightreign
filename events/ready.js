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
        
        // Detectar canales de matchmaking en todos los servidores
        await detectMatchmakingChannels(client);
        
        console.log(`🚀 Bot listo para usar! Usa /setup para ver el estado del sistema`);
    },
};

/**
 * Detectar canales de matchmaking en todos los servidores
 */
async function detectMatchmakingChannels(client) {
    console.log(`\n🔍 Detectando canales de matchmaking...`);
    
    const targetChannels = ['matchmaking-pc', 'matchmaking-xbox', 'matchmaking-play'];
    let totalDetected = 0;
    
    for (const guild of client.guilds.cache.values()) {
        console.log(`\n📋 Servidor: ${guild.name} (${guild.id})`);
        
        let detectedInThisGuild = 0;
        
        for (const channelName of targetChannels) {
            const channel = guild.channels.cache.find(
                ch => ch.name.toLowerCase() === channelName && ch.type === 2 // 2 = GuildVoice
            );
            
            if (channel) {
                const platform = channelName.split('-')[1]; // pc, xbox, play
                console.log(`   ✅ ${channelName} → ${channel.id} (${platform.toUpperCase()})`);
                detectedInThisGuild++;
                totalDetected++;
            } else {
                console.log(`   ❌ ${channelName} → No encontrado`);
            }
        }
        
        if (detectedInThisGuild === 0) {
            console.log(`   ⚠️ No se encontraron canales de matchmaking en este servidor`);
        } else {
            console.log(`   🎯 ${detectedInThisGuild}/3 canales detectados en este servidor`);
        }
        
        // Detectar categoría de matchmaking
        const matchmakingCategory = guild.channels.cache.find(
            ch => ch.name.toLowerCase() === 'matchmaking' && ch.type === 4 // 4 = CategoryChannel
        );
        
        if (matchmakingCategory) {
            console.log(`   📁 Categoría de matchmaking: ${matchmakingCategory.name} (${matchmakingCategory.id})`);
        } else {
            console.log(`   📁 Categoría de matchmaking: No encontrada (se usará raíz)`);
        }
    }
    
    console.log(`\n📊 Resumen de detección:`);
    console.log(`   • Total de canales detectados: ${totalDetected}`);
    console.log(`   • Servidores escaneados: ${client.guilds.cache.size}`);
    
    if (totalDetected === 0) {
        console.log(`\n⚠️ No se detectaron canales de matchmaking en ningún servidor`);
        console.log(`   Para que el sistema funcione, crea estos canales de voz:`);
        console.log(`   • matchmaking-pc`);
        console.log(`   • matchmaking-xbox`);
        console.log(`   • matchmaking-play`);
    } else {
        console.log(`\n🎮 Sistema listo para matchmaking automático!`);
    }
}

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