export function buildEmailVerificationTemplate({ otp, expiryMinutes, companyName = 'Your Company' }) {
  const subject = 'Verify your email address';
  const text = `Your verification OTP is: ${otp}\n\nThis OTP will expire in ${expiryMinutes} minute(s).\n\nFor security reasons, do not share this OTP with anyone.\nIf you did not request this OTP, you can ignore this email.`;
  const html = `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <h2>${companyName}</h2>
    <h3>Verify your email address</h3>
    <p>Your verification OTP is:</p>
    <p style="font-size: 24px; letter-spacing: 4px; font-weight: bold;">${otp}</p>
    <p>This OTP will expire in ${expiryMinutes} minute(s).</p>
    <p style="color: #666; font-size: 12px;">For security reasons, do not share this OTP with anyone.</p>
    <p style="color: #666; font-size: 12px;">If you did not request this OTP, you can ignore this email.</p>
  </div>
  `;

  return { subject, text, html };
}
