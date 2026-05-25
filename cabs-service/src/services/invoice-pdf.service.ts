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
            console.warn(`⚠️ [InvoicePdfService] Logo asset file not found at path: ${logoPath}`);
            return "";
        } catch (error) {
            console.error("❌ [InvoicePdfService] Error converting logo asset to base64:", error);
            return "";
        }
    }

    public compileInvoiceHtml(templateName: string, backendData: any): string {
        console.log("==================================================");
        console.log("📥 [DEBUG] COMPILING TEMPLATE CONTENT DATA INJECTION MATRIX");
        console.log("==================================================");

        const filePath = path.join(__dirname, "../templates", templateName);
        let html = fs.readFileSync(filePath, "utf8");

        const orderDetails = backendData?.data?.[0] || {};
        const order = orderDetails.order || {};
        const cabInfo = orderDetails.itemInfos?.CAB || {};
        const policies = order.policies || {};
        
        const currentStatus = String(order.status || "PENDING").toUpperCase();
        const isConfirmed = currentStatus === "CONFIRMED" || currentStatus === "SUCCESS";

        // Dynamic status badge styling selection profile
        let statusBadgeClass = "badge-pending";
        if (isConfirmed) {
            statusBadgeClass = "badge-confirmed";
        }

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

        // Construct Robust Dynamic List Line-Items with Fallbacks
        const buildListItems = (itemsArray: any[] | undefined, defaultText: string): string => {
            if (!itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) {
                return `<li>${defaultText}</li>`;
            }
            return itemsArray.map(item => {
                const text = typeof item === 'object' && item !== null ? item.description || JSON.stringify(item) : String(item);
                return `<li>${text}</li>`;
            }).join("");
        };

        const dynamicInclusions = buildListItems(policies.inclusions, "All inclusive pricing");
        const dynamicExclusions = buildListItems(policies.exclusions, "Charges for changes or extra stops");
        const dynamicBaggage = buildListItems(policies.baggagePolicy, "Standard luggage parameters apply.");
        const dynamicTerms = buildListItems(policies.termsAndPolicies, "Standard passenger terms apply.");

        const base64Logo = this.getLogoAsBase64();

        // Dictionary map tokens to execute total replacement metrics loops matching HTML variables
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
            "{{grossAmount}}": Number(order.amount || cabInfo.pricing?.grossAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            
            // Fixed Array Parameter Content Nodes
            "{{waitingTime}}": String(policies.waitingTime || "30 mins free waiting time"),
            "{{meetAndGreet}}": String(policies.meetAndGreet?.description || "Driver meets with placard at Arrivals Gate"),
            "{{helpline}}": String(order.helpline || "For any urgent matters, you can also call our 24/7 helpline number at: +1 855 980 5669"),
            "{{dynamicInclusions}}": dynamicInclusions,
            "{{dynamicExclusions}}": dynamicExclusions,
            "{{dynamicBaggage}}": dynamicBaggage,
            "{{dynamicTerms}}": dynamicTerms
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