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
            return this.getFallbackResponse();
        }
    }

    async generateGeminiResponse(userMessage, history, user, context) {
        try {
            const model = this.gemini.getGenerativeModel({ model: this.model });
            const phoneNumber = user.phoneNumber;
            
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
                    systemInstruction: systemPrompt
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

    getFallbackResponse() {
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
        
        switch (command) {
            case '/help':
                return this.getHelpMessage();
                
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
                return "Sesi percakapan telah direset. Silakan mulai percakapan baru.";
                
            case '/status':
                const user = await db.getUser(phoneNumber);
                if (user) {
                    return `Status Anda:\nNama: ${user.name}\nTotal Pesan: ${user.messageCount}\nTerakhir Aktif: ${new Date(user.lastSeen).toLocaleString('id-ID')}\nAI Provider: ${this.provider.toUpperCase()}`;
                }
                return "Informasi pengguna tidak ditemukan.";
                
            case '/provider':
                return `🤖 *AI Provider Information*\n\nCurrent Provider: *${this.provider.toUpperCase()}*\nModel: *${this.model}*\n\nAvailable Providers:\n• Gemini (Default) - Google's latest AI\n• OpenAI - GPT models\n• Claude - Anthropic's AI assistant`;
                
            default:
                return null; // Not a special command
        }
    }

    getHelpMessage() {
        return `🤖 *Bantuan AllOneCustomerAI*\n\n` +
               `Perintah yang tersedia:\n` +
               `• /help - Menampilkan pesan bantuan ini\n` +
               `• /info - Informasi perusahaan\n` +
               `• /reset - Reset sesi percakapan\n` +
               `• /status - Lihat status akun Anda\n` +
               `• /provider - Informasi AI provider\n\n` +
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

    async getContextualResponse(intent, message, phoneNumber) {
        // Provide contextual responses based on intent
        switch (intent) {
            case 'greeting':
                return `Halo! Selamat datang di ${this.companyInfo.name}. Saya adalah asisten AI yang siap membantu Anda. Ada yang bisa saya bantu hari ini?`;
                
            case 'gratitude':
                return "Sama-sama! Senang bisa membantu Anda. Jika ada pertanyaan lain, jangan ragu untuk bertanya.";
                
            default:
                return await this.generateResponse(message, phoneNumber);
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