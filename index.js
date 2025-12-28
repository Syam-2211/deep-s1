// index.js - Main bot file for 🕊🦋⃝♥⃝ѕиєнα🍁♥⃝🦋⃝🕊
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const P = require('pino');

// === WEB SERVER & SOCKET.IO SETUP ===
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const PORT = process.env.PORT || 3000;

// Serve website files from 'public' folder
app.use(express.static('public'));

// Start Server
server.listen(PORT, () => {
    console.log(`🌐 Website running on http://localhost:${PORT}`);
});

// Custom Configuration
const config = {
    botName: "🕊🦋⃝♥⃝ѕиєнα🍁♥⃝🦋⃝🕊",
    ownerName: "複| xʏEᴍツ",
    ownerNumber: "919947121619",
    prefix: ".",
    sessionName: "snehα-session",
    language: "Manglish",
    usePairingCode: true  // Enable pairing code instead of QR
};

// Command Handler Setup
const commands = new Map();
const aliases = new Map();

// Load all commands from commands folder
function loadCommands() {
    const commandsDir = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir, { recursive: true });
        console.log('📁 Created commands directory');
    }
    
    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        try {
            const command = require(path.join(commandsDir, file));
            commands.set(command.name, command);
            
            // Register aliases
            if (command.alias && Array.isArray(command.alias)) {
                command.alias.forEach(alias => {
                    aliases.set(alias, command.name);
                });
            }
            
            console.log(`✅ Loaded command: ${command.name}`);
        } catch (error) {
            console.error(`❌ Error loading command ${file}:`, error.message);
        }
    }
    
    console.log(`📊 Total commands loaded: ${commands.size}`);
}

// Message Processor
function processMessage(msg) {
    if (!msg.message) return null;
    
    let text = '';
    let isMedia = false;
    let isQuoted = false;
    let quotedMsg = null;
    
    // Extract text from different message types
    if (msg.message.conversation) {
        text = msg.message.conversation;
    } else if (msg.message.extendedTextMessage) {
        text = msg.message.extendedTextMessage.text || '';
        if (msg.message.extendedTextMessage.contextInfo) {
            isQuoted = true;
            quotedMsg = msg.message.extendedTextMessage.contextInfo;
        }
    } else if (msg.message.imageMessage) {
        text = msg.message.imageMessage.caption || '';
        isMedia = true;
    } else if (msg.message.videoMessage) {
        text = msg.message.videoMessage.caption || '';
        isMedia = true;
    } else if (msg.message.documentMessage) {
        text = msg.message.documentMessage.caption || '';
        isMedia = true;
    }
    
    return { text, isMedia, isQuoted, quotedMsg, sender: msg.key.remoteJid };
}

// Main bot class
class SnehαBot {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.startTime = Date.now();
        this.userMessages = new Map(); // For rate limiting
        this.welcomeConfig = {}; // Store welcome/goodbye configs
        this.config = config; // Make config accessible to methods
    }

    // ==================== WELCOME/GOODBYE SYSTEM ====================

    async saveWelcomeConfig(groupId, newConfig) {
        try {
            const CONFIG_FILE = path.join(__dirname, 'data/welcome-config.json');
            await fs.promises.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
            
            let allConfig = {};
            try {
                const data = await fs.promises.readFile(CONFIG_FILE, 'utf8');
                allConfig = JSON.parse(data);
            } catch (e) {
                allConfig = {};
            }
            
            allConfig[groupId] = { ...allConfig[groupId], ...newConfig };
            await fs.promises.writeFile(CONFIG_FILE, JSON.stringify(allConfig, null, 2));
            this.welcomeConfig = allConfig;
            return true;
        } catch (error) {
            console.error('❌ Save config error:', error);
            return false;
        }
    }
    
    async loadWelcomeConfig() {
        try {
            const CONFIG_FILE = path.join(__dirname, 'data/welcome-config.json');
            await fs.promises.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
            
            let allConfig = {};
            try {
                const data = await fs.promises.readFile(CONFIG_FILE, 'utf8');
                allConfig = JSON.parse(data);
            } catch (e) {
                allConfig = {};
            }
            
            this.welcomeConfig = allConfig;
            return allConfig;
        } catch (error) {
            console.error('❌ Load config error:', error);
            return {};
        }
    }
    
    async handleGroupUpdate(update) {
        try {
            const { id, participants, action } = update;
            const metadata = await this.sock.groupMetadata(id);
            const groupName = metadata.subject;
            const memberCount = metadata.participants.length;
            const config = await this.loadWelcomeConfig();
            const groupConfig = config[id] || {};
            
            if (action === 'add' && groupConfig.welcomeEnabled !== false) {
                for (const participant of participants) {
                    await this.sendWelcomeMessage(id, participant, groupName, memberCount, groupConfig);
                }
            } else if (action === 'remove' && groupConfig.goodbyeEnabled !== false) {
                for (const participant of participants) {
                    await this.sendGoodbyeMessage(id, participant, groupName, memberCount, groupConfig);
                }
            }
        } catch (error) {
            console.error('❌ Group participants update error:', error);
        }
    }
    
    async sendWelcomeMessage(groupId, participant, groupName, memberCount, config) {
        try {
            const userNumber = participant.split('@')[0];
            let welcomeMessage;
            
            if (config.customWelcome) {
                welcomeMessage = config.customWelcome
                    .replace(/@user/g, `@${userNumber}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{membercount}/g, memberCount)
                    .replace(/{botname}/g, this.config.botName)
                    .replace(/{owner}/g, this.config.ownerName)
                    .replace(/{prefix}/g, this.config.prefix);
            } else {
                const defaultMessages = [
                    `🎉 *WELCOME TO THE GROUP!* 🎉\n\n👋 Welcome @${userNumber} to *${groupName}*!\n🤖 I'm ${this.config.botName}.\n👥 Members: ${memberCount}`,
                    `🌟 *NEW MEMBER ALERT!* 🌟\n\nA warm welcome to @${userNumber}!`
                ];
                welcomeMessage = defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
            }
            
            await this.sock.sendMessage(groupId, { text: welcomeMessage, mentions: [participant] });
            
            if (config.welcomeImage) {
                setTimeout(async () => {
                    try {
                        await this.sock.sendMessage(groupId, {
                            image: { url: config.welcomeImage },
                            caption: `🖼️ Welcome to ${groupName}!`
                        });
                    } catch (imageError) {}
                }, 500);
            }
        } catch (error) {
            console.error('❌ Welcome message error:', error);
        }
    }
    
    async sendGoodbyeMessage(groupId, participant, groupName, memberCount, config) {
        try {
            const userNumber = participant.split('@')[0];
            let goodbyeMessage;
            
            if (config.customGoodbye) {
                goodbyeMessage = config.customGoodbye
                    .replace(/@user/g, `@${userNumber}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{membercount}/g, memberCount);
            } else {
                goodbyeMessage = `👋 Goodbye @${userNumber}! We'll miss you!`;
            }
            
            await this.sock.sendMessage(groupId, { text: goodbyeMessage, mentions: [participant] });
        } catch (error) {
            console.error('❌ Goodbye message error:', error);
        }
    }

    // ==================== BOT INITIALIZATION ====================

    async initialize() {
        console.log(`🚀 Starting ${config.botName}...`);
        
        loadCommands();
        await this.loadWelcomeConfig();
        
        const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
        const { version } = await fetchLatestBaileysVersion();

        const socketOptions = {
            version,
            logger: P({ level: 'silent' }),
            auth: state,
            browser: [config.botName, 'Chrome', '1.0.0'],
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            getMessage: async (key) => {
                return { conversation: "Message unavailable" };
            }
        };

        if (config.usePairingCode) {
            socketOptions.phoneNumber = config.ownerNumber;
            console.log('🔢 Using pairing code authentication...');
        }

        this.sock = makeWASocket(socketOptions);
        this.setupEventHandlers(saveCreds);
        
        setInterval(() => {
            if (!this.isConnected) {
                console.log('🔁 Attempting auto-reconnect...');
                this.initialize();
            }
        }, 30000);
    }

    setupEventHandlers(saveCreds) {
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, pairingCode } = update;

            // === REAL-TIME SOCKET EMISSION ===
            if (pairingCode && config.usePairingCode) {
                console.log('🔢 Code generated:', pairingCode);
                io.emit('code', pairingCode); // Send to website
            } else if (qr) {
                console.log('🟢 QR generated');
                io.emit('qr', qr); // Send to website
            }

            if (connection === 'close') {
                this.isConnected = false;
                io.emit('status', 'disconnected');
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('❌ Logged out. Delete session folder.');
                    fs.rmSync(config.sessionName, { recursive: true, force: true });
                    process.exit(1);
                } else if (statusCode === 401) {
                    console.log('❌ Authentication failed.');
                } else {
                    console.log('🔁 Reconnecting...');
                    setTimeout(() => this.initialize(), 5000);
                }
            } else if (connection === 'open') {
                this.isConnected = true;
                io.emit('status', 'connected'); // Tell website we are connected
                console.log(`✅ ${config.botName} connected successfully!`);
                await this.setBotStatus();
                await this.sendOwnerAlert();
            }
        });

        this.sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (msg.key.fromMe) return;
            await this.handleMessage(msg);
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('group-participants.update', async (update) => {
            await this.handleGroupUpdate(update);
        });
    }

    async setBotStatus() {
        try {
            await this.sock.updateProfileStatus(`🤖 ${config.botName} | Online`);
            await this.sock.updateProfileName(config.botName);
        } catch (error) {}
    }

    async sendOwnerAlert() {
        try {
            await this.sock.sendMessage(`${config.ownerNumber}@s.whatsapp.net`, {
                text: `🤖 *${config.botName} is Online!*\n✅ Ready to serve!`
            });
        } catch (error) {}
    }

    async handleMessage(msg) {
        const processed = processMessage(msg);
        if (!processed) return;
        
        const { text, sender, isMedia, isQuoted } = processed;
        
        if (!this.checkRateLimit(sender)) return;
        
        console.log(`📨 [${sender.split('@')[0]}]: ${text}`);
        
        if (text.startsWith(config.prefix)) {
            await this.handleCommand(text, msg, sender, isMedia, isQuoted);
        } else {
            await this.handleRegularMessage(text, msg, sender);
        }
    }

    async handleCommand(fullCommand, originalMsg, sender, isMedia, isQuoted) {
        const args = fullCommand.slice(config.prefix.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        
        let command = commands.get(commandName) || commands.get(aliases.get(commandName));
        
        if (!command) return;
        
        if (command.requireMedia && !isMedia && !isQuoted) {
            await this.sock.sendMessage(sender, { text: `📸 Image required!` }, { quoted: originalMsg });
            return;
        }
        
        if (command.adminOnly && !this.isAdmin(sender)) {
            await this.sock.sendMessage(sender, { text: `⛔ Admins only!` }, { quoted: originalMsg });
            return;
        }
        
        try {
            await command.execute(this.sock, originalMsg, args, {
                config, commands, isMedia, isQuoted, bot: this
            });
        } catch (error) {
            console.error(`❌ Error executing ${commandName}:`, error);
        }
    }

    async handleRegularMessage(text, originalMsg, sender) {
        const greetings = ['hi', 'hello', 'hey', 'hai'];
        if (greetings.some(greet => text.toLowerCase().includes(greet))) {
            await this.sock.sendMessage(sender, {
                text: `Hello! 👋 Type ${config.prefix}menu for commands.`
            }, { quoted: originalMsg });
        }
    }

    isAdmin(sender) {
        if (sender === `${config.ownerNumber}@s.whatsapp.net`) return true;
        return false;
    }

    checkRateLimit(sender) {
        const now = Date.now();
        const userData = this.userMessages.get(sender) || { count: 0, lastMessage: 0 };
        
        if (now - userData.lastMessage > 60000) userData.count = 0;
        
        if (userData.count >= 10) return false;
        
        userData.count++;
        userData.lastMessage = now;
        this.userMessages.set(sender, userData);
        return true;
    }

    getUptime() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        return `${hours}h ${minutes}m ${seconds}s`;
    }
}

// Start the bot
async function startBot() {
    try {
        if (!fs.existsSync(config.sessionName)) {
            fs.mkdirSync(config.sessionName, { recursive: true });
        }
        
        if (!fs.existsSync('data')) {
            fs.mkdirSync('data', { recursive: true });
        }
        
        const bot = new SnehαBot();
        await bot.initialize();
        
        process.on('SIGINT', async () => {
            console.log(`\n👋 Shutting down...`);
            if (bot.sock) await bot.sock.end();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

startBot();