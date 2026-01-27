import { env } from "../config/env";
import { RateGainMockProvider } from "./rategain.mock.provider";
import { RateGainApiProvider } from "./rategain.api.provider";

class RateGainProvider {
    private provider: RateGainMockProvider | RateGainApiProvider;

    constructor() {
        this.provider = env.useRateGainMock
            ? new RateGainMockProvider()
            : new RateGainApiProvider();
    }

    async precheck(payload: any) {
        return this.provider.precheck(payload);
    }

    async commit(payload: any) {
        return this.provider.commit(payload);
    }

    async cancel(payload: any) {
        return this.provider.cancel(payload);
    }

    async getSpecialRequests() {
        return this.provider.getSpecialRequests();
    }
}

export const rateGainProvider = new RateGainProvider();
