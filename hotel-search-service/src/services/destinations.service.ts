import { rateGainProvider } from "../providers/rategain.provider";

class DestinationsService {
    async getDestinations() {
        return rateGainProvider.getDestinations();
    }
}

export const destinationsService = new DestinationsService();
