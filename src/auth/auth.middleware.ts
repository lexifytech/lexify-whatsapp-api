import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers['x-api-token'] as string;
    const validToken = this.configService.get<string>('API_TOKEN');

    if (!token || token !== validToken) {
      throw new UnauthorizedException('Token de autenticação inválido');
    }

    next();
  }
}