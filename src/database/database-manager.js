const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

class DatabaseManager {
    constructor(config) {
        this.config = config;
        this.data = {
            users: {},
            conversations: {},
            sessions: {},
            analytics: {
                totalMessages: 0,
                totalUsers: 0,
                dailyStats: {}
            }
        };
        this.dbPath = config.path;
    }

    async initialize() {
        try {
            // Ensure database directory exists
            await fs.ensureDir(path.dirname(this.dbPath));
            
            // Load existing data if file exists
            if (await fs.pathExists(this.dbPath)) {
                const existingData = await fs.readJson(this.dbPath);
                this.data = { ...this.data, ...existingData };
                logger.info(`Database loaded from ${this.dbPath}`);
            } else {
                // Create new database file
                await this.save();
                logger.info(`New database created at ${this.dbPath}`);
            }
        } catch (error) {
            logger.error('Failed to initialize database:', error);
            throw error;
        }
    }

    async save() {
        try {
            await fs.writeJson(this.dbPath, this.data, { spaces: 2 });
        } catch (error) {
            logger.error('Failed to save database:', error);
            throw error;
        }
    }

    // User management
    async getUser(phoneNumber) {
        return this.data.users[phoneNumber] || null;
    }

    async createUser(phoneNumber, userData = {}) {
        const user = {
            phoneNumber,
            name: userData.name || 'Unknown',
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            messageCount: 0,
            preferences: userData.preferences || {},
            ...userData
        };
        
        this.data.users[phoneNumber] = user;
        this.data.analytics.totalUsers = Object.keys(this.data.users).length;
        await this.save();
        
        logger.info(`New user created: ${phoneNumber}`);
        return user;
    }

    async updateUser(phoneNumber, updates) {
        if (this.data.users[phoneNumber]) {
            this.data.users[phoneNumber] = {
                ...this.data.users[phoneNumber],
                ...updates,
                lastSeen: new Date().toISOString()
            };
            await this.save();
            return this.data.users[phoneNumber];
        }
        return null;
    }

    // Conversation management
    async saveMessage(phoneNumber, message, isFromUser = true) {
        const conversationId = phoneNumber;
        
        if (!this.data.conversations[conversationId]) {
            this.data.conversations[conversationId] = {
                phoneNumber,
                messages: [],
                createdAt: new Date().toISOString(),
                lastMessageAt: new Date().toISOString()
            };
        }

        const messageData = {
            id: Date.now().toString(),
            content: message,
            isFromUser,
            timestamp: new Date().toISOString(),
            type: 'text'
        };

        this.data.conversations[conversationId].messages.push(messageData);
        this.data.conversations[conversationId].lastMessageAt = messageData.timestamp;
        
        // Update analytics
        this.data.analytics.totalMessages++;
        const today = new Date().toISOString().split('T')[0];
        if (!this.data.analytics.dailyStats[today]) {
            this.data.analytics.dailyStats[today] = { messages: 0, users: new Set() };
        }
        this.data.analytics.dailyStats[today].messages++;
        this.data.analytics.dailyStats[today].users.add(phoneNumber);
        
        // Update user message count
        if (this.data.users[phoneNumber]) {
            this.data.users[phoneNumber].messageCount++;
            this.data.users[phoneNumber].lastSeen = messageData.timestamp;
        }
        
        await this.save();
        return messageData;
    }

    async getConversation(phoneNumber, limit = 50) {
        const conversation = this.data.conversations[phoneNumber];
        if (!conversation) return null;
        
        return {
            ...conversation,
            messages: conversation.messages.slice(-limit)
        };
    }

    async getConversationHistory(phoneNumber, limit = 10) {
        const conversation = await this.getConversation(phoneNumber, limit);
        return conversation ? conversation.messages : [];
    }

    // Session management
    async createSession(phoneNumber, sessionData = {}) {
        const sessionId = `${phoneNumber}_${Date.now()}`;
        const session = {
            id: sessionId,
            phoneNumber,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            context: {},
            isActive: true,
            ...sessionData
        };
        
        this.data.sessions[sessionId] = session;
        await this.save();
        
        return session;
    }

    async getActiveSession(phoneNumber) {
        const sessions = Object.values(this.data.sessions)
            .filter(session => session.phoneNumber === phoneNumber && session.isActive)
            .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
        
        return sessions[0] || null;
    }

    async updateSession(sessionId, updates) {
        if (this.data.sessions[sessionId]) {
            this.data.sessions[sessionId] = {
                ...this.data.sessions[sessionId],
                ...updates,
                lastActivity: new Date().toISOString()
            };
            await this.save();
            return this.data.sessions[sessionId];
        }
        return null;
    }

    async closeSession(sessionId) {
        return await this.updateSession(sessionId, { isActive: false });
    }

    // Analytics
    async getAnalytics() {
        // Convert Set objects to arrays for JSON serialization
        const analytics = { ...this.data.analytics };
        Object.keys(analytics.dailyStats).forEach(date => {
            if (analytics.dailyStats[date].users instanceof Set) {
                analytics.dailyStats[date].users = analytics.dailyStats[date].users.size;
            }
        });
        
        return analytics;
    }

    // Cleanup old data
    async cleanup(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffISO = cutoffDate.toISOString();
        
        // Clean old conversations
        Object.keys(this.data.conversations).forEach(conversationId => {
            const conversation = this.data.conversations[conversationId];
            conversation.messages = conversation.messages.filter(
                message => message.timestamp > cutoffISO
            );
            
            if (conversation.messages.length === 0) {
                delete this.data.conversations[conversationId];
            }
        });
        
        // Clean old sessions
        Object.keys(this.data.sessions).forEach(sessionId => {
            const session = this.data.sessions[sessionId];
            if (session.lastActivity < cutoffISO) {
                delete this.data.sessions[sessionId];
            }
        });
        
        await this.save();
        logger.info(`Database cleanup completed, kept data from last ${daysToKeep} days`);
    }
}

let databaseInstance = null;

module.exports = {
    async initializeDatabase(config) {
        if (!databaseInstance) {
            databaseInstance = new DatabaseManager(config);
            await databaseInstance.initialize();
        }
        return databaseInstance;
    },
    
    getDatabase() {
        if (!databaseInstance) {
            throw new Error('Database not initialized. Call initializeDatabase first.');
        }
        return databaseInstance;
    }
};