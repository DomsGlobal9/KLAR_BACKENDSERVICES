import puppeteer from 'puppeteer';

export const generatePdfFromHtml = async (html: string): Promise<Buffer> => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await browser.close();
    // In TypeScript, page.pdf returns a Buffer in newer versions
    return Buffer.from(pdfBuffer);
};