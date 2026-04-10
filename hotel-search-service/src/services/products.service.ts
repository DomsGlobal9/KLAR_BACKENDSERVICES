import { rateGainProvider } from "../providers/rategain.provider";

class ProductsService {
    async getProducts(payload: any) {
        // later: validation, rate rules
        return rateGainProvider.getAllProducts(payload);
    }
}

export const productsService = new ProductsService();
