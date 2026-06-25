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
            table-layout: fixed;
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
        
        /* Column Widths */
        .flight-table th:first-child,
        .flight-table td:first-child {
            width: 18%;
        }
        
        .flight-table th:nth-child(2),
        .flight-table td:nth-child(2) {
            width: 42%;
        }
        
        .flight-table th:nth-child(3),
        .flight-table td:nth-child(3) {
            width: 25%;
        }
        
        .flight-table th:last-child,
        .flight-table td:last-child {
            width: 15%;
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
        
        /* Fare Info - Compact */
        .fare-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .fare-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1px 2px;
            background: #f8fafc;
            border-radius: 2px;
            font-size: 6px;
        }
        
        .fare-name {
            font-weight: 600;
            color: #0f172a;
            font-size: 6px;
        }
        
        .cabin-class {
            font-size: 5px;
            color: #64748b;
            margin-left: 2px;
        }
        
        .fare-price {
            font-weight: 700;
            color: #10b981;
            white-space: nowrap;
            font-size: 6px;
        }
        
        /* Price Column */
        .price-cell {
            text-align: right;
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
        
        /* Round Trip Card */
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
            padding: 8px;
            border-bottom: 1px solid #f1f5f9;
        }
        
        .flight-row:last-child {
            border-bottom: none;
        }
        
        .flight-direction {
            font-size: 7px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 6px;
        }
        
        .roundtrip-route {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }
        
        .roundtrip-fares {
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px dashed #e2e8f0;
        }
        
        .roundtrip-fares .fare-list {
            gap: 2px;
        }
        
        .roundtrip-fares .fare-item {
            padding: 1px 2px;
            font-size: 6px;
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
        
        <!-- Domestic Flights - Onward Section -->
        {{#if onward}}
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
                            <div class="fare-item">
                                <div>
                                    <span class="fare-name">{{this.fareName}}</span>
                                    <span class="cabin-class">({{this.cabinClass}})</span>
                                </div>
                                <div class="fare-price">₹{{this.totalPrice}}</div>
                            </div>
                            {{/each}}
                        </div>
                    </td>
                    <td class="price-cell">
                        <div class="cheapest-price">₹{{this.cheapestFare.price}}</div>
                        <div class="cheapest-label">Cheapest</div>
                    </td>
                </tr>
                {{/each}}
            </tbody>
        </table>
        {{/if}}
        
        <!-- Domestic Flights - Return Section -->
        {{#if return}}
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
                            <div class="fare-item">
                                <div>
                                    <span class="fare-name">{{this.fareName}}</span>
                                    <span class="cabin-class">({{this.cabinClass}})</span>
                                </div>
                                <div class="fare-price">₹{{this.totalPrice}}</div>
                            </div>
                            {{/each}}
                        </div>
                    </td>
                    <td class="price-cell">
                        <div class="cheapest-price">₹{{this.cheapestFare.price}}</div>
                        <div class="cheapest-label">Cheapest</div>
                    </td>
                </tr>
                {{/each}}
            </tbody>
        </table>
        {{/if}}
        
        <!-- International Flights - Round Trips -->
        {{#if roundTrips}}
        <div class="section-header">✈ ROUND TRIPS ({{totalRoundTrips}} found)</div>
        {{#each roundTrips}}
        <div class="roundtrip-card">
            <div class="roundtrip-header">
                <span class="roundtrip-title">Round Trip Option</span>
                <span class="roundtrip-total">Total: ₹{{this.totalPrice}}</span>
            </div>
            
            <!-- Onward Flight -->
            <div class="flight-row">
                <div class="flight-direction">ONWARD</div>
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
                    </div>
                    <div class="arrival-info">
                        <div class="time">{{this.onward.to.time}}</div>
                        <div class="airport-code">{{this.onward.to.airportCode}}</div>
                        <div class="city">{{this.onward.to.city}}</div>
                        <div class="date-info">{{this.onward.to.date}}</div>
                    </div>
                </div>
                <div style="margin-top: 4px;">
                    <div class="airline-name">{{this.onward.airline}} - {{this.onward.flightNumber}}</div>
                </div>
            </div>
            
            <!-- Return Flight -->
            <div class="flight-row">
                <div class="flight-direction">RETURN</div>
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
                    </div>
                    <div class="arrival-info">
                        <div class="time">{{this.return.to.time}}</div>
                        <div class="airport-code">{{this.return.to.airportCode}}</div>
                        <div class="city">{{this.return.to.city}}</div>
                        <div class="date-info">{{this.return.to.date}}</div>
                    </div>
                </div>
                <div style="margin-top: 4px;">
                    <div class="airline-name">{{this.return.airline}} - {{this.return.flightNumber}}</div>
                </div>
            </div>
            
            <!-- Available Fares -->
            {{#if this.allFares}}
            <div class="roundtrip-fares">
                <div style="font-size: 6px; font-weight: 600; margin-bottom: 3px;">Fares:</div>
                <div class="fare-list">
                    {{#each this.allFares}}
                    <div class="fare-item">
                        <div>
                            <span class="fare-name">{{this.fareName}}</span>
                            <span class="cabin-class">({{this.cabinClass}})</span>
                        </div>
                        <div class="fare-price">₹{{this.totalPrice}}</div>
                    </div>
                    {{/each}}
                </div>
            </div>
            {{/if}}
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