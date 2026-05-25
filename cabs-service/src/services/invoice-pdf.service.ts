import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

class InvoicePdfService {
    public compileInvoiceHtml(templateName: string, backendData: any): string {

        console.log("============== [INVOICE DATA DEBUG] ==============");
        console.log(JSON.stringify(backendData, null, 2));
        console.log("==================================================");

        const filePath = path.join(__dirname, "../templates", templateName);
        let html = fs.readFileSync(filePath, "utf8");

        const orderDetails = backendData?.data?.[0] || {};
        const order = orderDetails.order || {};
        const cabInfo = orderDetails.itemInfos?.CAB || {};

        const isConfirmed = order.status === "CONFIRMED";

        // Mappings dictionary
        const mappings: { [key: string]: string } = {
            "{{bookingId}}": String(order.bookingId || "N/A"),
            "{{status}}": String(order.status || "PENDING"),
            "{{templateHeaderTitle}}": isConfirmed ? "BOOKING CONFIRMED!" : "BOOKING STATEMENT (PROCESSING)",
            "{{statusBadgeClass}}": isConfirmed ? "badge-confirmed" : "badge-pending",
            "{{sourceAddress}}": String(cabInfo.journeyInfo?.source || "N/A"),
            "{{destAddress}}": String(cabInfo.journeyInfo?.destination || "N/A"),
            "{{pickupDate}}": String(cabInfo.journeyInfo?.pickupDate || "N/A"),
            "{{vehicleClass}}": String(cabInfo.vehicleDetail?.clazz || "Standard Sedan"),
            "{{passengerName}}": String(cabInfo.paxDetails?.fullName || "Traveler"),
            "{{passengerPhone}}": String(cabInfo.paxDetails?.phone || "N/A"),
            "{{passengerEmail}}": String(cabInfo.paxDetails?.email || "N/A"),
            "{{agencyName}}": String(orderDetails.bookingUser?.name || "N/A"),
            "{{agencyEmail}}": String(orderDetails.bookingUser?.email || "N/A"),
            "{{netPrice}}": Number(cabInfo.pricing?.netPrice || 0).toFixed(2),
            "{{totalTax}}": Number(cabInfo.pricing?.totalTax || 0).toFixed(2),
            "{{agentMarkup}}": Number(cabInfo.pricing?.agentMarkup || 0).toFixed(2),
            "{{grossAmount}}": Number(order.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })
        };

        for (const placeholder in mappings) {
            html = html.split(placeholder).join(mappings[placeholder]);
        }
        return html;
    }

    public async generatePdfBuffer(htmlContent: string): Promise<Buffer> {
        const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });
        const pdf = await page.pdf({ format: "A4", printBackground: true });
        await browser.close();
        return pdf;
    }
}

export const invoicePdfService = new InvoicePdfService();