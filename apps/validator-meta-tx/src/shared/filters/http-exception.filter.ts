import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let details = '';
    try {
      details = JSON.parse(exception.message);
    } catch (error) {
      details = exception.message;
    }
    response.status(exception.statusCode).json({
      isHttpError: exception.isHttpError,
      statusCode: exception.statusCode,
      title: exception.title,
      details: details,
    });
  }
}
