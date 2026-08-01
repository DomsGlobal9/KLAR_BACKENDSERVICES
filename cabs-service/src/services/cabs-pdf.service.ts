const pdfmake = require('pdfmake');
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { ICabBooking } from '../models/CabBooking.model';

export class CabsPdfGeneratorService {
  constructor() {
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };
    pdfmake.setFonts(fonts);
  }

  public async generateCabVoucher(booking: ICabBooking): Promise<Buffer> {
    const rawStatus = String(booking.status || 'PENDING').toUpperCase();
    
    // Formatting Helpers
    const formatDate = (dateStr: any) => {
      if (!dateStr) return "N/A";
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    };

    const formatCurrency = (val: number) => {
      return val.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    // Data Extraction
    const guestName = `${booking.passenger?.firstName || ''} ${booking.passenger?.lastName || ''}`.trim() || "Valued Guest";
    const clientEmail = booking.passenger?.email || "N/A";
    const clientPhone = booking.passenger?.phone || "N/A";
    
    const vehicleName = `${booking.vehicleCategory || ''} ${booking.vehicleType || ''}`.trim() || "Standard Vehicle";
    const totalAmount = Number(booking.totalAmount || 0);
    const currencyCode = booking.currency || "INR";

    const origin = booking.origin?.displayAddress || "N/A";
    const destination = booking.destination?.displayAddress || "N/A";

    const docDefinition: TDocumentDefinitions = {
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
      },
      content: [
        {
          columns: [
            { text: 'KLAR TRAVELS', style: 'headerLogo' },
            { 
              text: [
                { text: 'CAB VOUCHER\n', style: 'headerTitle' },
                { text: `Ref: ${booking.klarBookingId || booking.bookingId || 'PENDING'}\n` },
                { text: `Status: ${rawStatus}` }
              ],
              alignment: 'right'
            }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2 }] },
        { text: '\n' },
        
        { text: 'GUEST INFORMATION', style: 'sectionHeader' },
        {
          table: {
            widths: ['*'],
            body: [
              [{
                columns: [
                  { text: `Name: ${guestName.toUpperCase()}\nEmail: ${clientEmail}\nPhone: ${clientPhone}` }
                ]
              }]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 15]
        },

        { text: 'JOURNEY DETAILS', style: 'sectionHeader' },
        {
          table: {
            widths: ['50%', '50%'],
            body: [
              [{ text: 'Pickup Location', style: 'tableHeader' }, { text: 'Drop Location', style: 'tableHeader' }],
              [origin, destination]
            ]
          },
          layout: {
            hLineWidth: (i: any, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
            vLineWidth: (i: any, node: any) => 0
          },
          margin: [0, 0, 0, 15]
        },

        { text: 'VEHICLE DETAILS', style: 'sectionHeader' },
        {
          table: {
            widths: ['50%', '50%'],
            body: [
              [
                { text: 'Pickup Time', style: 'tableHeader' }, 
                { text: 'Vehicle Type', style: 'tableHeader' }
              ],
              [
                formatDate(booking.pickupDate),
                vehicleName
              ]
            ]
          },
          layout: {
            hLineWidth: (i: any, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
            vLineWidth: (i: any, node: any) => 0
          },
          margin: [0, 0, 0, 15]
        },

        { text: 'PAYMENT SUMMARY', style: 'sectionHeader' },
        {
          table: {
            widths: ['75%', '25%'],
            body: [
              ['Total Amount Paid', { text: `${currencyCode} ${formatCurrency(totalAmount)}`, alignment: 'right' }]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 25]
        },

        { text: 'IMPORTANT INFORMATION', style: 'sectionHeader' },
        {
          ul: [
            'Please be ready at the pickup location 10 minutes before the scheduled time.',
            'Tolls, parking, and state taxes may be extra if not explicitly included in the fare.',
            'Driver details will be shared via SMS/Email shortly before the journey.'
          ],
          fontSize: 9,
          color: 'gray'
        }
      ],
      styles: {
        headerLogo: {
          fontSize: 22,
          bold: true,
          color: '#003580'
        },
        headerTitle: {
          fontSize: 14,
          bold: true,
        },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          margin: [0, 10, 0, 5],
          color: '#333333'
        },
        tableHeader: {
          bold: true,
          fillColor: '#f5f5f5',
          color: '#333333'
        }
      }
    };

    const pdfDoc = pdfmake.createPdf(docDefinition);
    return await pdfDoc.getBuffer();
  }
}

export const cabsPdfGeneratorService = new CabsPdfGeneratorService();
