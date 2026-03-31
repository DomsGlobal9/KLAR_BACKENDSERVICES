import { rateGainProvider } from "../providers/rategain.provider";

class SpecialRequestsService {
    async getSpecialRequests() {
        return rateGainProvider.getSpecialRequests();
    }
}

export const specialRequestsService = new SpecialRequestsService();
