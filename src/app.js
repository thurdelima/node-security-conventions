import 'dotenv/config';
import helmet from 'helmet';
import redis from 'redis';
import RateLimit from 'express-rate-limit';
import RateLimitRedis from 'rate-limit-redis';
import express from 'express';
import path from 'path';
import cors from 'cors';
import Youch from 'youch';
import * as Sentry from '@sentry/node';
import 'express-async-errors';
import routes from './routes';
import sentryConfig from './config/sentry';


import './database';

class App {
  constructor() {
    this.server = express();

    Sentry.init(sentryConfig);

    this.middlewares();
    this.routes();
    this.exceptionHandler();
  }

  middlewares() {
    // The request handler must be the first middleware on the app
    this.server.use(Sentry.Handlers.requestHandler());
    this.server.use(helmet());
    this.server.use(cors({
      origin: process.env.FRONT_URL,
    }));
    this.server.use(express.json());
    
    this.server.use(
      '/files',
      express.static(path.resolve(__dirname, '..', 'tmp', 'uploads'))
    );

    if (process.env.NODE_ENV !== 'development') {
      //configure rate limit  
      this.server.use(new RateLimit({
        store: new RateLimitRedis({
          client: redis.createClient({
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
          })
        }),
        //é em milisegundo, (1000 * 60 da um minuto, vezes 15, 15 minutos)
        windowMs: 1000 * 60 * 15,
        //máximo de requisições dentro desse tempo
        max: 100,
      }));
    }


    
  
  
  }

  routes() {
    this.server.use(routes);
    // The error handler must be before any other error middleware and after all controllers
    this.server.use(Sentry.Handlers.errorHandler());
  }

  exceptionHandler() {
    this.server.use(async (err, req, res, next) => {
      if (process.env.NODE_ENV === 'development') {
        const errors = await new Youch(err, req).toJSON();

        return res.status(500).json(errors);
      }

      return res.status(500).json('internal server error');
    });
  }
}

export default new App().server;
