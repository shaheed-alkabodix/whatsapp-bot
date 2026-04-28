const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
const port = process.env.PORT || 10000; // متوافق مع منافذ Render التلقائية

// ============================================
// 🎯 إعدادات المجموعات المستهدفة
// ============================================
const TARGET_GROUP_IDS = [
    '120363423769337868@g.us', 
    '120363420793660260@g.us'  
];
const TARGET_GROUP_SET = new Set(TARGET_GROUP_IDS);

// 🔍 الكلمة المفتاحية (تأكد أنها تظهر بشكل متصل في المحرر)
const targetRegex = /التسجيل لحجز/;

// ============================================
// 📊 مقاييس الأداء
// ============================================
let successfulReactions = 0;
let lastResponseTime = 0;
const startTime = Date.now();

// خادم ويب لإبقاء السيرفر مستيقظاً ولربطه بـ UptimeRobot
app.get('/', (req, res) => {
    res.send(`Bot Online | OK: ${successfulReactions} | Last Ping: ${lastResponseTime}ms | Uptime: ${Math.floor((Date.now() - startTime) / 60000)} min`);
});
app.listen(port, '0.0.0.0');

const logger = pino({ level: 'silent' });

async function startBot() {
    console.log('⏳ جاري إعداد الجلسة والتحقق من الإصدار...');
    
    const { state, saveCreds } = await useMultiFileAuthState('/app/auth_info_baileys');
    
    // جلب أحدث إصدار لتفادي أخطاء الـ SSL
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger,
        auth: state,
        browser: Browsers.ubuntu('Chrome'), // تمويه رسمي متوافق مع نظام السيرفر
        connectTimeoutMs: 60000, 
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => ({ conversation: '' }),
        shouldSyncHistoryMessage: () => false
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📱 امسح الباركود بسرعة للحجز:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => startBot(), 2000);
        } else if (connection === 'open') {
            console.log('\n✅ متصل بنجاح! وضع Turbo مفعل 24/7.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ============================================
    // ⚡ المسار السريع (Hot Path Optimization)
    // ============================================
    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify' || !messages[0].message) return;
        
        const msg = messages[0];
        const txt = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // 1. الفشل السريع (Fast Fail) لتوفير وقت المعالج
        if (!txt || !targetRegex.test(txt)) return;

        // 2. التحقق من المجموعة المستهدفة
        const jid = msg.key.remoteJid;
        if (!TARGET_GROUP_SET.has(jid)) return;

        // 3. إرسال التفاعل فوراً (قبل أي عملية حسابية)
        const t0 = performance.now();
        sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).then(() => {
            lastResponseTime = (performance.now() - t0).toFixed(2);
            successfulReactions++;
            console.log(`⚡ ضربة ناجحة! وقت المعالجة الداخلي: ${lastResponseTime}ms`);
        }).catch(() => {});
    });

    // ============================================
    // 🔥 تسخين محرك V8
    // ============================================
    console.log('🔥 جاري تسخين النظام لأقصى سرعة...');
    for (let i = 0; i < 5000; i++) {
        targetRegex.test('رسالة وهمية للتسجيل لحجز وهمي');
    }
    console.log('🚀 النظام الآن في حالة استعداد قصوى!');
}

startBot().catch(console.error);

process.on('unhandledRejection', () => {}); // منع الانهيار بسبب أخطاء الشبكة العابرة
