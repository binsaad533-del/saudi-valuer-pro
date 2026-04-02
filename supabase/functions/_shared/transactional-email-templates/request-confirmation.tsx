/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'جساس للتقييم'
const LOGO_URL = 'https://vprxcirjtzsxyllqjjyr.supabase.co/storage/v1/object/public/logos/email-logo.png'

interface RequestConfirmationProps {
  clientName?: string
  requestNumber?: string
}

const RequestConfirmationEmail = ({ clientName, requestNumber }: RequestConfirmationProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تم استلام طلب التقييم - {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={SITE_NAME} width="140" height="auto" style={logo} />
        <Heading style={h1}>
          {clientName ? `مرحباً ${clientName}،` : 'مرحباً،'}
        </Heading>
        <Text style={text}>
          تم استلام طلب التقييم الخاص بك بنجاح
          {requestNumber ? ` برقم مرجعي: ${requestNumber}` : ''}.
          سيتم مراجعته من قبل فريقنا والتواصل معك قريباً.
        </Text>
        <Text style={text}>
          يمكنك متابعة حالة طلبك من خلال حسابك في المنصة.
        </Text>
        <Text style={footerText}>
          مع تحيات فريق {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: RequestConfirmationEmail,
  subject: 'تم استلام طلب التقييم الخاص بك',
  displayName: 'تأكيد استلام طلب التقييم',
  previewData: { clientName: 'أحمد', requestNumber: 'VAL-2026-0001' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Cairo', 'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px', textAlign: 'right' as const }
const logo = { margin: '0 0 24px 0' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(215, 30%, 18%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(215, 15%, 52%)',
  lineHeight: '1.7',
  margin: '0 0 25px',
}
const footerText = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
