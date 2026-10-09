import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!
const SITE_URL = 'https://tbritenkova.com'

export async function POST(req: NextRequest) {
  const body = await req.text()

  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(body)
  } catch {
    // Prodamus sometimes sends form-urlencoded without Content-Type header
    try {
      const params = new URLSearchParams(body)
      for (const [key, value] of params.entries()) {
        try { data[key] = JSON.parse(value) } catch { data[key] = value }
      }
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
  }

  const paymentStatus = data['payment_status'] as string
  const customerEmail = data['customer_email'] as string
  const customerName = (data['customer_name'] as string) ?? ''
  const orderId = (data['order_id'] as string) ?? ''
  const sum = (data['sum'] as string) ?? ''

  if (paymentStatus !== 'success' && paymentStatus !== 'paid') {
    return NextResponse.json({ ok: true, skipped: true })
  }
  if (!customerEmail) {
    return NextResponse.json({ error: 'No customer_email' }, { status: 400 })
  }

  // Only create accounts for "Денежный Дзен" products
  const products = data['products']
  let productNames = ''
  if (Array.isArray(products)) {
    productNames = products.map((p: { name?: string }) => p.name ?? '').join(' ')
  }
  if (!productNames.toLowerCase().includes('денежный дзен')) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_dzen_product' })
  }

  const supabase = createAdminClient()
  const redirectTo = `${SITE_URL}/update-password`

  // Check if user exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const exists = existingUsers?.users?.find(u => u.email === customerEmail)

  // Create user if new
  if (!exists) {
    const { error: createError } = await supabase.auth.admin.createUser({
      email: customerEmail,
      email_confirm: true,
      user_metadata: { invited_via: 'prodamus', order_id: orderId, order_sum: sum },
    })
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
  }

  // Generate recovery link (works for both new and existing users)
  const actionLink = await generateActionLink(customerEmail, 'recovery', redirectTo)
  if (!actionLink) {
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 })
  }

  // Enroll user in the course (upsert to avoid duplicates)
  const courseId = '62e9c3c7-3b2c-41d7-9206-05c03577a89e'
  const { data: userData } = await supabase.auth.admin.getUserByEmail(customerEmail)
  if (userData?.user) {
    await supabase.from('enrollments').upsert(
      { user_id: userData.user.id, course_id: courseId },
      { onConflict: 'user_id,course_id' }
    )
  }

  await sendAccessEmail(customerEmail, customerName, actionLink, exists ? 'reset' : 'invite')
  return NextResponse.json({ ok: true, action: exists ? 'reset' : 'invited' })
}

async function generateActionLink(
  email: string,
  type: string,
  redirectTo: string,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    type,
    email,
    options: { redirect_to: redirectTo },
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as Record<string, unknown>
  const raw = json['action_link'] as string | undefined
  if (!raw) return null

  // Replace redirect_to param — Supabase uses its own site_url (may be localhost)
  return raw.replace(/redirect_to=[^&]+/, `redirect_to=${encodeURIComponent(redirectTo)}`)
}

async function sendAccessEmail(
  email: string,
  name: string,
  link: string,
  type: 'invite' | 'reset',
) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const resend = new Resend(resendKey)
  const firstName = name.split(' ')[1] ?? name.split(' ')[0] ?? ''
  const greeting = firstName ? `Привет, ${firstName}!` : 'Привет!'

  await resend.emails.send({
    from: 'Татьяна Бритенкова <no-reply@tbritenkova.com>',
    to: email,
    subject: 'Ваш доступ к курсу «Денежный Дзен»',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1c1c1c;">
        <p style="font-size: 18px;">${greeting}</p>
        <p>${type === 'invite'
          ? 'Спасибо за оплату. Ваш доступ к курсу <strong>«Денежный Дзен»</strong> готов.'
          : 'Вот ваша ссылка для входа в курс <strong>«Денежный Дзен»</strong>.'
        }</p>
        <p>Нажмите кнопку ниже, чтобы войти и установить пароль:</p>
        <p style="margin: 32px 0;">
          <a href="${link}" style="background: #1c1c1c; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px;">
            Войти в курс
          </a>
        </p>
        <p style="color: #888; font-size: 13px;">Ссылка действует 24 часа.</p>
        <p style="color: #888; font-size: 13px;">Ваш логин: ${email}</p>
      </div>
    `,
  })
}
