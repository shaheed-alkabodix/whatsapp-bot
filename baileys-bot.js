const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

// ============================================
// 🛠️ المحرك الفائق (Ultra-Fast Engine Config)
// ============================================
const TARGET_IDS = new Set(['120363423769337868@g.us', '120363420793660260@g.us']);
const TARGET_PHRASE = 'التسجيل لحجز';
const app = express();

// إحصائيات صامتة (خارج المسار السريع لضمان السرعة)
let okCount = 0;
let lastMs = 0;

// خادم الويب (لإبقاء UptimeRobot سعيداً)
app.get('/', (req, res) => res.send(`RUNNING | OK: ${okCount} | Last: ${lastMs}ms`));
app.listen(process.env.PORT || 10000);

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
        keepAliveIntervalMs: 10000, // نبضات قلب سريعة لإبقاء الاتصال "ساخناً"
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => ({ conversation: '' }),
        shouldSyncHistoryMessage: () => false
    });

    sock.ev.on('connection.update', (u) => {
        if (u.qr) {
            console.log('📱 امسح الباركود الآن:');
            require('qrcode-terminal').generate(u.qr, { small: true });
        }
        if (u.connection === 'close') {
            const code = u.lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === 'open') {
            console.log('🚀 وضع الاقتناص الفوري: نشط');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ============================================
    // ⚡ المسار الذهبي (The Golden Path) - السرعة المطلقة
    // ============================================
    sock.ev.on('messages.upsert', ({ messages, type }) => {
        // فحص سريع جداً (Bitwise optimization)
        if (type !== 'notify') return;
        
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        // استخراج النص بأقل استهلاك للذاكرة
        const txt = m.message.conversation || m.message.extendedTextMessage?.text;
        
        // 1. الفحص النصي (Raw Search) - أسرع من Regex في Node.js
        if (txt && txt.includes(TARGET_PHRASE)) {
            
            // 2. فحص المجموعة (JID Check)
            const jid = m.key.remoteJid;
            if (TARGET_IDS.has(jid)) {
                
                // 3. التنفيذ اللحظي (Immediate Execution)
                // نرسل الطلب فوراً دون انتظار أي حسابات أخرى
                const t0 = performance.now();
                sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

                // 4. معالجة السجلات لاحقاً (Deferred Logging) لكي لا نعطل المسار
                process.nextTick(() => {
                    lastMs = (performance.now() - t0).toFixed(2);
                    okCount++;
                    console.log(`⚡ تم الاقتناص: ${lastMs}ms`);
                });
            }
        }
    });

    // 🔥 "كي" المحرك (Engine Priming)
    // تشغيل عمليات بحث وهمية لتدريب مترجم JIT في Node.js على الكود
    for (let i = 0; i < 10000; i++) {
        const dummy = "نص عشوائي للتسجيل لحجز وهمي";
        dummy.includes(TARGET_PHRASE);
    }
}

startBot().catch(() => {});
