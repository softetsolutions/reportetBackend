import dotenv from "dotenv";
dotenv.config();
import { BrevoClient } from "@getbrevo/brevo";

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
  timeoutInSeconds: 30,
  maxRetries: 3,
});

// The payload example of sendmail payload
// subject: 'Hello from Brevo!',
// htmlContent: '<html><body><p>Hello,</p><p>This is my first transactional email.</p></body></html>',
// sender: { name: 'Alex from Brevo', email: 'hello@brevo.com' },
// to: [{ email: 'johndoe@example.com', name: 'John Doe' }],

export  async function sendMail(subject, userName, password, to) {
  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: subject,
      htmlContent: `
      
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Employee Onboarding</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#111827; padding:20px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:24px;">
                Welcome Onboard
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px 30px; color:#333333;">

              <p style="font-size:16px; margin-bottom:20px;">
                Hi,
              </p>

              <p style="font-size:16px; line-height:24px; margin-bottom:30px;">
                Please find your onboarding details below:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:20px;">
                <tr>
                  <td style="padding:10px 0; font-size:15px;">
                    <strong>Username:</strong> ${userName}
                  </td>
                </tr>

                <tr>
                  <td style="padding:10px 0; font-size:15px;">
                    <strong>Password:</strong> ${password}
                  </td>
                </tr>
              </table>

              <p style="font-size:16px; line-height:24px; margin-top:30px;">
                Please sign in to the application and start reporting.
              </p>

              <!-- Button -->
              <!--<table cellpadding="0" cellspacing="0" style="margin-top:30px;">-->
              <!--  <tr>-->
              <!--    <td align="center" bgcolor="#2563eb" style="border-radius:6px;">-->
              <!--      <a href="https://yourapp.com/login"-->
              <!--         style="display:inline-block; padding:14px 28px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold;">-->
              <!--        Login to App-->
              <!--      </a>-->
              <!--    </td>-->
              <!--  </tr>-->
              <!--</table>-->

              <p style="font-size:14px; color:#6b7280; margin-top:40px;">
                If you face any issues while logging in, please contact the administrator.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f3f4f6; padding:20px; text-align:center; font-size:13px; color:#6b7280;">
              © 2026 Softet Solutions. All rights reserved.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`,
      sender: { name: "Reportet", email: "support@softetsolutions.com" },
      to: to,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      console.error("Invalid API key");
    } else if (err instanceof TooManyRequestsError) {
      const retryAfter = err.rawResponse.headers["retry-after"];
      console.error(`Rate limited. Retry after ${retryAfter}s`);
    } else if (err instanceof BrevoError) {
      console.error(`API error ${err.statusCode}:`, err.message);
    }
  }
}



export  async function sendForgotPasswordMail(resetUrl, to) {
  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: "Reset Your Reportet Account Password",

      htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Password Reset</title>
</head>

<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;">

<!-- Header -->
<tr>
<td style="background:#111827;padding:25px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:28px;">
Password Reset Request
</h1>
</td>
</tr>

<!-- Content -->
<tr>
<td style="padding:40px 35px;color:#333333;">

<p style="font-size:16px;margin-top:0;">
Hello,
</p>

<p style="font-size:16px;line-height:26px;">
We received a request to reset the password associated with your
<strong>Reportet</strong> account.
</p>

<p style="font-size:16px;line-height:26px;">
Click the button below to create a new password.
For your security, this link will expire in
<strong>60 minutes</strong>.
</p>

<table cellpadding="0" cellspacing="0" align="center" style="margin:35px auto;">
<tr>
<td bgcolor="#2563EB" style="border-radius:6px;">
<a href="${resetUrl}"
style="display:inline-block;padding:15px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">
Reset Password
</a>
</td>
</tr>
</table>

<p style="font-size:15px;line-height:24px;">
If the button above doesn't work, copy and paste the following link into your browser:
</p>

<p style="word-break:break-word;color:#2563EB;font-size:14px;">
${resetUrl}
</p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:35px 0;">

<p style="font-size:15px;line-height:24px;">
If you did not request a password reset, you can safely ignore this email.
Your account will remain secure, and no changes will be made.
</p>

<p style="font-size:15px;line-height:24px;">
For security reasons, please do not share this email or reset link with anyone.
</p>

<p style="margin-top:40px;font-size:16px;">
Thank you,<br>
<strong>Reportet Support Team</strong>
</p>

</td>
</tr>

<!-- Footer -->
<tr>
<td style="background:#f3f4f6;padding:20px;text-align:center;color:#6b7280;font-size:13px;">
© 2026 Softet Solutions. All rights reserved.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
      `,

      sender: {
        name: "Reportet",
        email: "support@softetsolutions.com",
      },

      to,
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    throw err;
  }
}


