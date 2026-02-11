import axios from "axios";
import { envConfig } from "../config/env";
import { getCache, setCache } from "./redisService";
import { FareRuleRequest, FareRuleResponse, TransformedFareRule } from "../interface/flight/flight.interface";


/**
 * Fetch fare rules from TripJack API
 * @param fareRuleRequest Fare rule request with id and flowType
 * @returns Fare rule response
 */
export const getFareRules = async (fareRuleRequest: FareRuleRequest): Promise<FareRuleResponse> => {
    const cacheKey = `fare_rule:${fareRuleRequest.id}:${fareRuleRequest.flowType}`;

    const cached = await getCache(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        const response = await axios.post(
            `${envConfig.TRIPJACK.BASE_URL}/fms/v1/farerule`,
            fareRuleRequest,
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: envConfig.TRIPJACK.API_KEY,
                },
                timeout: 15000,
            }
        );

        await setCache(cacheKey, JSON.stringify(response.data), 3600);

        return response.data;
    } catch (error) {
        console.error("Error fetching fare rules:", error);
        throw error;
    }
};

/**
 * Parse RTF text to plain text (for REVIEW flowType)
 * @param rtfText RTF formatted text
 * @returns Plain text
 */
export const parseRtfToText = (rtfText: string): string => {
    try {
        let plainText = rtfText
            .replace(/\\[a-z]+\d*\s?/gi, '')
            .replace(/\\[{}]/g, '')
            .replace(/\\[\\]/g, '\\')
            .replace(/\{.*?\}/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/\s+/g, ' ')
            .trim();


        const rtfHeaderEnd = plainText.indexOf('viewkind');
        if (rtfHeaderEnd > 0) {
            plainText = plainText.substring(rtfHeaderEnd);
        }


        const viewkindIndex = plainText.indexOf('viewkind');
        if (viewkindIndex !== -1) {
            plainText = plainText.substring(viewkindIndex + 8);
        }


        plainText = plainText
            .replace(/pardul?b?f\d+fs\d+/gi, '')
            .replace(/par\s*/gi, '\n')
            .replace(/ulnoneb\d+/gi, '')
            .replace(/f\d+fs\d+par/g, '')
            .replace(/\n\s*\n/g, '\n')
            .trim();

        return plainText;
    } catch (error) {
        console.error("Error parsing RTF:", error);
        return rtfText;
    }
};

/**
 * Transform fare rule response to structured format
 * @param fareRuleResponse Raw fare rule response from TripJack
 * @param flowType REVIEW or SEARCH
 * @returns Transformed fare rules
 */
export const transformFareRules = (
    fareRuleResponse: FareRuleResponse,
    flowType: 'REVIEW' | 'SEARCH'
): TransformedFareRule[] => {
    const result: TransformedFareRule[] = [];

    if (!fareRuleResponse.fareRule) {
        return result;
    }

    for (const [routeKey, routeRule] of Object.entries(fareRuleResponse.fareRule)) {
        const transformedRule: TransformedFareRule = {
            routeKey,
            flowType,
        };

        if (flowType === 'REVIEW' && routeRule.miscInfo) {

            const rtfText = routeRule.miscInfo[0] || '';
            transformedRule.rawRtf = rtfText;
            transformedRule.rawText = parseRtfToText(rtfText);
        } else if (flowType === 'SEARCH' && routeRule.tfr) {

            transformedRule.structuredRules = {
                cancellation: {
                    beforeDeparture: routeRule.tfr.CANCELLATION?.find(r => r.pp === 'BEFORE_DEPARTURE' || !r.pp),
                    afterDeparture: routeRule.tfr.CANCELLATION?.find(r => r.pp === 'AFTER_DEPARTURE'),
                    timeWindows: routeRule.tfr.CANCELLATION?.filter(r => r.st && r.et) || []
                },
                dateChange: {
                    beforeDeparture: routeRule.tfr.DATECHANGE?.find(r => r.pp === 'BEFORE_DEPARTURE' || !r.pp),
                    afterDeparture: routeRule.tfr.DATECHANGE?.find(r => r.pp === 'AFTER_DEPARTURE'),
                    timeWindows: routeRule.tfr.DATECHANGE?.filter(r => r.st && r.et) || []
                },
                noShow: {
                    beforeDeparture: routeRule.tfr.NO_SHOW?.find(r => r.pp === 'BEFORE_DEPARTURE' || !r.pp),
                    afterDeparture: routeRule.tfr.NO_SHOW?.find(r => r.pp === 'AFTER_DEPARTURE'),
                    timeWindows: routeRule.tfr.NO_SHOW?.filter(r => r.st && r.et) || []
                },
                seatCharges: routeRule.tfr.SEAT_CHARGEABLE || [],
                baggageCharges: routeRule.tfr.BAGGAGE_CHARGES || []
            };
        }

        result.push(transformedRule);
    }

    return result;
};

/**
 * Get simplified fare rule summary
 * @param transformedRules Transformed fare rules
 * @returns Simplified summary for UI
 */
export const getFareRuleSummary = (transformedRules: TransformedFareRule[]) => {
    const summaries = transformedRules.map(rule => {
        if (rule.flowType === 'REVIEW') {
            return {
                route: rule.routeKey,
                type: 'TEXT_RULES',
                summary: rule.rawText?.substring(0, 200) + '...' || 'No rules available',
                hasCancellation: rule.rawText?.toLowerCase().includes('cancellation') || false,
                hasDateChange: rule.rawText?.toLowerCase().includes('change') || false,
            };
        } else {
            const structured = rule.structuredRules;
            return {
                route: rule.routeKey,
                type: 'STRUCTURED_RULES',
                cancellationFee: structured?.cancellation?.beforeDeparture?.amount,
                dateChangeFee: structured?.dateChange?.beforeDeparture?.amount,
                cancellationPolicy: structured?.cancellation?.beforeDeparture?.policyInfo,
                dateChangePolicy: structured?.dateChange?.beforeDeparture?.policyInfo,
                noShowPolicy: structured?.noShow?.beforeDeparture?.policyInfo,
                isRefundable: !structured?.cancellation?.beforeDeparture?.policyInfo?.toLowerCase().includes('nonrefundable'),
                hasCancellation: !!structured?.cancellation?.beforeDeparture,
                hasDateChange: !!structured?.dateChange?.beforeDeparture,
            };
        }
    });

    return summaries;
};