export const onewayFlightListPdfTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Flight Details Report</title>
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
            font-size: 10px;
            line-height: 1.3;
        }
        
        .container {
            max-width: 100%;
            margin: 0;
            padding: 15px;
        }
        
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .logo {
            max-height: 40px;
        }
        
        .report-title {
            text-align: right;
        }
        
        .report-title h1 {
            font-size: 14px;
            color: #0f172a;
            margin-bottom: 3px;
        }
        
        .report-title .date {
            font-size: 8px;
            color: #64748b;
        }
        
        /* Flight Table - Compact View */
        .flight-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 9px;
        }
        
        .flight-table th {
            background: #f1f5f9;
            padding: 6px 8px;
            text-align: left;
            font-weight: 700;
            color: #475569;
            border: 1px solid #e2e8f0;
            font-size: 8px;
            text-transform: uppercase;
        }
        
        .flight-table td {
            padding: 8px 6px;
            border: 1px solid #e2e8f0;
            vertical-align: middle;
        }
        
        /* Airline Info Column */
        .airline-cell {
            min-width: 100px;
        }
        
        .airline-name {
            font-weight: 700;
            font-size: 10px;
            color: #0f172a;
        }
        
        .flight-number {
            font-size: 8px;
            color: #64748b;
            margin-top: 2px;
        }
        
        /* Route Info */
        .route-cell {
            min-width: 180px;
        }
        
        .route-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
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
            font-size: 10px;
            color: #0f172a;
        }
        
        .airport-code {
            font-size: 9px;
            font-weight: 600;
            color: #475569;
        }
        
        .city {
            font-size: 8px;
            color: #64748b;
        }
        
        .date-info {
            font-size: 7px;
            color: #94a3b8;
        }
        
        .duration-info {
            text-align: center;
            padding: 0 5px;
        }
        
        .duration {
            font-size: 8px;
            font-weight: 600;
            color: #475569;
            white-space: nowrap;
        }
        
        .stops {
            font-size: 7px;
            color: #64748b;
        }
        
        .plane-icon {
            font-size: 10px;
            color: #667eea;
        }
        
        /* Fare Info Column */
        .fare-cell {
            min-width: 120px;
        }
        
        .fare-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .fare-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 2px 4px;
            background: #f8fafc;
            border-radius: 3px;
            font-size: 8px;
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
            font-size: 7px;
            color: #64748b;
            margin-left: 4px;
        }
        
        .fare-price {
            font-weight: 700;
            color: #10b981;
            white-space: nowrap;
        }
        
        /* Price Column */
        .price-cell {
            text-align: right;
            min-width: 70px;
        }
        
        .cheapest-price {
            font-weight: 800;
            font-size: 11px;
            color: #10b981;
        }
        
        .cheapest-label {
            font-size: 7px;
            color: #64748b;
            margin-top: 2px;
        }
        
        /* Footer */
        .footer {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 7px;
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
                <div style="font-size: 14px; font-weight: 800; color: #667eea;">FLIGHT SEARCH</div>
            {{/if}}
            <div class="report-title">
                <h1>Flight Search Results</h1>
                <div class="date">Generated: {{generatedDate}}</div>
            </div>
        </div>
        
        <!-- Flights Table -->
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
                {{#each flights}}
                <tr>
                    <!-- Airline Info -->
                    <td class="airline-cell">
                        <div class="airline-name">{{this.airline}}</div>
                        <div class="flight-number">{{this.flightNumber}}</div>
                        <div style="font-size: 7px; color: #94a3b8; margin-top: 2px;">
                            {{#if (eq this.stops 0)}}Direct{{/if}}
                            {{#if (eq this.stops 1)}}{{this.stops}} Stop{{/if}}
                            {{#if (eq this.stops 2)}}{{this.stops}} Stops{{/if}}
                        </div>
                    </td>
                    
                    <!-- Route & Duration -->
                    <td class="route-cell">
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
                    
                    <!-- Available Fares -->
                    <td class="fare-cell">
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
                    
                    <!-- Price -->
                    <td class="price-cell">
                        <div class="cheapest-price">₹{{formatNumber this.cheapestFare.price}}</div>
                        <div class="cheapest-label">Cheapest Fare</div>
                    </td>
                </tr>
                {{/each}}
            </tbody>
        </table>
        
        <!-- Footer -->
        <div class="footer">
            <p>This is a system-generated report. For booking assistance, please contact support.</p>
            <p>© {{currentYear}} Flight Search Platform. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;