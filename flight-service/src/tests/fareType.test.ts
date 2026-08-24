import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import FlightSearchValidator from '../utils/flightSearchValidator';
import searchService from '../services/search.service';
import { BaseFlightNormalizer } from '../normalizers/baseFlight.normalizer';
import { OneWayNormalizer } from '../normalizers/oneway.normalizer';
import TripjackFieldMapper from '../utils/mappers/tripjackField.mapper';
import { SearchQuery } from '../types/flightSearch.types';

describe('Student & Senior Citizen Fare Type Handling', () => {

    describe('Search Query Validation', () => {
        test('validates STUDENT fare with ADULT passengers only', () => {
            const query: SearchQuery = {
                cabinClass: 'ECONOMY',
                paxInfo: { ADULT: 1, CHILD: 0, INFANT: 0 },
                routeInfos: [
                    {
                        fromCityOrAirport: { code: 'DEL' },
                        toCityOrAirport: { code: 'BOM' },
                        travelDate: '2026-09-01'
                    }
                ],
                searchModifiers: { pft: 'STUDENT' }
            };

            const result = FlightSearchValidator.validate(query);
            assert.strictEqual(result.isValid, true);
        });

        test('rejects STUDENT fare when CHILD or INFANT is present', () => {
            const queryWithChild: SearchQuery = {
                cabinClass: 'ECONOMY',
                paxInfo: { ADULT: 1, CHILD: 1 },
                routeInfos: [
                    {
                        fromCityOrAirport: { code: 'DEL' },
                        toCityOrAirport: { code: 'BOM' },
                        travelDate: '2026-09-01'
                    }
                ],
                searchModifiers: { pft: 'STUDENT' }
            };

            const result = FlightSearchValidator.validate(queryWithChild);
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(e => e.code === 'CHILD_OR_INFANT_WITH_SPECIAL_FARE'));
        });

        test('rejects SENIOR_CITIZEN fare when INFANT is present', () => {
            const queryWithInfant: SearchQuery = {
                cabinClass: 'ECONOMY',
                paxInfo: { ADULT: 1, INFANT: 1 },
                routeInfos: [
                    {
                        fromCityOrAirport: { code: 'DEL' },
                        toCityOrAirport: { code: 'BOM' },
                        travelDate: '2026-09-01'
                    }
                ],
                searchModifiers: { pft: 'SENIOR_CITIZEN' }
            };

            const result = FlightSearchValidator.validate(queryWithInfant);
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(e => e.code === 'CHILD_OR_INFANT_WITH_SPECIAL_FARE'));
        });

        test('allows REGULAR fare with CHILD and INFANT', () => {
            const query: SearchQuery = {
                cabinClass: 'ECONOMY',
                paxInfo: { ADULT: 1, CHILD: 1, INFANT: 1 },
                routeInfos: [
                    {
                        fromCityOrAirport: { code: 'DEL' },
                        toCityOrAirport: { code: 'BOM' },
                        travelDate: '2026-09-01'
                    }
                ],
                searchModifiers: { pft: 'REGULAR' }
            };

            const result = FlightSearchValidator.validate(query);
            assert.strictEqual(result.isValid, true);
        });
    });

    describe('TripJack Payload Preparation', () => {
        test('removes pft when pft is REGULAR and searchModifiers is otherwise empty', () => {
            const payload = {
                cabinClass: 'ECONOMY',
                paxInfo: { ADULT: 1 },
                searchModifiers: { pft: 'REGULAR' }
            };

            const prepared = searchService.prepareTripjackSearchPayload(payload);
            assert.strictEqual(prepared.searchModifiers, undefined);
        });

        test('preserves isDirectFlight but removes pft when REGULAR', () => {
            const payload = {
                cabinClass: 'ECONOMY',
                paxInfo: { ADULT: 1 },
                searchModifiers: { pft: 'REGULAR', isDirectFlight: true }
            };

            const prepared = searchService.prepareTripjackSearchPayload(payload);
            assert.deepStrictEqual(prepared.searchModifiers, { isDirectFlight: true });
        });

        test('preserves pft = STUDENT in searchModifiers for TripJack', () => {
            const payload = {
                cabinClass: 'ECONOMY',
                paxInfo: { ADULT: 1 },
                searchModifiers: { pft: 'STUDENT' }
            };

            const prepared = searchService.prepareTripjackSearchPayload(payload);
            assert.deepStrictEqual(prepared.searchModifiers, { pft: 'STUDENT' });
        });

        test('preserves pft = SENIOR_CITIZEN in searchModifiers for TripJack', () => {
            const payload = {
                cabinClass: 'ECONOMY',
                paxInfo: { ADULT: 1 },
                searchModifiers: { pft: 'SENIOR_CITIZEN' }
            };

            const prepared = searchService.prepareTripjackSearchPayload(payload);
            assert.deepStrictEqual(prepared.searchModifiers, { pft: 'SENIOR_CITIZEN' });
        });
    });

    describe('Fare Extraction and Mapping', () => {
        test('extracts ft and fareType in BaseFlightNormalizer.extractFares', () => {
            const mockFlight = {
                sI: [{ id: '101' }],
                totalPriceList: [
                    {
                        id: 'price-1',
                        fareIdentifier: 'SPECIAL',
                        ft: 'STUDENT',
                        fd: {
                            ADULT: {
                                fC: { TF: 5000, BF: 4000, TAF: 1000, NF: 5000 },
                                cc: 'ECONOMY'
                            }
                        }
                    }
                ]
            };

            const extracted = BaseFlightNormalizer.extractFares([mockFlight]);
            assert.strictEqual(extracted.length, 1);
            assert.strictEqual(extracted[0].fares[0].ft, 'STUDENT');
            assert.strictEqual(extracted[0].fares[0].fareType, 'STUDENT');

            const mapped = TripjackFieldMapper.map(extracted[0]);
            assert.strictEqual(mapped.fares[0].FareType, 'STUDENT');
        });

        test('includes ft and fareType in OneWayNormalizer normalized output', () => {
            const mockTripjackResponse = {
                data: {
                    searchResult: {
                        tripInfos: {
                            ONWARD: [
                                {
                                    sI: [
                                        {
                                            fD: { aI: { name: 'Air India', code: 'AI' }, fN: '101' },
                                            da: { city: 'Delhi', code: 'DEL' },
                                            aa: { city: 'Mumbai', code: 'BOM' },
                                            dt: '2026-09-01T10:00',
                                            at: '2026-09-01T12:00',
                                            duration: 120
                                        }
                                    ],
                                    totalPriceList: [
                                        {
                                            id: 'price-1',
                                            fareIdentifier: 'SPECIAL',
                                            ft: 'SENIOR_CITIZEN',
                                            fd: {
                                                ADULT: {
                                                    fC: { TF: 4500, BF: 3500, TAF: 1000, NF: 4500 },
                                                    cc: 'ECONOMY'
                                                }
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            };

            const normalized = OneWayNormalizer.transform(mockTripjackResponse);
            assert.strictEqual(normalized.flights[0].ft, 'SENIOR_CITIZEN');
            assert.strictEqual(normalized.flights[0].fareType, 'SENIOR_CITIZEN');
        });
    });
});
