import { CharterRepository } from "../repositories/charter.repository";
import { CreateCharterInput } from "../utils/charterValidation";

export class CharterService {
  private charterRepository: CharterRepository;

  constructor() {
    this.charterRepository = new CharterRepository();
  }

  async createCharterBooking(data: CreateCharterInput) {
    const booking = await this.charterRepository.create(data);
    return booking;
  }
}