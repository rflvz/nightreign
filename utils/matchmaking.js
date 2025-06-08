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
        
        // Sistema de delays para auto-unión
        this.pendingAutoJoins = new Map(); // userId -> { timeout, platform, guildId, channelInfo }
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

    /**
     * Obtener estadísticas de canales activos con espacios disponibles
     * @param {string} guildId - ID del servidor
     * @returns {Object} - Estadísticas de canales con espacios libres
     */
    async getActiveChannelsStats(guildId) {
        const stats = {
            pc: { channels: 0, totalSpaces: 0 },
            xbox: { channels: 0, totalSpaces: 0 },
            play: { channels: 0, totalSpaces: 0 },
            total: { channels: 0, totalSpaces: 0 }
        };

        try {
            for (const platform of ['pc', 'xbox', 'play']) {
                const availableChannels = await this.findChannelsWithSpace(guildId, platform);
                stats[platform].channels = availableChannels.length;
                stats[platform].totalSpaces = availableChannels.reduce((sum, ch) => sum + ch.spacesAvailable, 0);
                
                stats.total.channels += availableChannels.length;
                stats.total.totalSpaces += stats[platform].totalSpaces;
            }
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas de canales activos:', error);
        }

        return stats;
    }

    /**
     * Buscar canales activos de una plataforma específica que tengan espacios libres
     * @param {string} guildId - ID del servidor
     * @param {string} platform - Plataforma (pc, xbox, play)
     * @returns {Array} - Array de canales con espacios disponibles
     */
    async findChannelsWithSpace(guildId, platform) {
        const { activeChannels, config } = this.client.matchmaking;
        const availableChannels = [];

        try {
            const guild = await this.client.guilds.fetch(guildId);
            if (!guild) return availableChannels;

            for (const [channelId, channelData] of activeChannels) {
                // Verificar que sea de la misma plataforma y servidor
                if (channelData.platform === platform && channelData.guildId === guildId) {
                    try {
                        const channel = await guild.channels.fetch(channelId);
                        if (channel && channel.members.size < config.teamSize) {
                            const spacesAvailable = config.teamSize - channel.members.size;
                            availableChannels.push({
                                channel: channel,
                                channelData: channelData,
                                spacesAvailable: spacesAvailable,
                                currentMembers: channel.members.size
                            });
                        }
                    } catch (error) {
                        // Canal no existe, limpiar de la memoria
                        activeChannels.delete(channelId);
                    }
                }
            }

            // Ordenar por menor cantidad de miembros (para llenar los equipos más vacíos primero)
            availableChannels.sort((a, b) => a.currentMembers - b.currentMembers);

        } catch (error) {
            console.error(`❌ Error buscando canales con espacios libres para ${platform}:`, error);
        }

        return availableChannels;
    }

    /**
     * Unir un usuario a un canal activo existente
     * @param {string} userId - ID del usuario
     * @param {string} guildId - ID del servidor
     * @param {VoiceChannel} targetChannel - Canal de destino
     * @param {Object} channelData - Datos del canal activo
     * @returns {boolean} - Si se unió exitosamente
     */
    async joinActiveChannel(userId, guildId, targetChannel, channelData) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            if (!guild) return false;

            const member = await guild.members.fetch(userId);
            if (!member || !member.voice.channel) return false;

            // Mover al usuario al canal
            await member.voice.setChannel(targetChannel);

            // Actualizar la lista de miembros en los datos del canal
            if (!channelData.members.includes(userId)) {
                channelData.members.push(userId);
                this.client.matchmaking.activeChannels.set(targetChannel.id, channelData);
            }

            // Actualizar actividad del canal
            this.updateChannelActivity(targetChannel.id);

            console.log(`🔄 Usuario ${member.displayName} unido al canal activo ${targetChannel.name} (${channelData.platform?.toUpperCase()}) - ${targetChannel.members.size}/${this.client.matchmaking.config.teamSize}`);

            return true;
        } catch (error) {
            console.error(`❌ Error uniendo usuario ${userId} al canal activo:`, error);
            return false;
        }
    }

    /**
     * Verificar si un usuario podría formar parte de un grupo potencial que se está formando
     * @param {string} userId - ID del usuario
     * @param {string} platform - Plataforma
     * @returns {boolean} - True si el usuario podría ser parte de un grupo en formación
     */
    isUserPotentialGroupMember(userId, platform) {
        const { groupDetection } = this.client.matchmaking;
        const now = Date.now();
        
        // Limpiar entradas antiguas primero
        this.cleanupOldGroupDetectionEntries(platform);
        
        // Obtener usuarios que se han unido recientemente (incluyendo el actual)
        const recentUsers = groupDetection.recentJoins[platform].filter(
            entry => (now - entry.timestamp) <= groupDetection.groupDetectionWindow
        );
        
        // Si ya hay 2 o más usuarios recientes (incluyendo potencialmente el actual), 
        // este usuario podría completar un grupo
        return recentUsers.length >= 2;
    }

    /**
     * Detectar si un usuario forma parte de un grupo intencional
     * @param {string} userId - ID del usuario
     * @param {string} platform - Plataforma
     * @returns {Object|null} - Información del grupo detectado o null
     */
    detectIntentionalGroup(userId, platform) {
        const { groupDetection } = this.client.matchmaking;
        const now = Date.now();
        
        // Limpiar entradas antiguas primero
        this.cleanupOldGroupDetectionEntries(platform);
        
        // Agregar el usuario actual a las entradas recientes
        groupDetection.recentJoins[platform].push({
            userId: userId,
            timestamp: now
        });
        
        // Obtener usuarios que se han unido en la ventana de tiempo
        const recentUsers = groupDetection.recentJoins[platform].filter(
            entry => (now - entry.timestamp) <= groupDetection.groupDetectionWindow
        );
        
        // Si hay 3 o más usuarios en la ventana de tiempo, considerar como grupo intencional
        if (recentUsers.length >= groupDetection.minimumGroupSize) {
            const groupId = `${platform}_${now}_${Math.random().toString(36).substr(2, 9)}`;
            const userIds = recentUsers.map(entry => entry.userId);
            
            const groupData = {
                users: userIds,
                platform: platform,
                timestamp: now,
                isIntentional: true,
                id: groupId
            };
            
            // Guardar el grupo detectado
            groupDetection.detectedGroups.set(groupId, groupData);
            
            // Limpiar las entradas recientes ya que se formó un grupo
            groupDetection.recentJoins[platform] = groupDetection.recentJoins[platform].filter(
                entry => !userIds.includes(entry.userId)
            );
            
            console.log(`🎯 Grupo intencional detectado para ${platform.toUpperCase()}: ${userIds.length} usuarios [${userIds.join(', ')}]`);
            
            return groupData;
        }
        
        return null;
    }
    
    /**
     * Limpiar entradas de detección de grupos que han expirado
     * @param {string} platform - Plataforma a limpiar
     */
    cleanupOldGroupDetectionEntries(platform) {
        const { groupDetection, activeChannels } = this.client.matchmaking;
        const now = Date.now();
        
        // Obtener lista de usuarios que ya están en canales activos
        const usersInActiveChannels = new Set();
        for (const [channelId, channelData] of activeChannels) {
            if (channelData.platform === platform) {
                channelData.members.forEach(userId => usersInActiveChannels.add(userId));
            }
        }
        
        // Filtrar entradas por tiempo Y por si ya están en canales activos
        groupDetection.recentJoins[platform] = groupDetection.recentJoins[platform].filter(
            entry => {
                const isNotExpired = (now - entry.timestamp) <= groupDetection.groupDetectionWindow;
                const isNotInActiveChannel = !usersInActiveChannels.has(entry.userId);
                return isNotExpired && isNotInActiveChannel;
            }
        );
        
        // Limpiar grupos detectados antiguos (después de 5 minutos)
        for (const [groupId, groupData] of groupDetection.detectedGroups) {
            if (now - groupData.timestamp > 300000) { // 5 minutos
                groupDetection.detectedGroups.delete(groupId);
            }
        }
    }
    
    /**
     * Verificar si un usuario es parte de un grupo intencional activo
     * @param {string} userId - ID del usuario
     * @param {string} platform - Plataforma
     * @returns {Object|null} - Datos del grupo si es parte de uno, null si no
     */
    isUserInIntentionalGroup(userId, platform) {
        const { groupDetection } = this.client.matchmaking;
        
        for (const [groupId, groupData] of groupDetection.detectedGroups) {
            if (groupData.platform === platform && groupData.users.includes(userId) && groupData.isIntentional) {
                return groupData;
            }
        }
        
        return null;
    }
    
    /**
     * Crear equipo para un grupo intencional detectado
     * @param {Object} groupData - Datos del grupo intencional
     * @param {string} guildId - ID del servidor
     * @returns {Object|null} - Información del equipo creado
     */
    async createTeamForIntentionalGroup(groupData, guildId) {
        const { activeChannels, config } = this.client.matchmaking;
        
        try {
            const guild = await this.client.guilds.fetch(guildId);
            if (!guild) return null;
            
            // Obtener el primer usuario (será el líder)
            const leader = await guild.members.fetch(groupData.users[0]);
            if (!leader) return null;
            
            // Buscar categoría de matchmaking automáticamente
            const categoryId = await this.findMatchmakingCategory(guild);
            
            // Crear canal de voz temporal
            const voiceChannel = await this.createVoiceChannel(guild, leader, categoryId, groupData.platform);
            if (!voiceChannel) return null;
            
            // Registrar el canal como activo con marca de grupo intencional
            activeChannels.set(voiceChannel.id, {
                leaderId: leader.id,
                members: groupData.users,
                platform: groupData.platform,
                timestamp: Date.now(),
                guildId: guildId,
                isIntentionalGroup: true,
                groupId: groupData.id
            });
            
            // Mover usuarios al canal
            await this.moveUsersToChannel(guild, groupData.users, voiceChannel);
            
            console.log(`🎮 Equipo de grupo intencional creado para ${groupData.platform.toUpperCase()}! Canal: ${voiceChannel.name}, Líder: ${leader.displayName}, Miembros: ${groupData.users.length}`);
            
            // Marcar el grupo como procesado
            this.client.matchmaking.groupDetection.detectedGroups.delete(groupData.id);
            
            return {
                channel: voiceChannel,
                leader: leader,
                members: groupData.users,
                platform: groupData.platform,
                isIntentionalGroup: true
            };
            
        } catch (error) {
            console.error(`❌ Error creando equipo para grupo intencional de ${groupData.platform}:`, error);
            return null;
        }
    }

    /**
     * Programar auto-unión con delay para permitir formación de grupos
     * @param {string} userId - ID del usuario
     * @param {string} guildId - ID del servidor
     * @param {string} platform - Plataforma
     * @param {Object} targetChannelInfo - Información del canal objetivo
     * @param {number} delayMs - Delay en millisegundos (default: 12 segundos)
     */
    scheduleDelayedAutoJoin(userId, guildId, platform, targetChannelInfo, delayMs = 12000) {
        // Cancelar cualquier auto-unión pendiente para este usuario
        this.cancelPendingAutoJoin(userId);
        
        console.log(`⏳ Programando auto-unión con delay de ${delayMs/1000}s para usuario ${userId} en ${platform.toUpperCase()}`);
        
        const timeout = setTimeout(async () => {
            try {
                // Verificar si el usuario aún está disponible para auto-unión
                if (await this.canUserAutoJoin(userId, guildId, platform)) {
                    const joined = await this.joinActiveChannel(
                        userId, 
                        guildId, 
                        targetChannelInfo.channel, 
                        targetChannelInfo.channelData
                    );
                    
                    if (joined) {
                        const guild = await this.client.guilds.fetch(guildId);
                        const member = await guild.members.fetch(userId);
                        console.log(`✅ Auto-unión con delay exitosa: ${member.displayName} → ${targetChannelInfo.channel.name} (${platform.toUpperCase()})`);
                    } else {
                        console.log(`⚠️ Auto-unión con delay falló para usuario ${userId}`);
                    }
                } else {
                    console.log(`🎯 Auto-unión cancelada - usuario ${userId} ya forma parte de un grupo o está en canal`);
                }
            } catch (error) {
                console.error(`❌ Error en auto-unión con delay para usuario ${userId}:`, error);
            } finally {
                // Limpiar el pending auto-join
                this.pendingAutoJoins.delete(userId);
            }
        }, delayMs);
        
        // Guardar el timeout para poder cancelarlo si es necesario
        this.pendingAutoJoins.set(userId, {
            timeout: timeout,
            platform: platform,
            guildId: guildId,
            channelInfo: targetChannelInfo,
            scheduledAt: Date.now()
        });
    }
    
    /**
     * Cancelar auto-unión pendiente para un usuario
     * @param {string} userId - ID del usuario
     */
    cancelPendingAutoJoin(userId) {
        const pendingJoin = this.pendingAutoJoins.get(userId);
        if (pendingJoin) {
            clearTimeout(pendingJoin.timeout);
            this.pendingAutoJoins.delete(userId);
            console.log(`🚫 Auto-unión pendiente cancelada para usuario ${userId}`);
            return true;
        }
        return false;
    }
    
    /**
     * Verificar si un usuario puede ser auto-unido (no está en grupo, no está en canal activo)
     * @param {string} userId - ID del usuario
     * @param {string} guildId - ID del servidor
     * @param {string} platform - Plataforma
     * @returns {boolean} - True si puede ser auto-unido
     */
    async canUserAutoJoin(userId, guildId, platform) {
        try {
            // Verificar si el usuario está en un grupo intencional
            if (this.isUserInIntentionalGroup(userId, platform)) {
                return false;
            }
            
            // Verificar si el usuario ya está en un canal activo
            const { activeChannels } = this.client.matchmaking;
            for (const [channelId, channelData] of activeChannels) {
                if (channelData.guildId === guildId && channelData.members.includes(userId)) {
                    return false;
                }
            }
            
            // Verificar si el usuario aún está en un canal de matchmaking
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            
            if (!member.voice.channel) {
                return false; // Usuario no está en canal de voz
            }
            
            const currentPlatform = this.getPlatformFromChannel(member.voice.channel.name);
            if (currentPlatform !== platform) {
                return false; // Usuario cambió de plataforma o salió del matchmaking
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Error verificando si usuario ${userId} puede auto-unirse:`, error);
            return false;
        }
    }
    
    /**
     * Limpiar auto-uniones pendientes para una plataforma específica
     * @param {string} platform - Plataforma a limpiar
     */
    cleanupPendingAutoJoins(platform = null) {
        const now = Date.now();
        const maxAge = 30000; // 30 segundos máximo
        
        for (const [userId, pendingJoin] of this.pendingAutoJoins) {
            const shouldCleanup = platform ? 
                (pendingJoin.platform === platform || (now - pendingJoin.scheduledAt) > maxAge) :
                (now - pendingJoin.scheduledAt) > maxAge;
                
            if (shouldCleanup) {
                clearTimeout(pendingJoin.timeout);
                this.pendingAutoJoins.delete(userId);
                console.log(`🧹 Auto-unión pendiente limpiada para usuario ${userId}`);
            }
        }
    }
}

module.exports = MatchmakingSystem; 