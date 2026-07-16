export const bookingVoucherTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Flight Voucher</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            background: #f0f4f8;
            color: #1e293b;
            font-size: 10px;
            line-height: 1.5;
            padding: 20px;
        }
        
        .voucher-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
            padding: 30px;
        }
        
        /* Header */
        .voucher-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e8edf4;
        }
        
        .logo-section {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }
        
        .logo {
            max-height: 60px;
            width: auto;
        }
        
        .brand-name {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
        }
        
        .brand-name span {
            color: #3b82f6;
        }
        
        /* Right Section - Address */
        .right-section {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            text-align: right;
        }
        
        .company-address {
            text-align: right;
        }
        
        .company-address .company-name {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 4px;
        }
        
        .company-address .address-line {
            font-size: 8px;
            color: #475569;
            line-height: 1.5;
        }
        
        .company-address .address-line:last-child {
            font-weight: 600;
            color: #3b82f6;
        }
        
        /* Booking Info Bar */
        .booking-info-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #3b82f6;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .booking-info-item {
            display: flex;
            flex-direction: column;
        }
        
        .booking-info-item .label {
            font-size: 7px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .booking-info-item .value {
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
        }
        
        .booking-info-item .value.highlight {
            color: #3b82f6;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 16px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: #f0fdf4;
            color: #10b981;
            border: 1px solid #86efac;
        }
        
        /* Info Grid */
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .info-card {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e8edf4;
        }
        
        .info-card .card-title {
            font-size: 9px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e8edf4;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
        }
        
        .info-row .label {
            font-size: 9px;
            color: #64748b;
        }
        
        .info-row .value {
            font-size: 9px;
            font-weight: 600;
            color: #0f172a;
        }
        
        /* Flight Itinerary */
        .flight-itinerary {
            margin-bottom: 20px;
        }
        
        .flight-itinerary .section-title {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e8edf4;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .flight-card {
            background: white;
            border: 1px solid #e8edf4;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
        }
        
        .flight-card:last-child {
            margin-bottom: 0;
        }
        
        .flight-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .flight-airline {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .flight-airline .airline-name {
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
        }
        
        .flight-airline .flight-number {
            font-size: 9px;
            color: #64748b;
            background: #f1f5f9;
            padding: 2px 10px;
            border-radius: 12px;
        }
        
        .flight-airline .airline-code {
            font-size: 9px;
            font-weight: 600;
            color: #3b82f6;
        }
        
        .flight-route {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 10px;
        }
        
        .route-point {
            flex: 1;
        }
        
        .route-point .city-name {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
        }
        
        .route-point .airport-code {
            font-size: 13px;
            font-weight: 700;
            color: #3b82f6;
        }
        
        .route-point .airport-name {
            font-size: 9px;
            color: #64748b;
        }
        
        .route-point .datetime {
            font-size: 10px;
            font-weight: 600;
            color: #475569;
            margin-top: 2px;
        }
        
        .route-point .terminal {
            font-size: 8px;
            color: #94a3b8;
        }
        
        .route-middle {
            text-align: center;
            padding: 0 15px;
            min-width: 80px;
        }
        
        .route-middle .duration {
            font-size: 9px;
            font-weight: 600;
            color: #475569;
        }
        
        .route-middle .stops {
            font-size: 8px;
            color: #94a3b8;
        }
        
        .route-middle .plane-icon {
            font-size: 18px;
            color: #3b82f6;
        }
        
        .flight-details {
            display: flex;
            gap: 20px;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #f1f5f9;
            flex-wrap: wrap;
        }
        
        .flight-detail-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .flight-detail-item .icon {
            font-size: 14px;
        }
        
        .flight-detail-item .detail-label {
            font-size: 8px;
            color: #94a3b8;
        }
        
        .flight-detail-item .detail-value {
            font-size: 9px;
            font-weight: 600;
            color: #0f172a;
        }
        
        /* Traveller Details Table */
        .traveller-section {
            margin-bottom: 20px;
        }
        
        .traveller-section .section-title {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e8edf4;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .traveller-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
        }
        
        .traveller-table th {
            background: #f1f5f9;
            padding: 8px 10px;
            text-align: left;
            font-weight: 700;
            color: #475569;
            border: 1px solid #e2e8f0;
            font-size: 8px;
            text-transform: uppercase;
        }
        
        .traveller-table td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            vertical-align: middle;
        }
        
        .traveller-table .ssr-tag {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 7px;
            font-weight: 600;
            margin: 2px 4px 2px 0;
        }
        
        .traveller-table .ssr-tag.seat {
            background: #dbeafe;
            color: #1e40af;
        }
        
        .traveller-table .ssr-tag.meal {
            background: #fef3c7;
            color: #92400e;
        }
        
        .traveller-table .ssr-tag.baggage {
            background: #d1fae5;
            color: #065f46;
        }
        
        .traveller-table .ssr-tag.pnr {
            background: #e0e7ff;
            color: #3730a3;
        }
        
        /* PNR Details */
        .pnr-details {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-top: 8px;
        }
        
        .pnr-item {
            background: #f8fafc;
            padding: 6px 12px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
        }
        
        .pnr-item .pnr-label {
            font-size: 7px;
            color: #94a3b8;
            text-transform: uppercase;
        }
        
        .pnr-item .pnr-value {
            font-size: 10px;
            font-weight: 700;
            color: #0f172a;
        }
        
        /* Emergency Contact */
        .emergency-section {
            background: #fefce8;
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid #fde68a;
            margin-bottom: 20px;
        }
        
        .emergency-section .emergency-title {
            font-size: 9px;
            font-weight: 700;
            color: #92400e;
            margin-bottom: 6px;
        }
        
        .emergency-section .emergency-details {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            font-size: 9px;
        }
        
        .emergency-section .emergency-details span {
            color: #78350f;
        }
        
        .emergency-section .emergency-details .label {
            color: #92400e;
            font-weight: 600;
        }
        
        /* Price Summary - Only Total Amount */
        .price-summary {
            background: #f8fafc;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #e8edf4;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .price-summary .total-label {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
        }
        
        .price-summary .total-amount {
            font-size: 28px;
            font-weight: 800;
            color: #3b82f6;
        }
        
        .price-summary .total-note {
            font-size: 8px;
            color: #94a3b8;
            margin-top: 8px;
        }
        
        /* Footer */
        .voucher-footer {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #e8edf4;
            text-align: center;
        }
        
        .voucher-footer .footer-text {
            font-size: 8px;
            color: #94a3b8;
        }
        
        .voucher-footer .footer-links {
            margin-top: 8px;
        }
        
        .voucher-footer .footer-links span {
            color: #94a3b8;
            margin: 0 8px;
        }
        
        .voucher-footer .footer-links a {
            color: #3b82f6;
            text-decoration: none;
            font-size: 8px;
        }
        
        .voucher-footer .copyright {
            font-size: 7px;
            color: #cbd5e1;
            margin-top: 8px;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .voucher-container {
                box-shadow: none;
                border-radius: 0;
                padding: 20px;
            }
            
            .flight-card {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            
            .traveller-table tr {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }
        
        @media (max-width: 600px) {
            .voucher-header {
                flex-direction: column;
                align-items: center;
            }
            
            .right-section {
                align-items: center;
                text-align: center;
                margin-top: 10px;
            }
            
            .company-address {
                text-align: center;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
            
            .booking-info-bar {
                flex-direction: column;
                gap: 8px;
                align-items: flex-start;
            }
            
            .flight-route {
                flex-direction: column;
                gap: 10px;
            }
            
            .route-middle {
                padding: 10px 0;
                border-top: 1px solid #e8edf4;
                border-bottom: 1px solid #e8edf4;
            }
            
            .flight-details {
                flex-wrap: wrap;
                gap: 10px;
            }
            
            .traveller-table {
                font-size: 8px;
            }
            
            .traveller-table th,
            .traveller-table td {
                padding: 6px 8px;
            }
            
            .pnr-details {
                flex-direction: column;
                gap: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="voucher-container">
        <!-- Header -->
        <div class="voucher-header">
            <!-- Left: Logo -->
            <div class="logo-section">
                {{#if logoBase64}}
                    <img src="{{logoBase64}}" class="logo" alt="Klar Travels">
                {{else}}
                    <div class="brand-name">FLIGHT <span>VOUCHER</span></div>
                {{/if}}
            </div>
            
            <!-- Right: Address -->
<div class="right-section">
    <div class="company-address">
        <div class="company-name">Klar Travels</div>
        <div class="address-line">3rd Floor 305, Tilak Rd, above Max Fashion Showroom,</div>
        <div class="address-line">beside payal footwears, Hanuman Tekdi, Abids,</div>
        <div class="address-line">Hyderabad, Telangana 500001</div>
        <div class="address-line">Mob: +918099359377 | GSTIN: 36BGCPS2420P1Z4</div>
    </div>
</div>
        </div>
        
        <!-- Booking Info Bar -->
        <div class="booking-info-bar">
            <div class="booking-info-item">
                <span class="label">Booking ID</span>
                <span class="value highlight">{{bookingId}}</span>
            </div>
            <div class="booking-info-item">
                <span class="label">Supplier Reference</span>
                <span class="value">{{supplierReference}}</span>
            </div>
            <div class="booking-info-item">
                <span class="label">Issue Date</span>
                <span class="value">{{issueDate}}</span>
            </div>
            <div class="booking-info-item">
                <span class="label">Status</span>
                <span class="status-badge">{{bookingStatus}}</span>
            </div>
            <div class="booking-info-item">
                <span class="label">Created On</span>
                <span class="value">{{createdOn}}</span>
            </div>
        </div>
        
        
        <!-- Emergency Contact -->
        {{#if emergencyContact}}
        <div class="emergency-section">
            <div class="emergency-title">🆘 Emergency Contact Information</div>
            <div class="emergency-details">
                <span><span class="label">Name:</span> {{emergencyContact.name}}</span>
                <span><span class="label">Email:</span> {{emergencyContact.email}}</span>
                <span><span class="label">Phone:</span> {{emergencyContact.phone}}</span>
            </div>
        </div>
        {{/if}}
        
        <!-- Flight Itinerary -->
        <div class="flight-itinerary">
            <div class="section-title">✈️ Flight Itinerary ({{flightSegments.length}} Segments)</div>
            
            {{#each flightSegments}}
            <div class="flight-card">
                <div class="flight-header">
                    <div class="flight-airline">
                        <div>
                            <div class="airline-name">{{this.airline}}</div>
                            <div style="display: flex; gap: 8px; align-items: center; margin-top: 2px; flex-wrap: wrap;">
                                <span class="flight-number">{{this.airlineCode}} {{this.flightNumber}}</span>
                                <span class="airline-code">{{this.equipment}}</span>
                                {{#if this.isLowCostCarrier}}
                                    <span style="font-size:7px; background:#fef3c7; padding:2px 8px; border-radius:3px; color:#92400e;">LCC</span>
                                {{/if}}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <span style="font-size:8px; background: #f1f5f9; padding:2px 12px; border-radius:12px; color:#475569;">
                            {{#if (eq this.numberOfStops 0)}}Direct{{/if}}
                            {{#if (eq this.numberOfStops 1)}}{{this.numberOfStops}} Stop{{/if}}
                            {{#if (gt this.numberOfStops 1)}}{{this.numberOfStops}} Stops{{/if}}
                        </span>
                        <span style="font-size:8px; background: {{#if this.isRefundable}}#f0fdf4{{else}}#fef2f2{{/if}}; padding:2px 12px; border-radius:12px; color:{{#if this.isRefundable}}#10b981{{else}}#ef4444{{/if}};">
                            {{#if this.isRefundable}}Refundable{{else}}Non-Refundable{{/if}}
                        </span>
                    </div>
                </div>
                
                <div class="flight-route">
                    <div class="route-point">
                        <div class="city-name">{{this.departure.city}}</div>
                        <div class="airport-code">{{this.departure.airportCode}}</div>
                        <div class="airport-name">{{this.departure.airportName}}</div>
                        <div class="datetime">
                            {{#if this.departure.date}}
                                {{formatDateLong this.departure.date}}<br>
                                {{formatTime this.departure.date}}
                            {{else}}
                                {{this.departure.time}}
                            {{/if}}
                        </div>
                        <div class="terminal">Terminal: {{this.departure.terminal}}</div>
                    </div>
                    
                    <div class="route-middle">
                        <div class="plane-icon">✈</div>
                        <div class="duration">{{this.duration}} min</div>
                        <div class="stops">
                            {{#if (eq this.numberOfStops 0)}}Non-stop{{/if}}
                            {{#if (eq this.numberOfStops 1)}}{{this.numberOfStops}} Stop{{/if}}
                            {{#if (gt this.numberOfStops 1)}}{{this.numberOfStops}} Stops{{/if}}
                        </div>
                    </div>
                    
                    <div class="route-point" style="text-align: right;">
                        <div class="city-name">{{this.arrival.city}}</div>
                        <div class="airport-code">{{this.arrival.airportCode}}</div>
                        <div class="airport-name">{{this.arrival.airportName}}</div>
                        <div class="datetime">
                            {{#if this.arrival.date}}
                                {{formatDateLong this.arrival.date}}<br>
                                {{formatTime this.arrival.date}}
                            {{else}}
                                {{this.arrival.time}}
                            {{/if}}
                        </div>
                        <div class="terminal">Terminal: {{this.arrival.terminal}}</div>
                    </div>
                </div>
                
                <div class="flight-details">
                    <div class="flight-detail-item">
                        <span class="icon">🧳</span>
                        <div>
                            <div class="detail-label">Check-in Baggage</div>
                            <div class="detail-value">{{this.baggageInfo.checkIn}}</div>
                        </div>
                    </div>
                    <div class="flight-detail-item">
                        <span class="icon">🎒</span>
                        <div>
                            <div class="detail-label">Cabin Baggage</div>
                            <div class="detail-value">{{this.baggageInfo.cabin}}</div>
                        </div>
                    </div>
                    <div class="flight-detail-item">
                        <span class="icon">🍽️</span>
                        <div>
                            <div class="detail-label">Meal</div>
                            <div class="detail-value">{{#if this.baggageInfo.mealIncluded}}Included{{else}}Not Included{{/if}}</div>
                        </div>
                    </div>
                    <div class="flight-detail-item">
                        <span class="icon">💺</span>
                        <div>
                            <div class="detail-label">Class</div>
                            <div class="detail-value">{{this.baggageInfo.cabinClass}}</div>
                        </div>
                    </div>
                    <div class="flight-detail-item">
                        <span class="icon">📋</span>
                        <div>
                            <div class="detail-label">Class Code</div>
                            <div class="detail-value">{{this.baggageInfo.classCode}}</div>
                        </div>
                    </div>
                </div>
            </div>
            {{/each}}
        </div>
        
        <!-- PNR Details -->
        {{#if pnrDetails}}
        <div style="background: #f0f9ff; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #bae6fd;">
            <div style="font-size: 9px; font-weight: 700; color: #0369a1; margin-bottom: 8px;">📌 PNR Details</div>
            <div class="pnr-details">
                {{#each pnrDetails}}
                <div class="pnr-item">
                    <div class="pnr-label">PNR for {{this.segment}}</div>
                    <div class="pnr-value">{{this.pnr}}</div>
                </div>
                {{/each}}
            </div>
        </div>
        {{/if}}
        
        <!-- Traveller Details -->
        <div class="traveller-section">
            <div class="section-title">👤 Passenger Details ({{travellers.length}} Passengers)</div>
            
            <table class="traveller-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Date of Birth</th>
                        <th>Seat</th>
                        <th>Meal</th>
                        <th>Baggage</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each travellers}}
                    <tr>
                        <td>{{add @index 1}}</td>
                        <td>
                            <strong>{{this.fullName}}</strong>
                            <div style="font-size: 7px; color: #94a3b8;">{{this.title}} {{this.firstName}} {{this.lastName}}</div>
                        </td>
                        <td>
                            <span style="font-size: 8px; font-weight: 600; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">
                                {{this.paxType}}
                            </span>
                        </td>
                        <td>{{this.dateOfBirth}}</td>
                        <td>
                            {{#if this.seatNumber}}
                                <span class="ssr-tag seat">💺 {{this.seatNumber}}</span>
                                {{#if this.seatPosition}}
                                    <div style="font-size: 7px; color: #64748b; margin-top: 2px;">{{this.seatPosition}}</div>
                                {{/if}}
                            {{else}}
                                <span style="font-size: 8px; color: #94a3b8;">Not assigned</span>
                            {{/if}}
                        </td>
                        <td>
                            {{#if this.mealDescription}}
                                <span class="ssr-tag meal">🍽️ {{this.mealDescription}}</span>
                            {{else}}
                                <span style="font-size: 8px; color: #94a3b8;">Standard</span>
                            {{/if}}
                        </td>
                        <td>
                            <div>
                                <span style="font-size: 8px; font-weight: 600;">Check-in: {{this.checkInBaggage}}</span>
                            </div>
                            <div>
                                <span style="font-size: 8px; color: #64748b;">Cabin: {{this.cabinBaggage}}</span>
                            </div>
                            {{#if this.extraBaggage}}
                                <div>
                                    <span class="ssr-tag baggage">+ {{this.extraBaggage}}</span>
                                </div>
                            {{/if}}
                        </td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </div>
        
        <!-- SSR Summary -->
        {{#if (hasSSR ssrInfo)}}
        <div style="background: #f0fdf4; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #86efac;">
            <div style="font-size: 9px; font-weight: 700; color: #065f46; margin-bottom: 8px;">🎯 Add-ons & Services Summary</div>
            {{#each ssrInfo}}
            <div style="margin-bottom: 8px; padding: 6px 10px; background: white; border-radius: 4px; border: 1px solid #e2e8f0;">
                <div style="font-weight: 700; font-size: 9px; color: #0f172a; margin-bottom: 4px;">{{@key}}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    {{#if this.seats}}
                        {{#each this.seats}}
                            <span class="ssr-tag seat">💺 {{this.seatNumber}} (₹{{this.amount}})</span>
                        {{/each}}
                    {{/if}}
                    {{#if this.meals}}
                        {{#each this.meals}}
                            <span class="ssr-tag meal">🍽️ {{this.description}} (₹{{this.amount}})</span>
                        {{/each}}
                    {{/if}}
                    {{#if this.baggage}}
                        {{#each this.baggage}}
                            <span class="ssr-tag baggage">🧳 {{this.description}} (₹{{this.amount}})</span>
                        {{/each}}
                    {{/if}}
                </div>
            </div>
            {{/each}}
        </div>
        {{/if}}
        
        <!-- Price Summary - Only Total Amount -->
        <div class="price-summary">
            <div class="total-label">Total Amount</div>
            <div class="total-amount">₹{{formatNumber totalPrice}}</div>
            <div class="total-note">* Includes all taxes and charges</div>
        </div>
        
        <!-- Footer -->
        <div class="voucher-footer">
            <div class="footer-text">
                This is a system-generated travel voucher. Please carry a printout or digital copy during travel.
            </div>
            <div class="footer-links">
                <a href="#">Terms & Conditions</a>
                <span>|</span>
                <a href="#">Privacy Policy</a>
                <span>|</span>
                <a href="#">Contact Support</a>
            </div>
            <div class="copyright">
                © {{currentYear}} Klar Travels. All rights reserved. | Generated: {{generatedDate}}
            </div>
        </div>
    </div>
</body>
</html>
`;