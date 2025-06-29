const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const AIService = require('../services/ai-service');
const { getDatabase } = require('../database/database-manager');
const fs = require('fs-extra');
const path = require('path');

class WhatsAppBot {
    constructor(config) {
        this.config = config;
        this.sock = null;
        this.aiService = new AIService(config);
        this.isConnected = false;
        this.authDir = './auth_info';
        this.adminNumbers = config.admin.numbers.map(num => num.includes('@') ? num : `${num}@s.whatsapp.net`);
    }

    async initialize() {
        try {
            // Ensure auth directory exists
            await fs.ensureDir(this.authDir);
            
            // Load auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            
            // Create WhatsApp socket
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: true,
                logger: logger.child({ module: 'baileys' }),
                browser: ['AllOneCustomerAI', 'Chrome', '1.0.0'],
                defaultQueryTimeoutMs: 60000
            });
            
            // Set up event handlers
            this.setupEventHandlers(saveCreds);
            
            logger.info('WhatsApp bot initialized successfully');
            return this;
            
        } catch (error) {
            logger.error('Failed to initialize WhatsApp bot:', error);
            throw error;
        }
    }

    setupEventHandlers(saveCreds) {
        // Connection updates
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                logger.info('QR Code generated, scan with WhatsApp');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                this.isConnected = false;
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                logger.info('Connection closed due to:', lastDisconnect?.error);
                
                if (shouldReconnect) {
                    logger.info('Reconnecting...');
                    setTimeout(() => this.initialize(), 5000);
                } else {
                    logger.info('Logged out, please scan QR code again');
                }
            } else if (connection === 'open') {
                this.isConnected = true;
                logger.info('WhatsApp bot connected successfully!');
                await this.sendStartupNotification();
            }
        });
        
        // Save credentials
        this.sock.ev.on('creds.update', saveCreds);
        
        // Handle incoming messages
        this.sock.ev.on('messages.upsert', async (m) => {
            await this.handleIncomingMessages(m);
        });
        
        // Handle message receipts
        this.sock.ev.on('message-receipt.update', (receipts) => {
            logger.debug('Message receipts:', receipts);
        });
    }

    async handleIncomingMessages(messageUpdate) {
        const { messages } = messageUpdate;
        
        for (const message of messages) {
            try {
                // Skip if message is from bot itself or is not a regular message
                if (message.key.fromMe || !message.message) continue;
                
                const phoneNumber = message.key.remoteJid;
                
                // Additional validation: Skip if message is from bot's own number
                if (this.isBotNumber(phoneNumber)) {
                    logger.debug(`Skipping message from bot's own number: ${phoneNumber}`);
                    continue;
                }
                
                const messageText = this.extractMessageText(message);
                
                if (!messageText) continue;
                
                logger.info(`Received message from ${phoneNumber}: ${messageText}`);
                
                // Mark message as read
                await this.sock.readMessages([message.key]);
                
                // Show typing indicator
                await this.sock.sendPresenceUpdate('composing', phoneNumber);
                
                // Process the message
                await this.processMessage(phoneNumber, messageText, message);
                
            } catch (error) {
                logger.error('Error handling message:', error);
            }
        }
    }

    extractMessageText(message) {
        const messageContent = message.message;
        
        if (messageContent.conversation) {
            return messageContent.conversation;
        }
        
        if (messageContent.extendedTextMessage?.text) {
            return messageContent.extendedTextMessage.text;
        }
        
        if (messageContent.imageMessage?.caption) {
            return messageContent.imageMessage.caption;
        }
        
        if (messageContent.videoMessage?.caption) {
            return messageContent.videoMessage.caption;
        }
        
        return null;
    }

    async processMessage(phoneNumber, messageText, originalMessage) {
        try {
            // Additional security: Skip processing if message is from bot's own number
            if (this.isBotNumber(phoneNumber)) {
                logger.warn(`Attempted to process message from bot's own number: ${phoneNumber}`);
                return;
            }
            
            const db = getDatabase();
            
            // Check if it's an admin command
            if (this.isAdmin(phoneNumber) && messageText.startsWith('/admin')) {
                await this.handleAdminCommand(phoneNumber, messageText);
                return;
            }
            
            // Check for special commands
            const specialResponse = await this.aiService.processSpecialCommands(messageText, phoneNumber);
            if (specialResponse) {
                await this.sendMessage(phoneNumber, specialResponse);
                return;
            }
            
            // Analyze user intent
            const intent = await this.aiService.analyzeUserIntent(messageText);
            
            // Generate AI response
            const response = await this.aiService.getContextualResponse(phoneNumber, intent, user, messageText);
            
            // Send response
            await this.sendMessage(phoneNumber, response);
            
        } catch (error) {
            logger.error('Error processing message:', error);
            await this.sendMessage(phoneNumber, 'Maaf, terjadi kesalahan dalam memproses pesan Anda. Silakan coba lagi.');
        }
    }

    async sendMessage(phoneNumber, text, options = {}) {
        try {
            if (!this.isConnected) {
                logger.warn('Bot not connected, cannot send message');
                return false;
            }
            
            // Prevent bot from sending messages to itself
            if (this.isBotNumber(phoneNumber)) {
                logger.warn(`Prevented bot from sending message to itself: ${phoneNumber}`);
                return false;
            }
            
            // Stop typing indicator
            await this.sock.sendPresenceUpdate('paused', phoneNumber);
            
            const messageOptions = {
                text: text,
                ...options
            };
            
            await this.sock.sendMessage(phoneNumber, messageOptions);
            logger.info(`Message sent to ${phoneNumber}`);
            
            return true;
        } catch (error) {
            logger.error('Error sending message:', error);
            return false;
        }
    }

    async handleAdminCommand(phoneNumber, command) {
        const parts = command.split(' ');
        const adminCommand = parts[1];
        
        switch (adminCommand) {
            case 'stats':
                await this.sendAdminStats(phoneNumber);
                break;
                
            case 'broadcast':
                const message = parts.slice(2).join(' ');
                await this.broadcastMessage(message);
                await this.sendMessage(phoneNumber, 'Broadcast message sent successfully.');
                break;
                
            case 'users':
                await this.sendUsersList(phoneNumber);
                break;
                
            case 'cleanup':
                const db = getDatabase();
                await db.cleanup();
                await this.sendMessage(phoneNumber, 'Database cleanup completed.');
                break;
                
            case 'sessions':
                await this.handleSessionsCommand(phoneNumber, parts.slice(2));
                break;
                
            default:
                await this.sendMessage(phoneNumber, this.getAdminHelp());
        }
    }

    async sendAdminStats(phoneNumber) {
        try {
            const db = getDatabase();
            const analytics = await db.getAnalytics();
            
            const statsMessage = `📊 *Bot Statistics*\n\n` +
                               `👥 Total Users: ${analytics.totalUsers}\n` +
                               `💬 Total Messages: ${analytics.totalMessages}\n` +
                               `🤖 Bot Status: ${this.isConnected ? '✅ Online' : '❌ Offline'}\n\n` +
                               `📈 *Daily Stats (Last 7 days):*\n` +
                               this.formatDailyStats(analytics.dailyStats);
            
            await this.sendMessage(phoneNumber, statsMessage);
        } catch (error) {
            logger.error('Error sending admin stats:', error);
            await this.sendMessage(phoneNumber, 'Error retrieving statistics.');
        }
    }

    formatDailyStats(dailyStats) {
        const last7Days = Object.keys(dailyStats)
            .sort()
            .slice(-7)
            .map(date => {
                const stats = dailyStats[date];
                return `${date}: ${stats.messages} messages, ${stats.users} users`;
            })
            .join('\n');
        
        return last7Days || 'No data available';
    }

    async sendUsersList(phoneNumber) {
        try {
            const db = getDatabase();
            const users = Object.values(db.data.users)
                .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
                .slice(0, 20); // Show last 20 active users
            
            let usersList = '👥 *Active Users (Last 20):*\n\n';
            users.forEach((user, index) => {
                usersList += `${index + 1}. ${user.name}\n`;
                usersList += `   📞 ${user.phoneNumber}\n`;
                usersList += `   💬 ${user.messageCount} messages\n`;
                usersList += `   🕐 ${new Date(user.lastSeen).toLocaleString('id-ID')}\n\n`;
            });
            
            await this.sendMessage(phoneNumber, usersList);
        } catch (error) {
            logger.error('Error sending users list:', error);
            await this.sendMessage(phoneNumber, 'Error retrieving users list.');
        }
    }

    async broadcastMessage(message) {
        try {
            const db = getDatabase();
            const users = Object.keys(db.data.users);
            
            for (const phoneNumber of users) {
                try {
                    await this.sendMessage(phoneNumber, `📢 *Broadcast Message*\n\n${message}`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
                } catch (error) {
                    logger.error(`Failed to send broadcast to ${phoneNumber}:`, error);
                }
            }
            
            logger.info(`Broadcast sent to ${users.length} users`);
        } catch (error) {
            logger.error('Error broadcasting message:', error);
        }
    }

    async handleSessionsCommand(phoneNumber, args) {
        try {
            const subCommand = args[0];
            
            switch (subCommand) {
                case 'info':
                    const sessionInfo = this.aiService.getChatSessionInfo();
                    const message = `🔄 *Chat Sessions Info*\n\n` +
                                  `Total Active Sessions: ${sessionInfo.totalSessions}\n` +
                                  `Active Users: ${sessionInfo.activeUsers.length}\n\n` +
                                  `*Recent Active Users:*\n` +
                                  sessionInfo.activeUsers.slice(0, 10).map((user, i) => 
                                      `${i + 1}. ${user}`
                                  ).join('\n');
                    await this.sendMessage(phoneNumber, message);
                    break;
                    
                case 'clear':
                    const targetUser = args[1];
                    if (targetUser) {
                        const cleared = this.aiService.clearChatSession(targetUser);
                        const response = cleared ? 
                            `✅ Chat session cleared for ${targetUser}` : 
                            `❌ No active session found for ${targetUser}`;
                        await this.sendMessage(phoneNumber, response);
                    } else {
                        await this.sendMessage(phoneNumber, '❌ Please specify user phone number: /admin sessions clear <phone>');
                    }
                    break;
                    
                case 'clearall':
                    const clearedCount = this.aiService.clearAllChatSessions();
                    await this.sendMessage(phoneNumber, `✅ Cleared ${clearedCount} chat sessions`);
                    break;
                    
                case 'cleanup':
                    const cleanedCount = this.aiService.cleanupInactiveSessions();
                    await this.sendMessage(phoneNumber, `🧹 Cleaned up ${cleanedCount} inactive sessions`);
                    break;
                    
                default:
                    const helpMessage = `🔄 *Sessions Management*\n\n` +
                                      `• /admin sessions info - Show sessions info\n` +
                                      `• /admin sessions clear <phone> - Clear specific session\n` +
                                      `• /admin sessions clearall - Clear all sessions\n` +
                                      `• /admin sessions cleanup - Clean inactive sessions`;
                    await this.sendMessage(phoneNumber, helpMessage);
            }
        } catch (error) {
            logger.error('Error handling sessions command:', error);
            await this.sendMessage(phoneNumber, '❌ Error managing sessions');
        }
    }

    getAdminHelp() {
        return `🔧 *Admin Commands*\n\n` +
               `• /admin stats - Bot statistics\n` +
               `• /admin users - List active users\n` +
               `• /admin broadcast <message> - Send broadcast\n` +
               `• /admin cleanup - Clean old data\n` +
               `• /admin sessions - Manage chat sessions\n` +
               `• /admin help - Show this help`;
    }

    isAdmin(phoneNumber) {
        return this.adminNumbers.includes(phoneNumber);
    }

    /**
     * Check if the phone number belongs to the bot itself
     * @param {string} phoneNumber - Phone number to check
     * @returns {boolean} True if it's the bot's own number
     */
    isBotNumber(phoneNumber) {
        if (!this.config.bot.phoneNumber) {
            return false;
        }
        
        // Extract only digits from both numbers for comparison
        const botNumber = this.config.bot.phoneNumber.replace(/\D/g, '');
        const checkNumber = phoneNumber.replace(/\D/g, '');
        
        // Check if the phone number contains the bot's number
        return checkNumber.includes(botNumber) || botNumber.includes(checkNumber);
    }

    async sendStartupNotification() {
        const startupMessage = `🤖 *${this.config.bot.name} Started*\n\n` +
                              `Bot is now online and ready to serve customers!\n` +
                              `Time: ${new Date().toLocaleString('id-ID')}`;
        
        for (const adminNumber of this.adminNumbers) {
            try {
                await this.sendMessage(adminNumber, startupMessage);
            } catch (error) {
                logger.error(`Failed to send startup notification to ${adminNumber}:`, error);
            }
        }
    }

    async logout() {
        try {
            if (this.sock) {
                await this.sock.logout();
                this.isConnected = false;
                logger.info('WhatsApp bot logged out successfully');
            }
        } catch (error) {
            logger.error('Error during logout:', error);
        }
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            botName: this.config.bot.name
        };
    }
}

module.exports = {
    async createBot(config) {
        const bot = new WhatsAppBot(config);
        await bot.initialize();
        return bot;
    },
    WhatsAppBot
};