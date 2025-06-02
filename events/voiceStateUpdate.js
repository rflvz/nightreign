const { Events } = require('discord.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const { matchmakingSystem, matchmaking } = newState.client;
        const userId = newState.id;
        const guildId = newState.guild.id;

        // Usuario se unió a un canal de voz
        if (!oldState.channel && newState.channel) {
            await handleUserJoinedChannel(userId, newState.channel, guildId, matchmakingSystem, matchmaking);
        }
        
        // Usuario salió de un canal de voz
        if (oldState.channel && !newState.channel) {
            await handleUserLeftChannel(userId, oldState.channel, guildId, matchmakingSystem, matchmaking);
        }
        
        // Usuario se movió entre canales
        if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            await handleUserLeftChannel(userId, oldState.channel, guildId, matchmakingSystem, matchmaking);
            await handleUserJoinedChannel(userId, newState.channel, guildId, matchmakingSystem, matchmaking);
        }
    },
};

/**
 * Manejar cuando un usuario se une a un canal de voz
 */
async function handleUserJoinedChannel(userId, channel, guildId, matchmakingSystem, matchmaking) {
    // Verificar si es un canal de matchmaking por plataforma
    const platform = matchmakingSystem.getPlatformFromChannel(channel.name);
    
    if (platform) {
        console.log(`👋 Usuario ${userId} se unió al canal de matchmaking de ${platform.toUpperCase()}: ${channel.name}`);
        
        // Añadir a la cola de matchmaking de la plataforma
        const added = await matchmakingSystem.addToQueue(userId, guildId, platform);
        if (added) {
            // Actualizar actividad del canal de lobby
            matchmakingSystem.updateChannelActivity(channel.id);
            
            // Obtener estadísticas de la cola
            const queueStats = matchmakingSystem.getQueueStats(guildId);
            const queuePosition = matchmaking.waitingQueues[platform].indexOf(userId) + 1;
            const membersNeeded = matchmaking.config.teamSize - matchmaking.waitingQueues[platform].length;
            
            try {
                const guild = await channel.guild;
                const member = await guild.members.fetch(userId);
                
                console.log(`📝 Usuario ${member.displayName} en posición ${queuePosition} de la cola de ${platform.toUpperCase()}`);
                console.log(`📊 Colas actuales - PC: ${queueStats.pc}, Xbox: ${queueStats.xbox}, PlayStation: ${queueStats.play}`);
                
                if (membersNeeded > 0) {
                    console.log(`⏳ Esperando ${membersNeeded} jugador(es) más para formar equipo de ${platform.toUpperCase()}`);
                } else {
                    console.log(`🎮 ¡Formando equipo de ${platform.toUpperCase()} automáticamente!`);
                }
            } catch (error) {
                console.error('❌ Error obteniendo información del usuario:', error);
            }
        }
        return;
    }
    
    // Verificar si es un canal activo del sistema de matchmaking
    if (matchmakingSystem.isActiveChannel(channel.id)) {
        console.log(`🔄 Usuario ${userId} se unió al canal activo ${channel.name}`);
        matchmakingSystem.updateChannelActivity(channel.id);
    }
}

/**
 * Manejar cuando un usuario sale de un canal de voz
 */
async function handleUserLeftChannel(userId, channel, guildId, matchmakingSystem, matchmaking) {
    // Verificar si es un canal de matchmaking por plataforma
    const platform = matchmakingSystem.getPlatformFromChannel(channel.name);
    
    if (platform) {
        const removed = matchmakingSystem.removeFromQueue(userId);
        if (removed) {
            console.log(`👋 Usuario ${userId} salió del matchmaking de ${platform.toUpperCase()} y fue removido de la cola`);
            
            // Mostrar estadísticas actualizadas
            const queueStats = matchmakingSystem.getQueueStats(guildId);
            console.log(`📊 Colas actuales - PC: ${queueStats.pc}, Xbox: ${queueStats.xbox}, PlayStation: ${queueStats.play}`);
        }
        return;
    }
    
    // Verificar si es un canal activo del sistema de matchmaking
    if (matchmakingSystem.isActiveChannel(channel.id)) {
        const channelInfo = matchmakingSystem.getChannelInfo(channel.id);
        console.log(`👋 Usuario ${userId} salió del canal activo ${channel.name} (${channelInfo?.platform?.toUpperCase() || 'UNKNOWN'})`);
        
        // Actualizar actividad del canal
        matchmakingSystem.updateChannelActivity(channel.id);
        
        // Verificar si el canal quedó vacío
        if (channel.members.size === 0) {
            console.log(`🗑️ Canal ${channel.name} quedó vacío, eliminando...`);
            await matchmakingSystem.deleteTeamChannel(channel.id);
        } else {
            // Verificar si el líder se fue y transferir liderazgo
            if (channelInfo && channelInfo.leaderId === userId) {
                await transferLeadership(channel, channelInfo, matchmakingSystem);
            }
        }
    }
}

/**
 * Transferir liderazgo cuando el líder actual sale del canal
 */
async function transferLeadership(channel, channelInfo, matchmakingSystem) {
    try {
        // Obtener miembros actuales del canal
        const members = Array.from(channel.members.values());
        
        if (members.length === 0) {
            return; // No hay nadie para transferir
        }
        
        // Seleccionar nuevo líder (el primer miembro disponible)
        const newLeader = members[0];
        
        // Actualizar permisos del canal
        await channel.permissionOverwrites.edit(channelInfo.leaderId, {
            ViewChannel: true,
            Connect: true,
            ManageChannels: false,
            MoveMembers: false,
            MuteMembers: false,
            DeafenMembers: false
        });
        
        await channel.permissionOverwrites.edit(newLeader.id, {
            ViewChannel: true,
            Connect: true,
            ManageChannels: true,
            MoveMembers: true,
            MuteMembers: true,
            DeafenMembers: true
        });
        
        // Actualizar información del canal
        channelInfo.leaderId = newLeader.id;
        matchmakingSystem.client.matchmaking.activeChannels.set(channel.id, channelInfo);
        
        console.log(`👑 Liderazgo transferido a ${newLeader.displayName} en canal ${channel.name} (${channelInfo.platform?.toUpperCase() || 'UNKNOWN'})`);
        
    } catch (error) {
        console.error('❌ Error transfiriendo liderazgo:', error);
    }
} 