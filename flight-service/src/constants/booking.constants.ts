export const PAX_TITLES = {
    ADULT: ['Mr', 'Mrs', 'Ms'],
    CHILD: ['Ms', 'Master'],
    INFANT: ['Ms', 'Master']
} as const;

export const NAME_REGEX = /^[A-Za-z]{1,50}$/;
export const PHONE_REGEX = /^\+\d{10,15}$/;
export const PASSPORT_REGEX = /^[A-Z0-9]{6,9}$/;
export const GST_REGEX = /^[0-9A-Z]{15}$/;

export const ERROR_CODES = {
    INVALID_TITLE: 'INVALID_TITLE',
    INVALID_NAME: 'INVALID_NAME',
    INVALID_PHONE: 'INVALID_PHONE',
    INVALID_PASSPORT: 'INVALID_PASSPORT',
    INVALID_GST: 'INVALID_GST',
    INFANT_MORE_THAN_ADULT: 'INFANT_MORE_THAN_ADULT'
} as const;