import { envConfig } from "./env.config";

export interface MarkupConfig {
    type: 'FIXED' | 'PERCENTAGE';
    value: number;
    enabled: boolean;
    applyTo: string[];
    currency: string;
}

class MarkupConfiguration {
    private config: MarkupConfig;

    constructor() {
        this.config = {
            type: envConfig.PLATFORM_MARKUP.TYPE as 'FIXED' | 'PERCENTAGE',
            value: envConfig.PLATFORM_MARKUP.VALUE,
            enabled: envConfig.PLATFORM_MARKUP.ENABLED,
            applyTo: envConfig.PLATFORM_MARKUP.APPLY_TO,
            currency: envConfig.PLATFORM_MARKUP.CURRENCY
        };
    }

    getConfig(): MarkupConfig {
        return this.config;
    }

    isEnabled(): boolean {
        return this.config.enabled;
    }

    shouldApplyTo(product: string): boolean {
        return this.config.applyTo.includes(product.toUpperCase());
    }

    getMarkupValue(originalPrice: number): number {
        if (!this.config.enabled) return 0;

        if (this.config.type === 'PERCENTAGE') {
            return (originalPrice * this.config.value) / 100;
        }
        return this.config.value;
    }

    getTotalPrice(originalPrice: number): number {
        if (!this.config.enabled) return originalPrice;
        return originalPrice + this.getMarkupValue(originalPrice);
    }
}

export default new MarkupConfiguration();