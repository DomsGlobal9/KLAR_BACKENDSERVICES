import visaRepository from '../repository/visa.repository';
import { IVisaApplication, IVisaPlan } from '../models/VisaApplication.model';

export type VisaCategory = 'employment' | 'family' | 'tourist' | 'student' | 'business';

export const VALID_CATEGORIES: VisaCategory[] = [
    'employment', 'family', 'tourist', 'student', 'business'
];

export class VisaService {


    // Create new custom database plan
    async createVisaPlan(planData: Partial<IVisaPlan>): Promise<any> {
        return await visaRepository.createVisaPlan(planData);
    }

    // Get matching plans or fetch fallback arrays dynamically
    async getVisaPlans(filter: any): Promise<any[]> {
        const storedPlans = await visaRepository.findVisaPlans(filter);
        
        // If the query specified a country but no exact matches were found, output the dynamic fallbacks
        if (storedPlans.length === 0 && filter.$or) {
            const requestedCountry = filter.$or[0].country.$regex.source.replace(/[\^$]/g, '');
            return this.generateDynamicFallbackPlans(requestedCountry);
        }

        return storedPlans;
    }

    // Standalone structured format fallback generator
    private generateDynamicFallbackPlans(countryName: string): any[] {
        return [
            {
                id: `dynamic-${Date.now()}-tourist`,
                title: 'Standard Tourist Visa',
                isPopular: true,
                processingTime: '4-7 Working Days',
                stayPeriod: '30 Days',
                validity: '90 Days',
                entry: 'Single Entry',
                country: countryName
            },
            {
                id: `dynamic-${Date.now()}-business`,
                title: 'Commercial Business Visa',
                processingTime: '5-10 Working Days',
                stayPeriod: '90 Days',
                validity: '180 Days',
                entry: 'Multiple Entry',
                country: countryName
            }
        ];
    }




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