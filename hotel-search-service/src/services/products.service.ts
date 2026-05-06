import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";

class ProductsService {
    async getProducts(payload: any) {
        const propertyId = (payload.propertyId || payload.PropertyId || "").toString();
        
        // Robust routing: 
        // 1. Explicit TJ prefix
        // 2. UUID format (TripJack uses UUIDs, RateGain uses numeric IDs)
        const isRg = propertyId.startsWith("RG:");
        const isTj = propertyId.startsWith("TJ:") || 
                     (!isRg && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId.replace("TJ:", "").replace("RG:", "")));
        
        if (isTj) {
            return tripJackProvider.getProducts(payload);
        }

        // Default to RateGain for numeric and RG prefixed IDs
        return rateGainProvider.getAllProducts(payload);
    }
}

export const productsService = new ProductsService();
