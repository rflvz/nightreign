const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('✏️ Renombrar tu canal de voz (solo líderes)')
        .addStringOption(option =>
            option.setName('nombre')
                .setDescription('Nuevo nombre para el canal')
                .setRequired(true)
                .setMaxLength(100)),

    async execute(interaction) {
        const newName = interaction.options.getString('nombre');
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
                content: '❌ **Solo el líder del canal puede renombrar el canal.**'
            });
            return;
        }

        // Validar el nombre
        const sanitizedName = newName.trim();
        if (sanitizedName.length < 1) {
            await interaction.editReply({
                content: '❌ **El nombre del canal no puede estar vacío.**'
            });
            return;
        }

        if (sanitizedName.length > 100) {
            await interaction.editReply({
                content: '❌ **El nombre del canal no puede tener más de 100 caracteres.**'
            });
            return;
        }

        // Verificar caracteres permitidos (Discord no permite ciertos caracteres)
        const invalidChars = /[<>@#&!]/g;
        if (invalidChars.test(sanitizedName)) {
            await interaction.editReply({
                content: '❌ **El nombre contiene caracteres no permitidos.** Evita usar: `< > @ # & !`'
            });
            return;
        }

        // Verificar rate limit (Discord limita cambios de nombre de canal)
        const channelInfo = matchmakingSystem.getChannelInfo(channelId);
        if (channelInfo && channelInfo.lastRename && Date.now() - channelInfo.lastRename < 600000) { // 10 minutos
            const timeLeft = Math.ceil((600000 - (Date.now() - channelInfo.lastRename)) / 60000);
            await interaction.editReply({
                content: `❌ **Debes esperar ${timeLeft} minuto(s) antes de renombrar el canal nuevamente.**`
            });
            return;
        }

        try {
            const oldName = voiceChannel.name;
            
            // Añadir automáticamente el prefijo "nightreign" si no lo tiene
            let finalName = sanitizedName;
            if (!sanitizedName.toLowerCase().startsWith('nightreign')) {
                finalName = `nightreign ${sanitizedName}`;
            }
            
            // Renombrar el canal
            await voiceChannel.setName(finalName);

            // Actualizar información del canal
            const { activeChannels } = interaction.client.matchmaking;
            const updatedChannelInfo = {
                ...channelInfo,
                lastRename: Date.now(),
                timestamp: Date.now()
            };
            activeChannels.set(channelId, updatedChannelInfo);

            await interaction.editReply({
                content: `✅ **Canal renombrado exitosamente.**\n📝 **Nombre anterior:** ${oldName}\n📝 **Nuevo nombre:** ${finalName}`
            });

            console.log(`✏️ ${interaction.user.tag} renombró el canal "${oldName}" a "${finalName}"`);

        } catch (error) {
            console.error('❌ Error renombrando canal:', error);

            let errorMessage = '❌ **No se pudo renombrar el canal.**';
            
            if (error.code === 50013) {
                errorMessage += ' No tengo permisos suficientes.';
            } else if (error.code === 50035) {
                errorMessage += ' El canal ya no existe.';
            } else if (error.code === 50001) {
                errorMessage += ' No tengo acceso al canal.';
            } else if (error.code === 50028) {
                errorMessage += ' Estás siendo rate limited. Inténtalo más tarde.';
            }

            await interaction.editReply({
                content: errorMessage
            });
        }
    },
};