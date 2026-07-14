import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

class InvoicePdfService {
    private getLogoAsBase64(): string {
        try {
            const logoPath = "src\\assets\\images\\klar-travels-logo.png";
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                return `data:image/png;base64,${Buffer.from(bitmap).toString('base64')}`;
            }
            return "";
        } catch (error) {
            console.error("❌ [InvoicePdfService] Error converting logo asset to base64:", error);
            return "";
        }
    }

    public compileInvoiceHtml(templateName: string, backendData: any): string {
        const orderDetails = backendData?.data?.[0] || {};
        const order = orderDetails.order || {};
        const cabInfo = orderDetails.itemInfos?.CAB || {};
        const policies = order.policies || {};
        const pricing = cabInfo.pricing || {};
        
        const currentStatus = String(order.status || "PENDING").toUpperCase();
        
        // 🛑 Dynamic check to route templates to cancellation states
        const isCancelled = currentStatus.includes("CANCEL") || currentStatus.includes("FAIL");
        let activeTemplateName = templateName;
        
        if (isCancelled) {
            activeTemplateName = templateName.includes("client") 
                ? "client-cancellation-template.html" 
                : "agent-cancellation-template.html";
        }

        const filePath = path.join(__dirname, "../templates", activeTemplateName);
        let html = fs.readFileSync(filePath, "utf8");

        const isConfirmed = currentStatus === "CONFIRMED" || currentStatus === "SUCCESS";
        let statusBadgeClass = "badge-pending";
        if (isConfirmed) statusBadgeClass = "badge-confirmed";

        const parseReadableDate = (rawDateStr: string): string => {
            if (!rawDateStr) return "N/A";
            try {
                const dateObj = new Date(rawDateStr);
                return dateObj.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) + 
                    " at " + dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
            } catch (e) { return rawDateStr; }
        };

        const buildListItems = (itemsArray: any[], defaultText: string): string => {
            if (!itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) {
                return `<li>${defaultText}</li>`;
            }
            return itemsArray.map(item => `<li>${typeof item === 'object' ? item.description || JSON.stringify(item) : String(item)}</li>`).join("");
        };

        // 📈 Calculate financial elements for refund fields safely
        const totalPaidAmount = Number(order.amount || pricing.grossAmount || 0);
        
        // Read cancellation charge policies if present, else fallback to 0
        const cancellationFeeValue = Number(order.cancellationFee || 0);
        const refundAmountValue = Math.max(0, totalPaidAmount - cancellationFeeValue);

        const base64Logo = this.getLogoAsBase64();

        const mappings: { [key: string]: string } = {
            "{{logoSrc}}": base64Logo,
            "{{bookingId}}": String(order.bookingId || "N/A"),
            "{{status}}": currentStatus,
            "{{templateHeaderTitle}}": isConfirmed ? "Booking Confirmed!" : "BOOKING STATEMENT (PROCESSING)",
            "{{statusBadgeClass}}": statusBadgeClass,
            "{{tripType}}": String(order.tripType || "ONEWAY"),
            "{{sourceAddress}}": String(cabInfo.journeyInfo?.source || "N/A"),
            "{{destAddress}}": String(cabInfo.journeyInfo?.destination || "N/A"),
            "{{pickupDate}}": parseReadableDate(cabInfo.journeyInfo?.pickupDate),
            "{{distance}}": String(cabInfo.journeyInfo?.distance || "10 Km"),
            "{{duration}}": `${cabInfo.journeyInfo?.duration || 30} mins`,
            "{{vehicleClass}}": String(cabInfo.vehicleDetail?.clazz || "Standard Sedan"),
            "{{passengerName}}": String(cabInfo.paxDetails?.fullName || "Passenger"),
            "{{passengerPhone}}": String(cabInfo.paxDetails?.phone || "N/A"),
            "{{passengerEmail}}": String(cabInfo.paxDetails?.email || "N/A"),
            "{{agencyName}}": String(orderDetails.bookingUser?.name || "N/A"),
            "{{agencyEmail}}": String(orderDetails.bookingUser?.email || "N/A"),
            
            // Financial Breakdown Tokens
            "{{netPrice}}": Number(pricing.netPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            "{{totalTax}}": Number(pricing.totalTax || order.taxes || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            "{{agentMarkup}}": Number(pricing.agentMarkup || order.agentMarkup || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            "{{grossAmount}}": totalPaidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            
            // Cancellation-specific computed financial fields
            "{{cancellationFee}}": cancellationFeeValue.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            "{{refundAmount}}": refundAmountValue.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            
            // Policy Framework Lists
            "{{waitingTime}}": String(policies.waitingTime || "30 mins free waiting time"),
            "{{meetAndGreet}}": String(policies.meetAndGreet?.description || "Driver meets with placard at Arrivals Gate"),
            "{{helpline}}": String(order.helpline || "For any urgent matters, call our 24/7 helpline number at: +1 855 980 5669"),
            "{{dynamicInclusions}}": buildListItems(policies.inclusions, "All inclusive pricing"),
            "{{dynamicExclusions}}": buildListItems(policies.exclusions, "Charges for changes or extra stops"),
            "{{dynamicBaggage}}": buildListItems(policies.baggagePolicy, "Standard luggage parameters apply."),
            "{{dynamicTerms}}": buildListItems(policies.termsAndPolicies, "Standard terms apply.")
        };

        for (const placeholder in mappings) {
            html = html.split(placeholder).join(mappings[placeholder]);
        }
        return html;
    }

    public async generatePdfBuffer(htmlContent: string): Promise<Buffer> {
        const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" as any });
        const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" } });
        await browser.close();
        return Buffer.from(pdf);
    }
}

export const invoicePdfService = new InvoicePdfService();