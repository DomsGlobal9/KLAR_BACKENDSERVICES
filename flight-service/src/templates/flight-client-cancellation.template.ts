export const cancellationRequestTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cancellation Request</title>
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
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
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
            border-bottom: 2px solid #dc3545;
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
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-warning {
            background: #fff3cd;
            color: #856404;
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
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #888;
            font-size: 12px;
        }
        .notes {
            background: #fff3cd;
            border-color: #ffc107;
        }
        .notes .section-title {
            color: #856404;
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
            <h1>🔄 Flight Cancellation Request</h1>
            <p>Your cancellation request has been submitted</p>
        </div>

        <div class="section">
            <div class="section-title">Booking Overview</div>
            <div class="info-grid">
                <div class="info-item">
                    <strong>Booking ID</strong>
                    <span>{{bookingId}}</span>
                </div>
                <div class="info-item">
                    <strong>Status</strong>
                    <span class="badge badge-warning">{{status}}</span>
                </div>
                <div class="info-item">
                    <strong>Total Amount</strong>
                    <span>₹{{totalPrice}}</span>
                </div>
                <div class="info-item">
                    <strong>Request Date</strong>
                    <span>{{formatDate cancellationDate}}</span>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Traveller Details</div>
            {{#each travellers}}
                <div class="traveller-card">
                    <div class="name">{{this.title}} {{this.firstName}} {{this.lastName}}</div>
                    <div class="detail">Type: {{this.paxType}}</div>
                    <div class="detail">Date of Birth: {{formatDate this.dob}}</div>
                    {{#if this.passportNumber}}
                        <div class="detail">
                            <strong>Passport:</strong> {{this.passportNumber}}
                        </div>
                    {{/if}}
                </div>
            {{/each}}
        </div>

        {{#if gstInfo}}
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
            </div>
        </div>
        {{/if}}

        <div class="section notes">
            <div class="section-title">Important Notes</div>
            <ul style="color:#333;font-size:14px;line-height:1.6;padding-left:20px;">
                <li>Your cancellation request has been submitted successfully.</li>
                <li>We will process your request and send you a confirmation shortly.</li>
                <li>Refund will be processed as per the airline's cancellation policy.</li>
                <li>Please allow 7-10 business days for the refund to reflect in your account.</li>
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