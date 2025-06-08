const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Mostrar estadísticas de debug del sistema de matchmaking (Solo administradores)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        const { matchmakingSystem, matchmaking } = interaction.client;
        
        if (!matchmakingSystem) {
            return interaction.reply({ 
                content: '❌ El sistema de matchmaking no está inicializado.', 
                ephemeral: true 
            });
        }
        
        try {
            const guildId = interaction.guild.id;
            const { groupDetection, waitingQueues, activeChannels } = matchmaking;
            const now = Date.now();
            
            // Estadísticas de colas
            const queueStats = matchmakingSystem.getQueueStats(guildId);
            
            // Estadísticas de detección de grupos
            let recentJoinsInfo = '';
            for (const [platform, joins] of Object.entries(groupDetection.recentJoins)) {
                if (joins.length > 0) {
                    const joinsList = joins.map(entry => {
                        const timeAgo = Math.floor((now - entry.timestamp) / 1000);
                        return `<@${entry.userId}> (${timeAgo}s ago)`;
                    }).join(', ');
                    recentJoinsInfo += `**${platform.toUpperCase()}**: ${joinsList}\n`;
                }
            }
            
            // Grupos detectados
            let detectedGroupsInfo = '';
            for (const [groupId, groupData] of groupDetection.detectedGroups) {
                const timeAgo = Math.floor((now - groupData.timestamp) / 1000);
                const usersList = groupData.users.map(userId => `<@${userId}>`).join(', ');
                detectedGroupsInfo += `**${groupId}**: ${usersList} (${timeAgo}s ago)\n`;
            }
            
            // Canales activos con marca de grupo
            let activeChannelsInfo = '';
            for (const [channelId, channelData] of activeChannels) {
                if (channelData.guildId === guildId) {
                    const groupFlag = channelData.isIntentionalGroup ? ' 🎯' : '';
                    const timeAgo = Math.floor((now - channelData.timestamp) / 1000);
                    activeChannelsInfo += `<#${channelId}> (${channelData.platform.toUpperCase()})${groupFlag} - ${channelData.members.length} miembros (${timeAgo}s ago)\n`;
                }
            }
            
            // Auto-uniones pendientes
            let pendingAutoJoinsInfo = '';
            for (const [userId, pendingJoin] of matchmakingSystem.pendingAutoJoins) {
                if (pendingJoin.guildId === guildId) {
                    const timeLeft = Math.max(0, Math.floor((12000 - (now - pendingJoin.scheduledAt)) / 1000));
                    pendingAutoJoinsInfo += `<@${userId}> → ${pendingJoin.platform.toUpperCase()} (${timeLeft}s restantes)\n`;
                }
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🔧 Debug del Sistema de Matchmaking')
                .setColor(0x0099FF)
                .addFields(
                    {
                        name: '📊 Estadísticas de Colas',
                        value: [
                            `**PC**: ${queueStats.pc} usuarios`,
                            `**Xbox**: ${queueStats.xbox} usuarios`,
                            `**PlayStation**: ${queueStats.play} usuarios`,
                            `**Total**: ${queueStats.total} usuarios`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '🎯 Detección de Grupos',
                        value: [
                            `**Ventana**: ${groupDetection.groupDetectionWindow / 1000}s`,
                            `**Tamaño mínimo**: ${groupDetection.minimumGroupSize} usuarios`,
                            `**Grupos detectados**: ${groupDetection.detectedGroups.size}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '👥 Entradas Recientes',
                        value: recentJoinsInfo || 'No hay entradas recientes',
                        inline: false
                    }
                );
            
            if (detectedGroupsInfo) {
                embed.addFields({
                    name: '🎯 Grupos Detectados Activos',
                    value: detectedGroupsInfo,
                    inline: false
                });
            }
            
            if (activeChannelsInfo) {
                embed.addFields({
                    name: '🔊 Canales Activos',
                    value: activeChannelsInfo,
                    inline: false
                });
            }
            
            if (pendingAutoJoinsInfo) {
                embed.addFields({
                    name: '⏳ Auto-Uniones Pendientes',
                    value: pendingAutoJoinsInfo,
                    inline: false
                });
            }
            
            embed.setFooter({ 
                text: `Actualizado: ${new Date().toLocaleString()}` 
            });
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } catch (error) {
            console.error('❌ Error en comando debug:', error);
            await interaction.reply({ 
                content: '❌ Error obteniendo estadísticas de debug.', 
                ephemeral: true 
            });
        }
    },
}; 