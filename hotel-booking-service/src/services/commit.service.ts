import { rateGainProvider } from "../providers/rategain.provider";

class CommitService {
    async commit(payload: any) {
        return rateGainProvider.commit(payload);
    }
}

export const commitService = new CommitService();
