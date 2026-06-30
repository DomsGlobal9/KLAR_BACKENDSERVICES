export const insufficientBalanceEmailTemplate = (
    recipientType: string,
    data: {
        bookingId: string;
        requiredAmount: number;
        currentBalance: number;
        shortfallAmount: number;
        companyName?: string;
        parentCompanyName?: string;
    }
) => {

    console.log(
        "[insufficientBalanceEmailTemplate] Called",
        {
            recipientType,
            bookingId: data.bookingId,
            requiredAmount: data.requiredAmount,
            currentBalance: data.currentBalance,
            shortfallAmount: data.shortfallAmount,
            companyName: data.companyName,
            parentCompanyName: data.parentCompanyName,
        }
    );

    const isSubCompany = recipientType === "SUB_COMPANY";
    const isParentAdmin = recipientType === "PARENT_ADMIN";
    const isRM = recipientType === "RM";

    let title = "";
    let greeting = "";
    let message = "";

    if (isSubCompany) {
        title = "⚠️ Insufficient Wallet Balance Alert";
        greeting = `Dear ${data.companyName || "Sub-Company"}`;
        message = `
            <p>Your wallet balance is insufficient to process the booking payment.</p>
            <p><strong>Note:</strong> The payment will be covered by your parent company (${data.parentCompanyName || "Parent B2B Admin"}) if they have sufficient balance.</p>
        `;
    } else if (isParentAdmin) {
        title = "⚠️ Action Required: Insufficient Wallet Balance - Booking Payment";
        greeting = `Dear ${data.companyName || "B2B Admin"}`;
        message = `
            <p>Your wallet balance is insufficient to process the booking payment.</p>
            <p><strong>Note:</strong> As the parent company, you may need to recharge your wallet to ensure future payments can be processed.</p>
        `;
    } else if (isRM) {
        title = "⚠️ Insufficient Wallet Balance Alert - Booking Payment Failed";
        greeting = `Dear RM`;
        message = `
            <p>Your parent company's wallet balance is insufficient to process the booking payment.</p>
            <p><strong>Note:</strong> Please contact your associated B2B Admin to recharge the wallet.</p>
        `;
    }

    return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #ff9800; padding: 20px; border-radius: 8px; text-align: center;">
            <h2 style="color: white; margin: 0;">${title}</h2>
        </div>
        
        <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <p style="font-size: 16px; color: #333;">${greeting},</p>
            
            ${message}
            
            <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #ff9800; margin-top: 0;">Payment Details:</h3>
                <p><strong>Booking ID:</strong> ${data.bookingId}</p>
                <p><strong>Required Amount:</strong> ₹${data.requiredAmount.toFixed(2)}</p>
                <p><strong>Current Balance:</strong> ₹${data.currentBalance.toFixed(2)}</p>
                <p><strong>Shortfall Amount:</strong> ₹${data.shortfallAmount.toFixed(2)}</p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
                This is an automated notification. Please recharge your wallet to continue processing bookings.
            </p>
            
            <hr style="margin: 20px 0; border-color: #ffcc80;">
            
            <p style="color: #999; font-size: 12px;">
                If you have any questions, please contact support.
            </p>
        </div>
    </div>
    `;
};

export const paymentSuccessEmailTemplate = (
    recipientType: string,
    data: {
        bookingId: string;
        amount: number;
        newBalance: number;
        companyName?: string;
        parentCompanyName?: string;
        paymentSource?: string;
    }
) => {

    console.log(
        "[paymentSuccessEmailTemplate] Called",
        {
            recipientType,
            bookingId: data.bookingId,
            amount: data.amount,
            newBalance: data.newBalance,
            companyName: data.companyName,
            parentCompanyName: data.parentCompanyName,
            paymentSource: data.paymentSource,
        }
    );

    const isSubCompany = recipientType === "SUB_COMPANY";
    const isParentAdmin = recipientType === "PARENT_ADMIN";
    const isRM = recipientType === "RM";

    let title = "";
    let greeting = "";
    let paymentMessage = "";

    if (isSubCompany) {
        title = "✅ Booking Payment Processed Successfully";
        greeting = `Dear ${data.companyName || "Sub-Company"}`;
        if (data.paymentSource === "SUB_COMPANY_WALLET") {
            paymentMessage = `
                <p>Your wallet has been debited for the booking payment.</p>
                <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Payment Source:</strong> Sub-Company Wallet</p>
                    <p><strong>Amount Debited:</strong> ₹${data.amount.toFixed(2)}</p>
                    <p><strong>New Balance:</strong> ₹${data.newBalance.toFixed(2)}</p>
                </div>
            `;
        } else {
            paymentMessage = `
                <p>The payment has been processed successfully.</p>
                <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Payment Source:</strong> Parent Company Wallet (${data.parentCompanyName})</p>
                    <p><strong>Amount Paid:</strong> ₹${data.amount.toFixed(2)}</p>
                    <p><strong>Note:</strong> Your sub-company wallet balance remains unchanged.</p>
                </div>
            `;
        }
    } else if (isParentAdmin) {
        title = "✅ Booking Payment Processed - Wallet Debited";
        greeting = `Dear ${data.companyName || "B2B Admin"}`;
        if (data.paymentSource === "SUB_COMPANY_WALLET") {
            paymentMessage = `
                <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Payment Source:</strong> Sub-Company Wallet</p>
                    <p><strong>Amount Paid:</strong> ₹${data.amount.toFixed(2)}</p>
                    <p><strong>Your Wallet Balance:</strong> ₹${data.newBalance.toFixed(2)} (unchanged)</p>
                </div>
            `;
        } else {
            paymentMessage = `
                <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Payment Source:</strong> Parent Wallet</p>
                    <p><strong>Amount Debited:</strong> ₹${data.amount.toFixed(2)}</p>
                    <p><strong>New Balance:</strong> ₹${data.newBalance.toFixed(2)}</p>
                </div>
            `;
        }
    } else if (isRM) {
        title = "✅ Booking Payment Processed by RM";
        greeting = `Dear RM`;
        paymentMessage = `
            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>Payment Source:</strong> Parent Company Wallet</p>
                <p><strong>Amount Debited:</strong> ₹${data.amount.toFixed(2)}</p>
                <p><strong>Parent Company's New Balance:</strong> ₹${data.newBalance.toFixed(2)}</p>
            </div>
        `;
    }

    return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4caf50; padding: 20px; border-radius: 8px; text-align: center;">
            <h2 style="color: white; margin: 0;">${title}</h2>
        </div>
        
        <div style="background-color: #f1f8e9; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <p style="font-size: 16px; color: #333;">${greeting},</p>
            
            <p>Your booking payment has been processed successfully.</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #4caf50; margin-top: 0;">Booking Details:</h3>
                <p><strong>Booking ID:</strong> ${data.bookingId}</p>
                ${paymentMessage}
            </div>
            
            <hr style="margin: 20px 0; border-color: #c8e6c9;">
            
            <p style="color: #999; font-size: 12px;">
                This is an automated notification. Please contact support if you have any questions.
            </p>
        </div>
    </div>
    `;
};