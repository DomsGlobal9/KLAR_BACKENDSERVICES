import Handlebars from 'handlebars';

export const registerHandlebarsHelpers = () => {
    Handlebars.registerHelper('formatCurrency', (value: number) => {
        if (!value && value !== 0) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    });

    Handlebars.registerHelper('formatNumber', (num: number) => {
        if (!num && num !== 0) return '0';
        return num.toLocaleString('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    });

    Handlebars.registerHelper('formatTime', (time: string) => time);

    Handlebars.registerHelper('formatDate', (date: string) => date);

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    Handlebars.registerHelper('currentYear', () => new Date().getFullYear());

    Handlebars.registerHelper('times', (n: number, block: any) => {
        let accum = '';
        for (let i = 0; i < n; ++i)
            accum += block.fn(i);
        return accum;
    });
};