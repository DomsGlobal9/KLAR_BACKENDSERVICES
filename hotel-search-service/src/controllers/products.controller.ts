import { Request, Response, NextFunction } from "express";
import { productsService } from "../services/products.service";
import { getClientType, extractToken } from "../utils/auth";

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const clientType = getClientType(req);
    const token = extractToken(req);
    const payload = {
      // Body first: `clientType` and `token` are derived from the verified JWT
      // and decide which markup prices this request, so the caller must not be
      // able to supply their own by putting them in the body.
      ...req.body,
      propertyId: req.params.propertyId,
      clientType,
      token,
    };

    const data = await productsService.getProducts(payload);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.response?.status || error.status || 500).json({
      status: false,
      statusCode: error.response?.status || error.status || 500,
      description:
        error.response?.data?.description ||
        error.response?.data?.error?.message ||
        error.message ||
        "Internal Server Error",
      body: error.response?.data || null,
    });
  }
};
