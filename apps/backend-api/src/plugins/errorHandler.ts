import type { FastifyError, FastifyInstance, FastifyPluginAsync } from 'fastify';

export interface ErrorResponseBody {
  error: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  };
}

export const errorHandlerPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;

    const response: ErrorResponseBody = {
      error: {
        statusCode,
        code: error.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
        message: statusCode === 500 && app.initialConfig.logger
          ? 'Internal server error occurred'
          : error.message || 'An error occurred',
      },
    };

    if (error.validation) {
      response.error.code = 'VALIDATION_ERROR';
      response.error.details = error.validation;
    }

    if (statusCode >= 500) {
      request.log.error(error);
    } else {
      request.log.warn(error);
    }

    reply.status(statusCode).send(response);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });
};

