import visaRepository from '../repository/visa.repository';
import { IVisaApplication } from '../models/VisaApplication.model';

export type VisaCategory = 'employment' | 'family' | 'tourist' | 'student' | 'business';

export const VALID_CATEGORIES: VisaCategory[] = [
    'employment', 'family', 'tourist', 'student', 'business'
];

export class VisaService {
    // Submit visa application
    async submitVisaApplication(visaData: Partial<IVisaApplication>): Promise<IVisaApplication> {
        // Set visa category based on purpose or fields provided
        let visaCategory: VisaCategory = 'tourist';

        if (visaData.employmentStatus || visaData.companyName) {
            visaCategory = 'employment';
        } else if (visaData.numberOfAdults || visaData.numberOfChildren) {
            visaCategory = 'family';
        } else if (visaData.visaType) {
            const type = visaData.visaType.toLowerCase();
            if (VALID_CATEGORIES.includes(type as VisaCategory)) {
                visaCategory = type as VisaCategory;
            }
        }

        const applicationData = {
            ...visaData,
            visaCategory
        };

        return await visaRepository.create(applicationData);
    }

    // Get all visa applications with pagination
    async getVisaApplications(
        filter: any = {},
        page: number = 1,
        limit: number = 10
    ): Promise<{ data: IVisaApplication[]; total: number; page: number; limit: number; pages: number }> {
        const { data, total } = await visaRepository.findAll(filter, page, limit);
        
        return {
            data,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        };
    }

    // Get single visa application by ID
    async getVisaApplicationById(id: string): Promise<IVisaApplication> {
        const application = await visaRepository.findById(id);
        
        if (!application) {
            throw new Error('Visa application not found');
        }
        
        return application;
    }

    // Update visa application
    async updateVisaApplication(
        id: string,
        updateData: Partial<IVisaApplication>
    ): Promise<IVisaApplication> {
        const application = await visaRepository.updateById(id, updateData);
        
        if (!application) {
            throw new Error('Visa application not found');
        }
        
        return application;
    }

    // Delete visa application
    async deleteVisaApplication(id: string): Promise<IVisaApplication> {
        const application = await visaRepository.deleteById(id);
        
        if (!application) {
            throw new Error('Visa application not found');
        }
        
        return application;
    }

    // Get applications by category with pagination
    async getApplicationsByCategory(
        category: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{ data: IVisaApplication[]; total: number; page: number; limit: number; pages: number }> {
        // Validate category
        if (!VALID_CATEGORIES.includes(category as VisaCategory)) {
            throw new Error(`Invalid category. Must be: ${VALID_CATEGORIES.join(', ')}`);
        }

        const { data, total } = await visaRepository.findByCategory(category, page, limit);
        
        return {
            data,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        };
    }

    // Get application by email
    async getApplicationByEmail(email: string): Promise<IVisaApplication | null> {
        return await visaRepository.findByEmail(email);
    }

    // Get count by category
    async getCountByCategory(category: string): Promise<number> {
        if (!VALID_CATEGORIES.includes(category as VisaCategory)) {
            throw new Error(`Invalid category. Must be: ${VALID_CATEGORIES.join(', ')}`);
        }
        return await visaRepository.countByCategory(category);
    }
}

export default new VisaService();