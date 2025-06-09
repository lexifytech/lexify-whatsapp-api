import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, WASocket, ConnectionState, DisconnectReason } from '@whiskeysockets/baileys';
import { SessionsType, QRCodesType } from './interfaces/session.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as qrcode from 'qrcode-terminal';
// And use only one of them, preferably:
const pino = require('pino');

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private sessions: SessionsType = {};
  private qrCodes: QRCodesType = {};
  private readonly SESSION_DIR: string;

  constructor() {
    // Use __dirname directly in CommonJS
    this.SESSION_DIR = path.join(path.dirname(path.dirname(__dirname)), 'sessions');
    
    if (!fs.existsSync(this.SESSION_DIR)) {
      fs.mkdirSync(this.SESSION_DIR);
    }
  }

  onModuleInit() {
    this.logger.log('Serviço WhatsApp inicializado');
  }

  async createSession(sessionId: string): Promise<WASocket> {
    this.logger.log(`Iniciando criação de sessão: ${sessionId}`);
    
    // Cria diretório para a sessão se não existir
    const sessionDir = path.join(this.SESSION_DIR, sessionId);
    this.logger.log(`Diretório da sessão: ${sessionDir}`);
    
    if (!fs.existsSync(sessionDir)) {
      this.logger.log(`Criando diretório da sessão: ${sessionDir}`);
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Estado de autenticação para a sessão específica
    this.logger.log(`Carregando estado de autenticação para: ${sessionId}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    // Busca versão mais recente do WhatsApp Web
    this.logger.log('Buscando versão mais recente do WhatsApp Web');
    const { version } = await fetchLatestBaileysVersion();
    
    this.logger.log(`Criando sessão ${sessionId} com Baileys v${version.join('.')}`);

    // Cria socket de conexão
    // Fix makeWASocket usage - remove default import
    // In the createSession method, fix the makeWASocket call
    const sock = makeWASocket({
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: true,
      browser: ['Lexify WhatsApp API', 'Chrome', '10.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 1000
    });

    // Evento para salvar credenciais sempre que atualizam
    sock.ev.on('creds.update', saveCreds);

    // Evento de conexão
    sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Armazena o QR code para ser acessado pela API
      if (qr) {
        this.qrCodes[sessionId] = qr;
        this.logger.log(`QR Code gerado para sessão ${sessionId}`);
        qrcode.generate(qr, { small: true });
      }
      
      if (connection === 'open') {
        this.logger.log(`Sessão ${sessionId} conectada com sucesso ao WhatsApp Web!`);
      } else if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const errorData = (lastDisconnect?.error as any)?.data;
        
        // Verifica se é um erro 401 específico
        const isAuthError = statusCode === 401;
        // Só reconecta se não for erro de autenticação ou logout
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !isAuthError;
        
        this.logger.log(`Conexão fechada para sessão ${sessionId}:`);
        this.logger.log(`Status: ${statusCode}, Dados: ${JSON.stringify(errorData)}`);
        this.logger.log(`Tentando reconectar: ${shouldReconnect}`);
        
        // Remove a sessão do objeto de sessões
        delete this.sessions[sessionId];
        delete this.qrCodes[sessionId];
        
        // Se for erro de autenticação, limpa os arquivos da sessão
        if (isAuthError) {
          const sessionDir = path.join(this.SESSION_DIR, sessionId);
          this.logger.log(`Limpando diretório da sessão devido a erro de autenticação: ${sessionDir}`);
          try {
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
              this.logger.log(`Diretório da sessão ${sessionId} removido com sucesso`);
            }
          } catch (err) {
            this.logger.error(`Erro ao remover diretório da sessão: ${err}`);
          }
        }
        
        // Reconectar se não for credenciais inválidas
        if (shouldReconnect) {
          setTimeout(() => {
            this.logger.log(`Tentando reconectar sessão ${sessionId}...`);
            this.createSession(sessionId);
          }, 5000);
        }
      }
    });

    // Armazena a sessão
    this.sessions[sessionId] = sock;
    return sock;
  }

  async sendMessage(sessionId: string, to: string, text: string) {
    if (!this.sessions[sessionId]) {
      throw new Error('Sessão não encontrada');
    }
    
    // Formata o número de telefone se necessário
    let recipient = to;
    if (!to.includes('@')) {
      recipient = `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    }
    
    // Envia a mensagem
    const result = await this.sessions[sessionId].sendMessage(recipient, { text });
    
    if (!result) {
      throw new Error('Falha ao enviar mensagem');
    }
    
    return result;
  }

  // Make sure this method exists for the controller
  getSession(sessionId: string): WASocket | undefined {
    return this.sessions[sessionId];
  }
  
  // Add these methods at the end of the WhatsappService class
  
  // Get QR code for a session
  getQRCode(sessionId: string): string | undefined {
    return this.qrCodes[sessionId];
  }
  
  // Get all active sessions
  getAllSessions(): string[] {
    return Object.keys(this.sessions);
  }
  
  // Delete a session
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.sessions[sessionId]) {
      throw new Error('Sessão não encontrada');
    }
    
    // Close the connection if it exists
    if (this.sessions[sessionId]) {
      // Either remove listeners for specific events
      this.sessions[sessionId].ev.removeAllListeners('connection.update');
      this.sessions[sessionId].ev.removeAllListeners('messages.upsert');
      this.sessions[sessionId].ev.removeAllListeners('creds.update');
      // Or use a more comprehensive approach to remove all event types
      
      // Delete the session instead of setting to null
      delete this.sessions[sessionId];
    }
    
    // Remove QR code if it exists
    if (this.qrCodes[sessionId]) {
      delete this.qrCodes[sessionId];
    }
    
    // Remove session directory if it exists
    const sessionDir = path.join(this.SESSION_DIR, sessionId);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        this.logger.log(`Diretório da sessão ${sessionId} removido com sucesso`);
      } catch (err) {
        this.logger.error(`Erro ao remover diretório da sessão: ${err}`);
        throw err;
      }
    }
    
    this.logger.log(`Sessão ${sessionId} encerrada com sucesso`);
  }
}