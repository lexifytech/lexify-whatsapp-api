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
      
      // Verifica se a sessão já existe
      if (this.whatsappService.getSession(id)) {
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
      if (!this.whatsappService.getSession(id)) {
        throw new HttpException('Sessão não encontrada', HttpStatus.NOT_FOUND);
      }
      
      const qrCode = this.whatsappService.getQRCode(id);
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
      if (!this.whatsappService.getSession(id)) {
        throw new HttpException('Sessão não encontrada', HttpStatus.NOT_FOUND);
      }
      
      const qrCode = this.whatsappService.getQRCode(id);
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
  getSessionStatus(@Param('id') id: string) {
    try {
      const session = this.whatsappService.getSession(id);
      if (!session) {
        throw new HttpException('Sessão não encontrada', HttpStatus.NOT_FOUND);
      }
      
      // Verifica se a sessão está conectada
      const isConnected = (session as any).user !== undefined;
      
      return { 
        success: true, 
        id, 
        connected: isConnected 
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