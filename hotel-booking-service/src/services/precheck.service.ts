import { rateGainProvider } from "../providers/rategain.provider";

class PrecheckService {
    async precheck(payload: any) {
        return rateGainProvider.precheck(payload);
    }
}

export const precheckService = new PrecheckService();
