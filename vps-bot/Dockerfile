# Imagem oficial do Playwright já vem com Chromium + dependências do Linux
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Instala deps primeiro (cache)
COPY package*.json ./
RUN npm install --omit=dev

# Copia código
COPY src ./src

# Pasta pra screenshots locais (debug)
RUN mkdir -p /app/screenshots

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
