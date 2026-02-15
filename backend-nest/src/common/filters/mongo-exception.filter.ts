import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

@Catch(MongooseError.ValidationError, MongoServerError)
export class MongoExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof MongooseError.ValidationError) {
      const errors = Object.values(exception.errors).map(
        (err) => err.message,
      );
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: errors.length ? errors : 'Validation error',
      });
    }

    if (
      exception instanceof MongoServerError &&
      exception.code === 11000
    ) {
      const fields = exception.keyPattern
        ? Object.keys(exception.keyPattern)
        : [];
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message:
          fields.length > 0
            ? `Duplicate value for ${fields.join(', ')}`
            : 'Duplicate key error',
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
