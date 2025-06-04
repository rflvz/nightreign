const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('📊 Mostrar información del sistema de matchmaking automático')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        // Verificar permisos del usuario
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.editReply({
                content: '❌ **No tienes permisos para ver la información del sistema.** Necesitas el permiso "Gestionar Canales".'
            });
            return;
        }

        const guild = interaction.guild;
        const { matchmakingSystem } = interaction.client;

        // Buscar canales de matchmaking existentes
        const foundChannels = {
            pc: guild.channels.cache.find(ch => ch.name.toLowerCase() === 'matchmaking-pc' && ch.type === 2),
            xbox: guild.channels.cache.find(ch => ch.name.toLowerCase() === 'matchmaking-xbox' && ch.type === 2),
            play: guild.channels.cache.find(ch => ch.name.toLowerCase() === 'matchmaking-play' && ch.type === 2)
        };

        // Buscar categoría de matchmaking
        const categoryChannel = await matchmakingSystem.findMatchmakingCategory(guild);
        const category = categoryChannel ? guild.channels.cache.get(categoryChannel) : null;

        // Obtener estadísticas de colas
        const queueStats = matchmakingSystem.getQueueStats(guild.id);

        // Obtener estadísticas de canales activos con espacios disponibles
        const activeChannelsStats = await matchmakingSystem.getActiveChannelsStats(guild.id);

        // Crear embed informativo
        const setupEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎮 **Sistema de Matchmaking - Estado**')
            .setDescription('**¡El sistema funciona automáticamente sin configuración!**')
            .addFields(
                {
                    name: '📋 **Canales Detectados**',
                    value: 
                        `💻 **PC:** ${foundChannels.pc ? `${foundChannels.pc} ✅` : '❌ No encontrado'}\n` +
                        `🎮 **Xbox:** ${foundChannels.xbox ? `${foundChannels.xbox} ✅` : '❌ No encontrado'}\n` +
                        `🎮 **PlayStation:** ${foundChannels.play ? `${foundChannels.play} ✅` : '❌ No encontrado'}`,
                    inline: false
                },
                {
                    name: '📊 **Colas Actuales**',
                    value: 
                        `💻 **PC:** ${queueStats.pc} jugador(es) en espera\n` +
                        `🎮 **Xbox:** ${queueStats.xbox} jugador(es) en espera\n` +
                        `🎮 **PlayStation:** ${queueStats.play} jugador(es) en espera\n` +
                        `📈 **Total:** ${queueStats.total} jugador(es)`,
                    inline: false
                },
                {
                    name: '🔄 **Canales Activos con Espacios Libres**',
                    value: 
                        `💻 **PC:** ${activeChannelsStats.pc.channels} canal(es) - ${activeChannelsStats.pc.totalSpaces} espacio(s)\n` +
                        `🎮 **Xbox:** ${activeChannelsStats.xbox.channels} canal(es) - ${activeChannelsStats.xbox.totalSpaces} espacio(s)\n` +
                        `🎮 **PlayStation:** ${activeChannelsStats.play.channels} canal(es) - ${activeChannelsStats.play.totalSpaces} espacio(s)\n` +
                        `🎯 **Total:** ${activeChannelsStats.total.channels} canal(es) con ${activeChannelsStats.total.totalSpaces} espacio(s) libres`,
                    inline: false
                },
                {
                    name: '⚙️ **Configuración**',
                    value: 
                        `📁 **Categoría:** ${category ? `${category.name} ✅` : '❌ No encontrada (se crearán en raíz)'}\n` +
                        `👥 **Tamaño de equipo:** ${interaction.client.matchmaking.config.teamSize} jugadores\n` +
                        `🔢 **Límite máximo:** ${interaction.client.matchmaking.config.maxTeamSize} jugadores`,
                    inline: false
                },
                {
                    name: '🚀 **Cómo Crear los Canales**',
                    value: 
                        'Para que el sistema funcione, crea estos canales de voz:\n\n' +
                        '• **`matchmaking-pc`** - Para jugadores de PC\n' +
                        '• **`matchmaking-xbox`** - Para jugadores de Xbox\n' +
                        '• **`matchmaking-play`** - Para jugadores de PlayStation\n\n' +
                        '¡Una vez creados, el sistema funciona automáticamente!',
                    inline: false
                },
                {
                    name: '✨ **Nueva Funcionalidad**',
                    value: 
                        '🎯 **Auto-unión a equipos:** Los nuevos jugadores se unen automáticamente a canales con espacios libres antes de ir a la cola\n' +
                        '🔄 **Prioridad de llenado:** Los equipos más vacíos se llenan primero\n' +
                        '📊 **Información en tiempo real:** El sistema muestra espacios disponibles al instante',
                    inline: false
                }
            )
            .setFooter({ 
                text: 'Night Reign Matchmaking Bot v1.3.0 - Auto-unión inteligente', 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [setupEmbed] });

        // Log de información del sistema
        console.log(`📊 Información del sistema solicitada en servidor ${guild.name} (${guild.id})`);
        console.log(`   • Canales PC: ${foundChannels.pc ? 'Detectado' : 'No encontrado'}`);
        console.log(`   • Canales Xbox: ${foundChannels.xbox ? 'Detectado' : 'No encontrado'}`);
        console.log(`   • Canales PlayStation: ${foundChannels.play ? 'Detectado' : 'No encontrado'}`);
        console.log(`   • Categoría: ${category ? `${category.name}` : 'No encontrada'}`);
        console.log(`   • Colas - PC: ${queueStats.pc}, Xbox: ${queueStats.xbox}, PlayStation: ${queueStats.play}`);
        console.log(`   • Canales activos con espacios - PC: ${activeChannelsStats.pc.channels} (${activeChannelsStats.pc.totalSpaces} espacios), Xbox: ${activeChannelsStats.xbox.channels} (${activeChannelsStats.xbox.totalSpaces} espacios), PlayStation: ${activeChannelsStats.play.channels} (${activeChannelsStats.play.totalSpaces} espacios)`);
        console.log(`   • Total de espacios disponibles: ${activeChannelsStats.total.totalSpaces} en ${activeChannelsStats.total.channels} canal(es)`);
    },
}; 