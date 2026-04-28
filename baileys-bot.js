const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
const port = process.env.PORT || 7860;

// ============================================
// Target Groups Configuration
// ============================================
const TARGET_GROUP_IDS = [
    '120363423769337868@g.us', 
    '120363420793660260@g.us'  
];

const TARGET_GROUP_SET = new Set(TARGET_GROUP_IDS);

let totalMessages = 0;
let successfulReactions = 0;
let lastResponseTime = 0;
const startTime = Date.now();

app.get('/', (req, res) => {
    res.end(`Bot Running | Uptime: ${Math.floor((Date.now() - startTime) / 1000)}s | OK: ${successfulReactions} | Ping: ${lastResponseTime}ms`);
});
app.listen(port, '0.0.0.0', () => console.log(`✅ خادم الويب يعمل على المنفذ ${port}`));

const logger = pino({ level: 'silent' });

async function startBot() {
    console.log('⏳ جاري إعداد ملفات الجلسة في بيئة آمنة...');
    const { state, saveCreds } = await useMultiFileAuthState('/app/auth_info_baileys');
    
    // 🚨 الحل الجذري: جلب أحدث إصدار لواتساب ويب لتجنب الرفض (SSL Alert 0)
    console.log('🔍 جاري التحقق من أحدث إصدار لواتساب ويب...');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[+] تم العثور على الإصدار: v${version.join('.')} (الأحدث: ${isLatest})`);
    
    console.log('⏳ جاري الاتصال بخوادم واتساب لطلب الباركود...');
    
    const sock = makeWASocket({
        version, // تمرير الإصدار الحديث هنا
        logger,
        auth: state,
        // استخدام أداة التمويه الرسمية من المكتبة لضمان تطابق البصمة
        browser: Browsers.ubuntu('Chrome'), 
        connectTimeoutMs: 60000, 
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => ({ conversation: '' }),
        patchMessageBeforeSending: (m) => m,
        shouldSyncHistoryMessage: () => false
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n\n================================');
            console.log('📱 امسح الباركود بسرعة!');
            console.log('================================\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('\n⚠️ انقطع الاتصال! السبب:', lastDisconnect.error?.message);
            if (shouldReconnect) {
                console.log('🔄 جاري محاولة إعادة الاتصال...');
                setTimeout(() => startBot(), 2000);
            }
        } else if (connection === 'open') {
            console.log('\n✅ اتصال WebSockets مفتوح! البوت جاهز للاقتناص بوضع Turbo.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    const sendMsg = sock.sendMessage.bind(sock);
    // 1. تجهيز محرك البحث النصي خارج الدالة ليكون جاهزاً فوراً
    const targetRegex = /التسجيل لحجز/;
    
    const processMessage = (msg) => {
        // 2. الفشل السريع: إذا لم يكن هناك نص، اخرج فوراً دون استهلاك CPU
        const txt = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        if (!txt || !targetRegex.test(txt)) return;
    
        // 3. التحقق من المجموعة (بعد التأكد من النص لتوفير الجهد)
        const jid = msg.key.remoteJid;
        if (!TARGET_GROUP_SET.has(jid)) return;
    
        // ⚡ الضربة القاضية: أرسل التفاعل فوراً قبل أي عملية أخرى
        const t0 = performance.now();
        sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).then(() => {
            // حساب السجلات يتم بعد إتمام المهمة بنجاح
            lastResponseTime = (performance.now() - t0).toFixed(2);
            successfulReactions++;
            console.log(`⚡ استجابة فورية: ${lastResponseTime}ms`);
        }).catch(() => {});
    };

    console.log('🔥 جاري تسخين محرك V8 لأقصى سرعة...');
    const dummyMsg = { key: { fromMe: false, remoteJid: TARGET_GROUP_IDS[0] }, message: { conversation: '' } };
    for (let i = 0; i < 10000; i++) {
        if (dummyMsg.message.conversation.indexOf('تخطي') !== -1) {}
    }
    console.log('🚀 اكتمل التسخين!');

    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        const len = messages.length;
        for (let i = 0; i < len; i++) {
            processMessage(messages[i]);
        }
    });
}

startBot().catch(console.error);

process.on('SIGTERM', () => process.exit(0));
process.on('unhandledRejection', (err) => {
    // تجاهل أخطاء الاتصال المزعجة لكي لا ينهار السيرفر
});
