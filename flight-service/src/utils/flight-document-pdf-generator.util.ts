import puppeteer from 'puppeteer';

export const generatePdfFromHtml = async (html: string): Promise<Buffer> => {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'load' });
    
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
};