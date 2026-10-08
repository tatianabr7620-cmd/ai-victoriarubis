import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const COURSE_ID = '62e9c3c7-3b2c-41d7-9206-05c03577a89e'
const IMAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat-images/reminders/evening-reminder.jpg`

// Runs at 16:00 UTC = 19:00 MSK, Mon–Sat
export async function GET(req: Request) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only run from 21 October 2026 onwards
  const now = new Date()
  const start = new Date('2026-10-21T00:00:00Z')
  if (now < start) {
    return NextResponse.json({ skipped: 'Before start date' })
  }

  // Skip Sunday (0 = Sunday in JS)
  const dayUTC = now.getUTCDay()
  if (dayUTC === 0) {
    return NextResponse.json({ skipped: 'Sunday' })
  }

  // Skip winter holidays 28 Dec 2026 – 10 Jan 2027
  const holidays = { start: new Date('2026-12-28T00:00:00Z'), end: new Date('2027-01-10T23:59:59Z') }
  if (now >= holidays.start && now <= holidays.end) {
    return NextResponse.json({ skipped: 'Holidays' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // Post as a system message (null user_id means it's from the platform)
  const { error } = await supabase.from('chat_messages').insert({
    course_id: COURSE_ID,
    user_id: null,
    content: 'Отчёт про цели',
    image_url: IMAGE_URL,
    tag: 'system',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
