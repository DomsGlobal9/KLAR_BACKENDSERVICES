import { Request, Response } from "express";
import { Filter } from "../types/filter.types";
import searchService from "../services/search.service";
import FlightSearchValidator from "../utils/flightSearchValidator";
import { ReturnFlightSorter } from "../utils/sorter/returnSort.utils";
import { OnewayFlightSorter } from "../utils/sorter/onewaySort.utils";
import { SortField, SortOption, SortOrder } from "../types/sort.types";
import { MulticityFlightSorter } from "../utils/sorter/multiSort.utils";


export const searchOneWayController = async (req: Request, res: Response) => {
    try {
        const validationResult = FlightSearchValidator.validate(req.body);

        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
            });
        }

        if (validationResult.searchType !== "ONEWAY") {
            return res.status(400).json({
                success: false,
                message: "Only one-way search allowed in this endpoint",
            });
        }

        const printData = req.query.printData;
        const sortField = req.query.sortBy as SortField;
        const sortOrder = (req.query.sortOrder as SortOrder) || 'asc';

        let sortOption: SortOption | undefined;
        if (sortField && OnewayFlightSorter.isValidSortField(sortField)) {
            sortOption = {
                field: sortField,
                order: sortOrder
            };
        }

        const filters: Filter[] = [];

        if (req.body.filters?.airlines && Array.isArray(req.body.filters.airlines)) {
            filters.push({
                type: 'airline',
                values: req.body.filters.airlines
            });
        }

        if (req.body.filters?.cabinClasses && Array.isArray(req.body.filters.cabinClasses)) {
            filters.push({
                type: 'cabinClass',
                values: req.body.filters.cabinClasses
            });
        }

        if (req.body.filters?.stops && Array.isArray(req.body.filters.stops)) {
            filters.push({
                type: 'stops',
                values: req.body.filters.stops
            });
        }

        if (req.body.filters?.priceRange) {
            const { min, max } = req.body.filters.priceRange;
            if (min !== undefined && max !== undefined) {
                filters.push({
                    type: 'priceRange',
                    min,
                    max
                });
            }
        }

        if (req.body.filters?.departureTimeRange) {
            const { start, end } = req.body.filters.departureTimeRange;
            if (start && end) {
                filters.push({
                    type: 'departureTimeRange',
                    start,
                    end
                });
            }
        }

        if (req.body.filters?.arrivalTimeRange) {
            const { start, end } = req.body.filters.arrivalTimeRange;
            if (start && end) {
                filters.push({
                    type: 'arrivalTimeRange',
                    start,
                    end
                });
            }
        }

        if (req.body.filters?.durationRange) {
            const { min, max } = req.body.filters.durationRange;
            if (min !== undefined && max !== undefined) {
                filters.push({
                    type: 'durationRange',
                    min,
                    max
                });
            }
        }

        const includeStats = req.query.includeStats === 'true';

        const result = await searchService.searchOneWay(
            req.body,
            sortOption,
            filters.length > 0 ? filters : undefined,
            includeStats,
            printData as string | boolean,
        );


        if (result && typeof result === 'object' && 'isPdf' in result && result.isPdf) {
            // Return PDF response
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=flight-search-results-${Date.now()}.pdf`);
            res.setHeader('Content-Length', result.pdfBuffer.length);
            return res.send(result.pdfBuffer);
        }


        return res.status(200).json({
            success: true,
            data: result,
            warnings: validationResult.warnings,
            filtersApplied: filters.length > 0 ? filters : undefined,
            sortApplied: sortOption || undefined
        });

    } catch (error: any) {


        return res.status(500).json({
            success: false,
            message: "Search failed",
        });
    }
};

export const searchReturnController = async (req: Request, res: Response) => {
    try {
        const validationResult = FlightSearchValidator.validate(req.body);

        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
            });
        }

        if (validationResult.searchType !== "RETURN") {
            return res.status(400).json({
                success: false,
                message: "Only return search allowed in this endpoint",
            });
        }

        const printData = req.query.printData;
        const sortField = req.query.sortBy as SortField;
        const sortOrder = (req.query.sortOrder as SortOrder) || 'asc';
        const sortTarget = (req.query.sortTarget as string) || 'both';

        let sortOption: SortOption | undefined;
        if (sortField && ReturnFlightSorter.isValidSortField(sortField)) {
            sortOption = {
                field: sortField,
                order: sortOrder
            };
        }

        let validSortTarget: 'onward' | 'return' | 'both' = 'both';
        if (sortTarget === 'onward' || sortTarget === 'return') {
            validSortTarget = sortTarget;
        }

        const filters: Filter[] = [];

        if (req.body.filters?.airlines && Array.isArray(req.body.filters.airlines)) {
            filters.push({
                type: 'airline',
                values: req.body.filters.airlines
            });
        }

        if (req.body.filters?.cabinClasses && Array.isArray(req.body.filters.cabinClasses)) {
            filters.push({
                type: 'cabinClass',
                values: req.body.filters.cabinClasses
            });
        }

        if (req.body.filters?.stops && Array.isArray(req.body.filters.stops)) {
            filters.push({
                type: 'stops',
                values: req.body.filters.stops
            });
        }

        if (req.body.filters?.priceRange) {
            const { min, max } = req.body.filters.priceRange;
            if (min !== undefined && max !== undefined) {
                filters.push({
                    type: 'priceRange',
                    min,
                    max
                });
            }
        }

        if (req.body.filters?.departureTimeRange) {
            const { start, end } = req.body.filters.departureTimeRange;
            if (start && end) {
                filters.push({
                    type: 'departureTimeRange',
                    start,
                    end
                });
            }
        }

        if (req.body.filters?.arrivalTimeRange) {
            const { start, end } = req.body.filters.arrivalTimeRange;
            if (start && end) {
                filters.push({
                    type: 'arrivalTimeRange',
                    start,
                    end
                });
            }
        }

        if (req.body.filters?.durationRange) {
            const { min, max } = req.body.filters.durationRange;
            if (min !== undefined && max !== undefined) {
                filters.push({
                    type: 'durationRange',
                    min,
                    max
                });
            }
        }

        const filterTarget = (req.body.filterTarget || 'both') as 'onward' | 'return' | 'both';
        const includeStats = req.query.includeStats === 'true';

        const result = await searchService.searchReturn(
            req.body,
            sortOption,
            validSortTarget,
            filters.length > 0 ? filters : undefined,
            filterTarget,
            includeStats,
            printData as boolean | string,
        );


        if (result && typeof result === 'object' && 'isPdf' in result && result.isPdf) {
            // Return PDF response
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=return-flight-search-results-${Date.now()}.pdf`);
            res.setHeader('Content-Length', result.pdfBuffer.length);
            return res.send(result.pdfBuffer);
        }


        const response: any = {
            success: true,
            data: result,
            warnings: validationResult.warnings,
        };

        if (sortOption) {
            response.sortApplied = {
                ...sortOption,
                target: validSortTarget
            };
        }

        if (filters.length > 0) {
            response.filtersApplied = filters;
        }

        return res.status(200).json(response);

    } catch (error: any) {


        return res.status(500).json({
            success: false,
            message: "Return search failed",
        });
    }
};

export const searchMulticityController = async (req: Request, res: Response) => {
    try {
        const validationResult = FlightSearchValidator.validate(req.body);

        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
            });
        }

        if (validationResult.searchType !== "MULTICITY") {
            return res.status(400).json({
                success: false,
                message: "Only multicity search allowed in this endpoint",
            });
        }

        const printData = req.query.printData;
        const sortField = req.query.sortBy as SortField;
        const sortOrder = (req.query.sortOrder as SortOrder) || 'asc';
        const legIndex = req.query.legIndex ? parseInt(req.query.legIndex as string) : undefined;

        let sortOption: SortOption | undefined;
        if (sortField && MulticityFlightSorter.isValidSortField(sortField)) {
            sortOption = {
                field: sortField,
                order: sortOrder
            };
        }

        const filters: Filter[] = [];

        if (req.body.filters?.airlines && Array.isArray(req.body.filters.airlines)) {
            filters.push({
                type: 'airline',
                values: req.body.filters.airlines
            });
        }

        if (req.body.filters?.cabinClasses && Array.isArray(req.body.filters.cabinClasses)) {
            filters.push({
                type: 'cabinClass',
                values: req.body.filters.cabinClasses
            });
        }

        if (req.body.filters?.stops && Array.isArray(req.body.filters.stops)) {
            filters.push({
                type: 'stops',
                values: req.body.filters.stops
            });
        }

        if (req.body.filters?.priceRange) {
            const { min, max } = req.body.filters.priceRange;
            if (min !== undefined && max !== undefined) {
                filters.push({
                    type: 'priceRange',
                    min,
                    max
                });
            }
        }

        if (req.body.filters?.departureTimeRange) {
            const { start, end } = req.body.filters.departureTimeRange;
            if (start && end) {
                filters.push({
                    type: 'departureTimeRange',
                    start,
                    end
                });
            }
        }

        if (req.body.filters?.arrivalTimeRange) {
            const { start, end } = req.body.filters.arrivalTimeRange;
            if (start && end) {
                filters.push({
                    type: 'arrivalTimeRange',
                    start,
                    end
                });
            }
        }

        if (req.body.filters?.durationRange) {
            const { min, max } = req.body.filters.durationRange;
            if (min !== undefined && max !== undefined) {
                filters.push({
                    type: 'durationRange',
                    min,
                    max
                });
            }
        }

        let applyToLegs: number[] | 'all' = 'all';
        if (req.body.applyToLegs) {
            if (req.body.applyToLegs === 'all') {
                applyToLegs = 'all';
            } else if (Array.isArray(req.body.applyToLegs)) {
                applyToLegs = req.body.applyToLegs;
            }
        }

        const includeStats = req.query.includeStats === 'true';

        const result = await searchService.searchMulticity(
            req.body,
            sortOption,
            legIndex,
            filters.length > 0 ? filters : undefined,
            applyToLegs,
            includeStats,
            false,  // includeFareRules
            printData as boolean | string,
        );

        if (result && typeof result === 'object' && 'isPdf' in result && result.isPdf) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=multicity-flight-search-results-${Date.now()}.pdf`);
            res.setHeader('Content-Length', result.pdfBuffer.length);
            return res.send(result.pdfBuffer);
        }

        const response: any = {
            success: true,
            data: result,
            warnings: validationResult.warnings,
        };

        if (sortOption) {
            response.sortApplied = {
                ...sortOption,
                legIndex: legIndex !== undefined ? legIndex : 'all'
            };
        }

        if (filters.length > 0) {
            response.filtersApplied = filters;
            response.applyToLegs = applyToLegs;
        }

        return res.status(200).json(response);

    } catch (error: any) {





        return res.status(500).json({
            success: false,
            message: error?.message || "Multicity search failed",
            details: error?.response?.data || error?.toString()
        });
    }
};