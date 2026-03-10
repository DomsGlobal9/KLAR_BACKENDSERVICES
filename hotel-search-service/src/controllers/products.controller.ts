import { Request, Response, NextFunction } from "express";
import { productsService } from "../services/products.service";

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
    } catch (error: any) {
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            description: error.response?.data?.description || error.message,
            body: null
        });
    }
};
