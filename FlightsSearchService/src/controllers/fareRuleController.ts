import { Request, Response, NextFunction } from "express";
import {
    getFareRules,
    transformFareRules,
    getFareRuleSummary,
    parseRtfToText
} from "../services/fareRuleService";
import { FareRuleRequest } from "../interface/flight/flight.interface";


/**
 * Get fare rules by fare rule ID
 */
export const getFareRulesById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.log("API trigger to run GET fare rules");
    try {
        const { id, flowType = 'SEARCH' } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Fare rule ID is required"
            });
        }

        if (!['SEARCH', 'REVIEW'].includes(flowType)) {
            return res.status(400).json({
                success: false,
                message: "flowType must be either 'SEARCH' or 'REVIEW'"
            });
        }

        const fareRuleRequest: FareRuleRequest = {
            id,
            flowType: flowType as 'SEARCH' | 'REVIEW'
        };


        console.log("Trying to get fare rule from controller ...........");
        const fareRuleResponse = await getFareRules(fareRuleRequest);

        console.log("THe fare rule details we get", fareRuleResponse);

        

        if (!fareRuleResponse.status.success) {
            return res.status(fareRuleResponse.status.httpStatus || 500).json({
                success: false,
                message: "Failed to fetch fare rules from provider"
            });
        }


        const transformedRules = transformFareRules(fareRuleResponse, flowType as 'SEARCH' | 'REVIEW');
        const summary = getFareRuleSummary(transformedRules);

        return res.status(200).json({
            success: true,
            message: "Fare rules retrieved successfully",
            data: {
                fareRules: transformedRules,
                summary,
                rawResponse: fareRuleResponse,
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get fare rules for multiple fare IDs (batch)
 */
export const getBatchFareRules = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { fareIds, flowType = 'SEARCH' } = req.body;

        if (!Array.isArray(fareIds) || fareIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "fareIds must be a non-empty array"
            });
        }

        if (!['SEARCH', 'REVIEW'].includes(flowType)) {
            return res.status(400).json({
                success: false,
                message: "flowType must be either 'SEARCH' or 'REVIEW'"
            });
        }


        const fareRuleRequests = fareIds.map(id => ({
            id,
            flowType: flowType as 'SEARCH' | 'REVIEW'
        }));

        const promises = fareRuleRequests.map(request =>
            getFareRules(request).catch(error => ({
                id: request.id,
                error: error.message,
                status: { success: false }
            }))
        );

        const results = await Promise.all(promises);

        const successfulResults = results.filter((result: any) =>
            result.status?.success && result.fareRule
        );

        const failedResults = results.filter((result: any) =>
            !result.status?.success || result.error
        );


        const allTransformedRules = successfulResults.flatMap((result: any) =>
            transformFareRules(result, flowType as 'SEARCH' | 'REVIEW')
        );

        const summary = getFareRuleSummary(allTransformedRules);

        return res.status(200).json({
            success: true,
            message: `Retrieved ${successfulResults.length} out of ${fareIds.length} fare rules`,
            data: {
                fareRules: allTransformedRules,
                summary,
                stats: {
                    total: fareIds.length,
                    successful: successfulResults.length,
                    failed: failedResults.length,
                    failedIds: failedResults.map((r: any) => r.id)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Parse RTF text to plain text (utility endpoint)
 */
export const parseRtf = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { rtfText } = req.body;

        if (!rtfText) {
            return res.status(400).json({
                success: false,
                message: "rtfText is required"
            });
        }

        const plainText = parseRtfToText(rtfText);

        return res.status(200).json({
            success: true,
            message: "RTF parsed successfully",
            data: {
                originalLength: rtfText.length,
                parsedLength: plainText.length,
                plainText,
                originalRtf: rtfText.substring(0, 500) + (rtfText.length > 500 ? '...' : '')
            }
        });
    } catch (error) {
        next(error);
    }
};