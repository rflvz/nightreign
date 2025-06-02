const { ChannelType, PermissionsBitField } = require('discord.js');

/**
 * Sistema de Matchmaking para Discord
 * Maneja la formación automática de equipos y creación de canales de voz temporales
 */
class MatchmakingSystem {
    constructor(client) {
        this.client = client;
        // Mapeo de nombres de canales a plataformas
        this.platformChannels = {
            'matchmaking-pc': 'pc',
            'matchmaking-xbox': 'xbox', 
            'matchmaking-play': 'play'
        };
    }

    /**
     * Determinar la plataforma basada en el nombre del canal
     * @param {string} channelName - Nombre del canal
     * @returns {string|null} - Plataforma (pc, xbox, play) o null si no es válido
     */
    getPlatformFromChannel(channelName) {
        const lowerName = channelName.toLowerCase();
        return this.platformChannels[lowerName] || null;
    }

    /**
     * Añadir usuario a la cola de espera de una plataforma
     * @param {string} userId - ID del usuario
     * @param {string} guildId - ID del servidor
     * @param {string} platform - Plataforma (pc, xbox, play)
     */
    async addToQueue(userId, guildId, platform) {
        const { waitingQueues } = this.client.matchmaking;
        
        // Verificar que la plataforma sea válida
        if (!waitingQueues[platform]) {
            return false;
        }

        // Verificar si el usuario ya está en alguna cola
        for (const [platformKey, queue] of Object.entries(waitingQueues)) {
            if (queue.includes(userId)) {
                // Si está en la misma plataforma, no hacer nada
                if (platformKey === platform) {
                    return false;
                }
                // Si está en otra plataforma, removerlo primero
                this.removeFromQueue(userId);
                break;
            }
        }

        // Añadir usuario a la cola de la plataforma
        waitingQueues[platform].push(userId);
        console.log(`👤 Usuario ${userId} añadido a la cola de ${platform.toUpperCase()}. Total en espera: ${waitingQueues[platform].length}`);

        // Verificar si se puede formar un equipo
        if (waitingQueues[platform].length >= this.client.matchmaking.config.teamSize) {
            await this.createTeam(guildId, platform);
        }

        return true;
    }

    /**
     * Remover usuario de todas las colas de espera
     * @param {string} userId - ID del usuario
     */
    removeFromQueue(userId) {
        const { waitingQueues } = this.client.matchmaking;
        let removed = false;
        
        for (const [platform, queue] of Object.entries(waitingQueues)) {
            const index = queue.indexOf(userId);
            if (index > -1) {
                queue.splice(index, 1);
                console.log(`👤 Usuario ${userId} removido de la cola de ${platform.toUpperCase()}. Total en espera: ${queue.length}`);
                removed = true;
            }
        }
        
        return removed;
    }

    /**
     * Crear equipo automáticamente cuando hay suficientes usuarios en una plataforma
     * @param {string} guildId - ID del servidor
     * @param {string} platform - Plataforma del equipo
     */
    async createTeam(guildId, platform) {
        const { waitingQueues, activeChannels, config } = this.client.matchmaking;
        
        if (!waitingQueues[platform] || waitingQueues[platform].length < config.teamSize) {
            return null;
        }

        try {
            // Tomar los primeros usuarios de la cola de la plataforma
            const teamMembers = waitingQueues[platform].splice(0, config.teamSize);
            
            // Obtener el guild
            const guild = await this.client.guilds.fetch(guildId);
            if (!guild) return null;

            // Obtener el primer usuario (será el líder)
            const leader = await guild.members.fetch(teamMembers[0]);
            if (!leader) return null;

            // Buscar categoría de matchmaking automáticamente
            const categoryId = await this.findMatchmakingCategory(guild);

            // Crear canal de voz temporal
            const voiceChannel = await this.createVoiceChannel(guild, leader, categoryId, platform);
            if (!voiceChannel) return null;

            // Registrar el canal como activo
            activeChannels.set(voiceChannel.id, {
                leaderId: leader.id,
                members: teamMembers,
                platform: platform,
                timestamp: Date.now(),
                guildId: guildId
            });

            // Mover usuarios al canal
            await this.moveUsersToChannel(guild, teamMembers, voiceChannel);

            console.log(`🎮 Equipo de ${platform.toUpperCase()} creado exitosamente! Canal: ${voiceChannel.name}, Líder: ${leader.displayName}`);
            
            return {
                channel: voiceChannel,
                leader: leader,
                members: teamMembers,
                platform: platform
            };

        } catch (error) {
            console.error(`❌ Error creando equipo de ${platform}:`, error);
            return null;
        }
    }

    /**
     * Buscar categoría de matchmaking automáticamente
     * @param {Guild} guild - Servidor de Discord
     * @returns {string|null} - ID de la categoría encontrada o null
     */
    async findMatchmakingCategory(guild) {
        try {
            // Buscar una categoría llamada "Matchmaking" o "matchmaking"
            const matchmakingCategory = guild.channels.cache.find(
                ch => ch.name.toLowerCase() === 'matchmaking' && ch.type === 4 // 4 = CategoryChannel
            );
            
            if (matchmakingCategory) {
                return matchmakingCategory.id;
            }

            // Si no se encuentra, buscar la categoría donde están los canales de matchmaking
            for (const [channelName] of Object.entries(this.platformChannels)) {
                const matchmakingChannel = guild.channels.cache.find(
                    ch => ch.name.toLowerCase() === channelName && ch.type === 2 // 2 = GuildVoice
                );
                
                if (matchmakingChannel && matchmakingChannel.parentId) {
                    return matchmakingChannel.parentId;
                }
            }

            return null;
        } catch (error) {
            console.log('⚠️ Error buscando categoría de matchmaking:', error);
            return null;
        }
    }

    /**
     * Crear canal de voz temporal para el equipo
     * @param {Guild} guild - Servidor de Discord
     * @param {GuildMember} leader - Líder del equipo
     * @param {string} categoryId - ID de la categoría donde crear el canal
     * @param {string} platform - Plataforma del equipo
     */
    async createVoiceChannel(guild, leader, categoryId, platform) {
        try {
            const platformNames = {
                pc: 'PC',
                xbox: 'XBOX',
                play: 'PLAY'
            };
            
            const channelName = `nightreign ${platformNames[platform]} ${leader.displayName}`;
            
            // Buscar el canal de matchmaking de la plataforma para posicionar el nuevo canal
            const matchmakingChannelName = `matchmaking-${platform}`;
            const matchmakingChannel = guild.channels.cache.find(
                ch => ch.name.toLowerCase() === matchmakingChannelName && ch.type === 2 // 2 = GuildVoice
            );
            
            // Permisos para el canal
            const permissions = [
                {
                    id: guild.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
                },
                {
                    id: leader.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.Connect,
                        PermissionsBitField.Flags.ManageChannels,
                        PermissionsBitField.Flags.MoveMembers,
                        PermissionsBitField.Flags.MuteMembers,
                        PermissionsBitField.Flags.DeafenMembers
                    ],
                }
            ];

            // Crear el canal
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: categoryId || null,
                userLimit: this.client.matchmaking.config.teamSize,
                permissionOverwrites: permissions,
            });

            // Posicionar el canal justo debajo del canal de matchmaking correspondiente
            if (matchmakingChannel) {
                try {
                    await channel.setPosition(matchmakingChannel.position + 1);
                    console.log(`📍 Canal ${channelName} posicionado debajo de ${matchmakingChannelName}`);
                } catch (positionError) {
                    console.log('⚠️ No se pudo posicionar el canal, pero se creó correctamente');
                }
            }

            return channel;
        } catch (error) {
            console.error(`❌ Error creando canal de voz para ${platform}:`, error);
            return null;
        }
    }

    /**
     * Mover usuarios a un canal de voz
     * @param {Guild} guild - Servidor de Discord
     * @param {Array} userIds - Array de IDs de usuarios
     * @param {VoiceChannel} targetChannel - Canal de destino
     */
    async moveUsersToChannel(guild, userIds, targetChannel) {
        const movedUsers = [];
        
        for (const userId of userIds) {
            try {
                const member = await guild.members.fetch(userId);
                if (member && member.voice.channel) {
                    await member.voice.setChannel(targetChannel);
                    movedUsers.push(member.displayName);
                    console.log(`➡️ Usuario ${member.displayName} movido al canal ${targetChannel.name}`);
                }
            } catch (error) {
                console.error(`❌ Error moviendo usuario ${userId}:`, error);
            }
        }
        
        if (movedUsers.length > 0) {
            console.log(`✅ ${movedUsers.length} usuario(s) movido(s) exitosamente: ${movedUsers.join(', ')}`);
        }
    }

    /**
     * Eliminar canal de equipo y limpiar datos
     * @param {string} channelId - ID del canal a eliminar
     */
    async deleteTeamChannel(channelId) {
        try {
            const { activeChannels } = this.client.matchmaking;
            const channelData = activeChannels.get(channelId);
            
            if (!channelData) return false;

            // Obtener y eliminar el canal
            const channel = await this.client.channels.fetch(channelId);
            if (channel) {
                await channel.delete('Fin de partida - canal eliminado');
            }

            // Limpiar datos del canal
            activeChannels.delete(channelId);
            console.log(`🗑️ Canal ${channelId} (${channelData.platform?.toUpperCase() || 'UNKNOWN'}) eliminado exitosamente`);
            
            return true;
        } catch (error) {
            console.error(`❌ Error eliminando canal ${channelId}:`, error);
            return false;
        }
    }

    /**
     * Verificar si un usuario es líder de un canal
     * @param {string} userId - ID del usuario
     * @param {string} channelId - ID del canal
     */
    isChannelLeader(userId, channelId) {
        const { activeChannels } = this.client.matchmaking;
        const channelData = activeChannels.get(channelId);
        return channelData && channelData.leaderId === userId;
    }

    /**
     * Verificar si un canal está activo en el sistema
     * @param {string} channelId - ID del canal
     */
    isActiveChannel(channelId) {
        return this.client.matchmaking.activeChannels.has(channelId);
    }

    /**
     * Obtener información de un canal activo
     * @param {string} channelId - ID del canal
     */
    getChannelInfo(channelId) {
        return this.client.matchmaking.activeChannels.get(channelId);
    }

    /**
     * Actualizar timestamp de actividad de un canal
     * @param {string} channelId - ID del canal
     */
    updateChannelActivity(channelId) {
        const { activeChannels } = this.client.matchmaking;
        const channelData = activeChannels.get(channelId);
        
        if (channelData) {
            channelData.timestamp = Date.now();
            activeChannels.set(channelId, channelData);
        }
    }

    /**
     * Obtener estadísticas de las colas de matchmaking
     * @param {string} guildId - ID del servidor
     */
    getQueueStats(guildId) {
        const { waitingQueues } = this.client.matchmaking;
        return {
            pc: waitingQueues.pc.length,
            xbox: waitingQueues.xbox.length,
            play: waitingQueues.play.length,
            total: waitingQueues.pc.length + waitingQueues.xbox.length + waitingQueues.play.length
        };
    }
}

module.exports = MatchmakingSystem; 