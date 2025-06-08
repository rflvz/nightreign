const { Events } = require('discord.js');
const MatchmakingSystem = require('../utils/matchmaking');

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
        
        // PRIMERO: Detectar si el usuario forma parte de un grupo intencional
        const detectedGroup = matchmakingSystem.detectIntentionalGroup(userId, platform);
        
        if (detectedGroup && detectedGroup.users.length >= matchmaking.config.teamSize) {
            // Crear equipo directamente para el grupo intencional, sin buscar canales existentes
            console.log(`🎯 Creando equipo para grupo intencional de ${platform.toUpperCase()} con ${detectedGroup.users.length} miembros`);
            
            const teamResult = await matchmakingSystem.createTeamForIntentionalGroup(detectedGroup, guildId);
            if (teamResult) {
                console.log(`✅ Equipo de grupo intencional creado exitosamente: ${teamResult.channel.name}`);
                return; // Salir - el grupo intencional tiene prioridad completa
            }
        }
        
        // SEGUNDO: Si no es parte de un grupo intencional, verificar si ya está en uno
        const existingGroup = matchmakingSystem.isUserInIntentionalGroup(userId, platform);
        if (existingGroup) {
            console.log(`🎯 Usuario ${userId} es parte de un grupo intencional pendiente de ${platform.toUpperCase()}, no se une a canales existentes`);
            // Añadir a la cola normal pero con prioridad de grupo
            const added = await matchmakingSystem.addToQueue(userId, guildId, platform);
            if (added) {
                matchmakingSystem.updateChannelActivity(channel.id);
                console.log(`📝 Usuario ${userId} añadido a la cola como parte de un grupo intencional`);
            }
            return;
        }
        
        // PROTECCIÓN DE GRUPOS: Verificar si este usuario podría ser parte de un grupo que se está formando
        const isPotentialGroupMember = matchmakingSystem.isUserPotentialGroupMember(userId, platform);
        if (isPotentialGroupMember) {
            console.log(`🛡️ Usuario ${userId} protegido de unión automática - podría formar grupo intencional en ${platform.toUpperCase()}`);
            // Añadir a la cola normal y esperar a ver si se forma el grupo
            const added = await matchmakingSystem.addToQueue(userId, guildId, platform);
            if (added) {
                matchmakingSystem.updateChannelActivity(channel.id);
                
                try {
                    const guild = await channel.guild;
                    const member = await guild.members.fetch(userId);
                    console.log(`⏳ Usuario ${member.displayName} esperando formación de grupo potencial en ${platform.toUpperCase()}`);
                } catch (error) {
                    console.error('❌ Error obteniendo información del usuario:', error);
                }
            }
            return;
        }
        
        // TERCERO: Buscar canales activos de la misma plataforma con espacios libres (solo para usuarios individuales confirmados)
        const availableChannels = await matchmakingSystem.findChannelsWithSpace(guildId, platform);
        
        // Filtrar canales que NO son grupos intencionales para permitir unión automática
        const nonIntentionalChannels = availableChannels.filter(channelInfo => 
            !channelInfo.channelData.isIntentionalGroup
        );
        
        if (nonIntentionalChannels.length > 0) {
            // DOBLE PROTECCIÓN: En lugar de unir inmediatamente, programar auto-unión con delay
            const targetChannelInfo = nonIntentionalChannels[0];
            
            try {
                const guild = await channel.guild;
                const member = await guild.members.fetch(userId);
                
                console.log(`⏳ Programando auto-unión con delay para ${member.displayName} → ${targetChannelInfo.channel.name} (${platform.toUpperCase()})`);
                console.log(`🛡️ Protección activa: Esperando posibles amigos por 12 segundos...`);
                
                // Programar auto-unión con delay para permitir que lleguen amigos
                matchmakingSystem.scheduleDelayedAutoJoin(userId, guildId, platform, targetChannelInfo);
                
                // Añadir a la cola mientras espera el delay
                const added = await matchmakingSystem.addToQueue(userId, guildId, platform);
                if (added) {
                    matchmakingSystem.updateChannelActivity(channel.id);
                    console.log(`📝 Usuario ${member.displayName} en cola con auto-unión programada`);
                }
                
            } catch (error) {
                console.error('❌ Error programando auto-unión con delay:', error);
            }
            return; // Salir - el delay se encargará de la auto-unión
        }
        
        // CUARTO: Si no hay canales disponibles o no se pudo unir, añadir a la cola normal (usuarios individuales confirmados)
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
        // Cancelar auto-unión pendiente si existe
        matchmakingSystem.cancelPendingAutoJoin(userId);
        
        // Limpiar el usuario de las entradas de detección de grupo
        const { groupDetection } = matchmakingSystem.client.matchmaking;
        groupDetection.recentJoins[platform] = groupDetection.recentJoins[platform].filter(
            entry => entry.userId !== userId
        );
        
        // Limpiar de grupos detectados si estaba en alguno
        for (const [groupId, groupData] of groupDetection.detectedGroups) {
            if (groupData.platform === platform && groupData.users.includes(userId)) {
                groupData.users = groupData.users.filter(id => id !== userId);
                if (groupData.users.length < groupDetection.minimumGroupSize) {
                    groupDetection.detectedGroups.delete(groupId);
                    console.log(`🔄 Grupo intencional ${groupId} disuelto - no hay suficientes miembros`);
                } else {
                    groupDetection.detectedGroups.set(groupId, groupData);
                }
            }
        }
        
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
        
        // Actualizar la lista de miembros en los datos del canal
        if (channelInfo && channelInfo.members.includes(userId)) {
            const memberIndex = channelInfo.members.indexOf(userId);
            channelInfo.members.splice(memberIndex, 1);
            matchmakingSystem.client.matchmaking.activeChannels.set(channel.id, channelInfo);
            console.log(`📝 Usuario ${userId} removido de la lista de miembros del canal ${channel.name}`);
        }
        
        // Actualizar actividad del canal
        matchmakingSystem.updateChannelActivity(channel.id);
        
        // Verificar si el canal quedó vacío
        if (channel.members.size === 0) {
            console.log(`🗑️ Canal ${channel.name} quedó vacío, eliminando...`);
            await matchmakingSystem.deleteTeamChannel(channel.id);
        } else {
            console.log(`📊 Canal ${channel.name} ahora tiene ${channel.members.size}/${matchmakingSystem.client.matchmaking.config.teamSize} miembros - ¡Espacio disponible para nuevos jugadores!`);
            
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