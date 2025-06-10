# Estágio de build
FROM node:22.11.0-alpine AS build

# Adiciona dependências necessárias para compilação nativa
RUN apk add --no-cache python3 make g++

# Configura npm para evitar problemas de memória
ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /app

# Copia os arquivos de configuração
COPY package*.json ./
COPY tsconfig*.json ./

# Usa npm install em vez de npm ci para maior estabilidade
RUN npm install

# Copia o código fonte
COPY src/ ./src/

# Compila o projeto
RUN npm run build

# Estágio de produção
FROM node:22.11.0-alpine AS production

WORKDIR /app

# Define variáveis de ambiente para produção
ENV NODE_ENV=production

# Copia apenas os arquivos necessários do estágio de build
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist/ ./dist/

# Usa npm install em vez de npm ci para maior estabilidade
RUN npm install --omit=dev

# Cria diretório para armazenar as sessões do WhatsApp
RUN mkdir -p /app/sessions

# Expõe a porta da aplicação
EXPOSE 3000

# Define o comando para iniciar a aplicação
CMD ["node", "dist/main.js"]