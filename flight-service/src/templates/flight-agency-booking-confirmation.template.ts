
export const flightAgencyBookingConfirmationTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flight Booking Confirmation - Agency Copy · Klar Travels</title>
    <style>
        /* Base & reset */
        * {
            box-sizing: border-box;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #e8e8e8;
        }
        .container {
            max-width: 750px;
            margin: 0 auto;
            background: #ffffff;
            padding: 30px;
            border: 3px solid #000;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            position: relative;
        }
        .container::before {
            content: '';
            position: absolute;
            top: 8px;
            left: 8px;
            right: 8px;
            bottom: 8px;
            border: 1px solid #ccc;
            pointer-events: none;
            border-radius: 8px;
        }
        /* header */
        .header {
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 15px;
        }
        .header table {
            width: 100%;
            border-collapse: collapse;
        }
        .header td {
            vertical-align: middle;
            padding: 4px 0;
        }
        .logo {
            max-height: 55px;
            width: auto;
        }
        .header-right {
            text-align: right;
            font-size: 11px;
            color: #333;
            line-height: 1.6;
        }
        .header-right .company-name {
            font-size: 15px;
            font-weight: bold;
            color: #000;
            letter-spacing: 1px;
        }
        .header-right .pnr {
            font-weight: bold;
            font-size: 14px;
            margin-top: 3px;
        }
        .agency-badge {
            display: inline-block;
            padding: 2px 15px;
            border: 1px solid #ff6b6b;
            border-radius: 4px;
            color: #ff6b6b;
            font-weight: bold;
            font-size: 11px;
            background: #fff5f5;
            margin-top: 4px;
        }
        /* tables general */
        .info-table, .flight-table, .passenger-table, .seat-table, .fare-table, .agency-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 10px 0;
            font-size: 12px;
        }
        .info-table td, .flight-table td, .passenger-table td, .seat-table td, .fare-table td, .agency-table td {
            padding: 8px 10px;
            border: 1px solid #000;
            vertical-align: middle;
        }
        .flight-table .flight-header {
            font-weight: bold;
            font-size: 14px;
            background: #f5f5f5;
            text-align: left;
            padding: 8px 15px;
        }
        .flight-table .flight-header .status-right {
            float: right;
        }
        .flight-table .time {
            font-weight: bold;
            font-size: 16px;
        }
        .flight-table .city-code {
            font-weight: bold;
            font-size: 17px;
        }
        .flight-table .duration {
            text-align: center;
            font-size: 12px;
            color: #555;
        }
        .status-badge {
            display: inline-block;
            padding: 2px 15px;
            border: 1px solid #28a745;
            border-radius: 4px;
            color: #28a745;
            font-weight: bold;
            font-size: 12px;
            background: #f0fff0;
        }
        .highlight-pnr, .highlight-flight, .highlight-price {
            font-weight: bold;
            color: #1a1a2e;
            font-size: 13px;
        }
        .passenger-table .header-row, .seat-table .header-row, .fare-table .header-row, .agency-table .header-row {
            background: #f5f5f5;
            font-weight: bold;
            text-align: center;
        }
        .passenger-table .pax-name, .seat-table .pax-name-cell, .fare-table .pax-name-cell {
            font-weight: bold;
        }
        .fare-table .total-row {
            font-weight: bold;
            background: #f5f5f5;
        }
        .section-title {
            font-weight: bold;
            font-size: 15px;
            margin: 18px 0 8px;
            padding: 6px 0;
            border-bottom: 2px solid #000;
        }
        .contact-info {
            font-size: 12px;
            color: #333;
            margin: 8px 0;
        }
        .contact-info strong {
            font-weight: bold;
        }
        .barcode-section {
            text-align: center;
            margin: 15px 0 10px;
            padding: 10px;
            border-top: 2px dashed #999;
            border-bottom: 2px dashed #999;
            border-radius: 8px;
        }
        .barcode-section .barcode {
            font-family: 'Courier New', monospace;
            font-size: 22px;
            letter-spacing: 2px;
            color: #000;
            font-weight: bold;
        }
        .footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
            text-align: center;
            color: #888;
            font-size: 11px;
        }
        .pnr-details {
            font-size: 11px;
            color: #555;
            margin-top: 3px;
        }
        .pnr-details strong {
            color: #333;
        }
        /* Separator line style */
        .separator-line {
            display: block;
            width: 100%;
            height: 1px;
            background: #ddd;
            margin: 4px 0;
        }
        .agency-notes {
            background: #f8f9fa;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 6px;
            margin: 10px 0;
        }
        .agency-notes ul {
            color: #333;
            font-size: 12px;
            line-height: 1.8;
            padding-left: 20px;
            margin: 5px 0;
        }
        .agency-notes ul li {
            margin: 4px 0;
        }

        /* ===== RESPONSIVE ===== */
        @media only screen and (max-width: 640px) {
            body {
                padding: 8px;
                background-color: #e8e8e8;
            }
            .container {
                padding: 16px 12px;
                margin: 0;
                border-width: 2px;
                border-radius: 10px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .container::before {
                top: 4px;
                left: 4px;
                right: 4px;
                bottom: 4px;
                border-radius: 6px;
            }

            /* header stack */
            .header td {
                display: block;
                text-align: center !important;
                width: 100% !important;
                padding: 2px 0;
            }
            .header-right {
                text-align: center !important;
                margin-top: 8px;
                font-size: 11px;
            }
            .header-right .company-name {
                font-size: 16px;
            }
            .logo {
                max-height: 48px;
                margin: 0 auto;
            }

            /* force all tables to block and remove borders */
            .info-table, .flight-table, .passenger-table, .seat-table, .fare-table, .agency-table {
                border: none !important;
                display: block;
                width: 100%;
                margin: 12px 0;
            }
            .info-table tbody, .flight-table tbody, .passenger-table tbody, .seat-table tbody, .fare-table tbody, .agency-table tbody {
                display: block;
                width: 100%;
            }
            .info-table tr, .flight-table tr, .passenger-table tr, .seat-table tr, .fare-table tr, .agency-table tr {
                display: block;
                width: 100%;
                margin-bottom: 6px;
                border: 1px solid #000;
                border-radius: 8px;
                padding: 6px 8px;
                background: #fff;
            }
            /* hide header rows in passenger/seat/fare tables */
            .passenger-table .header-row, 
            .seat-table .header-row, 
            .fare-table .header-row,
            .agency-table .header-row {
                display: none !important;
            }

            .info-table td, .flight-table td, .passenger-table td, .seat-table td, .fare-table td, .agency-table td {
                display: block;
                width: 100% !important;
                border: none !important;
                border-bottom: 1px solid #e0e0e0 !important;
                padding: 6px 4px !important;
                text-align: left !important;
                background: transparent !important;
                border-radius: 0 !important;
            }
            .info-table td:last-child, .flight-table td:last-child, 
            .passenger-table td:last-child, .seat-table td:last-child, 
            .fare-table td:last-child, .agency-table td:last-child {
                border-bottom: none !important;
            }
            /* label style for info table */
            .info-table .label {
                font-weight: bold;
                background: transparent !important;
                width: 100% !important;
            }
            /* flight specific */
            .flight-table .flight-header {
                display: block;
                text-align: center !important;
                background: #f5f5f5;
                border-radius: 6px 6px 0 0 !important;
                padding: 10px 8px !important;
                font-size: 14px;
                border-bottom: 1px solid #000 !important;
            }
            .flight-table .flight-header .status-right {
                float: none !important;
                display: block;
                margin-top: 6px;
            }
            .flight-table .duration {
                text-align: center !important;
                padding: 8px 4px !important;
                border-bottom: 1px solid #ddd !important;
            }
            .flight-table .time {
                font-size: 18px;
            }
            .flight-table .city-code {
                font-size: 18px;
            }
            /* seat table: force labels */
            .seat-table .pax-name-cell {
                font-weight: bold;
                font-size: 13px;
                border-bottom: 1px solid #ccc !important;
            }
            /* fare table: align left, add labels via pseudo? we keep text */
            .fare-table td, .agency-table td {
                text-align: left !important;
                font-weight: normal !important;
            }
            .fare-table .pax-name-cell {
                font-weight: bold !important;
            }
            .fare-table .total-row td {
                font-weight: bold !important;
                background: #f5f5f5;
            }
            .highlight-price {
                font-size: 13px;
            }
            /* contact info */
            .contact-info {
                font-size: 12px;
                word-break: break-word;
            }
            .barcode-section .barcode {
                font-size: 18px;
                letter-spacing: 1px;
            }
            /* footer */
            .footer {
                font-size: 10px;
            }
            /* extra spacing */
            .container .flight-table:last-child {
                margin-bottom: 6px;
            }
            .agency-notes ul {
                padding-left: 15px;
                font-size: 11px;
            }
        }

        /* small screens 400px */
        @media only screen and (max-width: 420px) {
            .container {
                padding: 12px 8px;
            }
            .flight-table .flight-header {
                font-size: 13px;
                padding: 8px 4px;
            }
            .flight-table .time {
                font-size: 16px;
            }
            .flight-table .city-code {
                font-size: 16px;
            }
            .passenger-table td, .seat-table td, .fare-table td, .agency-table td {
                padding: 4px 2px !important;
                font-size: 11px;
            }
            .header-right {
                font-size: 10px;
            }
            .header-right .company-name {
                font-size: 14px;
            }
        }

        @media print {
            body {
                background: #fff;
                padding: 0;
            }
            .container {
                box-shadow: none;
                border: 2px solid #000;
                margin: 0;
                border-radius: 8px;
            }
            .container::before {
                display: none;
            }
        }
    </style>
</head>
<body>
<div class="container">
    <!-- Header with Logo -->
    <div class="header">
        <table cellpadding="0" cellspacing="0">
            <tr>
                <td align="left">
                    <img 
                        src="https://travel-pdfs-prod-399934155938-eu-north-1-an.s3.eu-north-1.amazonaws.com/pdf/KLARBlue.png" 
                        alt="Klar Travels"
                        class="logo"
                    >
                </td>
                <td align="right" class="header-right">
                    <div class="company-name">KLAR TRAVELS</div>
                    <div>3rd Floor 305, Tilak Rd,</div>
                    <div>above Max Fashion Showroom,</div>
                    <div>beside payal footwears,</div>
                    <div>Hanuman Tekdi, Abids,</div>
                    <div>Hyderabad, Telangana 500001</div>
                    <div style="margin-top: 3px;">040-42603413 | 8099359377</div>
                    <div>Issued Date: {{formatDate bookingDate}}</div>
                    <div><span class="agency-badge">AGENCY COPY</span></div>
                </td>
            </tr>
        </table>
    </div>
    
    <!-- Passengers -->
    <table class="passenger-table">
        <tr class="header-row" style="font-size: 14px; font-weight: bold;">
            <td style="width: 35%;">Passenger Name</td>
            <td style="width: 40%;">PNR Details</td>
            <td style="width: 25%;">Booking ID</td>
        </tr>
        {{#each travellers}}
        <tr>
            <td class="pax-name">{{this.title}} {{this.firstName}} / {{this.lastName}} ({{this.paxType}})</td>
            <td class="highlight-pnr">
                {{#if this.formattedPnrDetails}}
                    {{#each this.formattedPnrDetails}}
                        <div style="font-size: 11px; margin-bottom: 2px;">
                            <strong>{{this.route}}</strong>: {{this.pnr}}
                            {{#if this.flightNumber}}
                                ({{this.flightNumber}})
                            {{/if}}
                        </div>
                    {{/each}}
                {{else if this.pnrDetails}}
                    {{#each this.pnrDetails}}
                        {{this}}{{#unless @last}}, {{/unless}}
                    {{/each}}
                {{else}}
                    N/A
                {{/if}}
            </td>
            <td class="highlight-pnr">{{../bookingId}}</td>
        </tr>
        {{/each}}
    </table>
    
    <!-- Contact Info -->
    <div class="contact-info">
        <strong>Passenger Contact Number -</strong> 
        {{#if deliveryInfo.Contacts}}
            {{#each deliveryInfo.Contacts}}
                {{this}}{{#unless @last}}, {{/unless}}
            {{/each}}
        {{else}}
            N/A
        {{/if}}
    </div>
    <div class="contact-info">
        <strong>Passenger Email -</strong> 
        {{#if deliveryInfo.Emails}}
            {{#each deliveryInfo.Emails}}
                {{this}}{{#unless @last}}, {{/unless}}
            {{/each}}
        {{else}}
            N/A
        {{/if}}
    </div>

    <!-- GST Details - Agency Copy -->
    {{#ifCond gstInfo '&&' gstInfo.gstNumber}}
    <div class="section-title">GST Details</div>
    <table class="agency-table">
        <tr class="header-row">
            <td style="text-align: left; width: 30%;">GST Number</td>
            <td style="width: 40%;">Registered Name</td>
            <td style="width: 30%;">SEZ</td>
        </tr>
        <tr>
            <td><strong>{{gstInfo.gstNumber}}</strong></td>
            <td>{{gstInfo.registeredName}}</td>
            <td>{{#if gstInfo.isSez}}Yes{{else}}No{{/if}}</td>
        </tr>
        {{#if gstInfo.email}}
        <tr>
            <td><strong>Email</strong></td>
            <td colspan="2">{{gstInfo.email}}</td>
        </tr>
        {{/if}}
        {{#if gstInfo.mobile}}
        <tr>
            <td><strong>Mobile</strong></td>
            <td colspan="2">{{gstInfo.mobile}}</td>
        </tr>
        {{/if}}
        {{#if gstInfo.address}}
        <tr>
            <td><strong>Address</strong></td>
            <td colspan="2">{{gstInfo.address}}</td>
        </tr>
        {{/if}}
    </table>
    {{/ifCond}}

    <!-- Flight Segments -->
    <div class="section-title">Flight Details</div>

    <!-- Your Flight -->
    {{#each segments}}
    <table class="flight-table">
        <tr>
            <td colspan="4" class="flight-header">
                <span>
                    {{#if ../isRoundTrip}}
                        {{#if this.isFirstTrip}}Onward{{else}}Return{{/if}}
                    {{else if ../isMultiCity}}
                        Flight {{add this.tripIndex 1}}
                    {{else}}
                        One Way
                    {{/if}}
                    - {{this.departureAirport.city}} To {{this.arrivalAirport.city}} {{formatDate this.departureTime}}
                </span>
                <span class="status-right"><span class="status-badge">CONFIRMED</span></span>
            </td>
        </tr>
        <tr>
            <td style="width: 35%;">
                <div class="time">{{formatTime this.departureTime}}</div>
                <div class="city-code">{{this.departureAirport.SSRCode}}</div>
                <div style="font-size: 12px; color: #555;">{{this.departureAirport.city}}</div>
                <div style="font-size: 11px; color: #999;">Terminal - {{defaultIfEmpty this.departureAirport.terminal 'N/A'}}</div>
            </td>

            <td style="width: 30%;" class="duration">

                <!-- Airline Name -->
                <div style="font-size: 12px; color: #28a745;">
                    {{getAirlineName this.flightDetails.AirlineInfo}}
                </div>

                <!-- Airline Number -->
                <div class="highlight-flight" style="font-size: 13px; font-weight: bold;">
                    Flight No: {{this.flightDetails.AirlineInfo.SSRCode}} {{this.flightDetails.FirstName}}
                </div>                

                <!-- Cabin Class -->
                <div style="font-size: 12px;">
                    Class: {{this.flightDetails.CabinClass}}
                </div>

                <!-- Arrow -->
                <div style="font-size: 20px; color: #666; margin: 4px 0;">
                    →
                </div>

                <!-- Duration -->
                <div style="font-size: 12px; font-weight: bold;">
                    Duration: {{this.duration}} mins
                </div>

                <!-- Fare Basis (optional) -->
                <div style="font-size: 11px; color: #666;">
                    Fare Basis: {{this.flightDetails.FareBasis}}
                </div>
            </td>
            <td style="width: 35%;">
                <div class="time">{{formatTime this.arrivalTime}}</div>
                <div class="city-code">{{this.arrivalAirport.SSRCode}}</div>
                <div style="font-size: 12px; color: #555;">{{this.arrivalAirport.city}}</div>
                <div style="font-size: 11px; color: #999;">Terminal - {{defaultIfEmpty this.arrivalAirport.terminal 'N/A'}}</div>
            </td>
        </tr>
    </table>
    {{/each}}
    
    <!-- Fare Details -->
    <div class="section-title">Fare Details</div>
    <table class="fare-table">
        <tr class="header-row">
            <td style="text-align: left; width: 25%;">Passenger Name</td>
            <td style="width: 15%;">Baggage</td>
            <td style="width: 15%;">Meals</td>
            <td style="width: 15%;">Seat</td>
            <td style="width: 15%;">Base Fare</td>
            <td style="width: 15%;">Total Price</td>
        </tr>
        
        {{#each travellers}}
        <tr>
            <td class="pax-name-cell">
                {{this.title}} {{this.firstName}} {{this.lastName}} ({{this.paxType}})
            </td>
            <td>
                <strong>
                {{#if this.baseBaggage}}
                    {{this.baseBaggage}}
                {{/if}}
                {{#if this.extraBaggageDetails}}
                    {{#if this.baseBaggage}} + {{/if}}
                    {{#each this.extraBaggageDetails}}
                        {{this}}{{#unless @last}}, {{/unless}}
                    {{/each}}
                {{else if this.baseBaggage}}
                    
                {{else}}
                    -
                {{/if}}
                </strong>
                <span class="separator-line"></span>
                <span style="font-weight: bold;">₹{{formatPrice this.baggageCharge}}</span>
            </td>
            <td>
                <strong>
                {{#if this.mealInfo}}
                    {{#each this.mealInfo}}
                        {{this.SSRCode}}{{#unless @last}}, {{/unless}}
                    {{/each}}
                {{else}}
                    -
                {{/if}}
                </strong>
                <span class="separator-line"></span>
                <span style="font-weight: bold;">₹{{formatPrice this.mealCharge}}</span>
            </td>
            <td>
                <strong>
                {{#if this.seatInfo}}
                    {{#each this.seatInfo}}
                        <div style="font-size: 11px; margin-bottom: 2px;">
                            {{@key}}: {{this.seatNo}}
                        </div>
                    {{/each}}
                {{else}}
                    -
                {{/if}}
                </strong>
                <span class="separator-line"></span>
                <span style="font-weight: bold;">₹{{formatPrice this.seatCharge}}</span>
            </td>
            <td class="highlight-price">
                ₹{{formatPrice ../tripjackPrice}}
            </td>
            <td class="highlight-price">
                ₹{{formatPrice ../totalPrice}}
            </td>
        </tr>
        {{/each}}
        
        <tr class="total-row">
            <td style="text-align: left; font-weight: bold;">Total</td>
            <td style="font-weight: bold;">₹{{formatPrice totalBaggage}}</td>
            <td style="font-weight: bold;">₹{{formatPrice totalMeals}}</td>
            <td style="font-weight: bold;">₹{{formatPrice totalSeat}}</td>
            <td style="font-weight: bold;">₹{{formatPrice tripjackPrice}}</td>
            <td style="font-weight: bold;">₹{{formatPrice totalPrice}}</td>
        </tr>
    </table>   

    <!-- Price Breakdown - Agency sees all prices -->
    <div class="section-title">Price Breakdown</div>
    <table class="fare-table">
        <tr class="header-row">
            <td style="text-align: left; width: 40%;">Description</td>
            <td style="width: 30%;">Amount</td>
            <td style="width: 30%;">Total</td>
        </tr>
        <tr>
            <td>Base Fare</td>
            <td></td>
            <td style="font-weight: bold;">{{formatPrice tripjackPrice}}</td>
        </tr>
        <tr>
            <td>Markup</td>
            <td></td>
            <td style="font-weight: bold;">{{formatPrice markupPrice}}</td>
        </tr>
        <tr class="total-row">
            <td style="text-align: left; font-weight: bold;">Grand Total</td>
            <td></td>
            <td style="font-weight: bold;">{{formatPrice totalPrice}}</td>
        </tr>
    </table>

    <!-- Emergency Contact -->
    {{#if emergencyContact}}
    <div class="section-title">Emergency Contact</div>
    <table class="agency-table">
        <tr>
            <td style="width: 25%;"><strong>Name</strong></td>
            <td style="width: 75%;">{{emergencyContact.name}}</td>
        </tr>
        {{#if emergencyContact.email}}
        <tr>
            <td><strong>Email</strong></td>
            <td>{{emergencyContact.email}}</td>
        </tr>
        {{/if}}
        {{#if emergencyContact.phone}}
        <tr>
            <td><strong>Phone</strong></td>
            <td>{{emergencyContact.phone}}</td>
        </tr>
        {{/if}}
    </table>
    {{/if}}

    <!-- Agency Notes -->
    <div class="section-title">Agency Notes</div>
    <div class="agency-notes">
        <ul>
            <li>This is a confirmation of the booking made through Klar Travels.</li>
            <li>Please verify all traveller details and flight information.</li>
            <li>Any changes or cancellations must be processed through the agency portal.</li>
            <li>Commission and markup details are included in the price breakdown above.</li>
        </ul>
    </div>
    
    <!-- Footer -->
    <div class="footer">
        <div style="text-align: left; margin-bottom: 15px; padding: 15px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px;">
            <strong style="font-size: 13px; color: #000;">RULES AND REGULATIONS</strong>
            <div style="margin-top: 8px; font-size: 11px; color: #333; line-height: 1.6;">
                <p style="margin: 4px 0;">● PASSENGER ID - All Passengers must carry their Photo Identification while Check In.</p>
                <p style="margin: 4px 0;">● Passengers are requested to report at the airport at least 2 hours prior to departure for domestic flights and 3 hours for international flights.</p>
                <p style="margin: 4px 0;">● Check-in baggage allowance varies by airline and fare type. Please verify with the respective airline.</p>
                <p style="margin: 4px 0;">● The airline reserves the right to cancel or change the flight schedule without prior notice.</p>
                <p style="margin: 4px 0;">● For any changes or cancellations, please contact our customer support at 040-42603413 or 8099359377.</p>
            </div>
        </div>
        <p>This is a system generated confirmation for agency reference.</p>
        <p>&copy; 2026 Klar Travels. All rights reserved.</p>
    </div>

</div>
</body>
</html>
`;