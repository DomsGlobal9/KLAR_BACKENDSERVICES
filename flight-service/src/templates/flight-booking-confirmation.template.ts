export const flightBookingConfirmationTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flight Booking Confirmation</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 700px;
            margin: 20px auto;
            background: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .header p {
            margin: 5px 0 0;
            opacity: 0.9;
            font-size: 14px;
        }
        .section {
            margin: 25px 0;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            background: #fafafa;
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .info-item {
            padding: 8px;
            background: white;
            border-radius: 4px;
        }
        .info-item strong {
            color: #555;
            display: block;
            font-size: 12px;
            margin-bottom: 3px;
        }
        .info-item span {
            color: #333;
            font-size: 14px;
        }
        .flight-card {
            background: white;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #667eea;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .flight-card .airline {
            font-weight: bold;
            color: #667eea;
            font-size: 16px;
        }
        .flight-card .route {
            margin: 10px 0;
            padding: 10px 0;
            border-bottom: 1px dashed #e0e0e0;
        }
        .flight-card .route:last-child {
            border-bottom: none;
        }
        .flight-card .time {
            font-weight: bold;
            font-size: 16px;
        }
        .flight-card .city {
            color: #666;
            font-size: 14px;
        }
        .flight-card .terminal {
            color: #999;
            font-size: 12px;
        }
        .flight-card .duration {
            text-align: center;
            color: #999;
            font-size: 12px;
            padding: 5px 0;
        }
        .flight-card .baggage {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #e0e0e0;
            font-size: 12px;
            color: #666;
        }
        .traveller-card {
            background: white;
            padding: 12px;
            margin: 10px 0;
            border-radius: 4px;
            border: 1px solid #e8e8e8;
        }
        .traveller-card .name {
            font-weight: bold;
            font-size: 15px;
            color: #333;
        }
        .traveller-card .detail {
            font-size: 13px;
            color: #666;
            margin: 3px 0;
        }
        .traveller-card .detail strong {
            color: #555;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-success {
            background: #d4edda;
            color: #155724;
        }
        .badge-warning {
            background: #fff3cd;
            color: #856404;
        }
        .price-total {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            font-size: 20px;
            font-weight: bold;
        }
        .price-total .label {
            font-size: 14px;
            opacity: 0.9;
            display: block;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #888;
            font-size: 12px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .notes {
            background: #f0f8ff;
            border-color: #87ceeb;
        }
        .notes .section-title {
            color: #0066cc;
        }
        @media only screen and (max-width: 600px) {
            .container {
                padding: 15px;
                margin: 10px;
            }
            .info-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✈️ Flight Booking Confirmation</h1>
            <p>Thank you for choosing us for your travel needs</p>
        </div>

        <!-- Booking Overview -->
        <div class="section">
            <div class="section-title">Booking Overview</div>
            <div class="info-grid">
                <div class="info-item">
                    <strong>Booking ID</strong>
                    <span>{{bookingId}}</span>
                </div>
                <div class="info-item">
                    <strong>Booking Date</strong>
                    <span>{{formatDate bookingDate}}</span>
                </div>
                <div class="info-item">
                    <strong>Status</strong>
                    <span class="badge badge-success">{{status}}</span>
                </div>
                <div class="info-item">
                    <strong>Total Amount</strong>
                    <span>{{formatPrice totalPrice}}</span>
                </div>
            </div>
        </div>

        <!-- Traveller Details -->
        <div class="section">
            <div class="section-title">Traveller Details</div>
            {{#each travellers}}
                <div class="traveller-card">
                    <div class="name">{{this.title}} {{this.firstName}} {{this.lastName}}</div>
                    <div class="detail">Type: {{this.paxType}}</div>
                    <div class="detail">Date of Birth: {{formatDate this.dateOfBirth}}</div>
                    
                    <!-- Passport Details -->
                    {{#ifCond this.passportNumber '&&' this.passportNumber}}
                    <div class="detail" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e0e0e0;">
                        <strong style="display: block; margin-bottom: 4px;">Passport Details</strong>
                        <div style="font-size: 13px; color: #666; line-height: 1.6;">
                            <div><strong>Number:</strong> {{this.passportNumber}}</div>
                            {{#if this.passportNationality}}
                                <div><strong>Nationality:</strong> {{this.passportNationality}}</div>
                            {{/if}}
                            {{#if this.passportIssueDate}}
                                <div><strong>Issue Date:</strong> {{formatDate this.passportIssueDate}}</div>
                            {{/if}}
                            {{#if this.passportExpiryDate}}
                                <div><strong>Expiry Date:</strong> {{formatDate this.passportExpiryDate}}</div>
                            {{/if}}
                        </div>
                    </div>
                    {{/ifCond}}
                    
                    {{#if this.pnrDetails}}
                        <div class="detail">
                            <strong>PNR:</strong> 
                            {{#each this.pnrDetails}}
                                {{this}} 
                            {{/each}}
                        </div>
                    {{/if}}
                    
                    {{#if this.seatInfo}}
                        <div class="detail">
                            <strong>Seat:</strong>
                            {{#each this.seatInfo}}
                                {{this.seatNo}} 
                            {{/each}}
                        </div>
                    {{/if}}
                    
                    {{#if this.mealInfo}}
                        <div class="detail">
                            <strong>Meal:</strong>
                            {{#each this.mealInfo}}
                                {{this.Description}} 
                            {{/each}}
                        </div>
                    {{/if}}
                    
                    {{#if this.baggageInfo}}
                        <div class="detail">
                            <strong>Extra Baggage:</strong>
                            {{#each this.baggageInfo}}
                                {{this.Description}} 
                            {{/each}}
                        </div>
                    {{/if}}
                </div>
            {{/each}}
        </div>

        <!-- GST Details -->
        {{#ifCond gstInfo '&&' gstInfo.gstNumber}}
        <div class="section">
            <div class="section-title">GST Details</div>
            <div class="info-grid">
                <div class="info-item">
                    <strong>GST Number</strong>
                    <span>{{gstInfo.gstNumber}}</span>
                </div>
                <div class="info-item">
                    <strong>Registered Name</strong>
                    <span>{{gstInfo.registeredName}}</span>
                </div>
                <div class="info-item">
                    <strong>Email</strong>
                    <span>{{gstInfo.email}}</span>
                </div>
                <div class="info-item">
                    <strong>Mobile</strong>
                    <span>{{gstInfo.mobile}}</span>
                </div>
                <div class="info-item" style="grid-column: 1 / -1;">
                    <strong>Address</strong>
                    <span>{{gstInfo.address}}</span>
                </div>
                {{#if gstInfo.isSez}}
                <div class="info-item">
                    <strong>SEZ</strong>
                    <span>Yes</span>
                </div>
                {{/if}}
            </div>
        </div>
        {{/ifCond}}

        <!-- Flight Details -->
        <div class="section">
            <div class="section-title">Flight Details</div>
            {{#each segments}}
                <div class="flight-card">
                    <div class="airline">{{getAirlineName this.flightDetails.AirlineInfo}} ({{this.flightDetails.AirlineInfo.SSRCode}})</div>
                    <div class="route">
                        <div class="time">{{formatTime this.departureTime}}</div>
                        <div class="city">{{this.departureAirport.city}} ({{this.departureAirport.SSRCode}})</div>
                        <div class="terminal">Terminal: {{this.departureAirport.terminal}}</div>
                    </div>
                    <div class="duration">→ Duration: {{this.duration}} mins | Stops: {{this.numberOfStops}}</div>
                    <div class="route">
                        <div class="time">{{formatTime this.arrivalTime}}</div>
                        <div class="city">{{this.arrivalAirport.city}} ({{this.arrivalAirport.SSRCode}})</div>
                        <div class="terminal">Terminal: {{this.arrivalAirport.terminal}}</div>
                    </div>
                    {{#if this.baggageInfo}}
                        <div class="baggage">
                            <strong>Baggage:</strong> 
                            {{#each this.baggageInfo.tI}}
                                {{#each this.FareDetails.BaggageInfo}}
                                    Check-in: {{CheckInBaggage}} | Cabin: {{ClassCode}}
                                {{/each}}
                            {{/each}}
                        </div>
                    {{/if}}
                </div>
            {{/each}}
        </div>

        <!-- Total Price - Client sees only total -->
        <div class="section">
            <div class="section-title">Payment Summary</div>
            <div class="price-total">
                <span class="label">Total Amount Paid</span>
                {{formatPrice totalPrice}}
            </div>
        </div>

        <!-- Emergency Contact -->
        {{#if emergencyContact}}
            <div class="section">
                <div class="section-title">Emergency Contact</div>
                <div class="info-grid">
                    <div class="info-item">
                        <strong>Name</strong>
                        <span>{{emergencyContact.EmergencyContactName}}</span>
                    </div>
                    <div class="info-item">
                        <strong>Email</strong>
                        <span>{{emergencyContact.Emails.[0]}}</span>
                    </div>
                    <div class="info-item">
                        <strong>Phone</strong>
                        <span>{{emergencyContact.Contacts.[0]}}</span>
                    </div>
                </div>
            </div>
        {{/if}}

        <!-- Important Notes -->
        <div class="section notes">
            <div class="section-title">Important Notes</div>
            <ul style="color:#333;font-size:14px;line-height:1.6;padding-left:20px;">
                <li>Please arrive at the airport at least 2 hours before departure for domestic flights.</li>
                <li>Carry a valid government-issued photo ID for check-in.</li>
                <li>Check-in baggage allowance and cabin baggage policy apply as per airline rules.</li>
                <li>For any changes or cancellations, please contact our support team.</li>
            </ul>
        </div>

        <div class="footer">
            <p>This is a system generated confirmation. Please keep this email for your records.</p>
            <p>For assistance, contact us at support@klartravels.com</p>
            <p>&copy; 2026 Klar Travels. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;