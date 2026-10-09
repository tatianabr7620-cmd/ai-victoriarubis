'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase puts the session in the URL hash after invite/reset link click.
    // We must wait for PASSWORD_RECOVERY or SIGNED_IN before allowing updateUser.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setReady(true)
      }
    })
    // If session is not established in 5s, the link is expired or invalid
    const timeout = setTimeout(() => setSessionError(true), 5000)
    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase.auth])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) {
      setError('Сессия не установлена. Перейдите по ссылке из письма ещё раз.')
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают')
      return
    }
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }

  if (!ready && !done) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          {sessionError ? (
            <>
              <p className="text-stone-800 font-medium mb-2">Ссылка устарела</p>
              <p className="text-stone-500 text-sm">Ссылка действует 24 часа. Напишите нам — пришлём новую.</p>
            </>
          ) : (
            <p className="text-stone-500 text-sm">Проверяем ссылку...</p>
          )}
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-xl text-stone-800 mb-2">Пароль установлен</p>
          <p className="text-stone-500 text-sm">Перехожу в курс...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-stone-800 mb-2 text-center">Установите пароль</h1>
        <p className="text-stone-500 text-sm text-center mb-8">Придумайте пароль для входа в курс</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Новый пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
              placeholder="Минимум 8 символов"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Повторите пароль</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Сохраняю...' : 'Войти в курс'}
          </button>
        </form>
      </div>
    </div>
  )
}
