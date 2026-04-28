const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
const port = process.env.PORT || 10000; 

// ============================================
// 🎯 الإعدادات المستهدفة
// ============================================
const TARGET_GROUP_IDS = ['120363423769337868@g.us', '120363420793660260@g.us'];
const TARGET_GROUP_SET = new Set(TARGET_GROUP_IDS);
const targetRegex = /التسجيل لحجز/; // تأكد من كتابتها يدوياً لتكون متصلة

let successfulReactions = 0;
let lastResponseTime = 0;
const startTime = Date.now();

// مسار UptimeRobot لضمان عدم نوم السيرفر
app.get('/', (req, res) => {
    res.send(`Bot Active | OK: ${successfulReactions} | Ping: ${lastResponseTime}ms`);
});
app.listen(port, '0.0.0.0');

const logger = pino({ level: 'silent' });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('/app/auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger,
        auth: state,
        browser: Browsers.ubuntu('Chrome'), 
        connectTimeoutMs: 60000, 
        keepAliveIntervalMs: 15000,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => ({ conversation: '' }),
        shouldSyncHistoryMessage: () => false
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('\n📱 امسح الباركود الآن:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => startBot(), 2000);
        } else if (connection === 'open') {
            console.log('\n✅ متصل! وضع الاقتناص الفوري يعمل الآن.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ============================================
    // ⚡ محرك الاقتناص (Ultra-Fast Handler)
    // ============================================
    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify' || !messages[0].message) return;
        
        const msg = messages[0];
        const txt = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // 1. الفحص السريع (Regex Performance)
        if (!txt || !targetRegex.test(txt)) return;

        // 2. التحقق من المجموعة
        const jid = msg.key.remoteJid;
        if (!TARGET_GROUP_SET.has(jid)) return;

        // 3. التفاعل الفوري
        const t0 = performance.now();
        sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).then(() => {
            lastResponseTime = (performance.now() - t0).toFixed(2);
            successfulReactions++;
            console.log(`⚡ ضربة ناجحة! الاستجابة: ${lastResponseTime}ms`);
        }).catch(() => {});
    });

    // 🔥 تسخين المحرك V8 مسبقاً
    for (let i = 0; i < 5000; i++) { targetRegex.test('نص وهمي للتسجيل لحجز'); }
}

startBot().catch(console.error);
process.on('unhandledRejection', () => {});
