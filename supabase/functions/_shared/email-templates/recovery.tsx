/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <html lang="ar" dir="rtl">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>إعادة تعيين كلمة المرور</title>
    </head>
    <body style={{ margin: 0, padding: 0, backgroundColor: '#f5f7fb', fontFamily: "Arial, sans-serif" }}>
      <table role="presentation" width="100%" cellSpacing={0} cellPadding={0} style={{ backgroundColor: '#f5f7fb', padding: '30px 15px' }}>
        <tbody>
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellSpacing={0} cellPadding={0} style={{ maxWidth: '600px', background: '#ffffff', borderRadius: '12px', padding: '40px 30px' }}>
                <tbody>
                  <tr>
                    <td align="center" style={{ paddingBottom: '20px' }}>
                      <h1 style={{ margin: 0, fontSize: '32px', color: '#111827' }}>إعادة تعيين كلمة المرور</h1>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style={{ paddingBottom: '20px' }}>
                      <p style={{ margin: 0, fontSize: '18px', lineHeight: '1.8', color: '#374151' }}>
                        تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك في جساس للتقييم.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style={{ padding: '20px 0 30px 0' }}>
                      {/* Table-based button for maximum email client compatibility */}
                      <table role="presentation" cellSpacing={0} cellPadding={0} style={{ margin: '0 auto' }}>
                        <tbody>
                          <tr>
                            <td align="center" style={{ backgroundColor: '#2563eb', borderRadius: '10px' }}>
                              <a
                                href={confirmationUrl}
                                target="_blank"
                                style={{
                                  backgroundColor: '#2563eb',
                                  borderRadius: '10px',
                                  color: '#ffffff',
                                  display: 'inline-block',
                                  fontSize: '18px',
                                  fontWeight: 'bold',
                                  lineHeight: 1,
                                  textDecoration: 'none',
                                  padding: '16px 32px',
                                }}
                              >
                                إعادة تعيين كلمة المرور
                              </a>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="right" style={{ paddingBottom: '10px' }}>
                      <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.8', color: '#6b7280' }}>
                        إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="left" dir="ltr" style={{ paddingBottom: '25px' }}>
                      <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.8', wordBreak: 'break-all' as const, color: '#2563eb' }}>
                        <a href={confirmationUrl} style={{ color: '#2563eb', textDecoration: 'underline' }}>{confirmationUrl}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
                      <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.8', color: '#9ca3af' }}>
                        إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style={{ paddingTop: '25px' }}>
                      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.8', color: '#9ca3af' }}>
                        Reset your password using the button above. If it doesn't work, use the link shown in this email.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </body>
  </html>
)

export default RecoveryEmail
