# ============================================
# Ultra Fast Dockerfile - Node 20 Full (SSL Fix)
# ============================================
# نستخدم النسخة الكاملة (non-slim) لتجنب مشاكل SSL
FROM node:20-bullseye

WORKDIR /app

# تثبيت CA certificates و SSL libraries
RUN apt-get update && \
    apt-get install -y \
        ca-certificates \
        openssl \
        git && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# نسخ الملفات
COPY package*.json ./
COPY baileys-bot.js ./

# التثبيت
RUN npm install --production && \
    npm cache clean --force

# 🚨 الضربة القاضية لمشكلة الصلاحيات في Hugging Face
RUN chmod -R 777 /app

ENV NODE_ENV=production \
    PORT=7860 \
    NODE_OPTIONS=--tls-min-v1.2

EXPOSE 7860

# تشغيل البوت
CMD ["node", "--no-warnings", "--max-old-space-size=1024", "baileys-bot.js"]