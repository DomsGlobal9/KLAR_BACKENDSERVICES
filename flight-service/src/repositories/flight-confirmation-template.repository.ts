// export class FlightBookingRepository {
//     async getBookingById(bookingId: string) {
//         return {
//             order: {
//                 BookingId: bookingId,
//                 status: "PENDING",
//                 Amount: 10240.5
//             },
//             itemInfos: {
//                 AIR: {
//                     TripInformation: [
//                         {
//                             SegmentInformation: [
//                                 {
//                                     FlightDetails: {
//                                         AirlineInfo: {
//                                             AirlineName: "Air India",
//                                             SSRCode: "AI"
//                                         },
//                                         FirstName: "1834" // Flight Number
//                                     },
//                                     DepartureAirport: {
//                                         cityCode: "JAI",
//                                         city: "Jaipur"
//                                     },
//                                     ArrivalAirport: {
//                                         cityCode: "DEL",
//                                         city: "Delhi"
//                                     },
//                                     DepartureTime: "2026-05-08T08:30",
//                                     ArrivalTime: "2026-05-08T09:35",
//                                     Duration: 65
//                                 }
//                             ]
//                         }
//                     ],
//                     TravellerInformation: [
//                         {
//                             Title: "Mr",
//                             FirstName: "Sadasiba",
//                             LastName: "Baliyarsingh",
//                             PaxType: "ADULT"
//                         }
//                     ],
//                     totalPriceInfo: {
//                         totalFareDetail: {
//                             FareComponents: {
//                                 NetFare: 10240.5
//                             }
//                         }
//                     }
//                 }
//             }
//         };
//     }
// }
















import BookingService from "../services/booking.service";

export class FlightBookingRepository {
    async getBookingById(bookingId: string) {
        // Fetch dynamic data from the Tripjack API via your existing service
        const response = await BookingService.getBookingDetails(bookingId);
        
        // This 'response' is already mapped by TripjackFieldMapper.map
        return response;
    }
}