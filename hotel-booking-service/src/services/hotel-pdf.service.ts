const pdfmake = require("pdfmake");
import { TDocumentDefinitions } from "pdfmake/interfaces";

export class PdfGeneratorService {
  constructor() {
    const fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };
    pdfmake.setFonts(fonts);
  }

  public async generateHotelVoucher(
    booking: any,
    target: "client" | "agent",
    status: string,
  ): Promise<Buffer> {
    const rawStatus = String(status || "").toUpperCase();

    // Formatting Helpers
    const formatDate = (dateStr: any) => {
      if (!dateStr) return "N/A";
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    };

    const formatTime = (dateStr: any) => {
      if (!dateStr) return "N/A";
      return new Date(dateStr).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    };

    const formatCurrency = (val: number) => {
      return val.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Data Extraction
    const guestName = String(booking.guestName || "Valued Guest").toUpperCase();
    const clientEmail =
      booking.guestEmail ||
      booking.tripJackRequest?.deliveryInfo?.emails?.[0] ||
      "N/A";
    let clientPhone = "N/A";
    if (booking.guestMobile) {
      clientPhone = booking.guestMobile;
    }

    const roomName =
      booking.roomType ||
      booking.rooms?.[0]?.roomType ||
      booking.roomName ||
      "Deluxe Room";
    const roomsCount =
      booking.rooms?.length || booking.tripJackRequest?.roomInfo?.length || 1;
    let mealPlan = "Room Only";
    if (booking.rooms?.[0]?.boardType) mealPlan = booking.rooms[0].boardType;

    const totalAmount = Number(booking.totalAmount || 0);
    const currencyCode = booking.currencyCode || "INR";

    const docDefinition: TDocumentDefinitions = {
      defaultStyle: {
        font: "Helvetica",
        fontSize: 10,
      },
      content: [
        {
          columns: [
            { text: "KLAR TRAVELS", style: "headerLogo" },
            {
              text: [
                { text: "HOTEL VOUCHER\n", style: "headerTitle" },
                { text: `Ref: ${booking.klarBookingId || booking.confirmationNumber || "PENDING"}\n` },
                { text: `Status: ${rawStatus}` },
              ],
              alignment: "right",
            },
          ],
        },
        {
          canvas: [
            { type: "line", x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2 },
          ],
        },
        { text: "\n" },

        { text: "GUEST INFORMATION", style: "sectionHeader" },
        {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  columns: [
                    {
                      text: `Name: ${guestName}\nEmail: ${clientEmail}\nPhone: ${clientPhone}`,
                    },
                  ],
                },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 15],
        },

        { text: "HOTEL INFORMATION", style: "sectionHeader" },
        {
          table: {
            widths: ["35%", "65%"],
            body: [
              [
                { text: "Hotel Name", style: "tableHeader" },
                { text: "Address", style: "tableHeader" },
              ],
              [
                booking.hotelName || "Your Selected Hotel",
                booking.hotelAddress || "N/A",
              ],
            ],
          },
          layout: {
            hLineWidth: (i: any, node: any) =>
              i === 0 || i === node.table.body.length ? 1 : 0.5,
            vLineWidth: (i: any, node: any) => 0,
          },
          margin: [0, 0, 0, 15],
        },

        { text: "STAY DETAILS", style: "sectionHeader" },
        {
          table: {
            widths: ["25%", "25%", "25%", "25%"],
            body: [
              [
                { text: "Check-In", style: "tableHeader" },
                { text: "Check-Out", style: "tableHeader" },
                { text: "Rooms", style: "tableHeader" },
                { text: "Meal Plan", style: "tableHeader" },
              ],
              [
                formatDate(booking.checkIn),
                formatDate(booking.checkOut),
                roomsCount.toString(),
                mealPlan,
              ],
            ],
          },
          margin: [0, 0, 0, 15],
        },

        { text: "PAYMENT SUMMARY", style: "sectionHeader" },
        {
          table: {
            widths: ["75%", "25%"],
            body: [
              [
                "Total Amount Paid",
                {
                  text: `${currencyCode} ${formatCurrency(totalAmount)}`,
                  alignment: "right",
                },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 25],
        },

        { text: "IMPORTANT INFORMATION", style: "sectionHeader" },
        {
          ul: [
            "Standard check-in time is 2:00 PM and check-out time is 12:00 PM.",
            "Please carry a valid government-issued photo ID.",
            "Any incidentals must be settled directly with the hotel upon check-out.",
          ],
          fontSize: 9,
          color: "gray",
        },
      ],
      styles: {
        headerLogo: {
          fontSize: 22,
          bold: true,
          color: "#003580",
        },
        headerTitle: {
          fontSize: 14,
          bold: true,
        },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          margin: [0, 10, 0, 5],
          color: "#333333",
        },
        tableHeader: {
          bold: true,
          fillColor: "#f5f5f5",
          color: "#333333",
        },
      },
    };

    const pdfDoc = pdfmake.createPdf(docDefinition);
    return await pdfDoc.getBuffer();
  }
}

export const pdfGeneratorService = new PdfGeneratorService();
