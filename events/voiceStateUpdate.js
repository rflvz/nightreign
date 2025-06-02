const { Events } = require('discord.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const { client } = newState;
        const { matchmakingSystem, matchmaking } = client;
        
        if (!matchmakingSystem) return;

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
        
        // Usuario cambió de canal
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
    // Verificar si el canal se llama "matchmaking" (sin importar mayúsculas/minúsculas)
    const isMatchmakingChannel = channel.name.toLowerCase() === 'matchmaking';
    
    if (isMatchmakingChannel) {
        console.log(`👋 Usuario ${userId} se unió al canal de matchmaking: ${channel.name}`);
        
        // Configurar automáticamente el servidor si no está configurado
        await autoConfigureGuild(guildId, channel, matchmaking);
        
        // Añadir a la cola de matchmaking
        const added = await matchmakingSystem.addToQueue(userId, guildId);
        if (added) {
            // Actualizar actividad del canal de lobby
            matchmakingSystem.updateChannelActivity(channel.id);
            
            // Notificar al usuario sobre su posición en la cola
            const queuePosition = matchmaking.waitingQueue.indexOf(userId) + 1;
            const membersNeeded = matchmaking.config.teamSize - matchmaking.waitingQueue.length;
            
            try {
                const guild = await channel.guild;
                const member = await guild.members.fetch(userId);
                
                console.log(`📝 Usuario ${member.displayName} en posición ${queuePosition} de la cola`);
                
                if (membersNeeded > 0) {
                    console.log(`⏳ Esperando ${membersNeeded} jugador(es) más para formar equipo`);
                } else {
                    console.log(`🎮 ¡Formando equipo automáticamente!`);
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
    // Verificar si es el canal de matchmaking
    const isMatchmakingChannel = channel.name.toLowerCase() === 'matchmaking';
    
    if (isMatchmakingChannel) {
        const removed = matchmakingSystem.removeFromQueue(userId);
        if (removed) {
            console.log(`👋 Usuario ${userId} salió del matchmaking y fue removido de la cola`);
        }
        return;
    }
    
    // Verificar si es un canal activo del sistema de matchmaking
    if (matchmakingSystem.isActiveChannel(channel.id)) {
        console.log(`👋 Usuario ${userId} salió del canal activo ${channel.name}`);
        
        // Actualizar actividad del canal
        matchmakingSystem.updateChannelActivity(channel.id);
        
        // Verificar si el canal quedó vacío
        if (channel.members.size === 0) {
            console.log(`🗑️ Canal ${channel.name} quedó vacío, eliminando...`);
            await matchmakingSystem.deleteTeamChannel(channel.id);
        } else {
            // Verificar si el líder se fue y transferir liderazgo
            const channelInfo = matchmakingSystem.getChannelInfo(channel.id);
            if (channelInfo && channelInfo.leaderId === userId) {
                await transferLeadership(channel, channelInfo, matchmakingSystem);
            }
        }
    }
}

/**
 * Configurar automáticamente el servidor cuando se detecta un canal "matchmaking"
 */
async function autoConfigureGuild(guildId, matchmakingChannel, matchmaking) {
    const { guildSettings } = matchmaking;
    
    // Si ya está configurado, no hacer nada
    if (guildSettings.has(guildId)) {
        return;
    }
    
    // Buscar una categoría llamada "Matchmaking" o usar la categoría del canal actual
    let categoryId = matchmakingChannel.parentId;
    
    try {
        const guild = matchmakingChannel.guild;
        const matchmakingCategory = guild.channels.cache.find(
            ch => ch.name.toLowerCase() === 'matchmaking' && ch.type === 4 // 4 = CategoryChannel
        );
        
        if (matchmakingCategory) {
            categoryId = matchmakingCategory.id;
        }
    } catch (error) {
        console.log('⚠️ No se pudo encontrar categoría específica, usando la del canal');
    }
    
    // Configurar automáticamente
    const settings = {
        lobbyChannelId: matchmakingChannel.id,
        categoryId: categoryId,
        setupBy: 'auto-config',
        setupAt: Date.now()
    };
    
    guildSettings.set(guildId, settings);
    
    console.log(`⚙️ Servidor ${guildId} configurado automáticamente:`);
    console.log(`   • Canal de matchmaking: ${matchmakingChannel.name} (${matchmakingChannel.id})`);
    console.log(`   • Categoría: ${categoryId || 'Sin categoría'}`);
}

/**
 * Transferir liderazgo cuando el líder actual se va
 */
async function transferLeadership(channel, channelInfo, matchmakingSystem) {
    try {
        const remainingMembers = Array.from(channel.members.keys());
        
        if (remainingMembers.length > 0) {
            const newLeaderId = remainingMembers[0];
            const newLeader = await channel.guild.members.fetch(newLeaderId);
            
            if (newLeader) {
                // Actualizar información del canal
                const { activeChannels } = matchmakingSystem.client.matchmaking;
                const updatedChannelInfo = {
                    ...channelInfo,
                    leaderId: newLeaderId,
                    timestamp: Date.now()
                };
                activeChannels.set(channel.id, updatedChannelInfo);
                
                // Dar permisos de líder al nuevo usuario
                await channel.permissionOverwrites.edit(newLeaderId, {
                    ManageChannels: true,
                    MoveMembers: true,
                    MuteMembers: true,
                    DeafenMembers: true
                });
                
                // Renombrar canal con el nuevo líder usando el formato "nightreign [nombre]"
                const newChannelName = `nightreign ${newLeader.displayName}`;
                await channel.setName(newChannelName);
                
                console.log(`👑 Liderazgo transferido a ${newLeader.displayName} en canal ${channel.id}`);
                console.log(`📝 Canal renombrado a: ${newChannelName}`);
            }
        }
    } catch (error) {
        console.error('❌ Error transfiriendo liderazgo:', error);
    }
} 