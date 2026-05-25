import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

class InvoicePdfService {
    private getLogoAsBase64(): string {
        try {
            const logoPath = "src\\assets\\images\\klar-travels-logo.png";
            
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                const base64Str = Buffer.from(bitmap).toString('base64');
                return `data:image/png;base64,${base64Str}`;
            }
            
            // Fallback warning path trace profile
            console.warn(`⚠️ [InvoicePdfService] Logo not found at absolute path: ${logoPath}`);
            return "";
        } catch (error) {
            console.error("❌ [InvoicePdfService] Failed converting logo asset to base64 string stream:", error);
            return "";
        }
    }

    public compileInvoiceHtml(templateName: string, backendData: any): string {
        // 🔍 DEBUG SYSTEM TRACE LOG OUTPUT
        console.log("==================================================");
        console.log("📥 [DEBUG] INVOICE BACKEND DATA STRINGS PROFILE:");
        console.log(JSON.stringify(backendData, null, 2));
        console.log("==================================================");

        const filePath = path.join(__dirname, "../templates", templateName);
        let html = fs.readFileSync(filePath, "utf8");

        const orderDetails = backendData?.data?.[0] || {};
        const order = orderDetails.order || {};
        const cabInfo = orderDetails.itemInfos?.CAB || {};
        
        const currentStatus = String(order.status || "PENDING").toUpperCase();
        const isConfirmed = currentStatus === "CONFIRMED";

        const parseReadableDate = (rawDateStr: string): string => {
            if (!rawDateStr) return "N/A";
            try {
                const dateObj = new Date(rawDateStr);
                return dateObj.toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }) + " at " + dateObj.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit"
                });
            } catch (e) {
                return rawDateStr;
            }
        };

        const base64Logo = this.getLogoAsBase64();

        // Template replacement tokens profile map dictionary configuration layout 
        const mappings: { [key: string]: string } = {
            "{{logoSrc}}": base64Logo,
            "{{bookingId}}": String(order.bookingId || "N/A"),
            "{{status}}": currentStatus,
            "{{templateHeaderTitle}}": isConfirmed ? "Booking Confirmed!" : "BOOKING STATEMENT (PROCESSING)",
            "{{statusBadgeClass}}": isConfirmed ? "badge-confirmed" : "badge-pending",
            "{{tripType}}": String(order.tripType || "ONEWAY"),
            "{{sourceAddress}}": String(cabInfo.journeyInfo?.source || "N/A"),
            "{{destAddress}}": String(cabInfo.journeyInfo?.destination || "N/A"),
            "{{pickupDate}}": parseReadableDate(cabInfo.journeyInfo?.pickupDate),
            "{{distance}}": String(cabInfo.journeyInfo?.distance || "10 Km"),
            "{{duration}}": `${cabInfo.journeyInfo?.duration || 30} mins`,
            "{{vehicleClass}}": String(cabInfo.vehicleDetail?.clazz || "Standard Private Van"),
            "{{passengerName}}": String(cabInfo.paxDetails?.fullName || "sudheer ganta"),
            "{{passengerPhone}}": String(cabInfo.paxDetails?.phone || "N/A"),
            "{{passengerEmail}}": String(cabInfo.paxDetails?.email || "N/A"),
            "{{agencyName}}": String(orderDetails.bookingUser?.name || "N/A"),
            "{{agencyEmail}}": String(orderDetails.bookingUser?.email || "N/A"),
            "{{netPrice}}": Number(cabInfo.pricing?.netPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            "{{totalTax}}": Number(cabInfo.pricing?.totalTax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            "{{agentMarkup}}": Number(cabInfo.pricing?.agentMarkup || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            "{{grossAmount}}": Number(order.amount || cabInfo.pricing?.grossAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })
        };

        for (const placeholder in mappings) {
            html = html.split(placeholder).join(mappings[placeholder]);
        }
        return html;
    }

    public async generatePdfBuffer(htmlContent: string): Promise<Buffer> {
        const browser = await puppeteer.launch({ 
            headless: true, 
            args: ["--no-sandbox", "--disable-setuid-sandbox"] 
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });
        
        const pdf = await page.pdf({ 
            format: "A4", 
            printBackground: true,
            margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" }
        });
        await browser.close();
        return pdf;
    }
}

export const invoicePdfService = new InvoicePdfService();