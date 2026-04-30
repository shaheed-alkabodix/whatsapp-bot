const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

// ============================================
// 🛠️ وضع الرادار الشامل (Global Radar)
// ============================================
// تم إلغاء مصفوفة المجموعات، البوت الآن يضرب في كل مكان
const TARGET_PHRASE = 'التسجيل لحجز';
const app = express();

// إحصائيات صامتة
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
        keepAliveIntervalMs: 10000,
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
            console.log('🚀 وضع الرادار الشامل: نشط ومستعد للاقتناص');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ============================================
    // ⚡ المسار الذهبي (The Golden Path)
    // ============================================
    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        
        // استخدام حلقة تكرار لمعالجة الدفعة بالكامل في نفس اللحظة
        for (const m of messages) {
            if (!m.message || m.key.fromMe) continue;

            const txt = m.message.conversation || m.message.extendedTextMessage?.text;
            if (!txt) continue;

            const jid = m.key.remoteJid;

            // 🪤 فخ كشف المعرفات (إذا أرسلت أنت من رقم آخر كلمة "ايدي" سيطبع لك المعرف)
            if (txt === 'ايدي') {
                console.log(`\n========================================`);
                console.log(`🎯 معرف المحادثة/المجموعة هو: ${jid}`);
                console.log(`========================================\n`);
            }

            // ⚡ الفحص النصي والضرب المباشر
            if (txt.includes(TARGET_PHRASE)) {
                const t0 = performance.now();
                sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

                // معالجة السجلات لاحقاً لكي لا نعطل المسار السريع
                process.nextTick(() => {
                    lastMs = (performance.now() - t0).toFixed(2);
                    okCount++;
                    console.log(`⚡ تم الاقتناص في: ${lastMs}ms | 🎯 المعرف: ${jid}`);
                });
            }
        }
    });

    // 🔥 "كي" المحرك (Engine Priming)
    for (let i = 0; i < 10000; i++) {
        const dummy = "نص عشوائي للتسجيل لحجز وهمي";
        dummy.includes(TARGET_PHRASE);
    }
}

startBot().catch(() => {});
