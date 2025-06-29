#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Development tools for AllOneCustomerAI
 * Provides utilities for testing, debugging, and development
 */

class DevTools {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.configDir = path.join(this.projectRoot, 'config');
        this.dataDir = path.join(this.projectRoot, 'data');
        this.logsDir = path.join(this.projectRoot, 'logs');
    }

    async testAIService() {
        console.log('🤖 Testing AI Service...');
        console.log('========================\n');

        try {
            // Load configuration
            const ConfigLoader = require('../src/config/config-loader');
            const AIService = require('../src/services/ai-service');
            
            const config = await ConfigLoader.loadConfig();
            const aiService = new AIService(config);
            
            // Test basic response
            console.log('📝 Testing basic AI response...');
            const testMessage = 'Hello, I need help with your services';
            const response = await aiService.generateResponse(testMessage, 'test-user', []);
            
            console.log(`Input: ${testMessage}`);
            console.log(`Output: ${response}\n`);
            
            // Test intent analysis
            console.log('🎯 Testing intent analysis...');
            const intent = await aiService.analyzeIntent(testMessage);
            console.log(`Intent: ${intent}\n`);
            
            // Test special commands
            console.log('⚡ Testing special commands...');
            const commands = ['/help', '/info', '/status'];
            
            for (const command of commands) {
                const cmdResponse = await aiService.generateResponse(command, 'test-user', []);
                console.log(`Command: ${command}`);
                console.log(`Response: ${cmdResponse.substring(0, 100)}...\n`);
            }
            
            console.log('✅ AI Service test completed successfully!');
            
        } catch (error) {
            console.error('❌ AI Service test failed:', error.message);
            throw error;
        }
    }

    async testDatabase() {
        console.log('💾 Testing Database Manager...');
        console.log('==============================\n');

        try {
            const DatabaseManager = require('../src/database/database-manager');
            const dbManager = new DatabaseManager();
            
            await dbManager.initialize();
            
            // Test user operations
            console.log('👤 Testing user operations...');
            const testUser = {
                phoneNumber: '+6281234567890',
                name: 'Test User',
                joinedAt: new Date().toISOString()
            };
            
            await dbManager.saveUser(testUser.phoneNumber, testUser);
            const retrievedUser = await dbManager.getUser(testUser.phoneNumber);
            console.log(`Saved and retrieved user: ${retrievedUser.name}`);
            
            // Test conversation operations
            console.log('💬 Testing conversation operations...');
            const testConversation = {
                userId: testUser.phoneNumber,
                message: 'Test message',
                response: 'Test response',
                timestamp: new Date().toISOString()
            };
            
            await dbManager.saveConversation(testUser.phoneNumber, testConversation);
            const conversations = await dbManager.getConversations(testUser.phoneNumber);
            console.log(`Saved conversation, total: ${conversations.length}`);
            
            // Test analytics
            console.log('📊 Testing analytics...');
            await dbManager.updateAnalytics('message_sent');
            const analytics = await dbManager.getAnalytics();
            console.log(`Analytics updated, total messages: ${analytics.totalMessages}`);
            
            console.log('\n✅ Database test completed successfully!');
            
        } catch (error) {
            console.error('❌ Database test failed:', error.message);
            throw error;
        }
    }

    async testConfiguration() {
        console.log('⚙️  Testing Configuration...');
        console.log('============================\n');

        try {
            const ConfigLoader = require('../src/config/config-loader');
            
            console.log('📋 Loading configuration...');
            const config = await ConfigLoader.loadConfig();
            
            console.log('✅ Configuration loaded successfully');
            console.log(`Bot Name: ${config.botName}`);
            console.log(`OpenAI Model: ${config.openai.model}`);
            console.log(`Default Language: ${config.defaultLanguage}`);
            console.log(`Custom Prompts: ${Object.keys(config.customPrompts).length} prompts`);
            console.log(`Company Info: ${config.companyInfo.name}\n`);
            
            // Validate required fields
            console.log('🔍 Validating required fields...');
            const requiredFields = [
                'botName',
                'openai.apiKey',
                'openai.model',
                'defaultLanguage'
            ];
            
            for (const field of requiredFields) {
                const value = this.getNestedValue(config, field);
                const isValid = value && value !== 'your_openai_api_key_here';
                console.log(`${isValid ? '✅' : '❌'} ${field}: ${isValid ? 'Valid' : 'Missing or invalid'}`);
            }
            
            console.log('\n✅ Configuration test completed!');
            
        } catch (error) {
            console.error('❌ Configuration test failed:', error.message);
            throw error;
        }
    }

    async generateTestData() {
        console.log('🎲 Generating test data...');
        console.log('==========================\n');

        try {
            const DatabaseManager = require('../src/database/database-manager');
            const dbManager = new DatabaseManager();
            
            await dbManager.initialize();
            
            // Generate test users
            const testUsers = [
                { phoneNumber: '+6281234567890', name: 'John Doe', joinedAt: new Date().toISOString() },
                { phoneNumber: '+6281234567891', name: 'Jane Smith', joinedAt: new Date().toISOString() },
                { phoneNumber: '+6281234567892', name: 'Bob Johnson', joinedAt: new Date().toISOString() }
            ];
            
            console.log('👥 Creating test users...');
            for (const user of testUsers) {
                await dbManager.saveUser(user.phoneNumber, user);
                console.log(`   Created user: ${user.name}`);
            }
            
            // Generate test conversations
            console.log('\n💬 Creating test conversations...');
            const testMessages = [
                'Hello, I need help with your services',
                'What are your business hours?',
                'How can I contact support?',
                'Do you offer technical support?',
                'I want to make a complaint'
            ];
            
            for (const user of testUsers) {
                for (let i = 0; i < 3; i++) {
                    const message = testMessages[Math.floor(Math.random() * testMessages.length)];
                    const conversation = {
                        userId: user.phoneNumber,
                        message: message,
                        response: `This is a test response to: ${message}`,
                        timestamp: new Date().toISOString()
                    };
                    
                    await dbManager.saveConversation(user.phoneNumber, conversation);
                    await dbManager.updateAnalytics('message_sent');
                }
                console.log(`   Created conversations for: ${user.name}`);
            }
            
            console.log('\n✅ Test data generated successfully!');
            
        } catch (error) {
            console.error('❌ Test data generation failed:', error.message);
            throw error;
        }
    }

    async cleanTestData() {
        console.log('🧹 Cleaning test data...');
        console.log('========================\n');

        try {
            const databasePath = path.join(this.dataDir, 'database.json');
            
            if (await fs.pathExists(databasePath)) {
                const backup = await fs.readJson(databasePath);
                const backupPath = path.join(this.dataDir, 'backups', `database-backup-${Date.now()}.json`);
                
                await fs.ensureDir(path.dirname(backupPath));
                await fs.writeJson(backupPath, backup, { spaces: 2 });
                console.log(`✅ Database backed up to: ${path.relative(this.projectRoot, backupPath)}`);
            }
            
            // Reset database
            const initialData = {
                users: {},
                conversations: {},
                sessions: {},
                analytics: {
                    totalMessages: 0,
                    totalUsers: 0,
                    dailyStats: {},
                    createdAt: new Date().toISOString()
                },
                metadata: {
                    version: '1.0.0',
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                }
            };
            
            await fs.writeJson(databasePath, initialData, { spaces: 2 });
            console.log('✅ Database reset to initial state');
            
            // Clean logs
            const logFiles = await fs.readdir(this.logsDir).catch(() => []);
            for (const logFile of logFiles) {
                if (logFile.endsWith('.log')) {
                    await fs.remove(path.join(this.logsDir, logFile));
                    console.log(`✅ Removed log file: ${logFile}`);
                }
            }
            
            console.log('\n✅ Test data cleaned successfully!');
            
        } catch (error) {
            console.error('❌ Test data cleaning failed:', error.message);
            throw error;
        }
    }

    async runAllTests() {
        console.log('🚀 Running all tests...');
        console.log('======================\n');

        try {
            await this.testConfiguration();
            console.log('\n' + '='.repeat(50) + '\n');
            
            await this.testDatabase();
            console.log('\n' + '='.repeat(50) + '\n');
            
            await this.testAIService();
            console.log('\n' + '='.repeat(50) + '\n');
            
            console.log('🎉 All tests completed successfully!');
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    }

    async showHelp() {
        console.log('🛠️  AllOneCustomerAI Development Tools');
        console.log('=====================================\n');
        console.log('Available commands:');
        console.log('  test-all      - Run all tests');
        console.log('  test-config   - Test configuration loading');
        console.log('  test-db       - Test database operations');
        console.log('  test-ai       - Test AI service');
        console.log('  generate-data - Generate test data');
        console.log('  clean-data    - Clean test data and reset database');
        console.log('  help          - Show this help message\n');
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    
    const devTools = new DevTools();
    
    (async () => {
        try {
            switch (command) {
                case 'test-all':
                    await devTools.runAllTests();
                    break;
                    
                case 'test-config':
                    await devTools.testConfiguration();
                    break;
                    
                case 'test-db':
                    await devTools.testDatabase();
                    break;
                    
                case 'test-ai':
                    await devTools.testAIService();
                    break;
                    
                case 'generate-data':
                    await devTools.generateTestData();
                    break;
                    
                case 'clean-data':
                    await devTools.cleanTestData();
                    break;
                    
                case 'help':
                default:
                    await devTools.showHelp();
                    break;
            }
        } catch (error) {
            console.error('❌ Command failed:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = DevTools;