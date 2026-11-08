import { defineStore } from 'pinia'

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
}

function getLocalTodayString(d = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const useTasklyStore = defineStore('taskly', () => {
  const selectedDate = ref<string>(getLocalTodayString())
  const dailyTargetSessions = useLocalStorage<number>('taskly_target_sessions', 16)
  const isDarkMode = useLocalStorage<boolean>('taskly_dark_mode', true)
  const selectedCategoryFilter = ref('all')

  // Menyimpan daftar ID parent task yang sub-itemnya sedang di-hidden (collapsed)
  const collapsedParentIds = useLocalStorage<string[]>('taskly_collapsed_parents', [])

  const categories = ref<Category[]>([])
  const items = ref<DailyItem[]>([])
  const isLoading = ref(false)
  const lastFocusFinishedAt = useLocalStorage<number | null>('taskly_last_focus_at', null)

  // POMODORO TIMER STATE (Timestamp Delta agar akurat saat tab di background)
  const activeTaskId = ref<string | null>(null)
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let lastTickAt = 0
  let unsyncedSeconds = 0
  const POMODORO_SECONDS = 25 * 60 // 25 menit per sesi (1500 detik)

  const activeTask = computed(() =>
    items.value.find(i => i.id === activeTaskId.value) || null
  )

  // Timer Utama (Countdown sesi Pomodoro 25 menit saat ini di bagian paling atas)
  const mainTimerSecondsRemaining = computed(() => {
    if (!activeTask.value) return POMODORO_SECONDS
    const elapsedInCurrentSession = activeTask.value.loggedSeconds % POMODORO_SECONDS
    return POMODORO_SECONDS - elapsedInCurrentSession
  })

  const mainTimerFormatted = computed(() => {
    if (!activeTask.value) return '25:00'
    const rem = mainTimerSecondsRemaining.value
    const m = String(Math.floor(rem / 60)).padStart(2, '0')
    const s = String(rem % 60).padStart(2, '0')
    return `${m}:${s}`
  })

  // Persentase putaran lingkaran timer utama (0 - 100)
  const mainTimerProgress = computed(() => {
    if (!activeTask.value) return 100
    const elapsedInCurrentSession = activeTask.value.loggedSeconds % POMODORO_SECONDS
    return ((POMODORO_SECONDS - elapsedInCurrentSession) / POMODORO_SECONDS) * 100
  })

  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value
  }

  function toggleSubitemsCollapse(parentId: string) {
    const idx = collapsedParentIds.value.indexOf(parentId)
    if (idx === -1) {
      collapsedParentIds.value.push(parentId)
    } else {
      collapsedParentIds.value.splice(idx, 1)
    }
  }

  function isParentCollapsed(parentId: string) {
    return collapsedParentIds.value.includes(parentId)
  }

  function playSessionCompleteChime() {
    if (typeof window === 'undefined') return
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14)
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.14)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.4)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + idx * 0.14)
        osc.stop(ctx.currentTime + idx * 0.14 + 0.4)
      })
    } catch {
      // Ignore audio errors
    }
  }

  // 1. FETCH DATA DARI D1 (/api/taskly)
  async function fetchDayData(date = selectedDate.value) {
    isLoading.value = true
    try {
      const data = await $fetch<TasklyDayResponse>('/api/taskly', { query: { date } })
      categories.value = data.categories
      items.value = data.items
    } finally {
      isLoading.value = false
    }
  }

  // Reload otomatis saat ganti tanggal
  watch(selectedDate, (newDate) => {
    stopTimer()
    fetchDayData(newDate)
  })

  // 2. POMODORO ENGINE DENGAN TIMESTAMP DELTA & AUTO-SYNC KE DATABASE
  function toggleTimer(taskId: string) {
    if (activeTaskId.value === taskId) {
      stopTimer()
    } else {
      stopTimer()
      activeTaskId.value = taskId
      lastTickAt = Date.now()
      unsyncedSeconds = 0

      timerInterval = setInterval(() => {
        const now = Date.now()
        const deltaSec = Math.floor((now - lastTickAt) / 1000)
        if (deltaSec < 1) return

        lastTickAt += deltaSec * 1000
        const task = items.value.find(i => i.id === activeTaskId.value)
        if (task) {
          const prevSessions = task.completedSessions
          task.loggedSeconds += deltaSec
          task.completedSessions = Math.floor(task.loggedSeconds / POMODORO_SECONDS)
          unsyncedSeconds += deltaSec

          if (task.completedSessions > prevSessions) {
            playSessionCompleteChime()
            lastFocusFinishedAt.value = Date.now()
          }

          // Sync otomatis ke Cloudflare D1 setiap >= 15 detik
          if (unsyncedSeconds >= 15) {
            unsyncedSeconds = 0
            syncTaskToDb(task.id, {
              loggedSeconds: task.loggedSeconds,
              completedSessions: task.completedSessions
            })
          }
        }
      }, 1000)
    }
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    if (activeTaskId.value) {
      const task = items.value.find(i => i.id === activeTaskId.value)
      if (task) {
        lastFocusFinishedAt.value = Date.now()
        syncTaskToDb(task.id, {
          loggedSeconds: task.loggedSeconds,
          completedSessions: task.completedSessions
        })
      }
      activeTaskId.value = null
      unsyncedSeconds = 0
    }
  }

  // 3. CRUD ACTIONS
  async function syncTaskToDb(id: string, payload: Partial<DailyItem>) {
    const item = items.value.find(i => i.id === id)
    if (item) Object.assign(item, payload)
    await $fetch(`/api/items/${id}`, { method: 'PATCH', body: payload })
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

    // Jika menambah sub-item ke parent yang sedang di-collapse, otomatis buka (unhide)
    if (parentId && collapsedParentIds.value.includes(parentId)) {
      collapsedParentIds.value = collapsedParentIds.value.filter(id => id !== parentId)
    }

    return created
  }

  async function deleteItem(id: string) {
    if (activeTaskId.value === id) stopTimer()
    items.value = items.value.filter(i => i.id !== id && i.parentId !== id)
    await $fetch(`/api/items/${id}`, { method: 'DELETE' })
  }

  async function addCategory(name: string, color: string) {
    if (!name.trim()) return
    const created = await $fetch<Category>('/api/categories', {
      method: 'POST',
      body: { name: name.trim(), color }
    })
    categories.value.push(created)
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
  }

  // 4. COMPUTED PROPERTIES (Hierarki & Category Breakdown)
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

  // 5. FORMATTER WAKTU & NAVIGASI TANGGAL
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
    selectedDate,
    dailyTargetSessions,
    isDarkMode,
    selectedCategoryFilter,
    collapsedParentIds,
    categories,
    items,
    isLoading,
    activeTaskId,
    activeTask,
    lastFocusFinishedAt,
    mainTimerSecondsRemaining,
    mainTimerFormatted,
    mainTimerProgress,
    structuredItems,
    totalSecondsToday,
    totalSessionsToday,
    categoryBreakdown,
    toggleDarkMode,
    toggleSubitemsCollapse,
    isParentCollapsed,
    fetchDayData,
    toggleTimer,
    stopTimer,
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
