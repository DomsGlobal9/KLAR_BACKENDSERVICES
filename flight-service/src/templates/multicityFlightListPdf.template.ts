export const multicityFlightListPdfTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Multicity Flight Details Report</title>
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
        
        .leg-header {
            background: #8b5cf6;
            color: white;
            padding: 4px 8px;
            margin: 8px 0 6px 0;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 600;
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
        
        /* Fare Info */
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
        
        .fare-item.cheapest {
            background: #f0fdf4;
            border-left: 2px solid #10b981;
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
        
        /* Itinerary Card (International) */
        .itinerary-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 12px;
            overflow: hidden;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        
        .itinerary-header {
            background: #f8fafc;
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .itinerary-title {
            font-weight: 700;
            font-size: 9px;
            color: #0f172a;
        }
        
        .itinerary-total {
            font-weight: 800;
            font-size: 11px;
            color: #2563eb;
        }
        
        .itinerary-leg {
            padding: 8px;
            border-bottom: 1px solid #f1f5f9;
        }
        
        .itinerary-leg:last-child {
            border-bottom: none;
        }
        
        .leg-label {
            font-size: 7px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 6px;
        }
        
        .itinerary-route {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }
        
        .itinerary-fares {
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px dashed #e2e8f0;
        }
        
        .itinerary-fares .fare-list {
            gap: 2px;
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
                <h1>Multicity Flight Search Results</h1>
                <div class="date">Generated: {{generatedDate}}</div>
            </div>
        </div>
        
        <!-- Search Parameters -->
        <div class="search-info">
            {{#if searchParams.flights}}
                {{#each searchParams.flights}}
                    <strong>{{this.origin}}</strong> → <strong>{{this.destination}}</strong>
                    {{#unless @last}} | {{/unless}}
                {{/each}}
                | Passengers: {{searchParams.passengerCount}}
            {{/if}}
        </div>
        
        <!-- Domestic Multicity - Leg based -->
        {{#if (eq type "domestic")}}
            {{#each legs}}
                <div class="leg-header">✈ LEG {{this.legIndex}} ({{this.flights.length}} flights found)</div>
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
                        {{#each this.flights}}
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
            {{/each}}
        {{/if}}
        
        <!-- International Multicity - Itinerary based -->
        {{#if (eq type "international")}}
            <div class="section-header">✈ AVAILABLE ITINERARIES ({{totalItineraries}} found)</div>
            {{#each itineraries}}
            <div class="itinerary-card">
                <div class="itinerary-header">
                    <span class="itinerary-title">Itinerary Option</span>
                    <span class="itinerary-total">Total: ₹{{this.totalPrice}}</span>
                </div>
                
                {{#each this.legs}}
                <div class="itinerary-leg">
                    <div class="leg-label">LEG {{this.legIndex}}</div>
                    <div class="itinerary-route">
                        <div class="departure-info">
                            <div class="time">{{this.from.time}}</div>
                            <div class="airport-code">{{this.from.airportCode}}</div>
                            <div class="city">{{this.from.city}}</div>
                            <div class="date-info">{{this.from.date}}</div>
                        </div>
                        <div class="duration-info">
                            <div class="plane-icon">✈</div>
                            <div class="duration">{{this.duration}}</div>
                            <div class="stops-info">
                                {{#if (eq this.stops 0)}}Direct{{/if}}
                                {{#if (eq this.stops 1)}}{{this.stops}} Stop{{/if}}
                                {{#if (eq this.stops 2)}}{{this.stops}} Stops{{/if}}
                            </div>
                        </div>
                        <div class="arrival-info">
                            <div class="time">{{this.to.time}}</div>
                            <div class="airport-code">{{this.to.airportCode}}</div>
                            <div class="city">{{this.to.city}}</div>
                            <div class="date-info">{{this.to.date}}</div>
                        </div>
                    </div>
                    <div style="margin-top: 4px;">
                        <div class="airline-name">{{this.airline}} - {{this.flightNumber}}</div>
                    </div>
                </div>
                {{/each}}
                
                <!-- Available Fares -->
                {{#if this.allFares}}
                <div class="itinerary-fares">
                    <div style="font-size: 6px; font-weight: 600; margin-bottom: 3px;">Fare Options:</div>
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