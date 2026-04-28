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
