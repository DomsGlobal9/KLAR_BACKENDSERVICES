import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBookingRequirements } from '../utils/reviewConditions.util';
import { validateBookingPayload } from '../utils/tripjackBookingVerifier';
import { mapToTripjackBooking } from '../utils/mappers/booking.mapper';
import { FrontendBookingPayload } from '../types/booking.types';

describe('Student & Senior Citizen Booking Pipeline', () => {

    describe('Review Conditions Resolution', () => {
        test('resolves documentId as mandatory when dc.idm is true', () => {
            const reviewResponse = {
                conditions: {
                    dc: { ida: true, idm: true }
                }
            };
            const req = resolveBookingRequirements(reviewResponse);
            assert.strictEqual(req.documentId.applicable, true);
            assert.strictEqual(req.documentId.mandatory, true);
        });

        test('resolves documentId as optional when dc.ida is true and dc.idm is false', () => {
            const reviewResponse = {
                conditions: {
                    dc: { ida: true, idm: false }
                }
            };
            const req = resolveBookingRequirements(reviewResponse);
            assert.strictEqual(req.documentId.applicable, true);
            assert.strictEqual(req.documentId.mandatory, false);
        });

        test('resolves documentId as not applicable when dc is absent', () => {
            const reviewResponse = {
                conditions: {}
            };
            const req = resolveBookingRequirements(reviewResponse);
            assert.strictEqual(req.documentId.applicable, false);
            assert.strictEqual(req.documentId.mandatory, false);
        });
    });

    describe('Backend Booking Validation for Special Fares', () => {
        const createPayload = (travellerOverrides: any = {}): FrontendBookingPayload => ({
            bookingId: 'BK-TEST-100',
            amount: 5000,
            email: 'test@example.com',
            phone: '+919876543210',
            isHold: false,
            travellers: [
                {
                    title: 'Mr',
                    paxType: 'ADULT',
                    firstName: 'John',
                    lastName: 'Doe',
                    ...travellerOverrides
                }
            ]
        });

        test('passes validation when documentId is provided for mandatory Student/Senior fare', () => {
            const req = resolveBookingRequirements({
                conditions: { dc: { ida: true, idm: true } }
            });
            const payload = createPayload({ documentId: 'STU-123456' });

            assert.doesNotThrow(() => {
                validateBookingPayload(payload, { requirements: req });
            });
        });

        test('passes validation when di property is used instead of documentId for mandatory fare', () => {
            const req = resolveBookingRequirements({
                conditions: { dc: { ida: true, idm: true } }
            });
            const payload = createPayload({ di: 'SENIOR-987654' });

            assert.doesNotThrow(() => {
                validateBookingPayload(payload, { requirements: req });
            });
        });

        test('fails validation when documentId is missing for mandatory Student/Senior fare', () => {
            const req = resolveBookingRequirements({
                conditions: { dc: { ida: true, idm: true } }
            });
            const payload = createPayload({ documentId: '   ' });

            assert.throws(
                () => validateBookingPayload(payload, { requirements: req }),
                (err: any) => err.errorCode === 'DOCUMENT_ID_REQUIRED'
            );
        });
    });

    describe('TripJack Booking Payload Mapping', () => {
        test('maps documentId to di in TripJack booking payload', () => {
            const payload: FrontendBookingPayload = {
                bookingId: 'BK-MAP-1',
                amount: 4500,
                email: 'student@example.com',
                phone: '9876543210',
                isHold: false,
                travellers: [
                    {
                        title: 'Ms',
                        paxType: 'ADULT',
                        firstName: 'Jane',
                        lastName: 'Smith',
                        documentId: 'STU-UNI-2026',
                        pan: 'ABCDE1234F'
                    }
                ]
            };

            const mapped = mapToTripjackBooking(payload);
            assert.strictEqual(mapped.travellerInfo[0].di, 'STU-UNI-2026');
            assert.strictEqual(mapped.travellerInfo[0].pan, 'ABCDE1234F');
        });

        test('maps di property to di in TripJack booking payload', () => {
            const payload: FrontendBookingPayload = {
                bookingId: 'BK-MAP-2',
                amount: 4500,
                email: 'senior@example.com',
                phone: '9876543210',
                isHold: false,
                travellers: [
                    {
                        title: 'Mr',
                        paxType: 'ADULT',
                        firstName: 'Robert',
                        lastName: 'Brown',
                        di: 'SENIOR-CARD-99'
                    }
                ]
            };

            const mapped = mapToTripjackBooking(payload);
            assert.strictEqual(mapped.travellerInfo[0].di, 'SENIOR-CARD-99');
        });
    });
});
