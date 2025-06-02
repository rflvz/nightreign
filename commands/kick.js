const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('👢 Expulsar un usuario de tu canal de voz (solo líderes)')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a expulsar del canal')
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('usuario');
        const { matchmakingSystem } = interaction.client;

        // Verificar que el usuario esté en un canal de voz
        if (!interaction.member.voice.channel) {
            await interaction.editReply({
                content: '❌ **Debes estar en un canal de voz para usar este comando.**'
            });
            return;
        }

        const voiceChannel = interaction.member.voice.channel;
        const channelId = voiceChannel.id;

        // Verificar que sea un canal activo del sistema de matchmaking
        if (!matchmakingSystem.isActiveChannel(channelId)) {
            await interaction.editReply({
                content: '❌ **Este comando solo se puede usar en canales de equipo creados por el bot.**'
            });
            return;
        }

        // Verificar que el usuario sea el líder del canal
        if (!matchmakingSystem.isChannelLeader(interaction.user.id, channelId)) {
            await interaction.editReply({
                content: '❌ **Solo el líder del canal puede expulsar usuarios.**'
            });
            return;
        }

        // Verificar que el usuario objetivo esté en el mismo canal
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            await interaction.editReply({
                content: '❌ **Usuario no encontrado en este servidor.**'
            });
            return;
        }

        if (!targetMember.voice.channel || targetMember.voice.channel.id !== channelId) {
            await interaction.editReply({
                content: `❌ **${targetUser.tag} no está en tu canal de voz.**`
            });
            return;
        }

        // No permitir que el líder se expulse a sí mismo
        if (targetUser.id === interaction.user.id) {
            await interaction.editReply({
                content: '❌ **No puedes expulsarte a ti mismo. Usa `/end` para terminar la partida.**'
            });
            return;
        }

        try {
            // Expulsar al usuario del canal
            await targetMember.voice.disconnect('Expulsado por el líder del canal');

            // Actualizar actividad del canal
            matchmakingSystem.updateChannelActivity(channelId);

            await interaction.editReply({
                content: `✅ **${targetUser.tag} ha sido expulsado del canal.**`
            });

            console.log(`👢 ${interaction.user.tag} expulsó a ${targetUser.tag} del canal ${voiceChannel.name}`);

        } catch (error) {
            console.error('❌ Error expulsando usuario:', error);

            let errorMessage = '❌ **No se pudo expulsar al usuario.**';
            
            if (error.code === 50013) {
                errorMessage += ' No tengo permisos suficientes.';
            } else if (error.code === 50035) {
                errorMessage += ' El usuario ya no está en el canal.';
            }

            await interaction.editReply({
                content: errorMessage
            });
        }
    },
}; 