const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const TARGET_PHRASE = 'التسجيل لحجز';
const AUTH_DIR = '/app/auth_info_baileys'; // مسار الجلسة في Render
const app = express();

let okCount = 0;
let lastMs = 0;

app.get('/', (req, res) => res.send(`TITAN SYSTEM RUNNING | OK: ${okCount} | Last: ${lastMs}ms`));
app.listen(process.env.PORT || 10000);
const logger = pino({ level: 'silent' });

// ============================================
// 🚑 بروتوكول الشفاء الذاتي الجراحي
// ============================================
function healCryptoCache() {
    try {
        if (!fs.existsSync(AUTH_DIR)) return;
        const files = fs.readdirSync(AUTH_DIR);
        let count = 0;
        for (const file of files) {
            // التحذير الذهبي: لا تمسح ملف الهوية (الباركود) أبداً
            if (file !== 'creds.json') {
                fs.unlinkSync(path.join(AUTH_DIR, file));
                count++;
            }
        }
        console.log(`\n🧹 [عملية التطهير]: تم مسح ${count} ملف تشفير معطوب. (الباركود سليم 100%)`);
    } catch (e) {
        console.error('خطأ أثناء التطهير:', e);
    }
}

// ============================================
// 🛡️ دروع الخلود (منع السيرفر من الانهيار)
// ============================================
process.on('uncaughtException', (err) => {
    console.error('\n🚨 [درع التيتانيوم] تم صد خطأ قاتل:', err.message);
    if (err.message.includes('MAC') || err.message.includes('decrypt')) {
        console.log('🔄 يتم الآن تشغيل الشفاء الذاتي في الخلفية...');
        healCryptoCache();
    }
});

process.on('unhandledRejection', (err) => {
    console.error('\n🚨 [درع التيتانيوم] تم صد خطأ في الوعود:', err.message || err);
});

// ============================================
// 🚀 المحرك الأساسي
// ============================================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
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
            console.log('📱 امسح الباركود الآن (هذه المرة الأخيرة إن شاء الله):');
            require('qrcode-terminal').generate(u.qr, { small: true });
        }
        if (u.connection === 'close') {
            const code = u.lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === 'open') {
            console.log('🚀 نظام التيتانيوم: الرادار الشامل نشط لا يقهر');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ============================================
    // ⚡ المسار الذهبي المعزز
    // ============================================
    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (const m of messages) {
            if (!m.message) continue;

            const txt = m.message.conversation || m.message.extendedTextMessage?.text;
            if (!txt) continue;

            const jid = m.key.remoteJid;

            // 📱 باب القيادة عن بعد (أنت فقط من يملك هذا الزر)
            if (m.key.fromMe && txt === 'تطهير') {
                healCryptoCache();
                console.log('👑 تلقيت أمر القيادة: تم غسل المحرك بنجاح!');
                continue; 
            }

            // 🧨========================================🧨
            // 🌪️ زر إطلاق عاصفة المحاكاة (Stress Test)
            // 🧨========================================🧨
            if (m.key.fromMe && txt === 'محاكاة') {
                console.log('\n🚨 [تحذير]: تم تفعيل بروتوكول المحاكاة القصوى!');
                console.log('🌪️ يتم الآن توليد وحقن 3000 رسالة في الذاكرة...');
                
                const fakeMessages = [];
                // 1. توليد 2999 رسالة تشويش عمياء
                for (let i = 0; i < 2999; i++) {
                    fakeMessages.push({
                        key: { remoteJid: `12036300000${i}@g.us`, fromMe: false, id: `FAKE_ID_${i}` },
                        message: { conversation: `رسالة تشويش عشوائية لزيادة الضغط رقم ${i} 🚀🔥` }
                    });
                }
                
                // 2. زرع الهدف الحقيقي في النهاية (رقم 3000)
                fakeMessages.push({
                    key: { remoteJid: `99999999999@g.us`, fromMe: false, id: `TARGET_ID_3000` },
                    message: { conversation: `⚽ التسجيل لحجز يوم الجمعة` }
                });

                // 3. حقن الـ 3000 رسالة دفعة واحدة في دماغ البوت ليرتبك
                const tStart = performance.now();
                sock.ev.emit('messages.upsert', { messages: fakeMessages, type: 'notify' });
                const tEnd = performance.now();
                
                console.log(`⏱️ انتهى الحقن! الوقت المستغرق لتوليد وضخ 3000 رسالة: ${(tEnd - tStart).toFixed(2)}ms\n`);
                continue;
            }

            // فخ كشف المعرفات
            if (m.key.fromMe && txt === 'ايدي') {
                console.log(`🎯 معرف المحادثة: ${jid}`);
                continue;
            }

            // تجاهل باقي رسائلك الشخصية لمنع التكرار اللانهائي
            if (m.key.fromMe) continue;

            // ⚡ الاقتناص
            if (txt.includes(TARGET_PHRASE)) {
                const t0 = performance.now();
                
                // تخطي إرسال الرد الفعلي لـ WhatsApp إذا كان المعرف وهمياً (من المحاكاة)
                if (!jid.includes('12036300000') && !jid.includes('99999999999')) {
                    sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                }

                process.nextTick(() => {
                    lastMs = (performance.now() - t0).toFixed(2);
                    okCount++;
                    console.log(`⚡ تم الاقتناص: ${lastMs}ms | 🎯 الهدف: ${jid}`);
                });
            }
        }
    });

    // 🔥 تسخين المحرك
    for (let i = 0; i < 10000; i++) {
        const dummy = "التسجيل لحجز";
        dummy.includes(TARGET_PHRASE);
    }
}

startBot().catch(() => {});
