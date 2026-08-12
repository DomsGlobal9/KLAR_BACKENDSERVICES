import cruiseRepository from '../repository/cruise.repository';
import { ICruiseEnquiry } from '../models/CruiseEnquiry.model';

export class CruiseService {

    // Submit a new cruise enquiry
    async submitCruiseEnquiry(enquiryData: Partial<ICruiseEnquiry>): Promise<ICruiseEnquiry> {
        return await cruiseRepository.create(enquiryData);
    }

    // GET, PATCH, DELETE handlers removed per request
}

export default new CruiseService();
