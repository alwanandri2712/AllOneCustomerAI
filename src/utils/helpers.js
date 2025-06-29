const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

/**
 * Utility functions for AllOneCustomerAI
 */

class Helpers {
    /**
     * Format phone number to WhatsApp format
     * @param {string} phoneNumber - Raw phone number
     * @returns {string} Formatted phone number
     */
    static formatPhoneNumber(phoneNumber) {
        // Remove all non-numeric characters
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Add country code if not present
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        } else if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }
        
        // Add WhatsApp suffix if not present
        if (!cleaned.includes('@')) {
            cleaned += '@s.whatsapp.net';
        }
        
        return cleaned;
    }

    /**
     * Extract clean phone number from WhatsApp format
     * @param {string} whatsappNumber - WhatsApp formatted number
     * @returns {string} Clean phone number
     */
    static extractPhoneNumber(whatsappNumber) {
        return whatsappNumber.replace('@s.whatsapp.net', '').replace('@c.us', '');
    }

    /**
     * Check if current time is within working hours
     * @param {string} workingHours - Working hours string (e.g., "Monday - Friday, 9 AM - 5 PM")
     * @param {string} timezone - Timezone (e.g., "Asia/Jakarta")
     * @returns {boolean} True if within working hours
     */
    static isWithinWorkingHours(workingHours = '', timezone = 'Asia/Jakarta') {
        try {
            const now = new Date().toLocaleString('en-US', { timeZone: timezone });
            const currentDate = new Date(now);
            const currentDay = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const currentHour = currentDate.getHours();
            
            // Simple check for Monday-Friday, 9 AM - 5 PM
            // This can be enhanced to parse the workingHours string more intelligently
            const isWeekday = currentDay >= 1 && currentDay <= 5;
            const isWorkingHour = currentHour >= 9 && currentHour < 17;
            
            return isWeekday && isWorkingHour;
        } catch (error) {
            logger.error('Error checking working hours:', error);
            return true; // Default to always available if error
        }
    }

    /**
     * Sanitize text for safe processing
     * @param {string} text - Input text
     * @returns {string} Sanitized text
     */
    static sanitizeText(text) {
        if (typeof text !== 'string') return '';
        
        return text
            .trim()
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .substring(0, 4000); // Limit length
    }

    /**
     * Generate unique session ID
     * @param {string} phoneNumber - Phone number
     * @returns {string} Unique session ID
     */
    static generateSessionId(phoneNumber) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const cleanNumber = this.extractPhoneNumber(phoneNumber);
        return `${cleanNumber}_${timestamp}_${random}`;
    }

    /**
     * Parse message for mentions and special formatting
     * @param {string} message - Input message
     * @returns {object} Parsed message object
     */
    static parseMessage(message) {
        const mentions = [];
        const hashtags = [];
        const urls = [];
        
        // Extract mentions (@username)
        const mentionRegex = /@([a-zA-Z0-9_]+)/g;
        let match;
        while ((match = mentionRegex.exec(message)) !== null) {
            mentions.push(match[1]);
        }
        
        // Extract hashtags (#tag)
        const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
        while ((match = hashtagRegex.exec(message)) !== null) {
            hashtags.push(match[1]);
        }
        
        // Extract URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        while ((match = urlRegex.exec(message)) !== null) {
            urls.push(match[1]);
        }
        
        return {
            originalMessage: message,
            cleanMessage: message.replace(mentionRegex, '').replace(hashtagRegex, '').trim(),
            mentions,
            hashtags,
            urls,
            hasSpecialContent: mentions.length > 0 || hashtags.length > 0 || urls.length > 0
        };
    }

    /**
     * Format message with WhatsApp markdown
     * @param {string} text - Plain text
     * @returns {string} Formatted text with WhatsApp markdown
     */
    static formatWhatsAppMessage(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold
            .replace(/__(.*?)__/g, '_$1_') // Italic
            .replace(/~~(.*?)~~/g, '~$1~') // Strikethrough
            .replace(/```([\s\S]*?)```/g, '```$1```'); // Code block
    }

    /**
     * Calculate message similarity (simple implementation)
     * @param {string} message1 - First message
     * @param {string} message2 - Second message
     * @returns {number} Similarity score (0-1)
     */
    static calculateSimilarity(message1, message2) {
        const clean1 = message1.toLowerCase().trim();
        const clean2 = message2.toLowerCase().trim();
        
        if (clean1 === clean2) return 1;
        if (clean1.length === 0 || clean2.length === 0) return 0;
        
        // Simple Levenshtein distance implementation
        const matrix = [];
        const len1 = clean1.length;
        const len2 = clean2.length;
        
        for (let i = 0; i <= len2; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= len1; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= len2; i++) {
            for (let j = 1; j <= len1; j++) {
                if (clean2.charAt(i - 1) === clean1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        const distance = matrix[len2][len1];
        const maxLength = Math.max(len1, len2);
        return 1 - (distance / maxLength);
    }

    /**
     * Validate environment configuration
     * @param {object} config - Configuration object
     * @returns {object} Validation result
     */
    static validateConfig(config) {
        const errors = [];
        const warnings = [];
        
        // Required fields
        if (!config.ai?.openaiApiKey) {
            errors.push('OpenAI API key is required');
        }
        
        if (!config.bot?.name) {
            warnings.push('Bot name not specified, using default');
        }
        
        if (!config.admin?.numbers || config.admin.numbers.length === 0) {
            warnings.push('No admin numbers configured');
        }
        
        // Validate admin numbers format
        if (config.admin?.numbers) {
            config.admin.numbers.forEach((number, index) => {
                if (!/^\+?[1-9]\d{1,14}$/.test(number.replace(/[\s-]/g, ''))) {
                    warnings.push(`Admin number ${index + 1} may have invalid format: ${number}`);
                }
            });
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Create backup of important data
     * @param {string} dataPath - Path to data directory
     * @returns {Promise<string>} Backup file path
     */
    static async createBackup(dataPath) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(dataPath, 'backups');
            const backupFile = path.join(backupDir, `backup_${timestamp}.json`);
            
            await fs.ensureDir(backupDir);
            
            const databaseFile = path.join(dataPath, 'database.json');
            if (await fs.pathExists(databaseFile)) {
                await fs.copy(databaseFile, backupFile);
                logger.info(`Backup created: ${backupFile}`);
                return backupFile;
            }
            
            return null;
        } catch (error) {
            logger.error('Error creating backup:', error);
            throw error;
        }
    }

    /**
     * Clean old backup files
     * @param {string} backupDir - Backup directory path
     * @param {number} daysToKeep - Number of days to keep backups
     */
    static async cleanOldBackups(backupDir, daysToKeep = 7) {
        try {
            if (!(await fs.pathExists(backupDir))) return;
            
            const files = await fs.readdir(backupDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            for (const file of files) {
                if (file.startsWith('backup_') && file.endsWith('.json')) {
                    const filePath = path.join(backupDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        await fs.remove(filePath);
                        logger.info(`Removed old backup: ${file}`);
                    }
                }
            }
        } catch (error) {
            logger.error('Error cleaning old backups:', error);
        }
    }

    /**
     * Rate limiting helper
     * @param {string} identifier - Unique identifier (e.g., phone number)
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} True if request is allowed
     */
    static checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
        if (!this.rateLimitStore) {
            this.rateLimitStore = new Map();
        }
        
        const now = Date.now();
        const windowStart = now - windowMs;
        
        if (!this.rateLimitStore.has(identifier)) {
            this.rateLimitStore.set(identifier, []);
        }
        
        const requests = this.rateLimitStore.get(identifier);
        
        // Remove old requests outside the window
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        
        if (validRequests.length >= maxRequests) {
            return false; // Rate limit exceeded
        }
        
        // Add current request
        validRequests.push(now);
        this.rateLimitStore.set(identifier, validRequests);
        
        return true; // Request allowed
    }
}

module.exports = Helpers;