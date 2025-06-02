const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Solo manejar comandos slash
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`❌ Comando ${interaction.commandName} no encontrado`);
            return;
        }

        // Verificar cooldown del usuario
        const { cooldowns } = interaction.client.matchmaking;
        const userId = interaction.user.id;
        const cooldownKey = `${userId}_${interaction.commandName}`;
        
        if (cooldowns.has(cooldownKey)) {
            await interaction.reply({
                content: '⏳ **Debes esperar antes de usar este comando nuevamente.**',
                ephemeral: true
            });
            return;
        }

        try {
            // Defer la respuesta para comandos que puedan tardar
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: shouldBeEphemeral(interaction.commandName) });
            }

            // Ejecutar el comando
            await command.execute(interaction);

            // Aplicar cooldown
            cooldowns.add(cooldownKey);
            setTimeout(() => {
                cooldowns.delete(cooldownKey);
            }, interaction.client.matchmaking.config.cooldownTime);

            console.log(`✅ Comando ${interaction.commandName} ejecutado por ${interaction.user.tag}`);

        } catch (error) {
            console.error(`❌ Error ejecutando comando ${interaction.commandName}:`, error);

            const errorMessage = {
                content: '❌ **Hubo un error al ejecutar este comando. Inténtalo de nuevo más tarde.**',
                ephemeral: true
            };

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (followUpError) {
                console.error('❌ Error enviando mensaje de error:', followUpError);
            }
        }
    },
};

/**
 * Determinar si un comando debe ser efímero (solo visible para el usuario)
 * @param {string} commandName - Nombre del comando
 * @returns {boolean} - Si debe ser efímero
 */
function shouldBeEphemeral(commandName) {
    const ephemeralCommands = ['setup', 'kick', 'limit', 'rename', 'end'];
    return ephemeralCommands.includes(commandName);
} 