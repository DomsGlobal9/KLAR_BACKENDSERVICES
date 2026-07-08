export const validateCreateOrder = (body: any): string | null => {
    if (!body.userId) {
        body.userId = body.userEmail || 'guest';
    }


    if (!body.clientType) {
        body.clientType = 'B2C';
    }
    if (!body.platform) {
        body.platform = body.clientType;
    }
    if (!body.amount) {
        return 'amount is required';
    }
    if (typeof body.amount !== 'number' || body.amount <= 0) {
        return 'amount must be a positive number';
    }
    if (body.amount < 1) {
        return 'minimum amount is ₹1';
    }
    if (body.amount > 1000000) {
        return 'maximum amount is ₹10,00,000';
    }
    return null;
};

export const validateVerifyPayment = (body: any): string | null => {
    if (!body.orderId) {
        return 'orderId is required';
    }
    if (!body.razorpayOrderId) {
        return 'razorpayOrderId is required';
    }
    if (!body.razorpayPaymentId) {
        return 'razorpayPaymentId is required';
    }
    if (!body.razorpaySignature) {
        return 'razorpaySignature is required';
    }
    return null;
};

export const validateOrderIdParam = (orderId: string): string | null => {
    if (!orderId) {
        return 'orderId is required';
    }
    return null;
};

export const validatePaymentIdParam = (paymentId: string): string | null => {
    if (!paymentId) {
        return 'paymentId is required';
    }
    return null;
};

export const validateRazorpayOrderIdParam = (razorpayOrderId: string): string | null => {
    if (!razorpayOrderId) {
        return 'razorpayOrderId is required';
    }
    return null;
};










// export const validateCreateOrder = (body: any) => {
//     const { userId, userEmail, mobile, clientType, amount, currency } = body;

//     if (!userId) return 'userId is required';
//     if (!userEmail) return 'userEmail is required';
//     if (!mobile) return 'mobile is required';
//     if (!clientType) return 'clientType is required';
//     if (!amount) return 'amount is required';
//     if (amount <= 0) return 'Amount must be greater than 0';
//     if (currency && currency !== 'INR') return 'Only INR currency is supported for Razorpay';

//     return null;
// };

// export const validateVerifyPayment = (body: any) => {
//     const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

//     if (!orderId) return 'orderId is required';
//     if (!razorpayOrderId) return 'razorpayOrderId is required';
//     if (!razorpayPaymentId) return 'razorpayPaymentId is required';
//     if (!razorpaySignature) return 'razorpaySignature is required';

//     return null;
// };

// export const validateOrderIdParam = (orderId?: string) => {
//     if (!orderId) return 'Order ID is required';
//     return null;
// };

// export const validatePaymentIdParam = (paymentId?: string) => {
//     if (!paymentId) return 'Payment ID is required';
//     return null;
// };

// export const validateRazorpayOrderIdParam = (razorpayOrderId?: string) => {
//     if (!razorpayOrderId) return 'Razorpay Order ID is required';
//     return null;
// };