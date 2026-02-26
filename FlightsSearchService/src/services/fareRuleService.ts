import axios from "axios";
import { envConfig } from "../config/env";
import { getCache, setCache } from "./redisService";
import { FareRuleRequest, FareRuleResponse, TransformedFareRule, FareRuleDetail } from "../interface/flight/flight.interface";

export const getFareRules = async (fareRuleRequest: FareRuleRequest): Promise<FareRuleResponse> => {
    const cacheKey = `fare_rule:${fareRuleRequest.id}:${fareRuleRequest.flowType}`;

    const cached = await getCache(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        const url = `${envConfig.TRIPJACK.BASE_URL}/fms/v2/farerule`;
        console.log("TripJack Fare Rule URL (v2):", url);
        console.log("Fare rule**************",{fareRuleRequest});

        const response = await axios.post(
            url,
            {
                id: fareRuleRequest.id,
                flowType: fareRuleRequest.flowType
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "apikey": envConfig.TRIPJACK.API_KEY,
                },
                timeout: envConfig.TRIPJACK.TIMEOUT,
            }
        );

        if (response.data?.status?.success === false) {
            console.error("❌ TripJack returned error:", response.data);
            throw new Error(response.data.errors?.[0]?.message || "TripJack API returned error");
        }

        await setCache(cacheKey, JSON.stringify(response.data), envConfig.TRIPJACK.CACHE_TTL);
        return response.data;

    } catch (error: any) {
        console.error("❌ TripJack Fare Rule API Error (v2):", {
            endpoint: `${envConfig.TRIPJACK.BASE_URL}/fms/v2/farerule`,
            requestId: fareRuleRequest.id,
            flowType: fareRuleRequest.flowType,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
        });
        throw error;
    }
};

export const parseRtfToText = (rtfText: string): string => {
    try {
        if (!rtfText || typeof rtfText !== 'string') {
            return '';
        }

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
            .replace(/pard?ul?b?f?\d*fs?\d*/gi, '')
            .replace(/par\s*/gi, '\n')
            .replace(/ulnoneb?\d*/gi, '')
            .replace(/f\d+fs\d+par/g, '')
            .replace(/\n\s*\n/g, '\n')
            .trim();

        return plainText;
    } catch (error) {
        console.error("Error parsing RTF:", error);
        return rtfText;
    }
};

export const extractRulesFromText = (text: string | undefined) => {
    if (!text) return undefined;

    const lowerText = text.toLowerCase();

    return {
        hasCancellation: lowerText.includes('cancellation') || lowerText.includes('cancel'),
        hasDateChange: lowerText.includes('change') || lowerText.includes('date change'),
        isRefundable: !lowerText.includes('nonrefundable') && !lowerText.includes('non-refundable'),
        hasNoShow: lowerText.includes('no show') || lowerText.includes('noshow'),
        cancellationFee: extractAmount(text, 'cancellation'),
        dateChangeFee: extractAmount(text, 'change'),
    };
};

export const extractAmount = (text: string, ruleType: string): number | null => {
    try {
        const patterns = [
            new RegExp(`${ruleType}[^0-9]*(?:INR|KWD|USD)?\\s*([0-9,]+(?:\\.[0-9]{2})?)`, 'i'),
            new RegExp(`(?:fee|penalty|charge)\\s*(?:of)?\\s*(?:INR|KWD|USD)?\\s*([0-9,]+(?:\\.[0-9]{2})?)`, 'i'),
            new RegExp(`([0-9,]+(?:\\.[0-9]{2})?)\\s*(?:INR|KWD|USD)`, 'i'),
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return parseFloat(match[1].replace(/,/g, ''));
            }
        }

        return null;
    } catch (error) {
        console.error("Error extracting amount:", error);
        return null;
    }
};

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
            transformedRule.extractedRules = extractRulesFromText(transformedRule.rawText);

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

export const getFareRuleSummary = (transformedRules: TransformedFareRule[]) => {
    const summaries = transformedRules.map(rule => {
        if (rule.flowType === 'REVIEW') {
            return {
                route: rule.routeKey,
                type: 'TEXT_RULES' as const,
                summary: rule.rawText?.substring(0, 200) + (rule.rawText && rule.rawText.length > 200 ? '...' : '') || 'No rules available',
                hasCancellation: rule.rawText?.toLowerCase().includes('cancellation') || false,
                hasDateChange: rule.rawText?.toLowerCase().includes('change') || false,
                isRefundable: !rule.rawText?.toLowerCase().includes('nonrefundable') && !rule.rawText?.toLowerCase().includes('non-refundable'),
                cancellationFee: rule.extractedRules?.cancellationFee,
                dateChangeFee: rule.extractedRules?.dateChangeFee,
                rawText: rule.rawText,
            };
        } else {
            const structured = rule.structuredRules;
            const cancellationRule = structured?.cancellation?.beforeDeparture;
            const dateChangeRule = structured?.dateChange?.beforeDeparture;
            const noShowRule = structured?.noShow?.beforeDeparture;

            return {
                route: rule.routeKey,
                type: 'STRUCTURED_RULES' as const,
                cancellationFee: cancellationRule?.amount,
                cancellationAdditionalFee: cancellationRule?.additionalFee,
                cancellationPolicy: cancellationRule?.policyInfo,
                cancellationTimeWindow: cancellationRule?.st && cancellationRule?.et ?
                    `${cancellationRule.st}-${cancellationRule.et} hours` : null,
                dateChangeFee: dateChangeRule?.amount,
                dateChangeAdditionalFee: dateChangeRule?.additionalFee,
                dateChangePolicy: dateChangeRule?.policyInfo,
                dateChangeTimeWindow: dateChangeRule?.st && dateChangeRule?.et ?
                    `${dateChangeRule.st}-${dateChangeRule.et} hours` : null,
                noShowPolicy: noShowRule?.policyInfo,
                noShowTimeWindow: noShowRule?.st && noShowRule?.et ?
                    `${noShowRule.st}-${noShowRule.et} hours` : null,
                isRefundable: !cancellationRule?.policyInfo?.toLowerCase().includes('nonrefundable') &&
                    !cancellationRule?.policyInfo?.toLowerCase().includes('no refund'),
                hasCancellation: !!cancellationRule,
                hasDateChange: !!dateChangeRule,
                hasNoShow: !!noShowRule,
                hasSeatCharges: structured?.seatCharges && structured.seatCharges.length > 0,
            };
        }
    });

    return {
        summaries,
        totalCount: summaries.length,
        summaryByType: {
            textRules: summaries.filter(s => s.type === 'TEXT_RULES').length,
            structuredRules: summaries.filter(s => s.type === 'STRUCTURED_RULES').length,
        },
    };
};

export async function getFareRuleById(
    fareRuleRequest: FareRuleRequest
): Promise<TransformedFareRule | null> {
    try {
        const data = await getFareRules(fareRuleRequest);

        if (!data.fareRule) {
            return null;
        }

        const transformedRules = transformFareRules(data, fareRuleRequest.flowType);
        return transformedRules[0] || null;

    } catch (error) {
        console.error("Error fetching fare rule:", error);
        throw error;
    }
}

export const getTransformedFareRule = async (
    id: string,
    flowType: 'REVIEW' | 'SEARCH' = 'SEARCH'
) => {
    const request: FareRuleRequest = { id, flowType };
    const fareRule = await getFareRuleById(request);
    const summary = fareRule ? getFareRuleSummary([fareRule]) : null;

    return {
        success: !!fareRule,
        data: fareRule,
        summary: summary?.summaries[0] || null,
    };
};

export const getBatchFareRules = async (
    fareRuleRequests: FareRuleRequest[]
): Promise<(FareRuleResponse | { id: string; error: string })[]> => {
    const promises = fareRuleRequests.map(async (request) => {
        try {
            return await getFareRules(request);
        } catch (error: any) {
            console.error(`Failed to fetch fare rule for ID: ${request.id}`, error.message);
            return {
                id: request.id,
                error: error.message || "Failed to fetch fare rule",
            };
        }
    });

    return Promise.all(promises);
};

export const compareFareRules = async (
    fareIds: string[],
    flowType: 'REVIEW' | 'SEARCH' = 'SEARCH'
) => {
    const requests: FareRuleRequest[] = fareIds.map(id => ({ id, flowType }));
    const responses = await getBatchFareRules(requests);

    const successfulRules = responses
        .filter((r): r is FareRuleResponse => !('error' in r))
        .map(r => transformFareRules(r, flowType)[0]);

    return {
        totalRequested: fareIds.length,
        successful: successfulRules.length,
        failed: responses.filter(r => 'error' in r).length,
        comparison: {
            cheapestCancellation: Math.min(...successfulRules.map(r =>
                r.structuredRules?.cancellation?.beforeDeparture?.amount || Infinity
            ).filter(a => a !== Infinity)),
            cheapestDateChange: Math.min(...successfulRules.map(r =>
                r.structuredRules?.dateChange?.beforeDeparture?.amount || Infinity
            ).filter(a => a !== Infinity)),
            refundableCount: successfulRules.filter(r =>
                !r.structuredRules?.cancellation?.beforeDeparture?.policyInfo?.toLowerCase().includes('nonrefundable')
            ).length,
        },
        rules: successfulRules,
    };
};