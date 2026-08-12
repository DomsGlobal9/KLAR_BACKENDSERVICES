import CruiseEnquiry, { ICruiseEnquiry } from '../models/CruiseEnquiry.model';

export class CruiseRepository {

    // Create
    async create(enquiryData: Partial<ICruiseEnquiry>): Promise<ICruiseEnquiry> {
        const enquiry = new CruiseEnquiry(enquiryData);
        return await enquiry.save();
    }

    // GET, PATCH, DELETE handlers removed per request
}

export default new CruiseRepository();
