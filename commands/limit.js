const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limit')
        .setDescription('👥 Cambiar el límite de usuarios en tu canal de voz (solo líderes)')
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Nuevo límite de usuarios (1-10, usa 0 para sin límite)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(10)),

    async execute(interaction) {
        const newLimit = interaction.options.getInteger('numero');
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
                content: '❌ **Solo el líder del canal puede cambiar el límite de usuarios.**'
            });
            return;
        }

        // Validar el límite
        const maxLimit = interaction.client.matchmaking.config.maxTeamSize;
        if (newLimit > maxLimit) {
            await interaction.editReply({
                content: `❌ **El límite máximo permitido es ${maxLimit} usuarios.**`
            });
            return;
        }

        // Verificar que el nuevo límite no sea menor que los usuarios actuales
        const currentMembers = voiceChannel.members.size;
        if (newLimit > 0 && newLimit < currentMembers) {
            await interaction.editReply({
                content: `❌ **No puedes establecer un límite menor a los usuarios actuales en el canal (${currentMembers}).**`
            });
            return;
        }

        try {
            // Cambiar el límite del canal
            await voiceChannel.setUserLimit(newLimit);

            // Actualizar actividad del canal
            matchmakingSystem.updateChannelActivity(channelId);

            let successMessage;
            if (newLimit === 0) {
                successMessage = `✅ **Límite removido.** El canal ahora permite usuarios ilimitados.`;
            } else {
                successMessage = `✅ **Límite cambiado a ${newLimit} usuario(s).**`;
            }

            await interaction.editReply({
                content: successMessage
            });

            console.log(`👥 ${interaction.user.tag} cambió el límite del canal ${voiceChannel.name} a ${newLimit}`);

        } catch (error) {
            console.error('❌ Error cambiando límite del canal:', error);

            let errorMessage = '❌ **No se pudo cambiar el límite del canal.**';
            
            if (error.code === 50013) {
                errorMessage += ' No tengo permisos suficientes.';
            } else if (error.code === 50035) {
                errorMessage += ' El canal ya no existe.';
            }

            await interaction.editReply({
                content: errorMessage
            });
        }
    },
}; 