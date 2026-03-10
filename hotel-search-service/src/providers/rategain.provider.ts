import { RateGainApiProvider } from "./rategain.api.provider";

// Single provider — always real RateGain API calls
export const rateGainProvider = new RateGainApiProvider();
