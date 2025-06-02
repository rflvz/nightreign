const { ChannelType, PermissionsBitField } = require('discord.js');

/**
 * Sistema de Matchmaking para Discord
 * Maneja la formación automática de equipos y creación de canales de voz temporales
 */
class MatchmakingSystem {
    constructor(client) {
        this.client = client;
    }

    /**
     * Añadir usuario a la cola de espera
     * @param {string} userId - ID del usuario
     * @param {string} guildId - ID del servidor
     */
    async addToQueue(userId, guildId) {
        const { waitingQueue } = this.client.matchmaking;
        
        // Verificar si el usuario ya está en la cola
        if (waitingQueue.includes(userId)) {
            return false;
        }

        // Añadir usuario a la cola
        waitingQueue.push(userId);
        console.log(`👤 Usuario ${userId} añadido a la cola. Total en espera: ${waitingQueue.length}`);

        // Verificar si se puede formar un equipo
        if (waitingQueue.length >= this.client.matchmaking.config.teamSize) {
            await this.createTeam(guildId);
        }

        return true;
    }

    /**
     * Remover usuario de la cola de espera
     * @param {string} userId - ID del usuario
     */
    removeFromQueue(userId) {
        const { waitingQueue } = this.client.matchmaking;
        const index = waitingQueue.indexOf(userId);
        
        if (index > -1) {
            waitingQueue.splice(index, 1);
            console.log(`👤 Usuario ${userId} removido de la cola. Total en espera: ${waitingQueue.length}`);
            return true;
        }
        return false;
    }

    /**
     * Crear equipo automáticamente cuando hay suficientes usuarios
     * @param {string} guildId - ID del servidor
     */
    async createTeam(guildId) {
        const { waitingQueue, guildSettings, activeChannels, config } = this.client.matchmaking;
        
        if (waitingQueue.length < config.teamSize) {
            return null;
        }

        try {
            // Obtener configuración del servidor
            const settings = guildSettings.get(guildId);
            if (!settings) {
                console.log(`⚠️ No hay configuración para el servidor ${guildId}`);
                return null;
            }

            // Tomar los primeros usuarios de la cola
            const teamMembers = waitingQueue.splice(0, config.teamSize);
            
            // Obtener el guild
            const guild = await this.client.guilds.fetch(guildId);
            if (!guild) return null;

            // Obtener el primer usuario (será el líder)
            const leader = await guild.members.fetch(teamMembers[0]);
            if (!leader) return null;

            // Crear canal de voz temporal
            const voiceChannel = await this.createVoiceChannel(guild, leader, settings.categoryId);
            if (!voiceChannel) return null;

            // Registrar el canal como activo
            activeChannels.set(voiceChannel.id, {
                leaderId: leader.id,
                members: teamMembers,
                timestamp: Date.now(),
                guildId: guildId
            });

            // Mover usuarios al canal
            await this.moveUsersToChannel(guild, teamMembers, voiceChannel);

            console.log(`🎮 Equipo creado exitosamente! Canal: ${voiceChannel.name}, Líder: ${leader.displayName}`);
            
            return {
                channel: voiceChannel,
                leader: leader,
                members: teamMembers
            };

        } catch (error) {
            console.error('❌ Error creando equipo:', error);
            // Devolver usuarios a la cola si hay error
            waitingQueue.unshift(...teamMembers);
            return null;
        }
    }

    /**
     * Crear canal de voz temporal para el equipo
     * @param {Guild} guild - Servidor de Discord
     * @param {GuildMember} leader - Líder del equipo
     * @param {string} categoryId - ID de la categoría donde crear el canal
     */
    async createVoiceChannel(guild, leader, categoryId) {
        try {
            const channelName = `nightreign ${leader.displayName}`;
            
            // Buscar el canal "matchmaking" para posicionar el nuevo canal debajo
            const matchmakingChannel = guild.channels.cache.find(
                ch => ch.name.toLowerCase() === 'matchmaking' && ch.type === 2 // 2 = GuildVoice
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

            // Posicionar el canal justo debajo del canal matchmaking
            if (matchmakingChannel) {
                try {
                    await channel.setPosition(matchmakingChannel.position + 1);
                    console.log(`📍 Canal ${channelName} posicionado debajo de matchmaking`);
                } catch (positionError) {
                    console.log('⚠️ No se pudo posicionar el canal, pero se creó correctamente');
                }
            }

            return channel;
        } catch (error) {
            console.error('❌ Error creando canal de voz:', error);
            return null;
        }
    }

    /**
     * Mover usuarios al canal de voz del equipo
     * @param {Guild} guild - Servidor de Discord
     * @param {Array} userIds - IDs de los usuarios a mover
     * @param {VoiceChannel} targetChannel - Canal destino
     */
    async moveUsersToChannel(guild, userIds, targetChannel) {
        for (const userId of userIds) {
            try {
                const member = await guild.members.fetch(userId);
                if (member && member.voice.channel) {
                    await member.voice.setChannel(targetChannel);
                    console.log(`🔄 Usuario ${member.displayName} movido al canal ${targetChannel.name}`);
                }
            } catch (error) {
                console.error(`❌ Error moviendo usuario ${userId}:`, error);
            }
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
            console.log(`🗑️ Canal ${channelId} eliminado exitosamente`);
            
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
}

module.exports = MatchmakingSystem; 