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
  Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'جساس للتقييم'
const LOGO_URL = 'https://vprxcirjtzsxyllqjjyr.supabase.co/storage/v1/object/public/logos/email-logo.png'

const STATUS_LABELS: Record<string, string> = {
  submitted: 'تم استلام الطلب',
  scope_generated: 'نطاق العمل وعرض السعر جاهز',
  scope_approved: 'تم اعتماد النطاق',
  first_payment_confirmed: 'تم تأكيد الدفعة الأولى',
  data_collection_open: 'مرحلة جمع البيانات',
  inspection_pending: 'المعاينة مجدولة',
  inspection_completed: 'تمت المعاينة',
  draft_report_ready: 'مسودة التقرير جاهزة',
  draft_approved: 'تم اعتماد المسودة',
  final_payment_confirmed: 'تم تأكيد الدفعة النهائية',
  issued: 'التقرير النهائي صدر',
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  scope_generated: 'تم إعداد نطاق العمل وعرض السعر. يرجى مراجعته والموافقة عليه من حسابك.',
  first_payment_confirmed: 'شكراً لسداد الدفعة الأولى. بدأنا العمل على طلبك.',
  data_collection_open: 'نحتاج بيانات ومستندات إضافية. يرجى رفعها من حسابك.',
  inspection_pending: 'تم جدولة المعاينة الميدانية. سيتم التنسيق معك لتحديد الموعد.',
  draft_report_ready: 'مسودة التقرير جاهزة لمراجعتك. يرجى الاطلاع عليها وإرسال أي ملاحظات.',
  issued: 'التقرير النهائي جاهز ومتاح للتحميل من حسابك. التقرير موقّع إلكترونياً ومعتمد.',
}

interface StatusUpdateProps {
  clientName?: string
  requestNumber?: string
  newStatus?: string
  portalUrl?: string
}

const StatusUpdateEmail = ({ clientName, requestNumber, newStatus, portalUrl }: StatusUpdateProps) => {
  const statusLabel = newStatus ? (STATUS_LABELS[newStatus] || newStatus) : 'تحديث';
  const description = newStatus ? (STATUS_DESCRIPTIONS[newStatus] || '') : '';

  return (
    <Html lang="ar" dir="rtl">
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet" />
      </Head>
      <Preview>تحديث حالة طلب التقييم - {statusLabel}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="80" height="auto" style={logo} />
          <Heading style={h1}>
            {clientName ? `مرحباً ${clientName}،` : 'مرحباً،'}
          </Heading>
          <Text style={text}>
            تم تحديث حالة طلب التقييم الخاص بك
            {requestNumber ? ` (${requestNumber})` : ''} إلى:
          </Text>
          <Text style={statusBadge}>
            {statusLabel}
          </Text>
          {description && (
            <Text style={text}>
              {description}
            </Text>
          )}
          {portalUrl && (
            <Button href={portalUrl} style={button}>
              متابعة الطلب
            </Button>
          )}
          <Text style={footerText}>
            مع تحيات فريق {SITE_NAME}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: StatusUpdateEmail,
  subject: (data: Record<string, any>) => {
    const label = data.newStatus ? (STATUS_LABELS[data.newStatus] || 'تحديث') : 'تحديث';
    return `تحديث حالة طلبك: ${label}`;
  },
  displayName: 'إشعار تغيّر حالة الطلب',
  previewData: { clientName: 'أحمد', requestNumber: 'VAL-2026-0001', newStatus: 'draft_report_ready', portalUrl: 'https://saudi-valuer-pro.lovable.app/client' },
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
  margin: '0 0 20px',
}
const statusBadge = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: 'hsl(215, 60%, 45%)',
  backgroundColor: 'hsl(215, 60%, 96%)',
  padding: '12px 20px',
  borderRadius: '8px',
  textAlign: 'center' as const,
  margin: '0 0 20px',
}
const button = {
  backgroundColor: 'hsl(215, 60%, 45%)',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'inline-block',
}
const footerText = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
