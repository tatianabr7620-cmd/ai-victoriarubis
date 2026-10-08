import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

const OWNER_EMAILS = ['tatianabr7620@gmail.com', 'tatianabr2016@yandex.ru', 'tatianabr2015@yandex.ru']
const COURSE_ID = '62e9c3c7-3b2c-41d7-9206-05c03577a89e'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Compute upcoming scheduled dates for the next 90 days
function getSchedule() {
  const entries: { date: Date; type: 'evening' | 'fairy-tale'; label: string; imageUrl: string }[] = []
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() + 90)

  const eveningStart = new Date('2026-10-21T00:00:00Z')
  const fairyStart = new Date('2026-10-22T00:00:00Z')
  const holidayStart = new Date('2026-12-28T00:00:00Z')
  const holidayEnd = new Date('2027-01-10T23:59:59Z')

  const cursor = new Date(eveningStart < now ? now : eveningStart)
  cursor.setUTCHours(16, 0, 0, 0)

  while (cursor <= end) {
    const day = cursor.getUTCDay()
    const inHoliday = cursor >= holidayStart && cursor <= holidayEnd

    // Evening reminder: Mon–Sat at 16:00 UTC
    if (day !== 0 && !inHoliday && cursor >= eveningStart) {
      entries.push({
        date: new Date(cursor),
        type: 'evening',
        label: 'Отчёт про цели',
        imageUrl: `${SUPABASE_URL}/storage/v1/object/public/chat-images/reminders/evening-reminder.jpg`,
      })
    }

    // Fairy-tale: Thursday at 09:05 UTC
    if (day === 4 && !inHoliday && cursor >= fairyStart) {
      const fairyCursor = new Date(cursor)
      fairyCursor.setUTCHours(9, 5, 0, 0)
      entries.push({
        date: fairyCursor,
        type: 'fairy-tale',
        label: 'Волшебная сказка',
        imageUrl: `${SUPABASE_URL}/storage/v1/object/public/chat-images/reminders/fairy-tale-reminder.jpg`,
      })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime())
}

function formatMsk(date: Date) {
  return date.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    weekday: 'short',
  })
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !OWNER_EMAILS.includes(user.email ?? '')) redirect('/login')

  const admin = createAdmin(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY!)
  const { data: sent } = await admin
    .from('chat_messages')
    .select('content, image_url, created_at')
    .eq('course_id', COURSE_ID)
    .eq('tag', 'system')
    .order('created_at', { ascending: false })
    .limit(50)

  const schedule = getSchedule()
  const now = new Date()

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-stone-800">Расписание тренинга</h1>
            <p className="text-xs text-stone-400 mt-0.5">Что выйдет в чате студентов и когда</p>
          </div>
          <a href="/dashboard" className="text-sm text-stone-500 hover:text-stone-700">← Назад</a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">

        {/* Sent history */}
        {sent && sent.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Уже вышло</h2>
            <div className="space-y-3">
              {sent.map((msg, i) => (
                <div key={i} className="bg-white border border-stone-200 rounded-2xl p-4 flex gap-4 items-center">
                  {msg.image_url && (
                    <img src={msg.image_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800">{msg.content}</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {formatMsk(new Date(msg.created_at))} мск
                    </p>
                  </div>
                  <span className="text-xs bg-stone-100 text-stone-500 px-2 py-1 rounded-full flex-shrink-0">Отправлено</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming schedule */}
        <section>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Запланировано</h2>
          <div className="space-y-3">
            {schedule.map((entry, i) => {
              const isPast = entry.date < now
              return (
                <div key={i} className={`bg-white border rounded-2xl p-4 flex gap-4 items-center ${isPast ? 'opacity-50 border-stone-100' : 'border-stone-200'}`}>
                  <img src={entry.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-stone-100" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800">{entry.label}</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {formatMsk(entry.date)} мск
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                    isPast ? 'bg-red-50 text-red-400' : 'bg-green-50 text-green-600'
                  }`}>
                    {isPast ? 'Пропущено?' : 'Запланировано'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
