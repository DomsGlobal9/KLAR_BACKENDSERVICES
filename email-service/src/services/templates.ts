
export interface BookingTemplateData {
    confirmationNumber: string;
    hotelName: string;
    hotelImage?: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    totalAmount: number;
    currency: string;
    roomType: string;
    hotelAddress?: string;
    agentName?: string;
}

export const getBookingConfirmationTemplate = (data: BookingTemplateData) => {
    const {
        confirmationNumber,
        hotelName,
        hotelImage,
        guestName,
        checkIn,
        checkOut,
        totalAmount,
        currency,
        roomType,
        hotelAddress = 'Address details available in booking portal',
        agentName = 'KLAR Agent'
    } = data;

    const formattedCheckIn = new Date(checkIn).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const formattedCheckOut = new Date(checkOut).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation - ${hotelName}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f7f9;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .header {
            background-color: #003580;
            color: #ffffff;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .booking-info {
            background-color: #f9f9f9;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 25px;
            border-left: 4px solid #003580;
        }
        .booking-id {
            font-weight: bold;
            color: #003580;
            font-size: 18px;
        }
        .hotel-section {
            display: flex;
            margin-bottom: 25px;
            border-bottom: 1px solid #eeeeee;
            padding-bottom: 20px;
        }
        .hotel-image {
            width: 150px;
            height: 100px;
            object-fit: cover;
            border-radius: 4px;
            margin-right: 20px;
        }
        .hotel-details {
            flex: 1;
        }
        .hotel-details h2 {
            margin: 0 0 5px;
            font-size: 20px;
            color: #333;
        }
        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 25px;
        }
        .detail-item label {
            display: block;
            font-size: 12px;
            text-transform: uppercase;
            color: #666;
            margin-bottom: 5px;
            letter-spacing: 0.5px;
        }
        .detail-item span {
            font-weight: 500;
            color: #333;
        }
        .footer {
            background-color: #f4f7f9;
            padding: 20px;
            text-align: center;
            font-size: 13px;
            color: #777;
        }
        .total-price {
            font-size: 24px;
            font-weight: bold;
            color: #008009;
            text-align: right;
            margin-top: 10px;
        }
        .btn {
            display: inline-block;
            padding: 12px 25px;
            background-color: #003580;
            color: #ffffff;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            margin-top: 20px;
        }
        @media only screen and (max-width: 480px) {
            .hotel-section {
                flex-direction: column;
            }
            .hotel-image {
                width: 100%;
                height: 180px;
                margin-right: 0;
                margin-bottom: 15px;
            }
            .details-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Booking Confirmed!</h1>
            <p>Thank you for booking with KLAR</p>
        </div>
        <div class="content">
            <p>Dear <strong>${guestName}</strong>,</p>
            <p>Your hotel reservation has been successfully confirmed. Please find your booking details below.</p>
            
            <div class="booking-info">
                <span>Confirmation Number:</span><br>
                <span class="booking-id">${confirmationNumber}</span>
            </div>

            <div class="hotel-section">
                ${hotelImage ? `<img src="${hotelImage}" alt="${hotelName}" class="hotel-image">` : ''}
                <div class="hotel-details">
                    <h2>${hotelName}</h2>
                    <p style="font-size: 14px; color: #666; margin: 0;">${hotelAddress}</p>
                </div>
            </div>

            <div class="details-grid">
                <div class="detail-item">
                    <label>Check-In</label>
                    <span>${formattedCheckIn}</span>
                </div>
                <div class="detail-item">
                    <label>Check-Out</label>
                    <span>${formattedCheckOut}</span>
                </div>
                <div class="detail-item">
                    <label>Room Category</label>
                    <span>${roomType}</span>
                </div>
                <div class="detail-item">
                    <label>Guest Name</label>
                    <span>${guestName}</span>
                </div>
            </div>

            <div style="border-top: 1px solid #eeeeee; padding-top: 20px;">
                <div style="float: left; font-size: 14px; color: #666; margin-top: 10px;">
                    Booked by: ${agentName}
                </div>
                <div class="total-price">
                    ${currency} ${totalAmount.toLocaleString()}
                </div>
                <div style="clear: both;"></div>
            </div>

            <center>
                <a href="https://klarworld.com/my-bookings" class="btn">View Booking Details</a>
            </center>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} KLAR World. All rights reserved.</p>
            <p>If you have any questions, please contact our support team at support@klarworld.com</p>
        </div>
    </div>
</body>
</html>
    `;
};
