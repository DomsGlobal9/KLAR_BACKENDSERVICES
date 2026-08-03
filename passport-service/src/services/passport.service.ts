import { PassportRepository } from "../repositories/passport.repository";
import { IPassportQuote } from "../types/passport.types";

export class PassportService {
  private passportRepository: PassportRepository;

  constructor() {
    this.passportRepository = new PassportRepository();
  }

  async requestQuote(quoteData: IPassportQuote) {
    return await this.passportRepository.createQuote(quoteData);
  }
}