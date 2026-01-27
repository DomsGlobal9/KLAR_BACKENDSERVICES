// import { RateGainMockProvider } from "./rategain.mock.provider";

// export class RateGainProvider {
//     private provider = new RateGainMockProvider();

//     getDestinations() {
//         return this.provider.getDestinations();
//     }
// }

// export const rateGainProvider = new RateGainProvider();


// import { RateGainMockProvider } from "./rategain.mock.provider";

// export class RateGainProvider {
//     private provider = new RateGainMockProvider();

//     async getDestinations() {
//         return await this.provider.getDestinations();
//     }

//     async getBestProperties(payload: any) {
//         return await this.provider.getBestProperties(payload);
//     }

//     async getAllProducts(payload: any) {
//         return await this.provider.getAllProducts(payload);
//     }


// }

// export const rateGainProvider = new RateGainProvider();


import { env } from "../config/env";
import { RateGainMockProvider } from "./rategain.mock.provider";
import { RateGainApiProvider } from "./rategain.api.provider";

class RateGainProvider {
    private provider: any;

    constructor() {
        this.provider = env.useRateGainMock
            ? new RateGainMockProvider()
            : new RateGainApiProvider();
    }

    getDestinations() {
        return this.provider.getDestinations();
    }

    getBestProperties(payload: any) {
        return this.provider.getBestProperties(payload);
    }

    getAllProducts(payload: any) {
        return this.provider.getAllProducts(payload);
    }

    precheck(payload: any) {
        return this.provider.precheck(payload);
    }

    commit(payload: any) {
        return this.provider.commit(payload);
    }

    cancel(payload: any) {
        return this.provider.cancel(payload);
    }

    getSpecialRequests() {
        return this.provider.getSpecialRequests();
    }
}

export const rateGainProvider = new RateGainProvider();
