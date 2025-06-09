import { WASocket } from '@whiskeysockets/baileys';

export interface SessionsType {
  [key: string]: WASocket;
}

export interface QRCodesType {
  [key: string]: string;
}