/**
 * Simple test for language detection functionality
 */

const path = require('path');
const fs = require('fs');

// Mock the required modules
const mockLogger = {
    info: console.log,
    warn: console.warn,
    error: console.error
};

// Mock database
const mockDb = {
    getUser: async () => ({ preferences: {} }),
    updateUser: async () => true
};

// Mock config loader
const mockConfig = {
    languages: {
        id: {
            name: "Bahasa Indonesia",
            welcomeMessage: "Halo! Selamat datang",
            systemPrompt: "Anda adalah asisten AI"
        },
        en: {
            name: "English", 
            welcomeMessage: "Hello! Welcome",
            systemPrompt: "You are an AI assistant"
        }
    }
};

// Create a simplified AIService class for testing
class TestAIService {
    constructor() {
        this.defaultLanguage = 'id';
        this.languages = mockConfig.languages;
    }
    
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
                englishScore += word.length;
            }
        });
        
        indonesianWords.forEach(word => {
            if (cleanText.includes(word)) {
                indonesianScore += word.length;
            }
        });
        
        // Additional heuristics
        if (/\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/g.test(cleanText)) {
            englishScore += 5;
        }
        
        if (/\b(yang|dan|atau|dengan|untuk|dari|ke|di|pada|ini|itu)\b/g.test(cleanText)) {
            indonesianScore += 5;
        }
        
        // Determine language based on scores
        if (englishScore > indonesianScore && englishScore > 3) {
            return 'en';
        } else if (indonesianScore > englishScore && indonesianScore > 3) {
            return 'id';
        }
        
        return null;
    }
}

// Test cases
function runLanguageDetectionTests() {
    console.log('🧪 Testing Language Detection...');
    console.log('================================');
    
    const aiService = new TestAIService();
    
    const testCases = [
        // English test cases
        { text: 'Hello, how are you?', expected: 'en', description: 'Simple English greeting' },
        { text: 'Good morning! I need help with my order', expected: 'en', description: 'English with common words' },
        { text: 'Thank you for the information', expected: 'en', description: 'English gratitude' },
        { text: 'Can you help me with this problem?', expected: 'en', description: 'English question' },
        { text: 'I want to buy this product', expected: 'en', description: 'English purchase intent' },
        
        // Indonesian test cases
        { text: 'Halo, apa kabar?', expected: 'id', description: 'Simple Indonesian greeting' },
        { text: 'Selamat pagi! Saya perlu bantuan dengan pesanan saya', expected: 'id', description: 'Indonesian with common words' },
        { text: 'Terima kasih untuk informasinya', expected: 'id', description: 'Indonesian gratitude' },
        { text: 'Bisakah Anda membantu saya dengan masalah ini?', expected: 'id', description: 'Indonesian question' },
        { text: 'Saya mau beli produk ini', expected: 'id', description: 'Indonesian purchase intent' },
        
        // Edge cases
        { text: 'Hi', expected: null, description: 'Too short text' },
        { text: '123456', expected: null, description: 'Numbers only' },
        { text: '', expected: null, description: 'Empty text' },
        { text: 'OK', expected: null, description: 'Ambiguous short text' }
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach((testCase, index) => {
        const result = aiService.detectLanguage(testCase.text);
        const success = result === testCase.expected;
        
        console.log(`Test ${index + 1}: ${testCase.description}`);
        console.log(`  Input: "${testCase.text}"`);
        console.log(`  Expected: ${testCase.expected}`);
        console.log(`  Got: ${result}`);
        console.log(`  Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');
        
        if (success) {
            passed++;
        } else {
            failed++;
        }
    });
    
    console.log('================================');
    console.log(`📊 Test Results:`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${testCases.length}`);
    console.log(`   Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log('🎉 All tests passed!');
    } else {
        console.log('⚠️  Some tests failed. Review the implementation.');
    }
}

// Run the tests
runLanguageDetectionTests();