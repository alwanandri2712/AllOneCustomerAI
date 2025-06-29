const { createBot } = require('./bot/whatsapp-bot');
const { loadConfig } = require('./config/config-loader');
const logger = require('./utils/logger');
const { initializeDatabase } = require('./database/database-manager');

async function startApplication() {
    try {
        logger.info('Starting AllOneCustomerAI...');
        
        // Load configuration
        const config = await loadConfig();
        logger.info('Configuration loaded successfully');
        
        // Initialize database
        await initializeDatabase(config.database);
        logger.info('Database initialized successfully');
        
        // Create and start WhatsApp bot
        const bot = await createBot(config);
        logger.info('WhatsApp bot created successfully');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await bot.logout();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await bot.logout();
            process.exit(0);
        });
        
        logger.info('AllOneCustomerAI started successfully!');
        
    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

// Start the application
startApplication();