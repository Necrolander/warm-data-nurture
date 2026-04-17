# Imagem oficial do Playwright já vem com Chromium + dependências do Linux (também serve pro whatsapp-web.js que usa Puppeteer)
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

WORKDIR /app

# Instala deps primeiro (cache)
COPY package*.json ./
RUN npm install --omit=dev

# Copia código
COPY src ./src

# Pastas pra screenshots iFood + sessão WhatsApp
RUN mkdir -p /app/screenshots /app/wa-session /app/browser-data

ENV NODE_ENV=production

# Roda iFood bot + WhatsApp bot em paralelo
CMD ["npm", "run", "start:all"]
