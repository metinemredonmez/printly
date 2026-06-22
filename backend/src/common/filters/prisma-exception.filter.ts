import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

// Prisma hatalarını anlamlı HTTP koduna çevirir ve HAM mesaj/dosya yolu/constraint
// detayını yanıta sızdırmaz (yalnız loglar). AllExceptionsFilter'dan önce devreye girer.
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaException');

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.BAD_REQUEST;
    let message = 'Geçersiz istek';
    let code: string | undefined;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      code = exception.code;
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[] | undefined)?.join(', ');
          message = target ? `Bu alan zaten kullanımda: ${target}` : 'Kayıt zaten mevcut';
          break;
        }
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'İlişkili kayıt bulunamadı (geçersiz referans)';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Kayıt bulunamadı';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = 'Veritabanı isteği işlenemedi';
      }
    } else {
      // PrismaClientValidationError (eksik/yanlış tip argüman) — şema detayı sızdırma
      code = 'VALIDATION';
      status = HttpStatus.BAD_REQUEST;
      message = 'Geçersiz veri (eksik veya hatalı alan)';
    }

    this.logger.warn(`${req.method} ${req.url} → Prisma ${code ?? '?'} → ${status}`);

    res.status(status).json({
      statusCode: status,
      error: code,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
