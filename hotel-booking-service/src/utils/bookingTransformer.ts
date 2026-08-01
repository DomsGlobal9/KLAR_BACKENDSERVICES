// src/utils/bookingTransformer.ts

export const compileTravellerPayload = (
  formData: any,
  providerContext: any,
) => {
  const rawHotelId = providerContext?.hotelId || formData?.hotelId || "";
  const cleanHotelId =
    typeof rawHotelId === "string" && rawHotelId.startsWith("TJ:")
      ? rawHotelId.replace("TJ:", "")
      : rawHotelId;
  const isTJ = typeof rawHotelId === "string" && rawHotelId.startsWith("TJ:");

  if (isTJ) {
    // 🏢 TRIPJACK ARCHITECTURE PIPELINE
    const primaryEmail =
      formData.primaryEmail ||
      formData.email ||
      formData.rooms?.[0]?.guests?.[0]?.email ||
      "";
    const primaryPhone =
      formData.primaryPhone ||
      formData.mobile ||
      formData.phone ||
      formData.rooms?.[0]?.guests?.[0]?.mobile ||
      "";
    const rawCountryCode =
      formData.countryCode || formData.profileCountryCode || "+91";
    const countryCode = rawCountryCode.startsWith("+")
      ? rawCountryCode
      : `+${rawCountryCode}`;

    return {
      bookingId: providerContext.bookingId || formData.precheckBookingId,
      type: "HOTEL",
      roomTravellerInfo: formData.rooms.map((room: any, rIdx: number) => ({
        travellerInfo: room.guests.map((g: any, gIdx: number) => {
          const cleanFN = (g.firstName || "Guest")
            .replace(/[^a-zA-Z]/g, "")
            .toUpperCase();
          const cleanLN = (g.lastName || "User")
            .replace(/[^a-zA-Z]/g, "")
            .toUpperCase();
          return {
            ti: g.title || "Mr",
            pt: g.isAdult ? "ADULT" : "CHILD",
            fN:
              gIdx === 0 && rIdx > 0
                ? `${cleanFN}R${rIdx + 1}`.toUpperCase()
                : cleanFN,
            lN: cleanLN,
            ...(g.pan && { pan: g.pan.toUpperCase() }),
            ...(g.passport && { pNum: g.passport.toUpperCase() }),
            ...(g.age && { age: g.age }),
          };
        }),
      })),
      deliveryInfo: {
        emails: [primaryEmail],
        contacts: [primaryPhone],
        code: [countryCode],
      },
      ...(formData.isCorporate &&
        formData.gstNumber && {
          gstInfo: {
            gstNumber: formData.gstNumber,
            registeredName: formData.companyName,
          },
        }),
    };
  } else {
    // 🏨 RATEGAIN ARCHITECTURE PIPELINE
    console.log(
      "[DEBUG] formData.RoomSelection:",
      JSON.stringify(formData.RoomSelection, null, 2),
    );
    console.log(
      "[DEBUG] formData.rooms:",
      JSON.stringify(formData.rooms, null, 2),
    );

    return {
      hotelName: formData.hotelName,
      hotelImage: formData.hotelImage,
      hotelAddress: formData.hotelAddress,
      city: formData.city,
      starRating: formData.starRating,
      BookReservation: {
        ResStatus: 1,
        DemandBookingId: `KLAR${Date.now()}`,
        CurrencyCode:
          providerContext.currency ||
          formData.CurrencyCode ||
          formData.Currency ||
          "USD",
        TimeStamp: new Date().toISOString(),
        ReservationDate: new Date().toISOString(),
        checkin:
          providerContext.checkIn || formData.checkIn || formData.checkin,
        checkout:
          providerContext.checkOut || formData.checkOut || formData.checkout,
        propertyID:
          providerContext.hotelId || formData.hotelId || formData.propertyID,
        PropertyCode:
          formData.PropertyCode ||
          formData.propertyCode ||
          providerContext.hotelId,
        BrandCode: formData.BrandCode || formData.brandCode || "N/A",
        EchoToken: formData.EchoToken || `echo-${Date.now()}`,
        Session: formData.Session || "",
        BookingRate:
          providerContext.totalAggregatePrice ||
          formData.totalNet ||
          formData.totalPrice,
        RoomSelection: formData.rooms.map((room: any) => ({
          RoomTypeCode:
            room.roomTypeCode ||
            formData.RoomSelection?.[0]?.RoomTypeCode ||
            "Standard",
          NumberOfRooms: 1,
          RoomSelectionKey:
            room.selectionKey ||
            room.optionId ||
            room.rateKey ||
            formData.RoomSelection?.[0]?.RoomSelectionKey ||
            "",
          RoomRate:
            room.rate ||
            room.price ||
            formData.RoomSelection?.[0]?.RoomRate ||
            0,
          BoardName:
            room.boardName ||
            formData.RoomSelection?.[0]?.BoardName ||
            "ROOM ONLY",
          allocationDetails:
            room.allocationDetails ||
            formData.RoomSelection?.[0]?.allocationDetails ||
            formData.precheckResponse?.body?.preCheckResponse?.rooms?.[0]
              ?.rates?.[0]?.allocationDetails ||
            formData.precheckResponse?.body?.preCheckResponse
              ?.allocationDetails ||
            undefined,
          Guest: room.guests
            .filter((g: any) => g.isAdult)
            .map((g: any, idx: number) => {
              const frontendGuest =
                formData.RoomSelection?.[0]?.Guest?.[0] || {};
              return {
                FirstName: g.firstName || frontendGuest.FirstName || "Guest",
                LastName:
                  (g.lastName || frontendGuest.LastName || "Guest") +
                  (idx > 0 ? `Adult${idx + 1}` : ""),
                Primary: idx === 0,
                Email:
                  g.email ||
                  formData.primaryEmail ||
                  formData.email ||
                  frontendGuest.Email ||
                  "[EMAIL_ADDRESS]",
                EmailType: 1,
                ProfileType: 1,
                Phone:
                  g.mobile ||
                  formData.primaryPhone ||
                  formData.mobile ||
                  formData.phone ||
                  frontendGuest.Phone ||
                  "0000000000",
                // Required for the primary guest per RG spec 1.5.3 (p.39).
                CountryCode:
                  formData.guestCountryCode ||
                  formData.countryCodeISO ||
                  formData.CountryCode ||
                  frontendGuest.CountryCode ||
                  "IN",
                PostalCode:
                  formData.guestPostalCode ||
                  formData.postalCode ||
                  frontendGuest.PostalCode ||
                  "500001",
                // Required=No per the same table. The booking form no longer
                // collects them, so they are normally absent — sent only if an
                // older client still supplies one, and omitted rather than
                // filled with "N/A" / a guessed "TN" otherwise.
                //
                // Line1 must never fall back to formData.hotelAddress: that is
                // the HOTEL's street address, and sending it as the guest's
                // address told the property its own address was the customer's.
                ...(frontendGuest.Line1 ? { Line1: frontendGuest.Line1 } : {}),
                ...(frontendGuest.City ? { City: frontendGuest.City } : {}),
                ...(frontendGuest.StateCode
                  ? { StateCode: frontendGuest.StateCode }
                  : {}),
              };
            }),
          Children: room.guests
            .filter((g: any) => !g.isAdult)
            .map((g: any) => ({
              type: "Child", // Enforces capital "C" compliance
              age: g.age || 5,
            })),
        })),
      },
    };
  }
};
