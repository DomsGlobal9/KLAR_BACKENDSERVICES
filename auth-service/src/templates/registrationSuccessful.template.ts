export const registrationSuccessEmailTemplate = (
    userEmail: string,
    userPassword: string,
    userRole: string
) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <!-- Header -->
      <div style="background-color: #1e3a8a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to B2B Travel Portal</h1>
        <p style="color: #bfdbfe; margin: 10px 0 0 0;">Your Account Has Been Successfully Created</p>
      </div>
      
      <!-- Body -->
      <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        
        <!-- Greeting -->
        <div style="margin-bottom: 25px;">
          <p style="font-size: 16px; color: #374151; margin: 0;">Welcome to our B2B Travel Platform! We're excited to have you on board.</p>
        </div>

        <!-- Login Credentials Section -->
        <div style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 25px; background-color: #fefce8;">
          <h3 style="color: #1e3a8a; margin: 0 0 15px 0; font-size: 18px; text-align: center;">🔐 Your Login Credentials</h3>
          
          <div style="margin-bottom: 15px;">
            <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">EMAIL ADDRESS</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${userEmail}</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">PASSWORD</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${userPassword}</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">ROLE</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${userRole}</p>
            </div>
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
            </p>
          </div>
        </div>

        <!-- Login Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://klartravels.com/b2b'}" 
             style="background-color: #2563eb; 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 6px; 
                    font-weight: 600;
                    display: inline-block;
                    font-size: 16px;">
            Login to Your Account
          </a>
        </div>

        <!-- Security Notice -->
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px; border-radius: 4px; margin-bottom: 25px;">
          <p style="margin: 0; font-size: 14px; color: #166534;">
            <strong>🔒 Security Tips:</strong>
          </p>
          <ul style="margin: 8px 0 0 20px; color: #166534; font-size: 14px;">
            <li>Never share your password with anyone</li>
            <li>Use a strong, unique password</li>
            <li>Enable two-factor authentication if available</li>
            <li>Contact support immediately if you notice any suspicious activity</li>
          </ul>
        </div>

        <!-- Support Information -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
          <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">
            <strong>Need help?</strong> Contact our support team at:
          </p>
          <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">
            📧 Email: <a href="mailto:support@b2btravel.com" style="color: #2563eb; text-decoration: none;">support@b2btravel.com</a>
          </p>
          <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">
            📞 Phone: +91 1234567890
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            This is an automated message, please do not reply to this email.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">
            © 2024 B2B Travel Portal. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;
};