import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// Tüm hataları yakalar. Prod'da stack trace/iç detay sızdırmaz; 5xx'leri loglar.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: unknown = 'Internal server error';
    let error: string | undefined;
    if (isHttp) {
      const r = exception.getResponse();
      if (typeof r === 'string') message = r;
      else {
        message = (r as any).message ?? message;
        error = (r as any).error;
      }
    } else if (!isProd) {
      message = (exception as any)?.message ?? message;
    }

    // 5xx ve beklenmeyen hataları her zaman logla (stack dahil)
    if (!isHttp || status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        (exception as any)?.stack,
      );
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
