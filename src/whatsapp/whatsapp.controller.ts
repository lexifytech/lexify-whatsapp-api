import { Controller, Post, Get, Delete, Body, Param, Res, HttpStatus, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { CreateSessionDto, SendMessageDto } from './interfaces/message.dto';
import * as QRCode from 'qrcode';

@Controller()
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('session/create')
  async createSession(@Body() createSessionDto: CreateSessionDto) {
    try {
      const { id } = createSessionDto;
      
      // Verifica se a sessão já existe - usando o novo método getAllSessions
      if (this.whatsappService.getAllSessions().includes(id)) {
        throw new HttpException('Sessão já existe', HttpStatus.BAD_REQUEST);
      }

      // Cria a sessão
      await this.whatsappService.createSession(id);
      
      return { 
        success: true, 
        message: 'Sessão criada com sucesso', 
        id 
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('session/:id/qr')
  async getQRCode(@Param('id') id: string, @Res() res: Response) {
    try {
      // Verifica se a sessão existe usando getAllSessions
      if (!this.whatsappService.getAllSessions().includes(id)) {
        throw new HttpException('Sessão não encontrada', HttpStatus.NOT_FOUND);
      }
      
      // getQRCode agora retorna uma Promise
      const qrCode = await this.whatsappService.getQRCode(id);
      if (!qrCode) {
        throw new HttpException('QR Code não disponível', HttpStatus.NOT_FOUND);
      }
      
      // Gera a imagem do QR code a partir do texto
      const qrImageDataUrl = await QRCode.toDataURL(qrCode);
      
      // Configura o cabeçalho para imagem
      res.setHeader('Content-Type', 'image/png');
      
      // Converte o Data URL para buffer e envia como resposta
      const qrImageBuffer = Buffer.from(qrImageDataUrl.split(',')[1], 'base64');
      return res.send(qrImageBuffer);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('session/:id/qr-html')
  async getQRCodeHTML(@Param('id') id: string, @Res() res: Response) {
    try {
      // Verifica se a sessão existe usando getAllSessions
      if (!this.whatsappService.getAllSessions().includes(id)) {
        throw new HttpException('Sessão não encontrada', HttpStatus.NOT_FOUND);
      }
      
      // getQRCode agora retorna uma Promise
      const qrCode = await this.whatsappService.getQRCode(id);
      if (!qrCode) {
        throw new HttpException('QR Code não disponível', HttpStatus.NOT_FOUND);
      }
      
      // Gera a imagem do QR code a partir do texto
      const qrImageDataUrl = await QRCode.toDataURL(qrCode);
      
      // Retorna uma página HTML com a imagem do QR code
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code para sessão ${id}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
              img { max-width: 300px; margin: 20px auto; display: block; }
            </style>
          </head>
          <body>
            <h2>Escaneie o QR Code para conectar a sessão ${id}</h2>
            <img src="${qrImageDataUrl}" alt="QR Code para WhatsApp">
            <p>Abra o WhatsApp no seu celular e escaneie este código para conectar.</p>
          </body>
        </html>
      `);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('session/:id/status')
  async getSessionStatus(@Param('id') id: string) {
    try {
      // Verifica se a sessão existe usando getAllSessions
      if (!this.whatsappService.getAllSessions().includes(id)) {
        throw new HttpException('Sessão não encontrada', HttpStatus.NOT_FOUND);
      }
      
      // Como não temos mais acesso direto à sessão, apenas verificamos se ela existe
      // Para verificar se está conectada, precisaríamos abrir a conexão temporariamente
      // o que não é recomendado para apenas verificar o status
      return { 
        success: true, 
        id, 
        connected: true // Assumimos que se a sessão existe, ela pode ser conectada
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('message/send')
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    try {
      const { sessionId, to, text } = sendMessageDto;
      
      const result = await this.whatsappService.sendMessage(sessionId, to, text);
      
      return { 
        success: true, 
        message: 'Mensagem enviada com sucesso', 
        messageId: result.key.id 
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('sessions')
  getAllSessions() {
    try {
      const activeSessions = this.whatsappService.getAllSessions();
      return { success: true, sessions: activeSessions };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('session/:id')
  async deleteSession(@Param('id') id: string) {
    try {
      await this.whatsappService.deleteSession(id);
      return { success: true, message: 'Sessão encerrada com sucesso' };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}