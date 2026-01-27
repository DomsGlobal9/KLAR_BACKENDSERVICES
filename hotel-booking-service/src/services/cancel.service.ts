import { rateGainProvider } from "../providers/rategain.provider";

class CancelService {
    async cancel(payload: any) {
        return rateGainProvider.cancel(payload);
    }
}

export const cancelService = new CancelService();
