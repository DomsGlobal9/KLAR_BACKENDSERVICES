import VisaApplication, { IVisaApplication } from '../models/VisaApplication.model';

export class VisaRepository {
    // Create
    async create(visaData: Partial<IVisaApplication>): Promise<IVisaApplication> {
        const visa = new VisaApplication(visaData);
        return await visa.save();
    }

    // Find all with pagination and filter
    async findAll(
        filter: Record<string, any> = {},
        page: number = 1,
        limit: number = 10
    ): Promise<{ data: IVisaApplication[]; total: number }> {
        const skip = (page - 1) * limit;
        
        const [data, total] = await Promise.all([
            VisaApplication.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            VisaApplication.countDocuments(filter)
        ]);

        return { data, total };
    }

    // Find by ID
    async findById(id: string): Promise<IVisaApplication | null> {
        return await VisaApplication.findById(id).lean();
    }

    // Update by ID
    async updateById(
        id: string,
        updateData: Partial<IVisaApplication>
    ): Promise<IVisaApplication | null> {
        return await VisaApplication.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).lean();
    }

    // Delete by ID
    async deleteById(id: string): Promise<IVisaApplication | null> {
        return await VisaApplication.findByIdAndDelete(id).lean();
    }

    // Find by category
    async findByCategory(
        category: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{ data: IVisaApplication[]; total: number }> {
        const skip = (page - 1) * limit;
        
        // Fix: Cast category to the correct type
        const [data, total] = await Promise.all([
            VisaApplication.find({ 
                visaCategory: category as 'employment' | 'family' | 'tourist' | 'student' | 'business'
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            VisaApplication.countDocuments({ 
                visaCategory: category as 'employment' | 'family' | 'tourist' | 'student' | 'business'
            })
        ]);

        return { data, total };
    }

    // Find by email
    async findByEmail(email: string): Promise<IVisaApplication | null> {
        return await VisaApplication.findOne({ email }).lean();
    }

    // Count applications by category
    async countByCategory(category: string): Promise<number> {
        return await VisaApplication.countDocuments({ 
            visaCategory: category as 'employment' | 'family' | 'tourist' | 'student' | 'business'
        });
    }
}

export default new VisaRepository();