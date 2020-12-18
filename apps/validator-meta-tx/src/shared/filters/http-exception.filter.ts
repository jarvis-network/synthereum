import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionObj = exception.getResponse() as any;
    console.log(exceptionObj.message);
    const message = `${exceptionObj.error} ${
      exceptionObj.message && exceptionObj.message.join()
    }`;
    console.log(exception.getResponse() as any);
    response.code(status).send({
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
