import crypto from 'crypto';
import { SupplierAdapter, PrecheckResultV1 } from "../models/PrecheckResult";
import { tripJackProvider } from "../providers/tripjack.provider";
import { CircuitBreaker } from "../services/CircuitBreaker";

const tripJackCircuitBreaker = new CircuitBreaker(5, 30000); // 5 failures -> Open for 30s

export class TripJackAdapter implements SupplierAdapter {
    async precheck(payload: any): Promise<PrecheckResultV1> {
        return tripJackCircuitBreaker.execute(async () => {
            // Call existing provider
            const tjRes = await tripJackProvider.precheck(payload);
        
        const data = tjRes.body;
        const option = data?.hotel?.ops?.[0] || data?.option || data?.hInfo?.ops?.[0];
        
        if (!option) {
            throw new Error("No option found in TripJack precheck response.");
        }

        const roomType = option.ris?.[0]?.rt || option.roomType || "";
        const mealPlan = option.ris?.[0]?.mb || option.mealPlan || "";
        const cancellationPolicy = JSON.stringify(option.cnp || option.cancellationPolicy || {});
        const occupancy = option.ris?.[0]?.adt || option.occupancy || 2;
        
        const price = option.tp || option.pricing?.totalPrice || option.totalPrice || 0;
        const taxes = option.tf || option.pricing?.totalTax || option.totalTax || 0;
        const currency = "INR";

        // Generate hash of cancellation policy
        const cancellationPolicyHash = crypto.createHash('sha256').update(cancellationPolicy).digest('hex');

            return {
                available: data.status?.success !== false,
                roomType,
                mealPlan,
                cancellationPolicyHash,
                occupancy,
                optionId: option.id || option.optionId || tjRes.optionId,
                price,
                taxes,
                currency,
                originalResponse: tjRes
            };
        });
    }
}

export const tripJackAdapter = new TripJackAdapter();
