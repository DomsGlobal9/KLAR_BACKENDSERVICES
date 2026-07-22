import { TourQueryRepository } from "../repositories/tour.repository";
import { ITourQuery } from "../types/tour.types";

export class TourQueryService {
  private tourQueryRepository: TourQueryRepository;

  constructor() {
    this.tourQueryRepository = new TourQueryRepository();
  }

  async submitQuery(queryData: ITourQuery) {
    const newQuery = await this.tourQueryRepository.createQuery(queryData);
    
    // Additional business logic like sending email notifications can be called here
    
    return newQuery;
  }
}