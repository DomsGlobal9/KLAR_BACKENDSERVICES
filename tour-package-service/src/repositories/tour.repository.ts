import { TourQueryModel, ITourQueryDocument } from "../model/tour.model";
import { ITourQuery } from "../types/tour.types";

export class TourQueryRepository {
  async createQuery(queryData: ITourQuery): Promise<ITourQueryDocument> {
    return await TourQueryModel.create(queryData);
  }
}