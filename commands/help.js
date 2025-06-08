const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('📚 Mostrar ayuda del sistema de matchmaking'),

    async execute(interaction) {
        const { matchmaking } = interaction.client;
        
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('🎮 **Sistema de Matchmaking - Ayuda**')
            .setDescription('Sistema automático de formación de equipos para Night Reign')
            .addFields(
                {
                    name: '🎯 **¿Cómo funciona?**',
                    value: '• Únete a uno de los canales de matchmaking por plataforma\n' +
                           '• Cuando se junten suficientes jugadores, se formará un equipo automáticamente\n' +
                           '• Se creará un canal temporal para tu equipo\n' +
                           '• El canal se elimina cuando todos salen',
                    inline: false
                },
                {
                    name: '🎮 **Canales de Matchmaking**',
                    value: '• **matchmaking-pc** - Para jugadores de PC 💻\n' +
                           '• **matchmaking-xbox** - Para jugadores de Xbox 🎮\n' +
                           '• **matchmaking-play** - Para jugadores de PlayStation 🎮',
                    inline: false
                },
                {
                    name: '⚙️ **Comandos Disponibles**',
                    value: '• `/help` - Mostrar esta ayuda\n' +
                           '• `/end` - Terminar partida (Solo líder)\n' +
                           '• `/kick` - Expulsar usuario (Solo líder)\n' +
                           '• `/limit` - Cambiar límite de usuarios (Solo líder)\n' +
                           '• `/rename` - Renombrar canal (Solo líder)',
                    inline: false
                },
                {
                    name: '📊 **Configuración Actual**',
                    value: `• **Tamaño de equipo:** ${matchmaking.config.teamSize} jugadores\n` +
                           `• **Límite máximo:** ${matchmaking.config.maxTeamSize} jugadores\n` +
                           `• **Sin configuración requerida** - ¡Funciona automáticamente!`,
                    inline: false
                },
                {
                    name: '🏆 **Canales de Equipo**',
                    value: 'Los canales se crean automáticamente con formato:\n' +
                           '• `nightreign PC [NombreDelLíder]`\n' +
                           '• `nightreign XBOX [NombreDelLíder]`\n' +
                           '• `nightreign PLAY [NombreDelLíder]`',
                    inline: false
                },
                {
                    name: '🛡️ **Permisos de Líder**',
                    value: 'El primer jugador que se une se convierte en líder y puede:\n' +
                           '• Mover usuarios dentro del canal\n' +
                           '• Silenciar/Ensordecer miembros\n' +
                           '• Renombrar el canal\n' +
                           '• Expulsar usuarios\n' +
                           '• Terminar la partida',
                    inline: false
                },
                {
                    name: '🎮 Sistema de Matchmaking',
                    value: [
                        '• **Detección Automática**: Los canales `matchmaking-pc`, `matchmaking-xbox`, `matchmaking-play` se detectan automáticamente',
                        '• **Formación de Equipos**: Cuando 3 usuarios se unen, se crea un equipo automáticamente',
                        '• **Grupos de Amigos**: Si 3 amigos entran juntos en 30 segundos, se mantienen como grupo',
                        '• **Canales Temporales**: Se crean canales únicos `nightreign [PLATAFORMA] [líder]`',
                        '• **Auto-eliminación**: Los canales se eliminan cuando quedan vacíos'
                    ].join('\n')
                }
            )
            .setFooter({ 
                text: 'Night Reign Matchmaking Bot v1.2.0 - Sin configuración requerida', 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [helpEmbed] });
    },
}; 