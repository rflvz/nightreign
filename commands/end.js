const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('end')
        .setDescription('🏁 Terminar la partida y eliminar el canal (solo líderes)'),

    async execute(interaction) {
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
                content: '❌ **Solo el líder del canal puede terminar la partida.**'
            });
            return;
        }

        const channelInfo = matchmakingSystem.getChannelInfo(channelId);
        const memberCount = voiceChannel.members.size;

        try {
            // Responder inmediatamente antes de eliminar el canal
            await interaction.editReply({
                content: `✅ **Partida terminada por el líder.**\n🗑️ **El canal se eliminará en 5 segundos...**\n👥 **Usuarios en el canal:** ${memberCount}`
            });

            console.log(`🏁 ${interaction.user.tag} terminó la partida en canal ${voiceChannel.name} con ${memberCount} usuarios`);

            // Esperar 5 segundos antes de eliminar el canal
            setTimeout(async () => {
                try {
                    await matchmakingSystem.deleteTeamChannel(channelId);
                } catch (error) {
                    console.error('❌ Error eliminando canal después del comando end:', error);
                }
            }, 5000);

        } catch (error) {
            console.error('❌ Error ejecutando comando end:', error);

            let errorMessage = '❌ **No se pudo terminar la partida.**';
            
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