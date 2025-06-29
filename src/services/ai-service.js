const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const { getDatabase } = require('../database/database-manager');

class AIService {
    constructor(config) {
        this.config = config;
        this.provider = config.ai.provider || 'gemini';
        this.systemPrompt = config.customPrompts.systemPrompt;
        this.companyInfo = config.companyInfo;
        this.customPrompts = config.customPrompts;
        this.languages = config.languages;
        this.defaultLanguage = config.language;
        this.maxResponseLength = config.ai.maxResponseLength;
        
        // Store chat sessions for Gemini (to maintain history)
        this.chatSessions = new Map();
        
        // Initialize AI clients based on provider
        this.initializeAIClients();
    }

    initializeAIClients() {
        try {
            switch (this.provider.toLowerCase()) {
                case 'gemini':
                    if (!this.config.ai.gemini.apiKey) {
                        throw new Error('Gemini API key is required');
                    }
                    this.gemini = new GoogleGenerativeAI(this.config.ai.gemini.apiKey);
                    this.model = this.config.ai.gemini.model;
                    logger.info('Initialized Gemini AI client');
                    break;
                    
                case 'openai':
                    if (!this.config.ai.openai.apiKey) {
                        throw new Error('OpenAI API key is required');
                    }
                    this.openai = new OpenAI({
                        apiKey: this.config.ai.openai.apiKey
                    });
                    this.model = this.config.ai.openai.model;
                    logger.info('Initialized OpenAI client');
                    break;
                    
                case 'claude':
                    if (!this.config.ai.claude.apiKey) {
                        throw new Error('Claude API key is required');
                    }
                    this.claude = new Anthropic({
                        apiKey: this.config.ai.claude.apiKey
                    });
                    this.model = this.config.ai.claude.model;
                    logger.info('Initialized Claude client');
                    break;
                    
                default:
                    throw new Error(`Unsupported AI provider: ${this.provider}`);
            }
        } catch (error) {
            logger.error('Failed to initialize AI client:', error);
            throw error;
        }
    }

    async generateResponse(userMessage, phoneNumber, context = {}) {
        try {
            // Check for special commands first
            const specialResponse = await this.processSpecialCommands(userMessage, phoneNumber);
            if (specialResponse) {
                return specialResponse;
            }

            const db = getDatabase();
            
            // Get user information
            let user = await db.getUser(phoneNumber);
            if (!user) {
                user = await db.createUser(phoneNumber);
            }
            
            // Get conversation history
            const conversationHistory = await db.getConversationHistory(phoneNumber, 10);
            
            // Auto-detect language from message
            const userLanguage = await this.getUserLanguage(phoneNumber, message);
            
            // Generate AI response based on provider
            let aiResponse;
            switch (this.provider.toLowerCase()) {
                case 'gemini':
                    aiResponse = await this.generateGeminiResponse(userMessage, conversationHistory, user, context);
                    break;
                case 'openai':
                    aiResponse = await this.generateOpenAIResponse(userMessage, conversationHistory, user, context);
                    break;
                case 'claude':
                    aiResponse = await this.generateClaudeResponse(userMessage, conversationHistory, user, context);
                    break;
                default:
                    throw new Error(`Unsupported AI provider: ${this.provider}`);
            }
            
            // Save messages to database
            await db.saveMessage(phoneNumber, userMessage, true);
            await db.saveMessage(phoneNumber, aiResponse, false);
            
            // Update user activity
            await db.updateUser(phoneNumber, {
                lastSeen: new Date().toISOString()
            });
            
            logger.info(`AI response generated for ${phoneNumber} using ${this.provider}`);
            return aiResponse;
            
        } catch (error) {
            logger.error('Error generating AI response:', error);
            return await this.getFallbackResponse(phoneNumber);
        }
    }

    async generateGeminiResponse(userMessage, history, user, context) {
        try {
            const model = this.gemini.getGenerativeModel({ model: this.model });
            const phoneNumber = user.phoneNumber;
            
            // Get localized system prompt
            const localizedSystemPrompt = await this.getLocalizedSystemPrompt(phoneNumber);
            
            // Get or create chat session for this user
            let chatSession = this.chatSessions.get(phoneNumber);
            
            if (!chatSession) {
                // Build system prompt
                const systemPrompt = this.buildSystemPrompt(user, context);
                
                // Start new chat session with system prompt
                chatSession = model.startChat({
                    history: [],
                    generationConfig: {
                        maxOutputTokens: Math.min(this.maxResponseLength, 1000),
                        temperature: 0.7,
                    },
                    systemInstruction: localizedSystemPrompt
                });
                
                // If there's existing history, add it to the chat session
                if (history && history.length > 0) {
                    for (const msg of history) {
                        try {
                            if (msg.isFromUser) {
                                await chatSession.sendMessage(msg.content);
                            }
                        } catch (error) {
                            logger.warn('Failed to add history message to chat session:', error);
                        }
                    }
                }
                
                this.chatSessions.set(phoneNumber, chatSession);
                logger.info(`Created new Gemini chat session for ${phoneNumber}`);
            }
            
            // Send message and get response
            const result = await chatSession.sendMessage(userMessage);
            const response = await result.response;
            
            return response.text().trim();
        } catch (error) {
            logger.error('Gemini API error:', error);
            // If there's an error, remove the chat session so it can be recreated
            this.chatSessions.delete(user.phoneNumber);
            throw error;
        }
    }

    async generateOpenAIResponse(userMessage, history, user, context) {
        try {
            // Build conversation context
            const messages = this.buildConversationContext(userMessage, history, user, context);
            
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: messages,
                max_tokens: Math.min(this.maxResponseLength, 1000),
                temperature: 0.7,
                presence_penalty: 0.1,
                frequency_penalty: 0.1
            });
            
            return response.choices[0].message.content.trim();
        } catch (error) {
            logger.error('OpenAI API error:', error);
            throw error;
        }
    }

    async generateClaudeResponse(userMessage, history, user, context) {
        try {
            // Build conversation context
            const messages = this.buildConversationContext(userMessage, history, user, context);
            
            // Extract system message and user messages for Claude
            const systemMessage = messages.find(m => m.role === 'system')?.content || '';
            const userMessages = messages.filter(m => m.role !== 'system');
            
            const response = await this.claude.messages.create({
                model: this.model,
                max_tokens: Math.min(this.maxResponseLength, 1000),
                system: systemMessage,
                messages: userMessages
            });
            
            return response.content[0].text.trim();
        } catch (error) {
            logger.error('Claude API error:', error);
            throw error;
        }
    }

    buildConversationContext(currentMessage, history, user, context) {
        const messages = [];
        
        // System prompt with company information
        const systemMessage = this.buildSystemPrompt(user, context);
        messages.push({
            role: 'system',
            content: systemMessage
        });
        
        // Add conversation history
        history.forEach(msg => {
            messages.push({
                role: msg.isFromUser ? 'user' : 'assistant',
                content: msg.content
            });
        });
        
        // Add current message
        messages.push({
            role: 'user',
            content: currentMessage
        });
        
        return messages;
    }

    buildConversationText(currentMessage, history, systemPrompt) {
        let conversationText = systemPrompt + '\n\n';
        
        // Add conversation history
        history.forEach(msg => {
            const role = msg.isFromUser ? 'User' : 'Assistant';
            conversationText += `${role}: ${msg.content}\n`;
        });
        
        // Add current message
        conversationText += `User: ${currentMessage}\nAssistant:`;
        
        return conversationText;
    }

    buildSystemPrompt(user, context) {
        let prompt = this.systemPrompt;
        
        // Add company information
        prompt += `\n\nInformasi Perusahaan:\n`;
        prompt += `Nama: ${this.companyInfo.name}\n`;
        prompt += `Deskripsi: ${this.companyInfo.description}\n`;
        prompt += `Jam Kerja: ${this.companyInfo.workingHours}\n`;
        prompt += `Kontak: Email: ${this.companyInfo.contact.email}, Phone: ${this.companyInfo.contact.phone}\n`;
        if (this.companyInfo.contact.website) {
            prompt += `Website: ${this.companyInfo.contact.website}\n`;
        }
        
        // Add user context
        if (user.name && user.name !== 'Unknown') {
            prompt += `\nNama pelanggan: ${user.name}\n`;
        }
        
        // Add custom context
        if (context.additionalInfo) {
            prompt += `\nInformasi tambahan: ${context.additionalInfo}\n`;
        }
        
        // Add behavioral guidelines
        prompt += `\nPanduan Perilaku:\n`;
        prompt += `- Selalu gunakan bahasa Indonesia yang sopan dan profesional\n`;
        prompt += `- Berikan jawaban yang membantu dan informatif\n`;
        prompt += `- Jika tidak tahu jawaban, arahkan ke kontak yang tepat\n`;
        prompt += `- Jangan memberikan informasi yang tidak akurat\n`;
        prompt += `- Tanyakan klarifikasi jika pertanyaan tidak jelas\n`;
        
        return prompt;
    }

    async getFallbackResponse(phoneNumber = null) {
        if (phoneNumber) {
            return await this.getLocalizedMessage(phoneNumber, 'fallback');
        }
        
        // Fallback to default Indonesian message if no phoneNumber provided
        const fallbackMessages = [
            "Maaf, saya sedang mengalami gangguan teknis. Silakan coba lagi dalam beberapa saat.",
            "Mohon maaf atas ketidaknyamanan ini. Tim teknis kami sedang memperbaiki sistem.",
            "Saya tidak dapat memproses permintaan Anda saat ini. Silakan hubungi customer service kami langsung."
        ];
        
        return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    }

    async processSpecialCommands(message, phoneNumber) {
        const command = message.toLowerCase().trim();
        const db = getDatabase();
        
        // Handle language command with parameter
        if (command.startsWith('/language')) {
            const parts = command.split(' ');
            if (parts.length === 1) {
                // Show language options
                return await this.getLocalizedMessage(phoneNumber, 'languageList');
            } else {
                // Set language
                const langCode = parts[1];
                if (this.languages[langCode]) {
                    await this.setUserLanguage(phoneNumber, langCode);
                    return await this.getLocalizedMessage(phoneNumber, 'languageChanged');
                } else {
                    return await this.getLocalizedMessage(phoneNumber, 'languageList');
                }
            }
        }
        
        switch (command) {
            case '/help':
                return await this.getLocalizedMessage(phoneNumber, 'help');
                
            case '/info':
                return this.getCompanyInfo();
                
            case '/reset':
                // Clear user session
                const session = await db.getActiveSession(phoneNumber);
                if (session) {
                    await db.closeSession(session.id);
                }
                // Clear Gemini chat session if exists
                this.clearChatSession(phoneNumber);
                return await this.getLocalizedMessage(phoneNumber, 'reset');
                
            case '/status':
                const user = await db.getUser(phoneNumber);
                if (user) {
                    const userLanguage = await this.getUserLanguage(phoneNumber);
                    const languageName = this.languages[userLanguage]?.name || userLanguage;
                    return await this.getLocalizedMessage(phoneNumber, 'status', {
                        name: user.name,
                        messageCount: user.messageCount,
                        lastSeen: new Date(user.lastSeen).toLocaleString('id-ID'),
                        language: languageName,
                        provider: this.provider.toUpperCase()
                    });
                }
                return await this.getLocalizedMessage(phoneNumber, 'userNotFound');
                
            case '/provider':
                return `🤖 *AI Provider Information*\n\nCurrent Provider: *${this.provider.toUpperCase()}*\nModel: *${this.model}*\n\nAvailable Providers:\n• Gemini (Default) - Google's latest AI\n• OpenAI - GPT models\n• Claude - Anthropic's AI assistant`;
                
            default:
                return null; // Not a special command
        }
    }

    /**
     * Detect language from message text using simple heuristics
     * @param {string} text - Message text to analyze
     * @returns {string|null} Detected language code or null
     */
    detectLanguage(text) {
        if (!text || text.trim().length < 3) return null;
        
        const cleanText = text.toLowerCase().trim();
        
        // English indicators
        const englishWords = [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'thank you', 'thanks', 'please', 'help', 'how are you', 'what', 'where',
            'when', 'why', 'how', 'can you', 'could you', 'would you', 'i need',
            'i want', 'i have', 'problem', 'issue', 'question', 'information',
            'service', 'product', 'price', 'cost', 'buy', 'purchase', 'order'
        ];
        
        // Indonesian indicators
        const indonesianWords = [
            'halo', 'hai', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam',
            'terima kasih', 'makasih', 'tolong', 'bantuan', 'apa kabar', 'apa', 'dimana',
            'kapan', 'mengapa', 'kenapa', 'bagaimana', 'gimana', 'bisa', 'bisakah',
            'saya perlu', 'saya mau', 'saya punya', 'masalah', 'pertanyaan', 'informasi',
            'layanan', 'produk', 'harga', 'beli', 'pesan', 'order', 'dan', 'atau',
            'dengan', 'untuk', 'dari', 'ke', 'di', 'pada', 'yang', 'ini', 'itu'
        ];
        
        let englishScore = 0;
        let indonesianScore = 0;
        
        // Count matches for each language
        englishWords.forEach(word => {
            if (cleanText.includes(word)) {
                englishScore += word.length; // Longer words get higher score
            }
        });
        
        indonesianWords.forEach(word => {
            if (cleanText.includes(word)) {
                indonesianScore += word.length;
            }
        });
        
        // Additional heuristics
        // Check for common English patterns
        if (/\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/g.test(cleanText)) {
            englishScore += 5;
        }
        
        // Check for common Indonesian patterns
        if (/\b(yang|dan|atau|dengan|untuk|dari|ke|di|pada|ini|itu)\b/g.test(cleanText)) {
            indonesianScore += 5;
        }
        
        // Determine language based on scores
        if (englishScore > indonesianScore && englishScore > 3) {
            return 'en';
        } else if (indonesianScore > englishScore && indonesianScore > 3) {
            return 'id';
        }
        
        return null; // Unable to detect with confidence
    }
    
    async setUserLanguage(phoneNumber, languageCode) {
        const db = getDatabase();
        const user = await db.getUser(phoneNumber);
        
        if (user) {
            // Update user preferences with language preference
            const preferences = user.preferences || {};
            preferences.language = languageCode;
            
            await db.updateUser(phoneNumber, { preferences });
            logger.info(`Language preference set to ${languageCode} for user ${phoneNumber}`);
            return true;
        }
        return false;
    }
    
    getHelpMessage() {
        // Deprecated - use getLocalizedMessage instead
        return `🤖 *Bantuan AllOneCustomerAI*\n\n` +
               `Perintah yang tersedia:\n` +
               `• /help - Menampilkan pesan bantuan ini\n` +
               `• /info - Informasi perusahaan\n` +
               `• /reset - Reset sesi percakapan\n` +
               `• /status - Lihat status akun Anda\n` +
               `• /provider - Informasi AI provider\n` +
               `• /language - Mengubah bahasa\n\n` +
               `Anda juga dapat mengirim pesan biasa untuk berbicara dengan AI customer service kami.\n\n` +
               `*Powered by ${this.provider.toUpperCase()}*`;
    }

    getCompanyInfo() {
        return `🏢 *${this.companyInfo.name}*\n\n` +
               `${this.companyInfo.description}\n\n` +
               `📅 *Jam Kerja:* ${this.companyInfo.workingHours}\n` +
               `📧 *Email:* ${this.companyInfo.contact.email}\n` +
               `📞 *Telepon:* ${this.companyInfo.contact.phone}\n` +
               (this.companyInfo.contact.website ? `🌐 *Website:* ${this.companyInfo.contact.website}\n` : '') +
               `\n*AI Assistant powered by ${this.provider.toUpperCase()}*`;
    }

    async analyzeUserIntent(message) {
        // Simple intent analysis - can be enhanced with more sophisticated NLP
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('harga') || lowerMessage.includes('biaya') || lowerMessage.includes('tarif')) {
            return 'pricing_inquiry';
        }
        
        if (lowerMessage.includes('produk') || lowerMessage.includes('layanan') || lowerMessage.includes('service')) {
            return 'product_inquiry';
        }
        
        if (lowerMessage.includes('komplain') || lowerMessage.includes('masalah') || lowerMessage.includes('error')) {
            return 'complaint';
        }
        
        if (lowerMessage.includes('terima kasih') || lowerMessage.includes('thanks')) {
            return 'gratitude';
        }
        
        if (lowerMessage.includes('halo') || lowerMessage.includes('hai') || lowerMessage.includes('hello')) {
            return 'greeting';
        }
        
        return 'general_inquiry';
    }

    async getContextualResponse(phoneNumber, intent, user, messageText = null) {
        // For new users (first message), send welcome message
        if (user && user.messageCount === 1) {
            return await this.getLocalizedMessage(phoneNumber, 'welcomeMessage');
        }
        
        // Handle different intents with localized messages
        switch (intent) {
            case 'greeting':
                return await this.getLocalizedMessage(phoneNumber, 'greeting');
            case 'gratitude':
                return await this.getLocalizedMessage(phoneNumber, 'gratitude');
            default:
                return null;
        }
    }

    // Method to switch AI provider dynamically (for admin use)
    async switchProvider(newProvider, config) {
        if (!['gemini', 'openai', 'claude'].includes(newProvider.toLowerCase())) {
            throw new Error(`Unsupported AI provider: ${newProvider}`);
        }
        
        this.provider = newProvider.toLowerCase();
        this.config.ai.provider = this.provider;
        
        // Reinitialize AI clients
        this.initializeAIClients();
        
        logger.info(`AI provider switched to: ${this.provider}`);
        return `AI provider berhasil diubah ke: ${this.provider.toUpperCase()}`;
    }

    getProviderInfo() {
        return {
            current: this.provider,
            model: this.model,
            available: ['gemini', 'openai', 'claude']
        };
    }

    // Chat Session Management Methods for Gemini
    clearChatSession(phoneNumber) {
        if (this.chatSessions.has(phoneNumber)) {
            this.chatSessions.delete(phoneNumber);
            logger.info(`Cleared Gemini chat session for ${phoneNumber}`);
            return true;
        }
        return false;
    }

    getChatSessionInfo() {
        return {
            totalSessions: this.chatSessions.size,
            activeUsers: Array.from(this.chatSessions.keys())
        };
    }

    /**
     * Get user's preferred language
     * @param {string} phoneNumber - User's phone number
     * @param {string} messageText - Optional message text for auto-detection
     * @returns {Promise<string>} Language code
     */
    async getUserLanguage(phoneNumber, messageText = null) {
        const db = getDatabase();
        const user = await db.getUser(phoneNumber);
        
        // If user has explicitly set a language preference, use it
        if (user && user.preferences && user.preferences.language) {
            return user.preferences.language;
        }
        
        // Auto-detect language from message if provided
        if (messageText) {
            const detectedLanguage = this.detectLanguage(messageText);
            if (detectedLanguage && detectedLanguage !== this.defaultLanguage) {
                // Auto-save detected language as user preference
                await this.setUserLanguage(phoneNumber, detectedLanguage);
                return detectedLanguage;
            }
        }
        
        return this.defaultLanguage;
    }

    /**
     * Get localized message
     * @param {string} phoneNumber - User's phone number
     * @param {string} messageKey - Message key
     * @param {Object} placeholders - Parameters for message formatting
     * @returns {Promise<string>} Localized message
     */
    async getLocalizedMessage(phoneNumber, messageKey, placeholders = {}) {
        const userLanguage = await this.getUserLanguage(phoneNumber);
        const languageData = this.languages[userLanguage] || this.languages[this.defaultLanguage];
        
        let message = languageData.messages[messageKey] || languageData.messages.fallback;
        
        // Add default placeholders
        const defaultPlaceholders = {
            companyName: this.companyInfo.name,
            ...placeholders
        };
        
        // Replace placeholders
        for (const [key, value] of Object.entries(defaultPlaceholders)) {
            message = message.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        
        return message;
    }

    /**
     * Get system prompt for user's language
     * @param {string} phoneNumber - User's phone number
     * @returns {Promise<string>} Localized system prompt
     */
    async getLocalizedSystemPrompt(phoneNumber) {
        const userLanguage = await this.getUserLanguage(phoneNumber);
        const language = this.languages[userLanguage] || this.languages[this.defaultLanguage];
        return language.systemPrompt || this.systemPrompt;
    }

    // Clean up inactive chat sessions (call this periodically)
    cleanupInactiveSessions(inactiveThresholdMs = 24 * 60 * 60 * 1000) { // 24 hours default
        const now = Date.now();
        let cleanedCount = 0;
        
        // Note: This is a simple cleanup. In production, you might want to track
        // last activity time for each session
        for (const [phoneNumber, session] of this.chatSessions.entries()) {
            // For now, we'll keep all sessions. In a real implementation,
            // you'd track last activity time and clean based on that
            // This method is here for future enhancement
        }
        
        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} inactive Gemini chat sessions`);
        }
        
        return cleanedCount;
    }

    // Clear all chat sessions (useful for maintenance)
    clearAllChatSessions() {
        const count = this.chatSessions.size;
        this.chatSessions.clear();
        logger.info(`Cleared all ${count} Gemini chat sessions`);
        return count;
    }
}

module.exports = AIService;