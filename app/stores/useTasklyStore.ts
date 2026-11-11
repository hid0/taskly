import { defineStore } from 'pinia'

export interface AuthUser {
  id: string
  username: string
  name: string
}

export interface Category {
  id: string
  name: string
  color: string
  createdAt?: string | null
}

export interface DailyItem {
  id: string
  parentId: string | null
  date: string
  type: 'task' | 'note' | 'event'
  title: string
  isCompleted: boolean
  categoryId: string | null
  estimatedSessions: number
  completedSessions: number
  loggedSeconds: number
  sortOrder: number
  createdAt?: string | null
}

export interface StructuredParentItem extends DailyItem {
  children: DailyItem[]
}

export interface TasklyDayResponse {
  categories: Category[]
  items: DailyItem[]
  yesterdayDate?: string
  yesterdayUndoneCount?: number
  yesterdayUndoneTitles?: string[]
}

interface SharedTimerState {
  activeTaskId: string | null
  startedAt: number | null
  baseLoggedSeconds: number
  timerMode: 'work' | 'break_prompt' | 'break'
  breakDurationSeconds: number
  breakStartedAt: number | null
  lastCompletedTaskId: string | null
  date: string
  updatedAt: number
}

const STORAGE_DARK_MODE_KEY = 'taskly_dark_mode_pref'
const STORAGE_TIMER_SYNC_KEY = 'taskly_shared_timer_v1'
const STORAGE_TARGET_SESSIONS_KEY = 'taskly_target_sessions'
const STORAGE_COLLAPSED_PARENTS_KEY = 'taskly_collapsed_parents'
const STORAGE_DISMISSED_REMINDERS_KEY = 'taskly_dismissed_reminders_v2'

function getLocalTodayString(d = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const useTasklyStore = defineStore('taskly', () => {
  // AUTH STATE
  const authUser = ref<AuthUser | null>(null)
  const isAuthChecking = ref(true)

  // UI & FILTER STATE
  const selectedDate = ref<string>(getLocalTodayString())
  const dailyTargetSessions = ref<number>(16)
  const isDarkMode = ref<boolean>(true)
  const selectedCategoryFilter = ref('all')
  const collapsedParentIds = ref<string[]>([])

  // REMINDER STATE
  const yesterdayUndoneCount = ref(0)
  const yesterdayUndoneTitles = ref<string[]>([])
  const dismissedReminderDates = ref<string[]>([])
  const isCopyingYesterday = ref(false)

  const showYesterdayReminder = computed(() => {
    return (
      yesterdayUndoneCount.value > 0 &&
      !dismissedReminderDates.value.includes(selectedDate.value)
    )
  })

  const categories = ref<Category[]>([])
  const items = ref<DailyItem[]>([])
  const isLoading = ref(false)
  const lastFocusFinishedAt = ref<number | null>(null)

  // POMODORO & BREAK TIMER STATE (Disinkronkan lintas tab via localStorage & BroadcastChannel)
  const activeTaskId = ref<string | null>(null)
  const lastCompletedTaskId = ref<string | null>(null)
  const timerMode = ref<'work' | 'break_prompt' | 'break'>('work')
  const breakDurationSeconds = ref(5 * 60)
  const breakRemainingSeconds = ref(0)
  const isBreakRunning = ref(false)

  let timerStartedAt: number | null = null
  // Track last update timestamp for shared timer state to avoid stale overwrites
  let lastSharedTimerUpdatedAt = 0
  let timerBaseLoggedSeconds = 0
  let breakStartedAt: number | null = null
  let tickerInterval: ReturnType<typeof setInterval> | null = null
  let lastDbSyncSecond = -1
  let broadcastChannel: BroadcastChannel | null = null

  const POMODORO_SECONDS = 25 * 60 // 25 menit per sesi (1500 detik)

  const activeTask = computed(() =>
    items.value.find(i => i.id === activeTaskId.value) || null
  )

  const lastCompletedTask = computed(() =>
    items.value.find(i => i.id === lastCompletedTaskId.value) || null
  )

  const mainTimerSecondsRemaining = computed(() => {
    if (timerMode.value === 'break') {
      return breakRemainingSeconds.value
    }
    if (!activeTask.value) return POMODORO_SECONDS
    const elapsedInCurrentSession = activeTask.value.loggedSeconds % POMODORO_SECONDS
    return POMODORO_SECONDS - elapsedInCurrentSession
  })

  const mainTimerFormatted = computed(() => {
    if (timerMode.value === 'break') {
      const rem = breakRemainingSeconds.value
      const m = String(Math.floor(rem / 60)).padStart(2, '0')
      const s = String(rem % 60).padStart(2, '0')
      return `${m}:${s}`
    }
    if (timerMode.value === 'break_prompt') {
      return '00:00'
    }
    if (!activeTask.value) return '25:00'
    const rem = mainTimerSecondsRemaining.value
    const m = String(Math.floor(rem / 60)).padStart(2, '0')
    const s = String(rem % 60).padStart(2, '0')
    return `${m}:${s}`
  })

  const mainTimerProgress = computed(() => {
    if (timerMode.value === 'break') {
      if (breakDurationSeconds.value <= 0) return 0
      return (breakRemainingSeconds.value / breakDurationSeconds.value) * 100
    }
    if (timerMode.value === 'break_prompt') return 0
    if (!activeTask.value) return 100
    const elapsedInCurrentSession = activeTask.value.loggedSeconds % POMODORO_SECONDS
    return ((POMODORO_SECONDS - elapsedInCurrentSession) / POMODORO_SECONDS) * 100
  })

  // --- PERSISTENCE & MULTI-TAB SYNC ENGINE ---
  function postBroadcast(message: Record<string, any>) {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage(message)
      } catch {
        // Ignore broadcast error
      }
    }
  }

  function saveSharedTimerState() {
    if (typeof window === 'undefined') return
    const state: SharedTimerState = {
      activeTaskId: activeTaskId.value,
      startedAt: timerStartedAt,
      baseLoggedSeconds: timerBaseLoggedSeconds,
      timerMode: timerMode.value,
      breakDurationSeconds: breakDurationSeconds.value,
      breakStartedAt,
      lastCompletedTaskId: lastCompletedTaskId.value,
      date: selectedDate.value,
      updatedAt: Date.now()
    }
    window.localStorage.setItem(STORAGE_TIMER_SYNC_KEY, JSON.stringify(state))
    postBroadcast({ type: 'TIMER_STATE', state })
  }

  function applySharedTimerState(state: SharedTimerState) {
    if (state.date && state.date !== selectedDate.value) {
      selectedDate.value = state.date
    }
    timerMode.value = state.timerMode || 'work'
    lastCompletedTaskId.value = state.lastCompletedTaskId || null
    breakDurationSeconds.value = state.breakDurationSeconds || 300
    breakStartedAt = state.breakStartedAt || null

    activeTaskId.value = state.activeTaskId || null
    timerStartedAt = state.startedAt || null
    timerBaseLoggedSeconds = state.baseLoggedSeconds || 0

    if (timerMode.value === 'work' && activeTaskId.value && timerStartedAt) {
      isBreakRunning.value = false
      tickTimerNow(false)
      ensureTickerRunning()
    } else if (timerMode.value === 'break' && breakStartedAt) {
      isBreakRunning.value = true
      tickTimerNow(false)
      ensureTickerRunning()
    } else {
      isBreakRunning.value = false
      stopTickerInterval()
    }
  }

  function loadSharedTimerFromStorage() {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(STORAGE_TIMER_SYNC_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as SharedTimerState
      applySharedTimerState(parsed)
    } catch {
      // Ignore invalid json
    }
  }

  function initClientSync() {
    if (typeof window === 'undefined') return

    // 1. Load Dark Mode dari localStorage secara eksplisit setelah mount (anti-hydration reset)
    const savedDark = window.localStorage.getItem(STORAGE_DARK_MODE_KEY)
    if (savedDark !== null) {
      isDarkMode.value = savedDark === 'true'
    } else {
      window.localStorage.setItem(STORAGE_DARK_MODE_KEY, String(isDarkMode.value))
    }

    // 2. Load Target Sessions, Collapsed Parents, & Dismissed Reminders
    const savedTarget = window.localStorage.getItem(STORAGE_TARGET_SESSIONS_KEY)
    if (savedTarget) dailyTargetSessions.value = Number(savedTarget) || 16

    const savedCollapsed = window.localStorage.getItem(STORAGE_COLLAPSED_PARENTS_KEY)
    if (savedCollapsed) {
      try {
        collapsedParentIds.value = JSON.parse(savedCollapsed)
      } catch {}
    }

    const savedDismissed = window.localStorage.getItem(STORAGE_DISMISSED_REMINDERS_KEY)
    if (savedDismissed) {
      try {
        dismissedReminderDates.value = JSON.parse(savedDismissed)
      } catch {}
    }

    // 3. Setup BroadcastChannel & Storage Listener untuk sinkronisasi antar Tab
    if ('BroadcastChannel' in window && !broadcastChannel) {
      broadcastChannel = new BroadcastChannel('taskly_multi_tab_sync')
      broadcastChannel.onmessage = (ev) => {
        const msg = ev.data
        if (!msg) return
        if (msg.type === 'DARK_MODE') {
          isDarkMode.value = Boolean(msg.value)
        } else if (msg.type === 'TIMER_STATE' && msg.state) {
          applySharedTimerState(msg.state)
        } else if (msg.type === 'DATA_UPDATED') {
          fetchDayData(selectedDate.value, false)
        } else if (msg.type === 'AUTH_CHANGED') {
          checkAuth()
        }
      }
    }

    window.addEventListener('storage', (ev) => {
      if (ev.key === STORAGE_DARK_MODE_KEY && ev.newValue !== null) {
        isDarkMode.value = ev.newValue === 'true'
      } else if (ev.key === STORAGE_TIMER_SYNC_KEY && ev.newValue) {
        try {
          applySharedTimerState(JSON.parse(ev.newValue))
        } catch {}
      }
    })

    // Saat tab akan ditutup, simpan detik terakhir ke DB tanpa mematikan timer di tab lain
    window.addEventListener('beforeunload', () => {
      if (activeTaskId.value && timerMode.value === 'work') {
        const task = items.value.find(i => i.id === activeTaskId.value)
        if (task) {
          // Update baseLoggedSeconds terbaru di localStorage agar tab baru tetap akurat
          timerBaseLoggedSeconds = task.loggedSeconds
          timerStartedAt = Date.now()
          saveSharedTimerState()
        }
      }
    })
  }

  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_DARK_MODE_KEY, String(isDarkMode.value))
    }
    postBroadcast({ type: 'DARK_MODE', value: isDarkMode.value })
  }

  function setDailyTargetSessions(val: number) {
    dailyTargetSessions.value = Math.max(1, val)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_TARGET_SESSIONS_KEY, String(dailyTargetSessions.value))
    }
  }

  function toggleSubitemsCollapse(parentId: string) {
    const idx = collapsedParentIds.value.indexOf(parentId)
    if (idx === -1) {
      collapsedParentIds.value.push(parentId)
    } else {
      collapsedParentIds.value.splice(idx, 1)
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        STORAGE_COLLAPSED_PARENTS_KEY,
        JSON.stringify(collapsedParentIds.value)
      )
    }
  }

  function isParentCollapsed(parentId: string) {
    return collapsedParentIds.value.includes(parentId)
  }

  // --- AUDIO CHIMES ---
  function playChime(notes: number[]) {
    if (typeof window === 'undefined') return
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15)
        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.45)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + idx * 0.15)
        osc.stop(ctx.currentTime + idx * 0.15 + 0.45)
      })
    } catch {}
  }

  function playSessionCompleteChime() {
    playChime([523.25, 659.25, 783.99, 1046.5])
  }

  function playBreakFinishedChime() {
    playChime([783.99, 659.25, 783.99, 1046.5])
  }

  // --- AUTHENTICATION ACTIONS ---
  async function checkAuth() {
    isAuthChecking.value = true
    try {
      const res = await $fetch<{ authenticated: boolean; user: AuthUser | null }>('/api/auth/me')
      authUser.value = res.authenticated ? res.user : null
      if (authUser.value) {
        await fetchDayData(selectedDate.value, false)
        loadSharedTimerFromStorage()
      }
    } catch {
      authUser.value = null
    } finally {
      isAuthChecking.value = false
    }
  }

  async function login(username: string, password: string) {
    const res = await $fetch<{ authenticated: boolean; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    })
    authUser.value = res.user
    postBroadcast({ type: 'AUTH_CHANGED' })
    await fetchDayData(selectedDate.value, false)
    loadSharedTimerFromStorage()
  }

  async function logout() {
    stopTimer()
    stopBreak()
    await $fetch('/api/auth/logout', { method: 'POST' })
    authUser.value = null
    items.value = []
    postBroadcast({ type: 'AUTH_CHANGED' })
  }

  async function updateCredentials(username: string, newPassword?: string) {
    const res = await $fetch<{ success: boolean; username: string }>('/api/auth/password', {
      method: 'PATCH',
      body: { username, newPassword }
    })
    if (authUser.value && res.username) {
      authUser.value.username = res.username
    }
    return res
  }

  // --- 1. FETCH DATA DARI D1 (/api/taskly) ---
  async function fetchDayData(date = selectedDate.value, restoreTimer = true) {
    if (!authUser.value) return
    isLoading.value = true
    try {
      const data = await $fetch<TasklyDayResponse>('/api/taskly', { query: { date } })
      categories.value = data.categories
      items.value = data.items
      yesterdayUndoneCount.value = data.yesterdayUndoneCount || 0
      yesterdayUndoneTitles.value = data.yesterdayUndoneTitles || []

      if (restoreTimer) {
        loadSharedTimerFromStorage()
      } else if (activeTaskId.value && timerMode.value === 'work' && timerStartedAt) {
        tickTimerNow(false)
      }
    } catch (err: any) {
      if (err?.statusCode === 401) {
        authUser.value = null
      }
    } finally {
      isLoading.value = false
    }
  }

  async function copyUndoneFromYesterday() {
    if (isCopyingYesterday.value) return
    isCopyingYesterday.value = true
    try {
      const res = await $fetch<{ copiedCount: number; items: DailyItem[] }>(
        '/api/items/copy-yesterday',
        {
          method: 'POST',
          body: { date: selectedDate.value }
        }
      )
      if (res.items?.length) {
        items.value.push(...res.items)
      }
      yesterdayUndoneCount.value = 0
      yesterdayUndoneTitles.value = []
      postBroadcast({ type: 'DATA_UPDATED' })
    } finally {
      isCopyingYesterday.value = false
    }
  }

  function dismissYesterdayReminder() {
    if (!dismissedReminderDates.value.includes(selectedDate.value)) {
      dismissedReminderDates.value.push(selectedDate.value)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          STORAGE_DISMISSED_REMINDERS_KEY,
          JSON.stringify(dismissedReminderDates.value)
        )
      }
    }
  }

  watch(selectedDate, (newDate) => {
    fetchDayData(newDate, true)
  })

  // --- 2. POMODORO & BREAK TICKER ENGINE (SHARED ACROSS ALL TABS) ---
  function stopTickerInterval() {
    if (tickerInterval) {
      clearInterval(tickerInterval)
      tickerInterval = null
    }
  }

  function ensureTickerRunning() {
    if (tickerInterval) return
    tickerInterval = setInterval(() => {
      tickTimerNow(true)
    }, 1000)
  }

  function tickTimerNow(allowDbSync = true) {
    // A. Mode Kerja (Pomodoro 25 Menit)
    if (timerMode.value === 'work' && activeTaskId.value && timerStartedAt) {
      const task = items.value.find(i => i.id === activeTaskId.value)
      if (!task) return

      const elapsedSec = Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000))
      const nextSeconds = timerBaseLoggedSeconds + elapsedSec
      const prevSessions = Math.floor(timerBaseLoggedSeconds / POMODORO_SECONDS)
      const nextSessions = Math.floor(nextSeconds / POMODORO_SECONDS)

      // Cek apakah sudah mencapai batas 25 menit (1 sesi selesai)
      if (nextSessions > prevSessions) {
        const exactBoundarySeconds = (prevSessions + 1) * POMODORO_SECONDS
        task.loggedSeconds = exactBoundarySeconds
        task.completedSessions = prevSessions + 1

        const finishedId = task.id
        stopTickerInterval()
        lastCompletedTaskId.value = finishedId
        activeTaskId.value = null
        timerStartedAt = null
        timerBaseLoggedSeconds = exactBoundarySeconds
        lastFocusFinishedAt.value = Date.now()
        timerMode.value = 'break_prompt'

        saveSharedTimerState()
        if (allowDbSync) {
          syncTaskToDb(
            finishedId,
            {
              loggedSeconds: task.loggedSeconds,
              completedSessions: task.completedSessions
            },
            false
          )
        }
        playSessionCompleteChime()
        return
      }

      task.loggedSeconds = nextSeconds
      task.completedSessions = nextSessions

      // Sync berkala ke DB setiap 15 detik
      if (allowDbSync && nextSeconds % 15 === 0 && lastDbSyncSecond !== nextSeconds) {
        lastDbSyncSecond = nextSeconds
        syncTaskToDb(
          task.id,
          {
            loggedSeconds: task.loggedSeconds,
            completedSessions: task.completedSessions
          },
          false
        )
      }
      return
    }

    // B. Mode Break / Peregangan (5m atau 10m)
    if (timerMode.value === 'break' && breakStartedAt) {
      const elapsedBreak = Math.max(0, Math.floor((Date.now() - breakStartedAt) / 1000))
      const rem = breakDurationSeconds.value - elapsedBreak
      if (rem <= 0) {
        breakRemainingSeconds.value = 0
        isBreakRunning.value = false
        breakStartedAt = null
        stopTickerInterval()
        timerMode.value = 'work'
        saveSharedTimerState()
        playBreakFinishedChime()
      } else {
        breakRemainingSeconds.value = rem
        isBreakRunning.value = true
      }
    }
  }

  function toggleTimer(taskId: string) {
    if (timerMode.value !== 'work') {
      stopBreak()
    }

    if (activeTaskId.value === taskId) {
      stopTimer()
    } else {
      if (activeTaskId.value) {
        stopTimer()
      }
      const task = items.value.find(i => i.id === taskId)
      if (!task) return

      activeTaskId.value = taskId
      lastCompletedTaskId.value = taskId
      timerMode.value = 'work'
      timerBaseLoggedSeconds = task.loggedSeconds || 0
      timerStartedAt = Date.now()
      lastDbSyncSecond = -1

      saveSharedTimerState()
      ensureTickerRunning()
    }
  }

  function stopTimer() {
    stopTickerInterval()
    if (activeTaskId.value) {
      const task = items.value.find(i => i.id === activeTaskId.value)
      if (task) {
        lastFocusFinishedAt.value = Date.now()
        syncTaskToDb(
          task.id,
          {
            loggedSeconds: task.loggedSeconds,
            completedSessions: task.completedSessions
          },
          true
        )
      }
      activeTaskId.value = null
      timerStartedAt = null
      saveSharedTimerState()
    }
  }

  function startBreak(minutes: 5 | 10) {
    if (activeTaskId.value) {
      stopTimer()
    }
    stopTickerInterval()
    const totalSec = minutes * 60
    breakDurationSeconds.value = totalSec
    breakRemainingSeconds.value = totalSec
    breakStartedAt = Date.now()
    timerMode.value = 'break'
    isBreakRunning.value = true

    saveSharedTimerState()
    ensureTickerRunning()
  }

  function stopBreak() {
    stopTickerInterval()
    isBreakRunning.value = false
    breakRemainingSeconds.value = 0
    breakStartedAt = null
    timerMode.value = 'work'
    saveSharedTimerState()
  }

  function resumeLastTask() {
    const targetId = lastCompletedTaskId.value
    stopBreak()
    if (targetId && items.value.some(i => i.id === targetId)) {
      toggleTimer(targetId)
    }
  }

  // --- 3. CRUD ACTIONS ---
  async function syncTaskToDb(
    id: string,
    payload: Partial<DailyItem>,
    broadcast = true
  ) {
    const item = items.value.find(i => i.id === id)
    if (item) Object.assign(item, payload)
    await $fetch(`/api/items/${id}`, { method: 'PATCH', body: payload })
    if (broadcast) {
      postBroadcast({ type: 'DATA_UPDATED' })
    }
  }

  async function addItem(
    title: string,
    parentId: string | null = null,
    type: 'task' | 'note' | 'event' = 'task',
    customCategoryId?: string
  ) {
    if (!title.trim()) return
    const defaultCategory =
      customCategoryId ||
      (selectedCategoryFilter.value !== 'all' ? selectedCategoryFilter.value : 'uncategorized')

    const created = await $fetch<DailyItem>('/api/items', {
      method: 'POST',
      body: {
        date: selectedDate.value,
        parentId,
        type,
        title: title.trim(),
        categoryId: defaultCategory,
        estimatedSessions: parentId ? 0 : 4,
        sortOrder: items.value.length + 1
      }
    })
    items.value.push(created)

    if (parentId && collapsedParentIds.value.includes(parentId)) {
      toggleSubitemsCollapse(parentId)
    }

    postBroadcast({ type: 'DATA_UPDATED' })
    return created
  }

  async function deleteItem(id: string) {
    if (activeTaskId.value === id) stopTimer()
    items.value = items.value.filter(i => i.id !== id && i.parentId !== id)
    await $fetch(`/api/items/${id}`, { method: 'DELETE' })
    postBroadcast({ type: 'DATA_UPDATED' })
  }

  async function addCategory(name: string, color: string) {
    if (!name.trim()) return
    const created = await $fetch<Category>('/api/categories', {
      method: 'POST',
      body: { name: name.trim(), color }
    })
    categories.value.push(created)
    postBroadcast({ type: 'DATA_UPDATED' })
    return created
  }

  async function deleteCategory(id: string) {
    if (id === 'uncategorized') return
    categories.value = categories.value.filter(c => c.id !== id)
    items.value.forEach((item) => {
      if (item.categoryId === id) item.categoryId = 'uncategorized'
    })
    if (selectedCategoryFilter.value === id) {
      selectedCategoryFilter.value = 'all'
    }
    await ($fetch as any)(`/api/categories/${id}`, { method: 'DELETE' })
    postBroadcast({ type: 'DATA_UPDATED' })
  }

  // --- 4. COMPUTED PROPERTIES ---
  const structuredItems = computed<StructuredParentItem[]>(() => {
    const sorted = [...items.value].sort((a, b) => a.sortOrder - b.sortOrder)
    let parents = sorted.filter(i => !i.parentId)
    if (selectedCategoryFilter.value !== 'all') {
      parents = parents.filter(i => i.categoryId === selectedCategoryFilter.value)
    }
    return parents.map(parent => ({
      ...parent,
      children: sorted.filter(c => c.parentId === parent.id)
    }))
  })

  const totalSecondsToday = computed(() =>
    items.value.reduce((acc, i) => acc + (i.loggedSeconds || 0), 0)
  )

  const totalSessionsToday = computed(() =>
    items.value.reduce((acc, i) => acc + (i.completedSessions || 0), 0)
  )

  const categoryBreakdown = computed(() => {
    const total = totalSecondsToday.value
    if (total === 0) return []

    const grouped: Record<string, number> = {}
    items.value.forEach((item) => {
      if (item.loggedSeconds > 0) {
        const catId = item.categoryId || 'uncategorized'
        grouped[catId] = (grouped[catId] || 0) + item.loggedSeconds
      }
    })

    return Object.entries(grouped)
      .map(([catId, seconds]) => {
        const cat = categories.value.find(c => c.id === catId) || {
          id: catId,
          name: 'uncategorized',
          color: '#cbd5e1'
        }
        return {
          ...cat,
          seconds,
          formattedTime: formatReadable(seconds),
          percentage: Math.round((seconds / total) * 100)
        }
      })
      .sort((a, b) => b.seconds - a.seconds)
  })

  // --- 5. FORMATTER WAKTU & NAVIGASI TANGGAL ---
  function formatHMS(sec: number) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0')
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
    const s = String(sec % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  function formatReadable(sec: number) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0 && m > 0) return `${h}h ${m}m`
    if (h > 0) return `${h}h`
    if (m > 0) return `${m}m`
    if (s > 0) return `${s}s`
    return '0m'
  }

  function changeDate(offsetDays: number) {
    const [year, month, day] = selectedDate.value.split('-').map(Number)
    const d = new Date(year!, month! - 1, day!)
    d.setDate(d.getDate() + offsetDays)
    selectedDate.value = getLocalTodayString(d)
  }

  function goToToday() {
    selectedDate.value = getLocalTodayString()
  }

  return {
    authUser,
    isAuthChecking,
    selectedDate,
    dailyTargetSessions,
    isDarkMode,
    selectedCategoryFilter,
    collapsedParentIds,
    yesterdayUndoneCount,
    yesterdayUndoneTitles,
    showYesterdayReminder,
    isCopyingYesterday,
    categories,
    items,
    isLoading,
    activeTaskId,
    activeTask,
    lastCompletedTaskId,
    lastCompletedTask,
    timerMode,
    breakDurationSeconds,
    breakRemainingSeconds,
    isBreakRunning,
    lastFocusFinishedAt,
    mainTimerSecondsRemaining,
    mainTimerFormatted,
    mainTimerProgress,
    structuredItems,
    totalSecondsToday,
    totalSessionsToday,
    categoryBreakdown,
    initClientSync,
    checkAuth,
    login,
    logout,
    updateCredentials,
    toggleDarkMode,
    setDailyTargetSessions,
    toggleSubitemsCollapse,
    isParentCollapsed,
    fetchDayData,
    copyUndoneFromYesterday,
    dismissYesterdayReminder,
    toggleTimer,
    stopTimer,
    startBreak,
    stopBreak,
    resumeLastTask,
    syncTaskToDb,
    addItem,
    deleteItem,
    addCategory,
    deleteCategory,
    formatHMS,
    formatReadable,
    changeDate,
    goToToday
  }
})
