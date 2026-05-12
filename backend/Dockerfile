FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# Instalar dependências
COPY package.json ./
RUN npm install --omit=dev=false

# Copiar código
COPY prisma ./prisma
COPY src ./src
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Gerar cliente Prisma
RUN npx prisma generate

EXPOSE 3001

# Script de inicialização: resolve migrations com falha, migrate, seed, start
CMD ["sh", "./start.sh"]
