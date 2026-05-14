export function formatPhoneNumber(phone: string): string {
    if (!phone) return phone;

    phone = phone.trim();

    if (phone.startsWith("+")) {
        return phone;
    }

    if (phone.startsWith("0")) {
        phone = phone.slice(1);
    }

    return `+91${phone}`;
}