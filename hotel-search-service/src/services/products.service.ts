import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";

class ProductsService {
    async getProducts(payload: any) {
        const propertyId = (payload.propertyId || payload.PropertyId || "").toString();
        
        if (this.isTripJack(propertyId)) {
            return tripJackProvider.getProducts(payload);
        }

        // Default to RateGain
        return rateGainProvider.getAllProducts(payload);
    }

    private isTripJack(propertyId: string): boolean {
        // 1. Explicit TJ prefix
        if (propertyId.startsWith("TJ:")) return true;
        
        // 2. RG prefix is definitely not TripJack
        if (propertyId.startsWith("RG:")) return false;

        // 3. UUID format is unique to TripJack (RateGain uses numeric IDs)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(propertyId);
    }
}

export const productsService = new ProductsService();
