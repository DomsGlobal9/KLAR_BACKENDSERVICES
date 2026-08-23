import {
    MulticityOption,
    MulticitySelectionError,
    MulticitySelectionIndex,
    MulticitySelectionRequest
} from "../types/multicity.types";

export interface ResolvedMulticitySelection {
    optionId: string;
    routeIndex: number | null;
    priceId: string;
}

export interface MulticityOptionQuery {
    optionId?: string;
    legIndex?: number;
    flightKey?: string;
    priceId?: string;
}

export function findMulticityOption(
    selection: MulticitySelectionIndex,
    query: MulticityOptionQuery
): MulticityOption | null {
    if (query.optionId) {
        return selection.options.find((option) => option.optionId === query.optionId) ?? null;
    }

    if (!query.flightKey) return null;

    const matches = selection.options.filter((option) =>
        option.legs.some((leg) =>
            leg.flightKey === query.flightKey &&
            (query.legIndex === undefined || leg.legIndex === query.legIndex)
        )
    );

    if (matches.length <= 1) return matches[0] ?? null;

    if (query.priceId) {
        return matches.find((option) => option.priceIds.includes(query.priceId!)) ?? null;
    }

    throw new MulticitySelectionError(
        "flightKey matches more than one itinerary in this search. Send optionId to identify the selected flight.",
        "AMBIGUOUS_FLIGHT_KEY",
        { flightKey: query.flightKey, candidates: matches.map((option) => option.optionId) }
    );
}

export function resolveReviewPriceIds(
    selection: MulticitySelectionIndex,
    rawSelections: Array<MulticitySelectionRequest | string>
): { priceIds: string[]; resolved: ResolvedMulticitySelection[] } {
    const selections: MulticitySelectionRequest[] = (rawSelections || []).map((entry) =>
        typeof entry === "string" ? { optionId: entry } : entry
    );

    if (!selections.length) {
        throw new MulticitySelectionError("At least one option must be selected.", "NO_SELECTION");
    }

    const expectedCount = selection.selectionMode === "COMBINED" ? 1 : selection.routes.length;

    if (selections.length !== expectedCount) {
        throw new MulticitySelectionError(
            `Expected ${expectedCount} selected option(s) for this ${selection.mode.toLowerCase()} multicity search, received ${selections.length}.`,
            "SELECTION_COUNT_MISMATCH",
            { expected: expectedCount, received: selections.length }
        );
    }

    const resolved: ResolvedMulticitySelection[] = selections.map((entry) => {
        const option = selection.options.find((candidate) => candidate.optionId === entry.optionId);

        if (!option) {
            throw new MulticitySelectionError(
                "Selected option does not belong to this search session.",
                "OPTION_NOT_IN_SESSION",
                { optionId: entry.optionId }
            );
        }

        if (selection.selectionMode === "COMBINED" && option.sourceType !== "TRIPJACK_COMBO") {
            throw new MulticitySelectionError(
                "International multicity must be reviewed with a single combined option.",
                "INVALID_OPTION_TYPE",
                { optionId: option.optionId, sourceType: option.sourceType }
            );
        }

        if (selection.selectionMode === "PER_ROUTE" && option.sourceType !== "TRIPJACK_ROUTE") {
            throw new MulticitySelectionError(
                "Domestic multicity must be reviewed with one option per route.",
                "INVALID_OPTION_TYPE",
                { optionId: option.optionId, sourceType: option.sourceType }
            );
        }

        const priceId = entry.priceId ?? option.defaultPriceId;

        if (!priceId) {
            throw new MulticitySelectionError(
                "Selected option has no priceId.",
                "OPTION_HAS_NO_PRICE_ID",
                { optionId: option.optionId }
            );
        }

        if (!option.priceIds.includes(priceId)) {
            throw new MulticitySelectionError(
                "priceId does not belong to the selected option.",
                "PRICE_ID_NOT_IN_OPTION",
                { optionId: option.optionId, priceId }
            );
        }

        return { optionId: option.optionId, routeIndex: option.routeIndex, priceId };
    });

    if (selection.selectionMode === "PER_ROUTE") {
        const covered = new Set<number>();

        for (const entry of resolved) {
            if (entry.routeIndex === null) {
                throw new MulticitySelectionError(
                    "Selected option is not bound to a route.",
                    "OPTION_ROUTE_UNKNOWN",
                    { optionId: entry.optionId }
                );
            }
            if (covered.has(entry.routeIndex)) {
                throw new MulticitySelectionError(
                    `Route ${entry.routeIndex} was selected more than once.`,
                    "DUPLICATE_ROUTE_SELECTION",
                    { routeIndex: entry.routeIndex }
                );
            }
            covered.add(entry.routeIndex);
        }

        const missing = selection.routes
            .map((route) => route.routeIndex)
            .filter((routeIndex) => !covered.has(routeIndex));

        if (missing.length) {
            throw new MulticitySelectionError(
                `No option selected for route(s) ${missing.join(", ")}.`,
                "ROUTE_NOT_SELECTED",
                { missing }
            );
        }

        resolved.sort((a, b) => (a.routeIndex as number) - (b.routeIndex as number));
    }

    const priceIds = resolved.map((entry) => entry.priceId);

    if (new Set(priceIds).size !== priceIds.length) {
        throw new MulticitySelectionError(
            "The same priceId was selected for more than one route.",
            "DUPLICATE_PRICE_ID",
            { priceIds }
        );
    }

    return { priceIds, resolved };
}
