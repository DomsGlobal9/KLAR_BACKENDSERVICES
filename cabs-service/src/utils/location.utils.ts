export const getCityFromAddress = (addressStr: string) => {
    if (!addressStr) return "City";
    const parts = addressStr.split(',').map(p => p.trim());
    if (parts.length === 1) return parts[0];
    
    const lastPart = parts[parts.length - 1].toLowerCase().replace(/[^a-z\s]/g, '').trim();
    const knownCountries = [
        'uk', 'united kingdom', 'us', 'usa', 'united states', 'australia', 'canada', 
        'uae', 'united arab emirates', 'singapore', 'france', 'germany', 'malaysia', 
        'thailand', 'japan', 'china', 'italy', 'spain', 'netherlands', 'switzerland',
        'sweden', 'norway', 'denmark', 'finland', 'russia', 'brazil', 'mexico',
        'argentina', 'south africa', 'turkey', 'egypt', 'saudi arabia', 'qatar',
        'oman', 'kuwait', 'bahrain', 'vietnam', 'philippines', 'indonesia', 'new zealand'
    ];
    
    if (knownCountries.includes(lastPart) || lastPart.includes('emirates')) {
        return parts.length > 1 ? parts[parts.length - 2] : "City";
    }
    return parts[parts.length - 1];
};

export const getCountryFromAddress = (addressStr: string) => {
    if (!addressStr) return "India";
    const parts = addressStr.split(',').map(p => p.trim());
    const lastPart = parts[parts.length - 1].toLowerCase().replace(/[^a-z\s]/g, '').trim();
    
    const knownCountries = [
        'uk', 'united kingdom', 'us', 'usa', 'united states', 'australia', 'canada', 
        'uae', 'united arab emirates', 'singapore', 'france', 'germany', 'malaysia', 
        'thailand', 'japan', 'china', 'italy', 'spain', 'netherlands', 'switzerland',
        'sweden', 'norway', 'denmark', 'finland', 'russia', 'brazil', 'mexico',
        'argentina', 'south africa', 'turkey', 'egypt', 'saudi arabia', 'qatar',
        'oman', 'kuwait', 'bahrain', 'vietnam', 'philippines', 'indonesia', 'new zealand'
    ];
    
    if (knownCountries.includes(lastPart)) {
        return parts[parts.length - 1]; 
    }
    
    if (lastPart.includes('emirates')) return "United Arab Emirates";
    
    // Check if "India" is explicitly present in any part
    if (parts.some(p => p.toLowerCase().includes('india'))) {
        return "India";
    }

    // Default Fallback: If it's not a known international country, it's likely India (City/State format)
    return "India";
};
