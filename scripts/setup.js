#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Setup script for AllOneCustomerAI
 * This script helps with initial setup and configuration
 */

class SetupManager {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.configDir = path.join(this.projectRoot, 'config');
        this.dataDir = path.join(this.projectRoot, 'data');
        this.logsDir = path.join(this.projectRoot, 'logs');
        this.authDir = path.join(this.projectRoot, 'auth_info');
    }

    async run() {
        console.log('🚀 Setting up AllOneCustomerAI...');
        console.log('=====================================\n');

        try {
            await this.checkNodeVersion();
            await this.createDirectories();
            await this.setupEnvironment();
            await this.installDependencies();
            await this.validateConfiguration();
            await this.createInitialData();
            
            console.log('\n✅ Setup completed successfully!');
            console.log('\n📋 Next steps:');
            console.log('1. Edit .env file with your OpenAI API key and other configurations');
            console.log('2. Customize config/company-info.json with your company details');
            console.log('3. Modify config/custom-prompts.json to customize AI behavior');
            console.log('4. Run "npm start" to start the bot');
            console.log('5. Scan the QR code with WhatsApp to connect the bot\n');
            
        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            process.exit(1);
        }
    }

    async checkNodeVersion() {
        console.log('🔍 Checking Node.js version...');
        
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion < 16) {
            throw new Error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
        }
        
        console.log(`✅ Node.js version ${nodeVersion} is supported\n`);
    }

    async createDirectories() {
        console.log('📁 Creating necessary directories...');
        
        const directories = [
            this.configDir,
            this.dataDir,
            this.logsDir,
            this.authDir,
            path.join(this.dataDir, 'backups')
        ];
        
        for (const dir of directories) {
            await fs.ensureDir(dir);
            console.log(`   Created: ${path.relative(this.projectRoot, dir)}`);
        }
        
        console.log('✅ Directories created\n');
    }

    async setupEnvironment() {
        console.log('⚙️  Setting up environment configuration...');
        
        const envPath = path.join(this.projectRoot, '.env');
        const envExamplePath = path.join(this.projectRoot, '.env.example');
        
        if (!(await fs.pathExists(envPath))) {
            if (await fs.pathExists(envExamplePath)) {
                await fs.copy(envExamplePath, envPath);
                console.log('   Created .env file from .env.example');
            } else {
                await this.createDefaultEnvFile(envPath);
                console.log('   Created default .env file');
            }
        } else {
            console.log('   .env file already exists');
        }
        
        console.log('✅ Environment configuration ready\n');
    }

    async createDefaultEnvFile(envPath) {
        const defaultEnv = `# AllOneCustomerAI Configuration

# WhatsApp Bot Configuration
BOT_NAME=AllOneCustomerAI
BOT_PHONE_NUMBER=+62xxxxxxxxxx

# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# Bot Behavior
DEFAULT_LANGUAGE=id
MAX_RESPONSE_LENGTH=1000
SESSION_TIMEOUT=1800000

# Admin Configuration
ADMIN_NUMBERS=62xxxxxxxxxx

# Database
DB_TYPE=json
DB_PATH=./data/database.json

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/bot.log

# Custom Configuration Files
CUSTOM_PROMPT_FILE=./config/custom-prompts.json
COMPANY_INFO_FILE=./config/company-info.json
`;
        
        await fs.writeFile(envPath, defaultEnv);
    }

    async installDependencies() {
        console.log('📦 Installing dependencies...');
        
        try {
            // Check if package.json exists
            const packageJsonPath = path.join(this.projectRoot, 'package.json');
            if (!(await fs.pathExists(packageJsonPath))) {
                throw new Error('package.json not found');
            }
            
            // Install dependencies
            console.log('   Running npm install...');
            execSync('npm install', { 
                cwd: this.projectRoot, 
                stdio: 'inherit' 
            });
            
            console.log('✅ Dependencies installed\n');
            
        } catch (error) {
            throw new Error(`Failed to install dependencies: ${error.message}`);
        }
    }

    async validateConfiguration() {
        console.log('🔍 Validating configuration files...');
        
        const configFiles = [
            { path: path.join(this.configDir, 'custom-prompts.json'), name: 'Custom Prompts' },
            { path: path.join(this.configDir, 'company-info.json'), name: 'Company Info' }
        ];
        
        for (const config of configFiles) {
            if (await fs.pathExists(config.path)) {
                try {
                    await fs.readJson(config.path);
                    console.log(`   ✅ ${config.name} configuration is valid`);
                } catch (error) {
                    console.log(`   ⚠️  ${config.name} configuration has invalid JSON format`);
                }
            } else {
                console.log(`   ⚠️  ${config.name} configuration file not found`);
            }
        }
        
        console.log('✅ Configuration validation completed\n');
    }

    async createInitialData() {
        console.log('💾 Creating initial data structure...');
        
        const databasePath = path.join(this.dataDir, 'database.json');
        
        if (!(await fs.pathExists(databasePath))) {
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
            console.log('   Created initial database structure');
        } else {
            console.log('   Database file already exists');
        }
        
        console.log('✅ Initial data structure ready\n');
    }

    async checkConfiguration() {
        console.log('🔧 Checking current configuration...');
        
        const envPath = path.join(this.projectRoot, '.env');
        
        if (await fs.pathExists(envPath)) {
            const envContent = await fs.readFile(envPath, 'utf8');
            
            const checks = [
                { key: 'OPENAI_API_KEY', required: true, description: 'OpenAI API Key' },
                { key: 'BOT_NAME', required: false, description: 'Bot Name' },
                { key: 'ADMIN_NUMBERS', required: false, description: 'Admin Numbers' }
            ];
            
            console.log('\n📋 Configuration Status:');
            
            for (const check of checks) {
                const hasValue = envContent.includes(`${check.key}=`) && 
                               !envContent.includes(`${check.key}=your_`) && 
                               !envContent.includes(`${check.key}=xxx`);
                
                const status = hasValue ? '✅' : (check.required ? '❌' : '⚠️ ');
                const message = hasValue ? 'Configured' : (check.required ? 'REQUIRED - Not configured' : 'Optional - Not configured');
                
                console.log(`   ${status} ${check.description}: ${message}`);
            }
        }
        
        console.log('');
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'setup';
    
    const setupManager = new SetupManager();
    
    switch (command) {
        case 'setup':
            setupManager.run();
            break;
            
        case 'check':
            setupManager.checkConfiguration();
            break;
            
        case 'reset':
            console.log('🔄 Resetting configuration...');
            // Add reset logic here if needed
            break;
            
        default:
            console.log('Usage: node scripts/setup.js [setup|check|reset]');
            break;
    }
}

module.exports = SetupManager;