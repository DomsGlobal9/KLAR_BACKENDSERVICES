import Handlebars from 'handlebars';

export const registerHandlebarsHelpers = () => {
    // Existing helpers
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

    Handlebars.registerHelper('add', (a: number, b: number) => {
        return a + b;
    });

    // Enhanced formatTime helper - handles string or Date object
    Handlebars.registerHelper('formatTime', (time: any) => {
        if (!time) return 'N/A';
        
        // If it's a string, try to parse it
        if (typeof time === 'string') {
            const date = new Date(time);
            if (!isNaN(date.getTime())) {
                return date.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            }
            // If it's already a formatted time string, return as is
            return time;
        }
        
        // If it's a Date object
        if (time instanceof Date) {
            return time.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }
        
        return 'N/A';
    });

    // Enhanced formatDate helper - handles string or Date object
    Handlebars.registerHelper('formatDate', (date: any) => {
        if (!date) return 'N/A';
        
        // If it's a string, try to parse it
        if (typeof date === 'string') {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            }
            // If it's already a formatted date string, return as is
            return date;
        }
        
        // If it's a Date object
        if (date instanceof Date) {
            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }
        
        return 'N/A';
    });

    // NEW: Format date in long format (with weekday)
    Handlebars.registerHelper('formatDateLong', (date: any) => {
        if (!date) return 'N/A';
        
        if (typeof date === 'string') {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            }
            return date;
        }
        
        if (date instanceof Date) {
            return date.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }
        
        return 'N/A';
    });

    // NEW: Format date with time together
    Handlebars.registerHelper('formatDateTime', (date: any) => {
        if (!date) return 'N/A';
        
        if (typeof date === 'string') {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                return d.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            }
            return date;
        }
        
        if (date instanceof Date) {
            return date.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }
        
        return 'N/A';
    });

    // Equality helper
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    // NOT equal helper
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);

    // Greater than helper
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);

    // Less than helper
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);

    // Greater than or equal helper
    Handlebars.registerHelper('gte', (a: number, b: number) => a >= b);

    // Less than or equal helper
    Handlebars.registerHelper('lte', (a: number, b: number) => a <= b);

    // AND logical operator
    Handlebars.registerHelper('and', (...args: any[]) => {
        // Remove the Handlebars options object at the end
        const options = args.pop();
        return args.every(arg => arg === true);
    });

    // OR logical operator
    Handlebars.registerHelper('or', (...args: any[]) => {
        // Remove the Handlebars options object at the end
        const options = args.pop();
        return args.some(arg => arg === true);
    });

    // Check if object has SSR data
    Handlebars.registerHelper('hasSSR', (ssrInfo: any) => {
        if (!ssrInfo) return false;
        if (typeof ssrInfo !== 'object') return false;
        return Object.keys(ssrInfo).length > 0;
    });

    // Check if value exists and is not empty
    Handlebars.registerHelper('exists', (value: any) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'object' && Object.keys(value).length === 0) return false;
        return true;
    });

    // Get first item from array
    Handlebars.registerHelper('first', (array: any[]) => {
        if (!array || !Array.isArray(array) || array.length === 0) return null;
        return array[0];
    });

    // Get last item from array
    Handlebars.registerHelper('last', (array: any[]) => {
        if (!array || !Array.isArray(array) || array.length === 0) return null;
        return array[array.length - 1];
    });

    // Join array with separator
    Handlebars.registerHelper('join', (array: any[], separator: string) => {
        if (!array || !Array.isArray(array)) return '';
        return array.join(separator || ', ');
    });

    // Current year helper
    Handlebars.registerHelper('currentYear', () => new Date().getFullYear());

    // Times helper
    Handlebars.registerHelper('times', (n: number, block: any) => {
        let accum = '';
        for (let i = 0; i < n; ++i) {
            accum += block.fn(i);
        }
        return accum;
    });

    // JSON stringify helper (useful for debugging)
    Handlebars.registerHelper('json', (context: any) => {
        return JSON.stringify(context, null, 2);
    });

    // Default value helper
    Handlebars.registerHelper('default', (value: any, defaultValue: any) => {
        if (value === null || value === undefined || value === '') {
            return defaultValue;
        }
        return value;
    });

    // Conditional rendering with multiple conditions - FIXED
    Handlebars.registerHelper('ifCond', function(this: any, v1: any, operator: string, v2: any, options: any) {
        switch (operator) {
            case '==':
                return (v1 == v2) ? options.fn(this) : options.inverse(this);
            case '===':
                return (v1 === v2) ? options.fn(this) : options.inverse(this);
            case '!=':
                return (v1 != v2) ? options.fn(this) : options.inverse(this);
            case '!==':
                return (v1 !== v2) ? options.fn(this) : options.inverse(this);
            case '<':
                return (v1 < v2) ? options.fn(this) : options.inverse(this);
            case '<=':
                return (v1 <= v2) ? options.fn(this) : options.inverse(this);
            case '>':
                return (v1 > v2) ? options.fn(this) : options.inverse(this);
            case '>=':
                return (v1 >= v2) ? options.fn(this) : options.inverse(this);
            case '&&':
                return (v1 && v2) ? options.fn(this) : options.inverse(this);
            case '||':
                return (v1 || v2) ? options.fn(this) : options.inverse(this);
            default:
                return options.inverse(this);
        }
    });
};