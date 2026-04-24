import crypto from "crypto";

export class CacheKeyUtil {
    static generateSearchKey(payload: any): string {
        const stringified = JSON.stringify(payload);
        return `FLIGHT_SEARCH:${crypto.createHash("md5").update(stringified).digest("hex")}`;
    }
}