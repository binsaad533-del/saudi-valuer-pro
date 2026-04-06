/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

const LOGO_URL = 'https://vprxcirjtzsxyllqjjyr.supabase.co/storage/v1/object/public/logos/email-logo.png'

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>إعادة تعيين كلمة المرور - جساس للتقييم</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="جساس للتقييم" width="80" height="auto" style={logo} />

        <Heading style={h1}>إعادة تعيين كلمة المرور</Heading>

        <Text style={text}>
          تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك في جساس للتقييم.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>
            إعادة تعيين كلمة المرور
          </Button>
        </Section>

        <Text style={fallbackText}>
          إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:
        </Text>
        <Text style={linkText}>
          <Link href={confirmationUrl} style={linkStyle}>{confirmationUrl}</Link>
        </Text>

        <Hr style={hr} />

        <Text style={disclaimer}>
          إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان.
          لن يتم تغيير كلمة مرورك.
        </Text>

        <Text style={disclaimerEn}>
          Reset your password using the button above.
          If the button doesn't work, copy and paste the link into your browser.
          If you didn't request a password reset, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: "'Cairo', 'Inter', Arial, sans-serif",
}

const container: React.CSSProperties = {
  padding: '40px 24px',
  maxWidth: '520px',
  margin: '0 auto',
  textAlign: 'right',
}

const logo: React.CSSProperties = { margin: '0 0 28px 0' }

const h1: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: 'hsl(215, 30%, 18%)',
  margin: '0 0 16px',
}

const text: React.CSSProperties = {
  fontSize: '15px',
  color: 'hsl(215, 15%, 40%)',
  lineHeight: '1.8',
  margin: '0 0 28px',
}

const buttonSection: React.CSSProperties = {
  textAlign: 'center',
  margin: '8px 0 28px',
}

const button: React.CSSProperties = {
  backgroundColor: 'hsl(212, 60%, 50%)',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  borderRadius: '10px',
  padding: '16px 48px',
  textDecoration: 'none',
  display: 'inline-block',
}

const fallbackText: React.CSSProperties = {
  fontSize: '13px',
  color: 'hsl(215, 15%, 52%)',
  lineHeight: '1.6',
  margin: '0 0 8px',
}

const linkText: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.4',
  margin: '0 0 24px',
  wordBreak: 'break-all',
  direction: 'ltr',
  textAlign: 'left',
}

const linkStyle: React.CSSProperties = {
  color: 'hsl(212, 60%, 50%)',
  textDecoration: 'underline',
}

const hr: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
}

const disclaimer: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  lineHeight: '1.8',
  margin: '0 0 16px',
}

const disclaimerEn: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  lineHeight: '1.8',
  margin: '0',
  direction: 'ltr',
  textAlign: 'left',
}
