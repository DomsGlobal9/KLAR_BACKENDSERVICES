import fs from 'fs';
import path from 'path';

export const getLogoBase64 = (): string => {
    try {
        const logoPath = path.join(__dirname, '..', 'assets', 'images', 'klar-travels-logo.png');

        if (!fs.existsSync(logoPath)) {

            return '';
        }
        
        const logoBuffer = fs.readFileSync(logoPath);
        const base64Logo = logoBuffer.toString('base64');

        return `data:image/png;base64,${base64Logo}`;
    } catch (error: any) {

        return '';
    }
};