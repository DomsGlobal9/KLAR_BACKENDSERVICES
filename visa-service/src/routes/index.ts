import { Router } from 'express';
import visaRoutes from '../routes/visa.route';

const router = Router();

// Use visa routes
router.use(visaRoutes);

// Root API route
// router.get('/', (req, res) => {
//     res.json({
//         message: 'Visa Service API',
//         version: '1.0.0',
//         endpoints: {
//             submit: 'POST /api/visa/submit',
//             getAll: 'GET /api/visa/applications',
//             getById: 'GET /api/visa/applications/:id',
//             update: 'PUT /api/visa/applications/:id',
//             delete: 'DELETE /api/visa/applications/:id',
//             byCategory: 'GET /api/visa/category/:category'
//         }
//     });
// });

export default router;