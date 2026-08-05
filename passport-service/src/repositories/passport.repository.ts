import PassportQuote, { IPassportQuoteDocument } from "../model/passport.model";
import { IPassportQuote } from "../types/passport.types";

export class PassportRepository {
  async createQuote(data: IPassportQuote): Promise<IPassportQuoteDocument> {
    return await PassportQuote.create(data);
  }
}