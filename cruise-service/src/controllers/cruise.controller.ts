import { Request, Response } from 'express';
import cruiseService from '../service/cruise.service';

export class CruiseController {

    // POST: Submit a new cruise enquiry
    async submitEnquiry(req: Request, res: Response): Promise<void> {
        try {
            const enquiryData = req.body;

            // Validate required fields
            const requiredFields = ['departurePort', 'sailMonth', 'nights', 'fullName', 'mobileNumber', 'emailId'];
            const missingFields = requiredFields.filter(field => !enquiryData[field]);

            if (missingFields.length > 0) {
                res.status(400).json({
                    success: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`
                });
                return;
            }

            const enquiry = await cruiseService.submitCruiseEnquiry(enquiryData);

            res.status(201).json({
                success: true,
                message: 'Cruise enquiry submitted successfully',
                data: enquiry
            });
        } catch (error) {
            console.error('Error submitting cruise enquiry:', error);
            res.status(400).json({
                success: false,
                message: 'Failed to submit cruise enquiry',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // GET, PATCH, DELETE handlers removed per request
}

export default new CruiseController();
