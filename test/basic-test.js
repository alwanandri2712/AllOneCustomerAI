const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');

/**
 * Basic tests for AllOneCustomerAI
 * Simple test suite to verify core functionality
 */

class BasicTest {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.passed = 0;
        this.failed = 0;
        this.tests = [];
    }

    async runTests() {
        console.log('🧪 Running Basic Tests for AllOneCustomerAI');
        console.log('==========================================\n');

        // Register all tests
        this.registerTests();

        // Run each test
        for (const test of this.tests) {
            try {
                console.log(`🔍 ${test.name}...`);
                await test.fn();
                console.log(`✅ ${test.name} - PASSED\n`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${test.name} - FAILED`);
                console.log(`   Error: ${error.message}\n`);
                this.failed++;
            }
        }

        // Show results
        this.showResults();
    }

    registerTests() {
        this.tests = [
            { name: 'Project Structure', fn: () => this.testProjectStructure() },
            { name: 'Package.json Validation', fn: () => this.testPackageJson() },
            { name: 'Environment Configuration', fn: () => this.testEnvironmentConfig() },
            { name: 'Config Files', fn: () => this.testConfigFiles() },
            { name: 'Source Code Structure', fn: () => this.testSourceStructure() },
            { name: 'Dependencies', fn: () => this.testDependencies() },
            { name: 'Configuration Loading', fn: () => this.testConfigurationLoading() },
            { name: 'Database Manager', fn: () => this.testDatabaseManager() },
            { name: 'Logger Utility', fn: () => this.testLogger() },
            { name: 'Helper Functions', fn: () => this.testHelpers() }
        ];
    }

    async testProjectStructure() {
        const requiredDirs = [
            'src',
            'src/config',
            'src/services',
            'src/database',
            'src/bot',
            'src/utils',
            'config',
            'scripts',
            'test'
        ];

        for (const dir of requiredDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            const exists = await fs.pathExists(dirPath);
            assert(exists, `Directory ${dir} should exist`);
        }

        const requiredFiles = [
            'package.json',
            '.env.example',
            '.gitignore',
            'README.md',
            'LICENSE',
            'src/index.js'
        ];

        for (const file of requiredFiles) {
            const filePath = path.join(this.projectRoot, file);
            const exists = await fs.pathExists(filePath);
            assert(exists, `File ${file} should exist`);
        }
    }

    async testPackageJson() {
        const packagePath = path.join(this.projectRoot, 'package.json');
        const packageJson = await fs.readJson(packagePath);

        assert(packageJson.name === 'allonecustomerai', 'Package name should be allonecustomerai');
        assert(packageJson.version, 'Package should have version');
        assert(packageJson.description, 'Package should have description');
        assert(packageJson.main === 'src/index.js', 'Main entry should be src/index.js');
        assert(packageJson.scripts, 'Package should have scripts');
        assert(packageJson.scripts.start, 'Package should have start script');
        assert(packageJson.dependencies, 'Package should have dependencies');

        const requiredDeps = [
            '@whiskeysockets/baileys',
            'qrcode-terminal',
            'pino',
            'dotenv',
            'fs-extra',
            'axios',
            'openai',
            'node-cron'
        ];

        for (const dep of requiredDeps) {
            assert(packageJson.dependencies[dep], `Dependency ${dep} should be present`);
        }
    }

    async testEnvironmentConfig() {
        const envExamplePath = path.join(this.projectRoot, '.env.example');
        const envContent = await fs.readFile(envExamplePath, 'utf8');

        const requiredVars = [
            'BOT_NAME',
            'OPENAI_API_KEY',
            'OPENAI_MODEL',
            'DEFAULT_LANGUAGE',
            'ADMIN_NUMBERS'
        ];

        for (const envVar of requiredVars) {
            assert(envContent.includes(envVar), `Environment variable ${envVar} should be in .env.example`);
        }
    }

    async testConfigFiles() {
        const configFiles = [
            'config/custom-prompts.json',
            'config/company-info.json'
        ];

        for (const configFile of configFiles) {
            const filePath = path.join(this.projectRoot, configFile);
            const exists = await fs.pathExists(filePath);
            assert(exists, `Config file ${configFile} should exist`);

            // Test if it's valid JSON
            const content = await fs.readJson(filePath);
            assert(typeof content === 'object', `${configFile} should contain valid JSON object`);
        }

        // Test custom prompts structure
        const customPrompts = await fs.readJson(path.join(this.projectRoot, 'config/custom-prompts.json'));
        assert(customPrompts.systemPrompt, 'Custom prompts should have systemPrompt');
        assert(customPrompts.welcomeMessage, 'Custom prompts should have welcomeMessage');

        // Test company info structure
        const companyInfo = await fs.readJson(path.join(this.projectRoot, 'config/company-info.json'));
        assert(companyInfo.name, 'Company info should have name');
        assert(companyInfo.contact, 'Company info should have contact');
    }

    async testSourceStructure() {
        const sourceFiles = [
            'src/index.js',
            'src/config/config-loader.js',
            'src/services/ai-service.js',
            'src/database/database-manager.js',
            'src/bot/whatsapp-bot.js',
            'src/utils/logger.js',
            'src/utils/helpers.js'
        ];

        for (const sourceFile of sourceFiles) {
            const filePath = path.join(this.projectRoot, sourceFile);
            const exists = await fs.pathExists(filePath);
            assert(exists, `Source file ${sourceFile} should exist`);

            // Test if it's valid JavaScript (basic syntax check)
            const content = await fs.readFile(filePath, 'utf8');
            assert(content.length > 0, `${sourceFile} should not be empty`);
            assert(!content.includes('undefined'), `${sourceFile} should not contain undefined references`);
        }
    }

    async testDependencies() {
        const packagePath = path.join(this.projectRoot, 'package.json');
        const packageJson = await fs.readJson(packagePath);

        // Check if node_modules exists (dependencies installed)
        const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
        const nodeModulesExists = await fs.pathExists(nodeModulesPath);
        
        if (nodeModulesExists) {
            // Check if main dependencies are installed
            const mainDeps = ['@whiskeysockets/baileys', 'openai', 'pino'];
            for (const dep of mainDeps) {
                const depPath = path.join(nodeModulesPath, dep);
                const depExists = await fs.pathExists(depPath);
                assert(depExists, `Dependency ${dep} should be installed`);
            }
        }
    }

    async testConfigurationLoading() {
        try {
            const ConfigLoader = require('../src/config/config-loader');
            assert(typeof ConfigLoader.loadConfig === 'function', 'ConfigLoader should have loadConfig method');
            assert(typeof ConfigLoader.validateConfig === 'function', 'ConfigLoader should have validateConfig method');
        } catch (error) {
            throw new Error(`ConfigLoader module should be loadable: ${error.message}`);
        }
    }

    async testDatabaseManager() {
        try {
            const DatabaseManager = require('../src/database/database-manager');
            const dbManager = new DatabaseManager();
            
            assert(typeof dbManager.initialize === 'function', 'DatabaseManager should have initialize method');
            assert(typeof dbManager.saveUser === 'function', 'DatabaseManager should have saveUser method');
            assert(typeof dbManager.getUser === 'function', 'DatabaseManager should have getUser method');
            assert(typeof dbManager.saveConversation === 'function', 'DatabaseManager should have saveConversation method');
        } catch (error) {
            throw new Error(`DatabaseManager module should be loadable: ${error.message}`);
        }
    }

    async testLogger() {
        try {
            const logger = require('../src/utils/logger');
            
            assert(typeof logger.info === 'function', 'Logger should have info method');
            assert(typeof logger.error === 'function', 'Logger should have error method');
            assert(typeof logger.warn === 'function', 'Logger should have warn method');
            assert(typeof logger.debug === 'function', 'Logger should have debug method');
        } catch (error) {
            throw new Error(`Logger module should be loadable: ${error.message}`);
        }
    }

    async testHelpers() {
        try {
            const helpers = require('../src/utils/helpers');
            
            assert(typeof helpers.formatPhoneNumber === 'function', 'Helpers should have formatPhoneNumber method');
            assert(typeof helpers.isWorkingHours === 'function', 'Helpers should have isWorkingHours method');
            assert(typeof helpers.sanitizeText === 'function', 'Helpers should have sanitizeText method');
            assert(typeof helpers.generateSessionId === 'function', 'Helpers should have generateSessionId method');
        } catch (error) {
            throw new Error(`Helpers module should be loadable: ${error.message}`);
        }
    }

    showResults() {
        console.log('📊 Test Results');
        console.log('===============');
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📈 Total:  ${this.passed + this.failed}`);
        
        if (this.failed === 0) {
            console.log('\n🎉 All tests passed! Your AllOneCustomerAI setup is ready.');
        } else {
            console.log('\n⚠️  Some tests failed. Please check the errors above.');
            process.exit(1);
        }
    }
}

// CLI interface
if (require.main === module) {
    const basicTest = new BasicTest();
    basicTest.runTests().catch(error => {
        console.error('❌ Test runner failed:', error.message);
        process.exit(1);
    });
}

module.exports = BasicTest;