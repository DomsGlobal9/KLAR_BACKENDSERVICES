import { rateGainProvider } from "../providers/rategain.provider";

class HotelsService {
    async searchHotels(searchPayload: any) {
        // later: validate dates, rooms, destinationCode
        return rateGainProvider.getBestProperties(searchPayload);
    }
}

export const hotelsService = new HotelsService();
