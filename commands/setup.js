const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('🎮 Configurar el sistema de matchmaking')
        .addChannelOption(option =>
            option.setName('lobby')
                .setDescription('Canal de voz que servirá como lobby para el matchmaking')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice))
        .addChannelOption(option =>
            option.setName('categoria')
                .setDescription('Categoría donde se crearán los canales de equipo (opcional)')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildCategory))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const lobbyChannel = interaction.options.getChannel('lobby');
        const category = interaction.options.getChannel('categoria');
        const guildId = interaction.guild.id;

        // Verificar permisos del usuario
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.editReply({
                content: '❌ **No tienes permisos para configurar el matchmaking.** Necesitas el permiso "Gestionar Canales".'
            });
            return;
        }

        // Verificar que el canal de lobby sea de voz
        if (lobbyChannel.type !== ChannelType.GuildVoice) {
            await interaction.editReply({
                content: '❌ **El canal de lobby debe ser un canal de voz.**'
            });
            return;
        }

        // Verificar permisos del bot en el canal de lobby
        const botPermissions = lobbyChannel.permissionsFor(interaction.client.user);
        if (!botPermissions.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
            await interaction.editReply({
                content: `❌ **No tengo permisos suficientes en el canal ${lobbyChannel}.** Necesito permisos para ver y conectarme al canal.`
            });
            return;
        }

        // Verificar permisos del bot para crear canales
        const guildPermissions = interaction.guild.members.me.permissions;
        if (!guildPermissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers])) {
            await interaction.editReply({
                content: '❌ **No tengo permisos suficientes en el servidor.** Necesito permisos para "Gestionar Canales" y "Mover Miembros".'
            });
            return;
        }

        // Verificar permisos en la categoría si se especificó
        if (category) {
            const categoryPermissions = category.permissionsFor(interaction.client.user);
            if (!categoryPermissions.has(PermissionFlagsBits.ManageChannels)) {
                await interaction.editReply({
                    content: `❌ **No tengo permisos para crear canales en la categoría ${category}.** Necesito permisos para "Gestionar Canales".`
                });
                return;
            }
        }

        try {
            // Guardar configuración en memoria
            const { guildSettings } = interaction.client.matchmaking;
            
            const settings = {
                lobbyChannelId: lobbyChannel.id,
                categoryId: category ? category.id : null,
                setupBy: interaction.user.id,
                setupAt: Date.now()
            };

            guildSettings.set(guildId, settings);

            // Crear respuesta de éxito
            let successMessage = `✅ **¡Matchmaking configurado exitosamente!**\n\n`;
            successMessage += `🎮 **Canal de Lobby:** ${lobbyChannel}\n`;
            successMessage += `📊 **Tamaño de Equipo:** ${interaction.client.matchmaking.config.teamSize} jugadores\n`;
            
            if (category) {
                successMessage += `📁 **Categoría:** ${category}\n`;
            } else {
                successMessage += `📁 **Categoría:** Sin categoría (canales se crearán en la raíz)\n`;
            }
            
            successMessage += `\n**📋 Cómo funciona:**\n`;
            successMessage += `• Los usuarios se unen al canal ${lobbyChannel}\n`;
            successMessage += `• Cuando hay ${interaction.client.matchmaking.config.teamSize} usuarios, se forma un equipo automáticamente\n`;
            successMessage += `• Se crea un canal temporal para el equipo\n`;
            successMessage += `• El primer usuario se convierte en líder del canal\n`;
            successMessage += `• El canal se elimina automáticamente cuando queda vacío\n\n`;
            successMessage += `**🎯 ¡El sistema está listo para usar!**`;

            await interaction.editReply({
                content: successMessage
            });

            console.log(`⚙️ Matchmaking configurado en servidor ${interaction.guild.name} (${guildId})`);
            console.log(`   • Lobby: ${lobbyChannel.name} (${lobbyChannel.id})`);
            console.log(`   • Categoría: ${category ? `${category.name} (${category.id})` : 'Sin categoría'}`);
            console.log(`   • Configurado por: ${interaction.user.tag} (${interaction.user.id})`);

        } catch (error) {
            console.error('❌ Error configurando matchmaking:', error);
            await interaction.editReply({
                content: '❌ **Error configurando el matchmaking.** Verifica que tengo todos los permisos necesarios e inténtalo de nuevo.'
            });
        }
    },
}; 