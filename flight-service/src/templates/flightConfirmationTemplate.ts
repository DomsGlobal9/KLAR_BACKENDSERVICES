export const flightConfirmationTemplate = (data: any): string => {
    const order = data?.order || {};
    const air = data?.itemInfos?.AIR || {};
    const tripInfos = air?.tripInfos?.[0]?.sI || [];
    const travellers = air?.travellerInfos || [];
    const fare = air?.totalPriceInfo?.totalFareDetail?.fC || {};

    const passenger = travellers[0] || {};

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);

        return d.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    };

    const formatCurrency = (value: number) =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2
        })}`;

    const segmentHtml = tripInfos
        .map((seg: any) => {
            return `
            <div class="flight-box">
                <div class="flight-top">
                    ${seg?.fD?.aI?.name || ""} ${seg?.fD?.aI?.code || ""}-${seg?.fD?.fN || ""}
                </div>

                <div class="route">

                    <div class="airport">
                        <div class="code">${seg?.da?.code || "-"}</div>
                        <div class="city">${seg?.da?.city || "-"}</div>
                        <div class="time">${formatDateTime(seg?.dt)}</div>
                    </div>

                    <div class="center">
                        <div class="line">
                            ${seg?.duration || 0} mins • ${seg?.stops === 0 ? "Non-stop" : seg?.stops + " Stop"}
                        </div>
                        ✈
                    </div>

                    <div class="airport" style="text-align:right">
                        <div class="code">${seg?.aa?.code || "-"}</div>
                        <div class="city">${seg?.aa?.city || "-"}</div>
                        <div class="time">${formatDateTime(seg?.at)}</div>
                    </div>

                </div>
            </div>
        `;
        })
        .join("");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<style>
body{
margin:0;
padding:0;
background:#f4f6f8;
font-family:Arial, Helvetica, sans-serif;
color:#111827;
}

.wrapper{
width:100%;
padding:30px 15px;
box-sizing:border-box;
}

.container{
max-width:760px;
margin:auto;
background:#ffffff;
border-radius:16px;
overflow:hidden;
box-shadow:0 8px 25px rgba(0,0,0,0.08);
}

.header{
background:#0f172a;
color:#fff;
padding:28px;
}

.header h1{
margin:0;
font-size:28px;
font-weight:700;
}

.header p{
margin:8px 0 0;
font-size:14px;
color:#cbd5e1;
}

.section{
padding:24px 28px;
border-bottom:1px solid #e5e7eb;
}

.title{
font-size:18px;
font-weight:700;
margin-bottom:16px;
}

.grid{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
gap:14px;
}

.card{
background:#f8fafc;
border:1px solid #e2e8f0;
border-radius:12px;
padding:14px;
}

.label{
font-size:12px;
color:#64748b;
margin-bottom:6px;
}

.value{
font-size:15px;
font-weight:600;
}

.flight-box{
border:1px solid #dbeafe;
background:#eff6ff;
border-radius:14px;
padding:18px;
margin-bottom:18px;
}

.flight-top{
font-size:14px;
font-weight:700;
color:#1d4ed8;
margin-bottom:16px;
}

.route{
display:flex;
justify-content:space-between;
gap:10px;
flex-wrap:wrap;
align-items:center;
}

.airport{
flex:1;
min-width:150px;
}

.code{
font-size:28px;
font-weight:800;
}

.city{
font-size:14px;
color:#475569;
}

.center{
text-align:center;
min-width:150px;
}

.line{
font-size:13px;
color:#475569;
margin-bottom:8px;
}

.time{
font-size:14px;
font-weight:600;
margin-top:4px;
}

table{
width:100%;
border-collapse:collapse;
}

td{
padding:8px 0;
font-size:14px;
}

td:last-child{
text-align:right;
font-weight:600;
}

.grand td{
border-top:1px solid #d1d5db;
padding-top:12px;
font-size:18px;
font-weight:800;
}

.footer{
padding:24px;
text-align:center;
font-size:13px;
background:#f8fafc;
color:#64748b;
}
</style>
</head>

<body>

<div class="wrapper">
<div class="container">

<div class="header">
<h1>Flight Confirmation</h1>
<p>Your booking has been received successfully.</p>
</div>

<div class="section">
<div class="title">Booking Details</div>

<div class="grid">

<div class="card">
<div class="label">Booking ID</div>
<div class="value">${order?.bookingId || "-"}</div>
</div>

<div class="card">
<div class="label">Booking Status</div>
<div class="value">${order?.status || "-"}</div>
</div>

<div class="card">
<div class="label">Booking Date</div>
<div class="value">${formatDate(order?.createdOn)}</div>
</div>

<div class="card">
<div class="label">Amount Paid</div>
<div class="value">${formatCurrency(order?.amount)}</div>
</div>

</div>
</div>

<div class="section">
<div class="title">Passenger Information</div>

<div class="grid">

<div class="card">
<div class="label">Passenger Name</div>
<div class="value">
${passenger?.ti || ""} ${passenger?.fN || ""} ${passenger?.lN || ""}
</div>
</div>

<div class="card">
<div class="label">Passenger Type</div>
<div class="value">${passenger?.pt || "-"}</div>
</div>

<div class="card">
<div class="label">Cabin Class</div>
<div class="value">${passenger?.fd?.cc || "-"}</div>
</div>

<div class="card">
<div class="label">Baggage</div>
<div class="value">
${passenger?.fd?.bI?.iB || "-"} + ${passenger?.fd?.bI?.cB || "-"}
</div>
</div>

</div>
</div>

<div class="section">
<div class="title">Journey Details</div>
${segmentHtml}
</div>

<div class="section">
<div class="title">Fare Summary</div>

<table>
<tr>
<td>Base Fare</td>
<td>${formatCurrency(fare?.BF)}</td>
</tr>

<tr>
<td>Taxes & Fees</td>
<td>${formatCurrency(fare?.TAF)}</td>
</tr>

<tr class="grand">
<td>Total Paid</td>
<td>${formatCurrency(fare?.TF)}</td>
</tr>
</table>
</div>

<div class="section">
<div class="title">Contact Details</div>

<div class="grid">

<div class="card">
<div class="label">Email</div>
<div class="value">${order?.contactInfo?.emails?.[0] || "-"}</div>
</div>

<div class="card">
<div class="label">Phone</div>
<div class="value">${order?.contactInfo?.contacts?.[0] || "-"}</div>
</div>

</div>
</div>

<div class="footer">
Thank you for booking with Travels. Wishing you a pleasant journey.
</div>

</div>
</div>

</body>
</html>
`;
};
