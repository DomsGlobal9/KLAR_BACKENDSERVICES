import { Router } from "express";
import { MarkupController } from "../controllers/markup.controller";
import { authenticateJWT } from "../middlewares/authentication.middleware";

const route = Router();


route.post('/', authenticateJWT, MarkupController.addMarkup);
route.get('/my-markup', authenticateJWT, MarkupController.getMyMarkups);
route.put('/bulk-update', authenticateJWT, MarkupController.bulkUpdate);
route.get('/monthly-revenue', authenticateJWT, MarkupController.getMonthlyRevenue);
route.delete('/:serviceType', authenticateJWT, MarkupController.deleteOne);
route.delete('/:serviceId', authenticateJWT, MarkupController.deleteByServiceId);

export default route;