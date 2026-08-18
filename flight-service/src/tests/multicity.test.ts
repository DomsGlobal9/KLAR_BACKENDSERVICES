import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { MultiCityNormalizer } from "../normalizers/multicity.normalizer";
import {
    findMulticityOption,
    resolveReviewPriceIds
} from "../utils/multicitySelection.util";
import { MulticitySelectionError } from "../types/multicity.types";
import { mapWithConcurrency } from "../utils/flightLog.util";

const seg = (id: string, from: string, to: string, dt: string, at: string) => ({
    id,
    da: { code: from, cityCode: from, city: from, terminal: "1", name: `${from} Airport` },
    aa: { code: to, cityCode: to, city: to, terminal: "2", name: `${to} Airport` },
    dt,
    at,
    duration: 180,
    fD: { aI: { code: "AI", name: "Air India" }, fN: "101", eT: "321" }
});

const fare = (id: string, tf: number, identifier = "PUBLISHED") => ({
    id,
    fareIdentifier: identifier,
    fd: {
        ADULT: {
            cc: "ECONOMY",
            rT: 1,
            bI: { iB: "15 Kg", cB: "7 Kg" },
            fC: { TF: tf, BF: tf - 500, TAF: 500, NF: tf }
        }
    }
});

const route = (from: string, to: string, travelDate: string) => ({
    fromCityOrAirport: { code: from },
    toCityOrAirport: { code: to },
    travelDate
});

const domesticSearch = (routeCount: number, flightsPerRoute = 2) => {
    const cities = ["DEL", "BOM", "BLR", "GOI", "HYD", "MAA", "CCU"];
    const routeInfos = Array.from({ length: routeCount }, (_, i) =>
        route(cities[i], cities[i + 1], `2026-09-0${i + 1}`)
    );

    const tripInfos: Record<string, any[]> = {};
    for (let r = 0; r < routeCount; r++) {
        tripInfos[String(r)] = Array.from({ length: flightsPerRoute }, (_, f) => ({
            sI: [seg(`R${r}S${f}`, cities[r], cities[r + 1], `2026-09-0${r + 1}T08:00`, `2026-09-0${r + 1}T10:00`)],
            totalPriceList: [fare(`price-r${r}-f${f}`, 5000 + f * 100)]
        }));
    }

    return {
        searchResult: { tripInfos },
        searchQuery: { routeInfos }
    };
};

const comboSearch = (combos: any[], routeInfos: any[]) => ({
    result: { searchResult: { tripInfos: { COMBO: combos } } },
    query: { routeInfos }
});

const twoLegSegments = () => [
    seg("501", "DEL", "DXB", "2026-09-01T08:00", "2026-09-01T11:00"),
    seg("502", "DXB", "LHR", "2026-09-05T09:00", "2026-09-05T13:00")
];

const twoLegRoutes = () => [route("DEL", "DXB", "2026-09-01"), route("DXB", "LHR", "2026-09-05")];

describe("Domestic multicity search", () => {

    test("2-leg search exposes one option per route flight", () => {
        const payload = domesticSearch(2);
        const result = MultiCityNormalizer.normalize(payload, payload.searchQuery);

        assert.equal(result.selection.mode, "DOMESTIC");
        assert.equal(result.selection.selectionMode, "PER_ROUTE");
        assert.equal(result.selection.routes.length, 2);
        assert.equal(result.selection.options.length, 4);
        assert.deepEqual(
            result.selection.options.map((option) => option.optionId),
            ["R0-0", "R0-1", "R1-0", "R1-1"]
        );
    });

    test("3-leg search keeps every route", () => {
        const payload = domesticSearch(3);
        const result = MultiCityNormalizer.normalize(payload, payload.searchQuery);

        assert.equal(result.flights.length, 3);
        assert.deepEqual(result.selection.routes.map((r) => r.routeIndex), [0, 1, 2]);
        assert.equal(result.selection.options.filter((o) => o.routeIndex === 2).length, 2);
    });

    test("6-leg search keeps every route", () => {
        const payload = domesticSearch(6, 1);
        const result = MultiCityNormalizer.normalize(payload, payload.searchQuery);

        assert.equal(result.flights.length, 6);
        assert.equal(result.selection.options.length, 6);
        assert.deepEqual(
            result.selection.options.map((o) => o.routeIndex),
            [0, 1, 2, 3, 4, 5]
        );
    });

    test("every displayed flight carries its own supplier priceId", () => {
        const payload = domesticSearch(2);
        const result = MultiCityNormalizer.normalize(payload, payload.searchQuery);

        const flat = result.flights.flatMap((leg: any) => leg.flights);
        for (const flight of flat) {
            const option = result.selection.options.find((o) => o.optionId === flight.optionId);
            assert.ok(option, `option missing for ${flight.optionId}`);
            assert.deepEqual(flight.priceIds, option!.priceIds);
            assert.equal(flight.priceId, option!.defaultPriceId);
        }
    });

    test("a route flight with no priceId is reported, not silently dropped", () => {
        const payload = domesticSearch(1, 2);
        payload.searchResult.tripInfos["0"][0].totalPriceList = [];

        const result = MultiCityNormalizer.normalize(payload, payload.searchQuery);

        assert.equal(result.selection.options.length, 1);
        assert.deepEqual(result.selection.unmappable, [
            { sourceType: "TRIPJACK_ROUTE", sourceIndex: 0, reason: "NO_PRICE_IDS" }
        ]);
    });
});

describe("Domestic multicity review selection", () => {

    const selectionFor = (routeCount: number) => {
        const payload = domesticSearch(routeCount);
        return MultiCityNormalizer.normalize(payload, payload.searchQuery).selection;
    };

    test("priceIds are emitted in route order whatever order the client sends", () => {
        const selection = selectionFor(3);

        const forward = resolveReviewPriceIds(selection, ["R0-0", "R1-1", "R2-0"]);
        const shuffled = resolveReviewPriceIds(selection, ["R2-0", "R0-0", "R1-1"]);

        assert.deepEqual(forward.priceIds, ["price-r0-f0", "price-r1-f1", "price-r2-f0"]);
        assert.deepEqual(shuffled.priceIds, forward.priceIds);
        assert.deepEqual(shuffled.resolved.map((r) => r.routeIndex), [0, 1, 2]);
    });

    test("a missing route is rejected", () => {
        const selection = selectionFor(3);

        assert.throws(
            () => resolveReviewPriceIds(selection, ["R0-0", "R1-0"]),
            (error: MulticitySelectionError) => error.errorCode === "SELECTION_COUNT_MISMATCH"
        );
    });

    test("selecting the same route twice is rejected", () => {
        const selection = selectionFor(2);

        assert.throws(
            () => resolveReviewPriceIds(selection, ["R0-0", "R0-1"]),
            (error: MulticitySelectionError) => error.errorCode === "DUPLICATE_ROUTE_SELECTION"
        );
    });

    test("an optionId from another search is rejected", () => {
        const selection = selectionFor(2);

        assert.throws(
            () => resolveReviewPriceIds(selection, ["R0-0", "R9-9"]),
            (error: MulticitySelectionError) => error.errorCode === "OPTION_NOT_IN_SESSION"
        );
    });

    test("a priceId that does not belong to the option is rejected", () => {
        const selection = selectionFor(2);

        assert.throws(
            () => resolveReviewPriceIds(selection, [
                { optionId: "R0-0", priceId: "price-r1-f0" },
                { optionId: "R1-0" }
            ]),
            (error: MulticitySelectionError) => error.errorCode === "PRICE_ID_NOT_IN_OPTION"
        );
    });

    test("a combined option cannot be used for a domestic review", () => {
        const selection = selectionFor(2);
        selection.options[0] = { ...selection.options[0], sourceType: "TRIPJACK_COMBO" };

        assert.throws(
            () => resolveReviewPriceIds(selection, ["R0-0", "R1-0"]),
            (error: MulticitySelectionError) => error.errorCode === "INVALID_OPTION_TYPE"
        );
    });
});

describe("International multicity search", () => {

    test("2-leg COMBO becomes one option with one authoritative priceId", () => {
        const { result, query } = comboSearch(
            [{ sI: twoLegSegments(), totalPriceList: [fare("combo-price-0", 60000)] }],
            twoLegRoutes()
        );

        const normalized = MultiCityNormalizer.normalize(result, query);

        assert.equal(normalized.selection.mode, "INTERNATIONAL");
        assert.equal(normalized.selection.selectionMode, "COMBINED");
        assert.equal(normalized.selection.options.length, 1);
        assert.deepEqual(normalized.selection.options[0].priceIds, ["combo-price-0"]);
        assert.equal(normalized.selection.options[0].legs.length, 2);
        assert.deepEqual(normalized.selection.options[0].diagnostics, []);
    });

    test("3-leg COMBO splits into three display legs", () => {
        const segments = [
            seg("601", "DEL", "DXB", "2026-09-01T08:00", "2026-09-01T11:00"),
            seg("602", "DXB", "LHR", "2026-09-05T09:00", "2026-09-05T13:00"),
            seg("603", "LHR", "JFK", "2026-09-09T09:00", "2026-09-09T13:00")
        ];
        const { result, query } = comboSearch(
            [{ sI: segments, totalPriceList: [fare("combo-price-3", 90000)] }],
            [route("DEL", "DXB", "2026-09-01"), route("DXB", "LHR", "2026-09-05"), route("LHR", "JFK", "2026-09-09")]
        );

        const normalized = MultiCityNormalizer.normalize(result, query);
        const option = normalized.selection.options[0];

        assert.equal(option.legs.length, 3);
        assert.deepEqual(option.legs.map((leg) => leg.flightKey), ["601", "602", "603"]);
        assert.deepEqual(option.diagnostics, []);
    });

    test("connecting segments stay inside their requested leg", () => {
        const segments = [
            seg("701", "DEL", "BOM", "2026-09-01T06:00", "2026-09-01T08:00"),
            seg("702", "BOM", "DXB", "2026-09-01T09:30", "2026-09-01T12:00"),
            seg("703", "DXB", "LHR", "2026-09-05T09:00", "2026-09-05T13:00")
        ];
        const { result, query } = comboSearch(
            [{ sI: segments, totalPriceList: [fare("combo-price-c", 70000)] }],
            twoLegRoutes()
        );

        const option = MultiCityNormalizer.normalize(result, query).selection.options[0];

        assert.equal(option.legs.length, 2);
        assert.deepEqual(option.legs[0].segmentIds, ["701", "702"]);
        assert.deepEqual(option.legs[1].segmentIds, ["703"]);
    });

    test("a COMBO with several fares keeps them all and defaults to the cheapest", () => {
        const { result, query } = comboSearch(
            [{
                sI: twoLegSegments(),
                totalPriceList: [
                    fare("combo-flex", 90000, "FLEXI"),
                    fare("combo-saver", 60000, "SAVER"),
                    fare("combo-corp", 75000, "CORPORATE")
                ]
            }],
            twoLegRoutes()
        );

        const option = MultiCityNormalizer.normalize(result, query).selection.options[0];

        assert.deepEqual(option.priceIds, ["combo-flex", "combo-saver", "combo-corp"]);
        assert.equal(option.defaultPriceId, "combo-saver");
    });

    test("a COMBO that does not split into the requested routes is kept with a diagnostic", () => {
        const { result, query } = comboSearch(
            [{
                sI: [seg("801", "DEL", "DXB", "2026-09-01T08:00", "2026-09-01T11:00")],
                totalPriceList: [fare("combo-partial", 40000)]
            }],
            twoLegRoutes()
        );

        const normalized = MultiCityNormalizer.normalize(result, query);

        assert.equal(normalized.selection.options.length, 1);
        assert.equal(normalized.flights.length, 1);
        assert.deepEqual(normalized.selection.options[0].diagnostics, [
            "LEG_COUNT_MISMATCH:expected=2,actual=1"
        ]);
        assert.deepEqual(normalized.selection.options[0].priceIds, ["combo-partial"]);
    });

    test("a rejected COMBO does not shift the source reference of later COMBOs", () => {
        const comboA = { sI: twoLegSegments(), totalPriceList: [fare("price-A", 60000)] };
        const comboB = { sI: twoLegSegments(), totalPriceList: [] };
        const comboC = {
            sI: [
                seg("901", "DEL", "DXB", "2026-09-01T08:00", "2026-09-01T11:00"),
                seg("902", "DXB", "LHR", "2026-09-05T09:00", "2026-09-05T13:00")
            ],
            totalPriceList: [fare("price-C", 55000)]
        };

        const { result, query } = comboSearch([comboA, comboB, comboC], twoLegRoutes());
        const normalized = MultiCityNormalizer.normalize(result, query);

        assert.equal(normalized.selection.options.length, 2);
        assert.deepEqual(normalized.selection.unmappable, [
            { sourceType: "TRIPJACK_COMBO", sourceIndex: 1, reason: "NO_PRICE_IDS" }
        ]);

        const [first, second] = normalized.selection.options;
        assert.equal(first.sourceIndex, 0);
        assert.deepEqual(first.priceIds, ["price-A"]);
        assert.equal(second.sourceIndex, 2);
        assert.deepEqual(second.priceIds, ["price-C"]);
        assert.equal(second.optionId, "C-2");
    });

    test("sorting the itineraries cannot detach a fare rule from its option", () => {
        const combos = [
            { sI: twoLegSegments(), totalPriceList: [fare("price-cheap", 40000)] },
            {
                sI: [
                    seg("911", "DEL", "DXB", "2026-09-01T08:00", "2026-09-01T11:00"),
                    seg("912", "DXB", "LHR", "2026-09-05T09:00", "2026-09-05T13:00")
                ],
                totalPriceList: [fare("price-dear", 95000)]
            }
        ];
        const { result, query } = comboSearch(combos, twoLegRoutes());
        const normalized = MultiCityNormalizer.normalize(result, query);

        const fareRulesByPriceId = new Map<string, any>([
            ["price-cheap", { rule: "NON_REFUNDABLE" }],
            ["price-dear", { rule: "REFUNDABLE" }]
        ]);

        const sorted = [...normalized.flights].sort((a: any, b: any) => b.totalPrice - a.totalPrice);

        for (const itinerary of sorted) {
            const option = normalized.selection.options.find((o) => o.optionId === itinerary.optionId)!;
            const rules = option.priceIds.map((priceId) => fareRulesByPriceId.get(priceId));
            assert.deepEqual(rules, [fareRulesByPriceId.get(itinerary.priceIds[0])]);
        }

        assert.equal(sorted[0].priceIds[0], "price-dear");
        assert.equal(sorted[1].priceIds[0], "price-cheap");
    });

    test("international review sends exactly one combo priceId", () => {
        const { result, query } = comboSearch(
            [{
                sI: twoLegSegments(),
                totalPriceList: [fare("combo-saver", 60000, "SAVER"), fare("combo-flex", 90000, "FLEXI")]
            }],
            twoLegRoutes()
        );

        const selection = MultiCityNormalizer.normalize(result, query).selection;

        const byDefault = resolveReviewPriceIds(selection, ["C-0"]);
        assert.deepEqual(byDefault.priceIds, ["combo-saver"]);

        const explicit = resolveReviewPriceIds(selection, [{ optionId: "C-0", priceId: "combo-flex" }]);
        assert.deepEqual(explicit.priceIds, ["combo-flex"]);
    });

    test("international review refuses one priceId per display leg", () => {
        const { result, query } = comboSearch(
            [
                { sI: twoLegSegments(), totalPriceList: [fare("combo-a", 60000)] },
                {
                    sI: [
                        seg("921", "DEL", "DXB", "2026-09-01T08:00", "2026-09-01T11:00"),
                        seg("922", "DXB", "LHR", "2026-09-05T09:00", "2026-09-05T13:00")
                    ],
                    totalPriceList: [fare("combo-b", 65000)]
                }
            ],
            twoLegRoutes()
        );

        const selection = MultiCityNormalizer.normalize(result, query).selection;

        assert.throws(
            () => resolveReviewPriceIds(selection, ["C-0", "C-1"]),
            (error: MulticitySelectionError) => error.errorCode === "SELECTION_COUNT_MISMATCH"
        );
    });
});

describe("Multicity fare lookup identity", () => {

    const duplicateSegmentSelection = () => {
        const combos = [
            { sI: twoLegSegments(), totalPriceList: [fare("price-first", 60000)] },
            { sI: twoLegSegments(), totalPriceList: [fare("price-second", 72000)] }
        ];
        const { result, query } = comboSearch(combos, twoLegRoutes());
        return MultiCityNormalizer.normalize(result, query).selection;
    };

    test("duplicate segment ids across COMBOs resolve by optionId", () => {
        const selection = duplicateSegmentSelection();

        const first = findMulticityOption(selection, { optionId: "C-0" });
        const second = findMulticityOption(selection, { optionId: "C-1" });

        assert.deepEqual(first!.priceIds, ["price-first"]);
        assert.deepEqual(second!.priceIds, ["price-second"]);
    });

    test("an ambiguous flightKey is an explicit error, not a silent wrong fare", () => {
        const selection = duplicateSegmentSelection();

        assert.throws(
            () => findMulticityOption(selection, { legIndex: 0, flightKey: "501" }),
            (error: MulticitySelectionError) => error.errorCode === "AMBIGUOUS_FLIGHT_KEY"
        );
    });

    test("a legacy flightKey plus priceId still resolves the right option", () => {
        const selection = duplicateSegmentSelection();

        const option = findMulticityOption(selection, {
            legIndex: 0,
            flightKey: "501",
            priceId: "price-second"
        });

        assert.equal(option!.optionId, "C-1");
    });

    test("an unknown optionId resolves to nothing rather than a neighbour", () => {
        const selection = duplicateSegmentSelection();

        assert.equal(findMulticityOption(selection, { optionId: "C-9" }), null);
    });
});

describe("Fare rule fetch concurrency", () => {

    test("never runs more than the configured number of requests at once", async () => {
        let inFlight = 0;
        let peak = 0;

        const results = await mapWithConcurrency(
            Array.from({ length: 20 }, (_, i) => i),
            5,
            async (item) => {
                inFlight++;
                peak = Math.max(peak, inFlight);
                await new Promise((resolve) => setTimeout(resolve, 1));
                inFlight--;
                return item * 2;
            }
        );

        assert.ok(peak <= 5, `peak concurrency was ${peak}`);
        assert.deepEqual(results.slice(0, 4), [0, 2, 4, 6]);
        assert.equal(results.length, 20);
    });
});
