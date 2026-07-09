import { Request, Response } from 'express';
import visaService from '../service/visa.service';
import { VALID_CATEGORIES } from '../service/visa.service';

export class VisaController {
    // Helper function to get string from params
    // private getStringParam(param: string | string[]): string {
    //     return Array.isArray(param) ? param[0] : param;
    // }

    private getStringParam(param: any): string {
    if (!param) return '';
    if (Array.isArray(param)) {
        return typeof param[0] === 'string' ? param[0] : JSON.stringify(param[0]);
    }
    if (typeof param === 'object') {
        return ''; // Filters out nested ParsedQs structures safely
    }
    return String(param);
}


    // POST: Create a standard visa plan
    async createVisaPlan(req: Request, res: Response): Promise<void> {
        try {
            const planData = req.body;
            
            // Basic input check
            if (!planData.title || !planData.country) {
                res.status(400).json({
                    success: false,
                    message: "Failed to create plan: 'title' and 'country' fields are required."
                });
                return;
            }

            const newPlan = await visaService.createVisaPlan(planData);
            res.status(201).json({
                success: true,
                message: 'Visa plan created successfully',
                data: newPlan
            });
        } catch (error) {
            console.error('Error creating visa plan:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create visa plan',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // GET: Retrieve all active visa plans
    async getVisaPlans(req: Request, res: Response): Promise<void> {
        try {
            const { country } = req.query;
            const filter: any = {};

            if (country) {
                const searchStr = this.getStringParam(country).trim();
                // Matches either the target country directly or structural alias combinations
                filter.$or = [
                    { country: { $regex: new RegExp(`^${searchStr}$`, 'i') } },
                    { countryAliases: { $regex: new RegExp(`^${searchStr}$`, 'i') } }
                ];
            }

            const plans = await visaService.getVisaPlans(filter);
            res.status(200).json({
                success: true,
                count: plans.length,
                data: plans
            });
        } catch (error) {
            console.error('Error fetching visa plans:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch visa plans',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }






    // Submit visa application
    async submitVisaApplication(req: Request, res: Response): Promise<void> {
        try {
            const visaData = req.body;
            const application = await visaService.submitVisaApplication(visaData);

            res.status(201).json({
                success: true,
                message: 'Visa application submitted successfully',
                data: application
            });
        } catch (error) {
            console.error('Error submitting visa:', error);
            res.status(400).json({
                success: false,
                message: 'Failed to submit visa application',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Get all visa applications
    async getVisaApplications(req: Request, res: Response): Promise<void> {
        try {
            const { visaCategory, page = 1, limit = 10 } = req.query;

            const filter: any = {};
            if (visaCategory) {
                // Convert to string if it's an array
                const categoryStr = this.getStringParam(visaCategory as string | string[]);
                
                // Validate category
                if (!VALID_CATEGORIES.includes(categoryStr as any)) {
                    res.status(400).json({
                        success: false,
                        message: `Invalid category. Must be: ${VALID_CATEGORIES.join(', ')}`
                    });
                    return;
                }
                filter.visaCategory = categoryStr;
            }

            const result = await visaService.getVisaApplications(
                filter,
                Number(page),
                Number(limit)
            );

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    pages: result.pages
                }
            });
        } catch (error) {
            console.error('Error fetching applications:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch visa applications',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Get single visa application
    async getVisaApplicationById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const idStr = this.getStringParam(id);
            const application = await visaService.getVisaApplicationById(idStr);

            res.status(200).json({
                success: true,
                data: application
            });
        } catch (error) {
            console.error('Error fetching application:', error);
            
            if (error instanceof Error && error.message === 'Visa application not found') {
                res.status(404).json({
                    success: false,
                    message: 'Visa application not found'
                });
                return;
            }

            res.status(500).json({
                success: false,
                message: 'Failed to fetch visa application',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Update visa application
    async updateVisaApplication(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const idStr = this.getStringParam(id);
            const updateData = req.body;
            const application = await visaService.updateVisaApplication(idStr, updateData);

            res.status(200).json({
                success: true,
                message: 'Visa application updated successfully',
                data: application
            });
        } catch (error) {
            console.error('Error updating application:', error);
            
            if (error instanceof Error && error.message === 'Visa application not found') {
                res.status(404).json({
                    success: false,
                    message: 'Visa application not found'
                });
                return;
            }

            res.status(400).json({
                success: false,
                message: 'Failed to update visa application',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Delete visa application
    async deleteVisaApplication(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const idStr = this.getStringParam(id);
            const application = await visaService.deleteVisaApplication(idStr);

            res.status(200).json({
                success: true,
                message: 'Visa application deleted successfully',
                data: application
            });
        } catch (error) {
            console.error('Error deleting application:', error);
            
            if (error instanceof Error && error.message === 'Visa application not found') {
                res.status(404).json({
                    success: false,
                    message: 'Visa application not found'
                });
                return;
            }

            res.status(500).json({
                success: false,
                message: 'Failed to delete visa application',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Get applications by category
    async getApplicationsByCategory(req: Request, res: Response): Promise<void> {
        try {
            const { category } = req.params;
            const categoryStr = this.getStringParam(category);
            const { page = 1, limit = 10 } = req.query;

            const result = await visaService.getApplicationsByCategory(
                categoryStr,
                Number(page),
                Number(limit)
            );

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    pages: result.pages
                }
            });
        } catch (error) {
            console.error('Error fetching applications by category:', error);
            
            if (error instanceof Error && error.message.includes('Invalid category')) {
                res.status(400).json({
                    success: false,
                    message: error.message
                });
                return;
            }

            res.status(500).json({
                success: false,
                message: 'Failed to fetch applications',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Get count by category
    async getCountByCategory(req: Request, res: Response): Promise<void> {
        try {
            const { category } = req.params;
            const categoryStr = this.getStringParam(category);
            const count = await visaService.getCountByCategory(categoryStr);

            res.status(200).json({
                success: true,
                data: {
                    category: categoryStr,
                    count
                }
            });
        } catch (error) {
            console.error('Error getting count:', error);
            
            if (error instanceof Error && error.message.includes('Invalid category')) {
                res.status(400).json({
                    success: false,
                    message: error.message
                });
                return;
            }

            res.status(500).json({
                success: false,
                message: 'Failed to get application count',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Get application by email
    async getApplicationByEmail(req: Request, res: Response): Promise<void> {
        try {
            const { email } = req.params;
            const emailStr = this.getStringParam(email);
            const application = await visaService.getApplicationByEmail(emailStr);

            if (!application) {
                res.status(404).json({
                    success: false,
                    message: 'No visa application found with this email'
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: application
            });
        } catch (error) {
            console.error('Error fetching application by email:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch application',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

export default new VisaController();