import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { AuthMiddleware } from '../auth/auth.middleware';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(WhatsappController);
  }
}