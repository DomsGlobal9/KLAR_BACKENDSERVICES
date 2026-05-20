export const otpEmailTemplate = (
    otp: string
) => {
    return `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      
      <h2>OTP Verification</h2>

      <p>Your OTP for verification is:</p>

      <div
        style="
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 5px;
          margin: 20px 0;
          color: #2563eb;
        "
      >
        ${otp}
      </div>

      <p>
        This OTP will expire in 5 minutes.
      </p>

      <p>
        If you did not request this OTP,
        please ignore this email.
      </p>

    </div>
  `;
};