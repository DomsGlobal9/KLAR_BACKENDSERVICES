import { TokenPayload } from './JWT';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};