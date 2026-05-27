// src/utils/bookingTransformer.ts

export const compileTravellerPayload = (formData: any, providerContext: any) => {
  const isTJ = providerContext.hotelId.startsWith('TJ:');

  if (isTJ) {
    // 🏢 TRIPJACK ARCHITECTURE PIPELINE
    return {
      bookingId: providerContext.bookingId,
      type: "HOTEL",
      roomTravellerInfo: formData.rooms.map((room: any, rIdx: number) => ({
        travellerInfo: room.guests.map((g: any, gIdx: number) => ({
          ti: g.title, // Mr, Mrs, Ms, Miss, Master
          pt: g.isAdult ? "ADULT" : "CHILD",
          fN: gIdx === 0 && rIdx > 0 ? `${g.firstName}R${rIdx + 1}`.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : g.firstName.toUpperCase(),
          lN: g.lastName.toUpperCase(),
          ...(g.pan && { pan: g.pan.toUpperCase() }),
          ...(g.passport && { pNum: g.passport.toUpperCase() })
        }))
      })),
      deliveryInfo: {
        emails: [formData.primaryEmail],
        contacts: [formData.primaryPhone],
        code: [formData.countryCode || "+91"]
      },
      ...(formData.isCorporate && formData.gstNumber && {
        gstInfo: {
          gstNumber: formData.gstNumber,
          registeredName: formData.companyName
        }
      })
    };
  } else {
    // 🏨 RATEGAIN ARCHITECTURE PIPELINE
    return {
      BookReservation: {
        ResStatus: 1,
        DemandBookingId: `KLAR${Date.now()}`,
        CurrencyCode: providerContext.currency || "USD",
        GuaranteeMethod: "CreditCard",
        GuaranteeType: "Guarantee",
        TimeStamp: new Date().toISOString(),
        ReservationDate: new Date().toISOString(),
        checkin: providerContext.checkIn,
        checkout: providerContext.checkOut,
        propertyID: providerContext.hotelId,
        BookingRate: providerContext.totalAggregatePrice,
        CreditCard: {
          Number: "1111222233334444",
          IssuedName: `${formData.rooms[0].guests[0].firstName} ${formData.rooms[0].guests[0].lastName}`,
          ExpirationDate: "2030-12",
          TypeIdentifier: "VISA"
        },
        RoomSelection: formData.rooms.map((room: any) => ({
          RoomTypeCode: room.roomTypeCode,
          NumberOfRooms: 1,
          RoomSelectionKey: room.selectionKey,
          RoomRate: room.rate,
          BoardName: room.boardName || "ROOM ONLY",
          Guest: room.guests.filter((g: any) => g.isAdult).map((g: any, idx: number) => ({
            FirstName: g.firstName,
            LastName: g.lastName,
            Primary: idx === 0,
            Email: formData.primaryEmail,
            Phone: formData.primaryPhone,
            CountryCode: formData.countryCodeISO || "IN",
            PostalCode: formData.postalCode || "500001"
          })),
          Children: room.guests.filter((g: any) => !g.isAdult).map((g: any) => ({
            type: "Child", // Enforces capital "C" compliance
            age: g.age || 5
          }))
        }))
      }
    };
  }
};
