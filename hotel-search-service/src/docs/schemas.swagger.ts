/**
 * @swagger
 * components:
 *   schemas:
 *     RateGainGuest:
 *       type: object
 *       required:
 *         - FirstName
 *         - LastName
 *         - Primary
 *         - Email
 *         - Phone
 *       properties:
 *         FirstName:
 *           type: string
 *         LastName:
 *           type: string
 *         Primary:
 *           type: boolean
 *         Remarks:
 *           type: string
 *         ServiceRequest:
 *           type: string
 *         Email:
 *           type: string
 *         EmailType:
 *           type: number
 *         ProfileType:
 *           type: number
 *         Phone:
 *           type: string
 *         Line1:
 *           type: string
 *         City:
 *           type: string
 *         StateCode:
 *           type: string
 *         CountryCode:
 *           type: string
 *         PostalCode:
 *           type: string
 *     
 *     RateGainChild:
 *       type: object
 *       required:
 *         - type
 *         - age
 *       properties:
 *         type:
 *           type: string
 *         age:
 *           type: number
 *     
 *     RateGainRoomSelection:
 *       type: object
 *       required:
 *         - RoomTypeCode
 *         - NumberOfRooms
 *         - NumberOfAdults
 *         - NumberOfChild
 *         - RoomSelectionKey
 *         - RoomRate
 *         - BoardName
 *         - Guest
 *         - Children
 *       properties:
 *         RoomTypeCode:
 *           type: string
 *         NumberOfRooms:
 *           type: number
 *         NumberOfAdults:
 *           type: number
 *         NumberOfChild:
 *           type: number
 *         allocationDetails:
 *           type: string
 *         RoomSelectionKey:
 *           type: string
 *         RoomRate:
 *           type: number
 *         BoardName:
 *           type: string
 *         Comment:
 *           type: string
 *         SpecialRequest:
 *           type: string
 *         Guest:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RateGainGuest'
 *         Children:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RateGainChild'
 *     
 *     RateGainCreditCard:
 *       type: object
 *       required:
 *         - ExpirationDate
 *         - IssuedName
 *         - Number
 *         - TypeIdentifier
 *       properties:
 *         ExpirationDate:
 *           type: string
 *           description: YYYY-MM
 *         IssuedName:
 *           type: string
 *         Number:
 *           type: string
 *         TypeIdentifier:
 *           type: string
 *           description: VISA, MASTERCARD, etc.
 *     
 *     RateGainBookReservation:
 *       type: object
 *       required:
 *         - ResStatus
 *         - CurrencyCode
 *         - GuaranteeMethod
 *         - GuaranteeType
 *         - checkin
 *         - checkout
 *         - propertyID
 *         - PropertyCode
 *         - BrandCode
 *         - EchoToken
 *         - BookingRate
 *         - Session
 *         - RoomSelection
 *       properties:
 *         ResStatus:
 *           type: number
 *         DemandBookingId:
 *           type: string
 *         CurrencyCode:
 *           type: string
 *         GuaranteeMethod:
 *           type: string
 *         GuaranteeType:
 *           type: string
 *         TimeStamp:
 *           type: string
 *         checkin:
 *           type: string
 *         checkout:
 *           type: string
 *         ReservationDate:
 *           type: string
 *         propertyID:
 *           type: string
 *         PropertyCode:
 *           type: string
 *         BrandCode:
 *           type: string
 *         EchoToken:
 *           type: string
 *         BookingRate:
 *           type: number
 *         sellingRate:
 *           type: number
 *         Session:
 *           type: string
 *         CountryCode:
 *           type: string
 *         Currency:
 *           type: string
 *         CreditCard:
 *           $ref: '#/components/schemas/RateGainCreditCard'
 *         RoomSelection:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RateGainRoomSelection'
 */
