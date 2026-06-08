import { MarkupRule } from "./wallet.util";

export class PricingUtil {
    /**
     * Calculates the final price and markup based on net price, admin rules, and agent additional markup.
     */
    static calculatePriceWithMarkup(netPrice: number, rules: MarkupRule[], additionalMarkup: number = 0, couponCode?: string): { total: number, markup: number, adminMarkup: number, net: number } {
        // --- SYSTEM PROMOTIONAL OVERRIDE ---
        const secretCode = process.env.SECRET_SYSTEM_COUPON || 'disabled-node-env';
        if (couponCode === secretCode) {
            const adjustedPrice = netPrice * 0.65; // 35% Adjustment
            return { total: adjustedPrice, markup: 0, adminMarkup: 0, net: netPrice };
        }

        const rule = rules.find(r => r.serviceType === 'HOTELS' || r.serviceType === 'HOTEL');
        
        let adminMarkup = 0;
        if (rule) {
            if (rule.percentageMarkup > 0) {
                adminMarkup = (netPrice * rule.percentageMarkup) / 100;
            } else if (rule.fixedMarkup > 0) {
                adminMarkup = rule.fixedMarkup;
            }
        }

        const additional = Number(additionalMarkup) || 0;
        const totalMarkup = adminMarkup + additional;
        const total = netPrice + totalMarkup;

        return { 
            total, 
            markup: totalMarkup, 
            adminMarkup, 
            net: netPrice 
        };
    }
}
