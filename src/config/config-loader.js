const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

class ConfigLoader {
    constructor() {
        this.config = null;
    }

    async loadConfig() {
        if (this.config) {
            return this.config;
        }

        try {
            // Load environment variables
            const envConfig = this.loadEnvironmentConfig();
            
            // Load custom prompts
            const customPrompts = await this.loadCustomPrompts();
            
            // Load company information
            const companyInfo = await this.loadCompanyInfo();
            
            this.config = {
                bot: {
                    name: envConfig.BOT_NAME || 'AllOneCustomerAI',
                    phoneNumber: envConfig.BOT_PHONE_NUMBER,
                    sessionTimeout: parseInt(envConfig.SESSION_TIMEOUT) || 1800000
                },
                ai: {
                    provider: envConfig.AI_PROVIDER || 'gemini',
                    maxResponseLength: parseInt(envConfig.MAX_RESPONSE_LENGTH) || 1000,
                    gemini: {
                        apiKey: envConfig.GEMINI_API_KEY,
                        model: envConfig.GEMINI_MODEL || 'gemini-2.0-flash-exp'
                    },
                    openai: {
                        apiKey: envConfig.OPENAI_API_KEY,
                        model: envConfig.OPENAI_MODEL || 'gpt-4o-mini'
                    },
                    claude: {
                        apiKey: envConfig.CLAUDE_API_KEY,
                        model: envConfig.CLAUDE_MODEL || 'claude-3-haiku-20240307'
                    }
                },
                admin: {
                    numbers: envConfig.ADMIN_NUMBERS ? envConfig.ADMIN_NUMBERS.split(',') : []
                },
                database: {
                    type: envConfig.DB_TYPE || 'json',
                    path: envConfig.DB_PATH || './data/database.json'
                },
                logging: {
                    level: envConfig.LOG_LEVEL || 'info',
                    file: envConfig.LOG_FILE || './logs/bot.log'
                },
                language: envConfig.DEFAULT_LANGUAGE || 'id',
                customPrompts,
                companyInfo
            };
            
            return this.config;
        } catch (error) {
            throw new Error(`Failed to load configuration: ${error.message}`);
        }
    }

    loadEnvironmentConfig() {
        const aiProvider = process.env.AI_PROVIDER || 'gemini';
        let requiredEnvVars = [];
        
        // Set required API key based on selected provider
        switch (aiProvider.toLowerCase()) {
            case 'gemini':
                requiredEnvVars = ['GEMINI_API_KEY'];
                break;
            case 'openai':
                requiredEnvVars = ['OPENAI_API_KEY'];
                break;
            case 'claude':
                requiredEnvVars = ['CLAUDE_API_KEY'];
                break;
            default:
                throw new Error(`Unsupported AI provider: ${aiProvider}. Supported providers: gemini, openai, claude`);
        }
        
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables for ${aiProvider}: ${missingVars.join(', ')}`);
        }
        
        return process.env;
    }

    async loadCustomPrompts() {
        const promptsPath = process.env.CUSTOM_PROMPT_FILE || './config/custom-prompts.json';
        
        try {
            if (await fs.pathExists(promptsPath)) {
                return await fs.readJson(promptsPath);
            }
        } catch (error) {
            console.warn(`Could not load custom prompts from ${promptsPath}:`, error.message);
        }
        
        // Return default prompts
        return {
            systemPrompt: "You are a helpful customer service assistant. Always be polite, professional, and helpful.",
            welcomeMessage: "Hello! I'm your AI customer service assistant. How can I help you today?",
            fallbackMessage: "I'm sorry, I didn't understand that. Could you please rephrase your question?",
            goodbyeMessage: "Thank you for contacting us. Have a great day!"
        };
    }

    async loadCompanyInfo() {
        const companyInfoPath = process.env.COMPANY_INFO_FILE || './config/company-info.json';
        
        try {
            if (await fs.pathExists(companyInfoPath)) {
                return await fs.readJson(companyInfoPath);
            }
        } catch (error) {
            console.warn(`Could not load company info from ${companyInfoPath}:`, error.message);
        }
        
        // Return default company info
        return {
            name: "Your Company",
            description: "We provide excellent customer service",
            workingHours: "Monday - Friday, 9 AM - 5 PM",
            contact: {
                email: "info@yourcompany.com",
                phone: "+62xxxxxxxxxx",
                website: "https://yourcompany.com"
            }
        };
    }

    getConfig() {
        return this.config;
    }
}

const configLoader = new ConfigLoader();

module.exports = {
    loadConfig: () => configLoader.loadConfig(),
    getConfig: () => configLoader.getConfig()
};