import { CharterModel, ICharterDocument } from "../model/charter.model";
import { CreateCharterInput } from "../utils/charterValidation";

export class CharterRepository {
  async create(data: CreateCharterInput): Promise<ICharterDocument> {
    const newBooking = new CharterModel({
      ...data,
      departureDateTime: new Date(data.departureDateTime),
    });
    return await newBooking.save();
  }
}