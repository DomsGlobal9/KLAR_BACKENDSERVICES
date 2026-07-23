import { Router } from "express";
import { MarkupController } from "../controllers/markup.controller";
import { MarkupConfigController } from "../controllers/markup-config.controller";
import { authenticateJWT } from "../middlewares/authentication.middleware";
import { requireMaster } from "../middlewares/master.middleware";
import { internalServiceAuth } from "../middlewares/internalService.middleware";

const route = Router();


/* =========================
   PLATFORM / B2C CONFIG — KLAR MASTER ONLY

   Declared before the agent-facing routes because `/config` must never fall
   through to the `/:serviceType` handlers below.
========================= */

route.get('/config', authenticateJWT, requireMaster, MarkupConfigController.list);
route.put('/config', authenticateJWT, requireMaster, MarkupConfigController.upsert);
route.delete('/config', authenticateJWT, requireMaster, MarkupConfigController.delete);

/* Service-to-service read. Shared-secret gated, deliberately NOT token-gated. */
route.get('/config/resolve', internalServiceAuth, MarkupConfigController.resolve);


/* =========================
   PER-AGENT MARKUP — the caller's own margin.
   userId comes from the token, never the body, so these stay self-scoped.
========================= */

route.post('/', authenticateJWT, MarkupController.addMarkup);
route.get('/my-markup', authenticateJWT, MarkupController.getMyMarkups);
route.put('/bulk-update', authenticateJWT, MarkupController.bulkUpdate);
route.get('/monthly-revenue', authenticateJWT, MarkupController.getMonthlyRevenue);
route.delete('/:serviceType', authenticateJWT, MarkupController.deleteOne);
route.delete('/:serviceId', authenticateJWT, MarkupController.deleteByServiceId);
route.post('/:serviceType', MarkupController.getMarkupByUserAndType);

export default route;