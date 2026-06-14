export const returnFlightListPdfTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Return Flight Details Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            background: white;
            color: #1e293b;
            font-size: 9px;
            line-height: 1.3;
        }
        
        .container {
            max-width: 100%;
            margin: 0;
            padding: 10px;
        }
        
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .logo {
            max-height: 35px;
        }
        
        .report-title {
            text-align: right;
        }
        
        .report-title h1 {
            font-size: 12px;
            color: #0f172a;
            margin-bottom: 2px;
        }
        
        .report-title .date {
            font-size: 7px;
            color: #64748b;
        }
        
        /* Search Info */
        .search-info {
            background: #f0f9ff;
            border-left: 3px solid #0ea5e9;
            padding: 6px 10px;
            margin-bottom: 10px;
            border-radius: 4px;
            font-size: 8px;
        }
        
        .search-info p {
            margin: 2px 0;
        }
        
        /* Section Header */
        .section-header {
            background: #667eea;
            color: white;
            padding: 6px 10px;
            margin: 10px 0 8px 0;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
        }
        
        /* Flight Table */
        .flight-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 8px;
        }
        
        .flight-table th {
            background: #f1f5f9;
            padding: 5px 6px;
            text-align: left;
            font-weight: 700;
            color: #475569;
            border: 1px solid #e2e8f0;
            font-size: 7px;
            text-transform: uppercase;
        }
        
        .flight-table td {
            padding: 6px 5px;
            border: 1px solid #e2e8f0;
            vertical-align: middle;
        }
        
        /* Airline Info */
        .airline-name {
            font-weight: 700;
            font-size: 9px;
            color: #0f172a;
        }
        
        .flight-number {
            font-size: 7px;
            color: #64748b;
            margin-top: 2px;
        }
        
        .stops-info {
            font-size: 6px;
            color: #94a3b8;
            margin-top: 2px;
        }
        
        /* Route Info */
        .route-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 5px;
        }
        
        .departure-info, .arrival-info {
            flex: 1;
        }
        
        .departure-info {
            text-align: left;
        }
        
        .arrival-info {
            text-align: right;
        }
        
        .time {
            font-weight: 700;
            font-size: 9px;
            color: #0f172a;
        }
        
        .airport-code {
            font-size: 8px;
            font-weight: 600;
            color: #475569;
        }
        
        .city {
            font-size: 7px;
            color: #64748b;
        }
        
        .date-info {
            font-size: 6px;
            color: #94a3b8;
        }
        
        .duration-info {
            text-align: center;
            padding: 0 3px;
        }
        
        .duration {
            font-size: 7px;
            font-weight: 600;
            color: #475569;
            white-space: nowrap;
        }
        
        .plane-icon {
            font-size: 8px;
            color: #667eea;
        }
        
        /* Fare Info */
        .fare-list {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        
        .fare-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 2px 3px;
            background: #f8fafc;
            border-radius: 3px;
            font-size: 7px;
        }
        
        .fare-item.cheapest {
            background: #f0fdf4;
            border-left: 2px solid #10b981;
        }
        
        .fare-name {
            font-weight: 600;
            color: #0f172a;
        }
        
        .cabin-class {
            font-size: 6px;
            color: #64748b;
            margin-left: 3px;
        }
        
        .fare-price {
            font-weight: 700;
            color: #10b981;
            white-space: nowrap;
        }
        
        /* Price Column */
        .price-cell {
            text-align: right;
            min-width: 60px;
        }
        
        .cheapest-price {
            font-weight: 800;
            font-size: 10px;
            color: #10b981;
        }
        
        .cheapest-label {
            font-size: 6px;
            color: #64748b;
            margin-top: 2px;
        }
        
        .total-price {
            font-weight: 800;
            font-size: 11px;
            color: #2563eb;
        }
        
        /* Round Trip Card (International) */
        .roundtrip-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 12px;
            overflow: hidden;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        
        .roundtrip-header {
            background: #f8fafc;
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .roundtrip-title {
            font-weight: 700;
            font-size: 9px;
            color: #0f172a;
        }
        
        .roundtrip-total {
            font-weight: 800;
            font-size: 11px;
            color: #2563eb;
        }
        
        .flight-row {
            padding: 10px;
            border-bottom: 1px solid #f1f5f9;
        }
        
        .flight-row:last-child {
            border-bottom: none;
        }
        
        .flight-direction {
            font-size: 8px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 8px;
        }
        
        .roundtrip-route {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .roundtrip-fares {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed #e2e8f0;
        }
        
        /* Footer */
        .footer {
            margin-top: 15px;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 6px;
            color: #94a3b8;
        }
        
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            
            .flight-table tr {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            
            .roundtrip-card {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            {{#if logoBase64}}
                <img src="{{logoBase64}}" class="logo" alt="Logo">
            {{else}}
                <div style="font-size: 12px; font-weight: 800; color: #667eea;">FLIGHT SEARCH</div>
            {{/if}}
            <div class="report-title">
                <h1>Return Flight Search Results</h1>
                <div class="date">Generated: {{generatedDate}}</div>
            </div>
        </div>
        
        <!-- Search Parameters -->
        <div class="search-info">
            <strong>{{searchParams.origin}}</strong> → <strong>{{searchParams.destination}}</strong> | 
            Departure: {{searchParams.departureDate}} | Return: {{searchParams.returnDate}} | 
            Passengers: {{searchParams.passengerCount}}
        </div>
        
        {{#if (eq type "domestic")}}
            <!-- Domestic Flights - Onward Section -->
            <div class="section-header">✈ ONWARD FLIGHTS ({{totalOnward}} found)</div>
            <table class="flight-table">
                <thead>
                    <tr>
                        <th>Airline & Flight</th>
                        <th>Route & Duration</th>
                        <th>Available Fares</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each onward}}
                    <tr>
                        <td>
                            <div class="airline-name">{{this.airline}}</div>
                            <div class="flight-number">{{this.flightNumber}}</div>
                            <div class="stops-info">
                                {{#if (eq this.stops 0)}}Direct{{/if}}
                                {{#if (eq this.stops 1)}}{{this.stops}} Stop{{/if}}
                                {{#if (eq this.stops 2)}}{{this.stops}} Stops{{/if}}
                            </div>
                        </td>
                        <td>
                            <div class="route-info">
                                <div class="departure-info">
                                    <div class="time">{{this.from.time}}</div>
                                    <div class="airport-code">{{this.from.airportCode}}</div>
                                    <div class="city">{{this.from.city}}</div>
                                    <div class="date-info">{{this.from.date}}</div>
                                </div>
                                <div class="duration-info">
                                    <div class="plane-icon">✈</div>
                                    <div class="duration">{{this.duration}}</div>
                                </div>
                                <div class="arrival-info">
                                    <div class="time">{{this.to.time}}</div>
                                    <div class="airport-code">{{this.to.airportCode}}</div>
                                    <div class="city">{{this.to.city}}</div>
                                    <div class="date-info">{{this.to.date}}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="fare-list">
                                {{#each this.allFares}}
                                <div class="fare-item {{#if (eq this.totalPrice ../cheapestFare.price)}}cheapest{{/if}}">
                                    <div>
                                        <span class="fare-name">{{this.fareName}}</span>
                                        <span class="cabin-class">({{this.cabinClass}})</span>
                                    </div>
                                    <div class="fare-price">₹{{formatNumber this.totalPrice}}</div>
                                </div>
                                {{/each}}
                            </div>
                        </td>
                        <td class="price-cell">
                            <div class="cheapest-price">₹{{formatNumber this.cheapestFare.price}}</div>
                            <div class="cheapest-label">Cheapest Fare</div>
                        </td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
            
            <!-- Domestic Flights - Return Section -->
            <div class="section-header">✈ RETURN FLIGHTS ({{totalReturn}} found)</div>
            <table class="flight-table">
                <thead>
                    <tr>
                        <th>Airline & Flight</th>
                        <th>Route & Duration</th>
                        <th>Available Fares</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each return}}
                    <tr>
                        <td>
                            <div class="airline-name">{{this.airline}}</div>
                            <div class="flight-number">{{this.flightNumber}}</div>
                            <div class="stops-info">
                                {{#if (eq this.stops 0)}}Direct{{/if}}
                                {{#if (eq this.stops 1)}}{{this.stops}} Stop{{/if}}
                                {{#if (eq this.stops 2)}}{{this.stops}} Stops{{/if}}
                            </div>
                        </td>
                        <td>
                            <div class="route-info">
                                <div class="departure-info">
                                    <div class="time">{{this.from.time}}</div>
                                    <div class="airport-code">{{this.from.airportCode}}</div>
                                    <div class="city">{{this.from.city}}</div>
                                    <div class="date-info">{{this.from.date}}</div>
                                </div>
                                <div class="duration-info">
                                    <div class="plane-icon">✈</div>
                                    <div class="duration">{{this.duration}}</div>
                                </div>
                                <div class="arrival-info">
                                    <div class="time">{{this.to.time}}</div>
                                    <div class="airport-code">{{this.to.airportCode}}</div>
                                    <div class="city">{{this.to.city}}</div>
                                    <div class="date-info">{{this.to.date}}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="fare-list">
                                {{#each this.allFares}}
                                <div class="fare-item {{#if (eq this.totalPrice ../cheapestFare.price)}}cheapest{{/if}}">
                                    <div>
                                        <span class="fare-name">{{this.fareName}}</span>
                                        <span class="cabin-class">({{this.cabinClass}})</span>
                                    </div>
                                    <div class="fare-price">₹{{formatNumber this.totalPrice}}</div>
                                </div>
                                {{/each}}
                            </div>
                        </td>
                        <td class="price-cell">
                            <div class="cheapest-price">₹{{formatNumber this.cheapestFare.price}}</div>
                            <div class="cheapest-label">Cheapest Fare</div>
                        </td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        {{/if}}
        
        {{#if (eq type "international")}}
            <!-- International Flights - Round Trips -->
            <div class="section-header">✈ ROUND TRIPS ({{totalRoundTrips}} found)</div>
            {{#each roundTrips}}
            <div class="roundtrip-card">
                <div class="roundtrip-header">
                    <span class="roundtrip-title">Round Trip Option</span>
                    <span class="roundtrip-total">Total: ₹{{formatNumber this.totalPrice}}</span>
                </div>
                
                <!-- Onward Flight -->
                <div class="flight-row">
                    <div class="flight-direction">ONWARD FLIGHT</div>
                    <div class="roundtrip-route">
                        <div class="departure-info">
                            <div class="time">{{this.onward.from.time}}</div>
                            <div class="airport-code">{{this.onward.from.airportCode}}</div>
                            <div class="city">{{this.onward.from.city}}</div>
                            <div class="date-info">{{this.onward.from.date}}</div>
                        </div>
                        <div class="duration-info">
                            <div class="plane-icon">✈</div>
                            <div class="duration">{{this.onward.duration}}</div>
                            <div class="stops-info">
                                {{#if (eq this.onward.stops 0)}}Direct{{/if}}
                                {{#if (eq this.onward.stops 1)}}{{this.onward.stops}} Stop{{/if}}
                                {{#if (eq this.onward.stops 2)}}{{this.onward.stops}} Stops{{/if}}
                            </div>
                        </div>
                        <div class="arrival-info">
                            <div class="time">{{this.onward.to.time}}</div>
                            <div class="airport-code">{{this.onward.to.airportCode}}</div>
                            <div class="city">{{this.onward.to.city}}</div>
                            <div class="date-info">{{this.onward.to.date}}</div>
                        </div>
                    </div>
                    <div style="margin-top: 5px;">
                        <div class="airline-name">{{this.onward.airline}} - {{this.onward.flightNumber}}</div>
                    </div>
                </div>
                
                <!-- Return Flight -->
                <div class="flight-row">
                    <div class="flight-direction">RETURN FLIGHT</div>
                    <div class="roundtrip-route">
                        <div class="departure-info">
                            <div class="time">{{this.return.from.time}}</div>
                            <div class="airport-code">{{this.return.from.airportCode}}</div>
                            <div class="city">{{this.return.from.city}}</div>
                            <div class="date-info">{{this.return.from.date}}</div>
                        </div>
                        <div class="duration-info">
                            <div class="plane-icon">✈</div>
                            <div class="duration">{{this.return.duration}}</div>
                            <div class="stops-info">
                                {{#if (eq this.return.stops 0)}}Direct{{/if}}
                                {{#if (eq this.return.stops 1)}}{{this.return.stops}} Stop{{/if}}
                                {{#if (eq this.return.stops 2)}}{{this.return.stops}} Stops{{/if}}
                            </div>
                        </div>
                        <div class="arrival-info">
                            <div class="time">{{this.return.to.time}}</div>
                            <div class="airport-code">{{this.return.to.airportCode}}</div>
                            <div class="city">{{this.return.to.city}}</div>
                            <div class="date-info">{{this.return.to.date}}</div>
                        </div>
                    </div>
                    <div style="margin-top: 5px;">
                        <div class="airline-name">{{this.return.airline}} - {{this.return.flightNumber}}</div>
                    </div>
                </div>
                
                <!-- Available Fares for Round Trip -->
                <div class="roundtrip-fares">
                    <div style="font-size: 7px; font-weight: 600; margin-bottom: 5px;">Available Fare Options:</div>
                    <div class="fare-list">
                        {{#each this.allFares}}
                        <div class="fare-item {{#if (eq this.totalPrice ../cheapestFare.price)}}cheapest{{/if}}">
                            <div>
                                <span class="fare-name">{{this.fareName}}</span>
                                <span class="cabin-class">({{this.cabinClass}})</span>
                            </div>
                            <div class="fare-price">₹{{formatNumber this.totalPrice}}</div>
                        </div>
                        {{/each}}
                    </div>
                </div>
            </div>
            {{/each}}
        {{/if}}
        
        <!-- Footer -->
        <div class="footer">
            <p>This is a system-generated report. For booking assistance, please contact support.</p>
            <p>© {{currentYear}} Flight Search Platform. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;