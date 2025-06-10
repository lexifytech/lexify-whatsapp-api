# Estágio de build
FROM node:22-alpine AS build

# Configura npm para evitar problemas de memória
ENV NODE_OPTIONS="--max-old-space-size=2048"

WORKDIR /app

# Copia os arquivos de configuração
COPY package*.json ./
COPY tsconfig*.json ./

# Usa npm install em vez de npm ci para maior estabilidade
RUN npm install --no-fund --no-audit

# Copia o código fonte
COPY src/ ./src/
COPY nest-cli.json ./

# Compila o projeto
RUN npm run build

# Estágio de produção
FROM node:22-alpine AS production

WORKDIR /app

# Define variáveis de ambiente para produção
ENV NODE_ENV=production

# Copia apenas os arquivos necessários do estágio de build
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist/ ./dist/

# Usa npm install em vez de npm ci para maior estabilidade
RUN npm install --omit=dev --no-fund --no-audit

# Cria diretório para armazenar as sessões do WhatsApp
RUN mkdir -p /app/sessions

# Expõe a porta da aplicação
EXPOSE 3000

# Define o comando para iniciar a aplicação
CMD ["node", "dist/main.js"]