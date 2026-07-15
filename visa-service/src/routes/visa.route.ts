import { Router } from 'express';
import visaController from '../controllers/visa.controller';

const router = Router();


// Create a new visa plan configuration (Without fee requirement)
router.post('/plans', visaController.createVisaPlan.bind(visaController));

// Get all visa plans (Supports filtering by country parameter)
router.get('/plans', visaController.getVisaPlans.bind(visaController));



// Submit new visa application
router.post('/submit', visaController.submitVisaApplication.bind(visaController));

// Get all applications with filters
router.get('/applications', visaController.getVisaApplications.bind(visaController));

// Get application by ID
router.get('/applications/:id', visaController.getVisaApplicationById.bind(visaController));

// Update application
router.patch('/applications/:id', visaController.updateVisaApplication.bind(visaController));

// Delete application
router.delete('/applications/:id', visaController.deleteVisaApplication.bind(visaController));

// Get applications by category
router.get('/category/:category', visaController.getApplicationsByCategory.bind(visaController));

export default router;