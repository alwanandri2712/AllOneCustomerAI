# AllOneCustomerAI

🤖 **Modular AI Customer Service Bot menggunakan Baileys WhatsApp API**

AllOneCustomerAI adalah solusi customer service berbasis AI yang dapat disesuaikan dengan kebutuhan perusahaan atau organisasi apapun. Bot ini menggunakan WhatsApp sebagai platform komunikasi dan OpenAI untuk memberikan respons yang intelligent dan contextual.

## ✨ Fitur Utama

- 🔧 **Modular & Customizable** - Mudah disesuaikan dengan kebutuhan bisnis
- 🤖 **Multiple AI Providers** - Mendukung Gemini, OpenAI, dan Claude dengan Gemini sebagai default
- 📱 **WhatsApp Integration** - Menggunakan Baileys untuk koneksi WhatsApp
- 💾 **Database Management** - Penyimpanan percakapan dan analytics
- 👥 **Multi-User Support** - Menangani multiple users secara bersamaan
- 📊 **Analytics & Reporting** - Statistik penggunaan dan performa
- 🔐 **Admin Panel** - Command khusus untuk administrator
- 🌐 **Multi-Language** - Dukungan bahasa Indonesia dan English
- ⚡ **Real-time Processing** - Respons cepat dan real-time

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 atau lebih tinggi)
- NPM atau Yarn
- API Key untuk salah satu AI provider:
  - **Gemini API Key** (Default - Recommended)
  - OpenAI API Key (Optional)
  - Claude API Key (Optional)
- WhatsApp account untuk bot

### Installation

1. **Clone repository**
   ```bash
   git clone https://github.com/yourusername/AllOneCustomerAI.git
   cd AllOneCustomerAI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit file `.env` dan isi dengan konfigurasi Anda:
   ```env
   # AI Provider Configuration
   AI_PROVIDER=gemini  # gemini, openai, atau claude
   
   # Gemini Configuration (Default)
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.0-flash-exp
   
   # OpenAI Configuration (Optional)
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   
   # Claude Configuration (Optional)
   CLAUDE_API_KEY=your_claude_api_key_here
   CLAUDE_MODEL=claude-3-haiku-20240307
   
   # Bot Configuration
   BOT_NAME=AllOneCustomerAI
   DEFAULT_LANGUAGE=id
   
   # Admin Configuration
   ADMIN_NUMBERS=62xxxxxxxxxx,62xxxxxxxxxx
   ```

4. **Customize company information**
   
   Edit `config/company-info.json` dengan informasi perusahaan Anda:
   ```json
   {
     "name": "Nama Perusahaan Anda",
     "description": "Deskripsi perusahaan",
     "contact": {
       "email": "info@perusahaan.com",
       "phone": "+62-xxx-xxxx-xxxx"
     }
   }
   ```

5. **Customize AI prompts**
   
   Edit `config/custom-prompts.json` untuk menyesuaikan perilaku AI:
   ```json
   {
     "systemPrompt": "You are a helpful customer service for [Company Name]...",
     "welcomeMessage": "Halo! Selamat datang di [Company Name]..."
   }
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

7. **Scan QR Code**
   
   Scan QR code yang muncul di terminal dengan WhatsApp untuk menghubungkan bot.

## 📁 Struktur Proyek

```
AllOneCustomerAI/
├── src/
│   ├── bot/
│   │   └── whatsapp-bot.js      # WhatsApp bot logic
│   ├── config/
│   │   └── config-loader.js     # Configuration management
│   ├── database/
│   │   └── database-manager.js  # Database operations
│   ├── services/
│   │   └── ai-service.js        # AI service integration
│   ├── utils/
│   │   └── logger.js            # Logging utility
│   └── index.js                 # Application entry point
├── config/
│   ├── custom-prompts.json      # AI prompts configuration
│   └── company-info.json        # Company information
├── data/                        # Database files (auto-generated)
├── logs/                        # Log files (auto-generated)
├── auth_info/                   # WhatsApp auth (auto-generated)
├── .env.example                 # Environment variables template
├── package.json
└── README.md
```

## 🔧 Konfigurasi

### Environment Variables

#### AI Provider Configuration
| Variable | Description | Default |
|----------|-------------|----------|
| `AI_PROVIDER` | AI provider to use (gemini/openai/claude) | `gemini` |
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `GEMINI_MODEL` | Gemini model to use | `gemini-2.0-flash-exp` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o-mini` |
| `CLAUDE_API_KEY` | Anthropic Claude API key | - |
| `CLAUDE_MODEL` | Claude model to use | `claude-3-haiku-20240307` |

#### Bot Configuration
| Variable | Description | Default |
|----------|-------------|----------|
| `BOT_NAME` | Bot name | `AllOneCustomerAI` |
| `BOT_PHONE_NUMBER` | Bot's WhatsApp number (untuk validasi identitas) | - |
| `DEFAULT_LANGUAGE` | Default language | `id` |
| `ADMIN_NUMBERS` | Admin phone numbers (comma separated) | - |
| `MAX_RESPONSE_LENGTH` | Maximum AI response length | `1000` |
| `SESSION_TIMEOUT` | Session timeout in ms | `1800000` |
| `LOG_LEVEL` | Logging level | `info` |

### Custom Prompts

Edit `config/custom-prompts.json` untuk mengkustomisasi:
- System prompt untuk AI
- Welcome message
- Fallback responses
- Contextual prompts untuk berbagai skenario

### Company Information

Edit `config/company-info.json` untuk mengatur:
- Informasi perusahaan
- Kontak dan departemen
- Layanan yang ditawarkan
- Social media links

### AI Providers

Bot mendukung tiga AI provider:

#### 🔥 Gemini (Default - Recommended)
- **Model**: `gemini-2.0-flash-exp`
- **Keunggulan**: Performa tinggi, respons cepat, cost-effective
- **API Key**: Dapatkan dari [Google AI Studio](https://aistudio.google.com/)

#### 🤖 OpenAI (Optional)
- **Model**: `gpt-4o-mini`
- **Keunggulan**: Kualitas respons konsisten, dokumentasi lengkap
- **API Key**: Dapatkan dari [OpenAI Platform](https://platform.openai.com/)

#### 🧠 Claude (Optional)
- **Model**: `claude-3-haiku-20240307`
- **Keunggulan**: Pemahaman konteks yang baik, safety-focused
- **API Key**: Dapatkan dari [Anthropic Console](https://console.anthropic.com/)

**Cara mengganti AI Provider:**
1. Set `AI_PROVIDER` di file `.env` (gemini/openai/claude)
2. Pastikan API key untuk provider yang dipilih sudah diset
3. Restart bot untuk menerapkan perubahan

## 💬 Penggunaan

### User Commands

- `/help` - Menampilkan bantuan
- `/info` - Informasi perusahaan
- `/reset` - Reset sesi percakapan
- `/status` - Status akun user
- `/provider` - Informasi AI provider yang sedang digunakan

### Admin Commands

- `/admin stats` - Statistik bot
- `/admin users` - Daftar user aktif
- `/admin broadcast <message>` - Kirim broadcast
- `/admin cleanup` - Bersihkan data lama
- `/admin sessions` - Kelola chat sessions (khusus Gemini)
  - `/admin sessions info` - Info sessions aktif
  - `/admin sessions clear <phone>` - Hapus session tertentu
  - `/admin sessions clearall` - Hapus semua sessions
  - `/admin sessions cleanup` - Bersihkan sessions tidak aktif
- `/admin help` - Bantuan admin

### Regular Conversation

User dapat mengirim pesan biasa dan AI akan merespons berdasarkan:
- Context percakapan sebelumnya
- Informasi perusahaan
- Custom prompts yang telah dikonfigurasi

## 📊 Analytics

Bot secara otomatis melacak:
- Total users dan messages
- Statistik harian
- Riwayat percakapan
- Session management

Data analytics dapat diakses melalui admin commands atau langsung dari database.

## 🔒 Security

- **Bot Identity Validation**: Bot secara otomatis mendeteksi dan mencegah membalas pesan dari nomor dirinya sendiri
- **Admin Access Control**: Admin access terbatas pada nomor yang dikonfigurasi
- **Session Management**: Keamanan percakapan dengan session management
- **Audit Trail**: Logging lengkap untuk audit trail
- **Environment Security**: Environment variables untuk sensitive data
- **Multi-layer Protection**: Validasi berlapis di incoming messages, message processing, dan outgoing messages

## 🛠️ Development

### Development Mode

```bash
npm run dev
```

### Adding New Features

1. **Custom AI Responses**: Edit `src/services/ai-service.js`
2. **New Commands**: Tambahkan di `processSpecialCommands()` method
3. **Database Schema**: Modify `src/database/database-manager.js`
4. **Bot Behavior**: Edit `src/bot/whatsapp-bot.js`

### Testing

```bash
# Run basic tests
npm test

# Test AI service with different providers
node scripts/dev-tools.js test-ai

# Test specific AI provider
AI_PROVIDER=gemini node scripts/dev-tools.js test-ai
AI_PROVIDER=openai node scripts/dev-tools.js test-ai
AI_PROVIDER=claude node scripts/dev-tools.js test-ai
```

## 📝 Logging

Logs disimpan di:
- Console output (development)
- File logs di `logs/bot.log`
- Configurable log levels: `trace`, `debug`, `info`, `warn`, `error`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

1. Check [Issues](https://github.com/yourusername/AllOneCustomerAI/issues)
2. Create new issue dengan detail yang lengkap
3. Join our [Discord](https://discord.gg/your-discord) untuk diskusi

## 🙏 Acknowledgments

Terima kasih kepada:

- **[Google Gemini](https://ai.google.dev/)** - AI provider default dengan performa tinggi
- **[OpenAI](https://openai.com/)** - Pioneering AI technology dan GPT models
- **[Anthropic Claude](https://www.anthropic.com/)** - Advanced AI dengan fokus pada safety
- **[Baileys](https://github.com/WhiskeySockets/Baileys)** - WhatsApp Web API library
- **[Node.js](https://nodejs.org/)** - JavaScript runtime environment
- **[Pino](https://github.com/pinojs/pino)** - Fast and low overhead logging library
- Semua kontributor dan pengguna yang memberikan feedback

---

**Made with ❤️ for better customer service experience**