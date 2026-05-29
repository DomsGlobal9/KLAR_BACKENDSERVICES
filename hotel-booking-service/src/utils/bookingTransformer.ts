// src/utils/bookingTransformer.ts

export const compileTravellerPayload = (formData: any, providerContext: any) => {
  const rawHotelId = providerContext?.hotelId || formData?.hotelId || "";
  const cleanHotelId = typeof rawHotelId === 'string' && rawHotelId.startsWith("TJ:") 
      ? rawHotelId.replace("TJ:", "") 
      : rawHotelId;
  const isTJ = typeof rawHotelId === 'string' && rawHotelId.startsWith('TJ:');


  if (isTJ) {
    // 🏢 TRIPJACK ARCHITECTURE PIPELINE
    const primaryEmail = formData.primaryEmail || formData.email || formData.rooms?.[0]?.guests?.[0]?.email || "";
    const primaryPhone = formData.primaryPhone || formData.mobile || formData.phone || formData.rooms?.[0]?.guests?.[0]?.mobile || "";
    const rawCountryCode = formData.countryCode || formData.profileCountryCode || "+91";
    const countryCode = rawCountryCode.startsWith("+") ? rawCountryCode : `+${rawCountryCode}`;

    return {
      bookingId: providerContext.bookingId || formData.precheckBookingId,
      type: "HOTEL",
      roomTravellerInfo: formData.rooms.map((room: any, rIdx: number) => ({
        travellerInfo: room.guests.map((g: any, gIdx: number) => {
          const cleanFN = (g.firstName || "Guest").replace(/[^a-zA-Z]/g, '').toUpperCase();
          const cleanLN = (g.lastName || "User").replace(/[^a-zA-Z]/g, '').toUpperCase();
          return {
            ti: g.title || "Mr",
            pt: g.isAdult ? "ADULT" : "CHILD",
            fN: gIdx === 0 && rIdx > 0 ? `${cleanFN}R${rIdx + 1}`.toUpperCase() : cleanFN,
            lN: cleanLN,
            ...(g.pan && { pan: g.pan.toUpperCase() }),
            ...(g.passport && { pNum: g.passport.toUpperCase() })
          };
        })
      })),
      deliveryInfo: {
        emails: [primaryEmail],
        contacts: [primaryPhone],
        code: [countryCode]
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
        TimeStamp: new Date().toISOString(),
        ReservationDate: new Date().toISOString(),
        checkin: providerContext.checkIn,
        checkout: providerContext.checkOut,
        propertyID: providerContext.hotelId,
        BookingRate: providerContext.totalAggregatePrice,
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
