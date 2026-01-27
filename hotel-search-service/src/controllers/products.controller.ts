import { Request, Response, NextFunction } from "express";
import { productsService } from "../services/products.service";

/**
 * @swagger
 * /api/search/hotels/{propertyId}/products:
 *   post:
 *     summary: Retrieve specific room types and rates for a selected property
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *           example: "e631ad1c-77d0-482d-888e-c322e1189290"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               PropertyCode:
 *                 type: string
 *                 example: "25293"
 *               BrandCode:
 *                 type: string
 *                 example: "SEI6SEI6SEI="
 *               checkin:
 *                 type: string
 *                 example: "2026-06-01"
 *               checkout:
 *                 type: string
 *                 example: "2026-06-05"
 *               Rooms:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     numberOfRoom:
 *                       type: number
 *                       example: 1
 *                     adults:
 *                       type: number
 *                       example: 2
 *                     children:
 *                       type: number
 *                       example: 1
 *                     childrenAges:
 *                       type: array
 *                       items:
 *                         type: number
 *                       example: [5]
 *     responses:
 *       200:
 *         description: A list of room products
 */

export const getProducts = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const payload = {
            propertyId: req.params.propertyId,
            ...req.body
        };

        const data = await productsService.getProducts(payload);
        res.status(200).json(data);
    } catch (err) {
        next(err);
    }
};
