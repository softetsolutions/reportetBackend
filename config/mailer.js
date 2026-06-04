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

export default async function sendMail(subject, employeeId, password, to) {
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
                    <strong>Employee ID:</strong> ${employeeId}
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
