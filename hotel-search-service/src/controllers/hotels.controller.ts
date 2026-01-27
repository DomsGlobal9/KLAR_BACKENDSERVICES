import { Request, Response, NextFunction } from "express";
import { hotelsService } from "../services/hotels.service";

/**
 * @swagger
 * /api/search/hotels/search:
 *   post:
 *     summary: Search for available properties in a destination
 *     tags: [Hotels]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinationCode:
 *                 type: string
 *                 example: "LAX"
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
 *                     Adults:
 *                       type: number
 *                       example: 2
 *                     Children:
 *                       type: number
 *                       example: 1
 *                     childrenAges:
 *                       type: array
 *                       items:
 *                         type: number
 *                       example: [5]
 *     responses:
 *       200:
 *         description: A list of properties
 */

export const searchHotels = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const data = await hotelsService.searchHotels(req.body);
        res.status(200).json(data);
    } catch (err) {
        next(err);
    }
};
