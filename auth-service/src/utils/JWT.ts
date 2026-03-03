import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { envConfig } from "../config/env.config";
import { UnauthorizedError } from "../errors/AppError";

export interface TokenPayload {
  userId: string;
  email: string;
  clientType: string;
  roles: string[];
}

export class JWTUtil {
  private static instance: JWTUtil;

  private readonly accessSecret: Secret;
  private readonly refreshSecret: Secret;
  private readonly accessOptions: SignOptions;
  private readonly refreshOptions: SignOptions;

  private constructor() {
    this.accessSecret = envConfig.JWT.SECRET;
    this.refreshSecret = envConfig.JWT.REFRESH_SECRET;

    this.accessOptions = {
      expiresIn: envConfig.JWT.EXPIRES_IN as SignOptions["expiresIn"],
    };

    this.refreshOptions = {
      expiresIn: envConfig.JWT.REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    };
  }

  public static getInstance(): JWTUtil {
    if (!JWTUtil.instance) {
      JWTUtil.instance = new JWTUtil();
    }
    return JWTUtil.instance;
  }

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.accessSecret, this.accessOptions);
  }

  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.refreshSecret, this.refreshOptions);
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.accessSecret) as TokenPayload;
    } catch {
      throw new UnauthorizedError("Invalid or expired access token");
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.refreshSecret) as TokenPayload;
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  }
}