import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";

class ProductsService {
    async getProducts(payload: any) {
        const propertyId = payload.propertyId || payload.PropertyId || "";
        
        if (propertyId.startsWith("TJ:")) {
            return tripJackProvider.getProducts(payload);
        }

        // Default to RateGain for legacy and RG properties
        return rateGainProvider.getAllProducts(payload);
    }
}

export const productsService = new ProductsService();
