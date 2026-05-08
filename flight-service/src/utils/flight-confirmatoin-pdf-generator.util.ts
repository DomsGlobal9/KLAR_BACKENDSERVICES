// import puppeteer from 'puppeteer';

// export const generatePdfFromHtml = async (html: string): Promise<Buffer> => {
//     const browser = await puppeteer.launch({ headless: true });
//     const page = await browser.newPage();
    
//     await page.setContent(html, { waitUntil: 'networkidle0' });
    
//     const pdfBuffer = await page.pdf({
//         format: 'A4',
//         printBackground: true,
//         margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
//     });

//     await browser.close();
//     // In TypeScript, page.pdf returns a Buffer in newer versions
//     return Buffer.from(pdfBuffer);
// };


























import puppeteer from 'puppeteer';

export const generatePdfFromHtml = async (html: string): Promise<Buffer> => {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Recommended for server environments
    });
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
};