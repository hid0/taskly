<script setup lang="ts">
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Plus,
  Trash2,
  FileText,
  Calendar,
  CheckSquare,
  BarChart2,
  GripVertical,
  Sun,
  Moon,
  Flame,
  Timer,
  Target,
  Tag,
  Check,
  Sparkles,
  X
} from 'lucide-vue-next'
import { useTasklyStore } from '~/stores/useTasklyStore'

const store = useTasklyStore()

const newTaskTitle = ref('')
const newTaskType = ref<'task' | 'note' | 'event'>('task')
const addingSubtaskTo = ref<string | null>(null)
const newSubtaskTitle = ref('')
const openMenuId = ref<string | null>(null)
const openCatPickerId = ref<string | null>(null)
const showBreakdown = ref(false)
const showCategoryManager = ref(false)
const newCategoryName = ref('')
const newCategoryColor = ref('#6366f1')

const presetColors = [
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#14b8a6',
  '#64748b'
]

// Lingkaran SVG Timer Utama (radius = 54, keliling = 2 * PI * 54 ≈ 339.29)
const CIRCLE_RADIUS = 54
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

const circleStrokeDashoffset = computed(() => {
  const progress = store.mainTimerProgress
  return CIRCLE_CIRCUMFERENCE - (progress / 100) * CIRCLE_CIRCUMFERENCE
})

useHead({
  title: computed(() =>
    store.activeTask
      ? `(${store.mainTimerFormatted}) ${store.activeTask.title} — Taskly`
      : 'Taskly — Modern Pomodoro & Daily Planner'
  )
})

onMounted(() => {
  store.fetchDayData()
})

onBeforeUnmount(() => {
  store.stopTimer()
})

function handleMainTimerClick() {
  if (store.activeTaskId) {
    store.stopTimer()
  } else {
    const firstTask = store.structuredItems.find(i => i.type === 'task' && !i.isCompleted)
    if (firstTask) {
      store.toggleTimer(firstTask.id)
    }
  }
}

async function handleAddMainTask() {
  if (!newTaskTitle.value.trim()) return
  await store.addItem(newTaskTitle.value, null, newTaskType.value)
  newTaskTitle.value = ''
}

async function handleAddSubtask(parentId: string) {
  if (!newSubtaskTitle.value.trim()) return
  await store.addItem(newSubtaskTitle.value, parentId, 'task')
  newSubtaskTitle.value = ''
  addingSubtaskTo.value = null
}

async function handleCreateCategory() {
  if (!newCategoryName.value.trim()) return
  await store.addCategory(newCategoryName.value, newCategoryColor.value)
  newCategoryName.value = ''
}

function getCategory(catId: string | null) {
  return (
    store.categories.find(c => c.id === catId) || {
      id: 'uncategorized',
      name: 'uncategorized',
      color: '#94a3b8'
    }
  )
}

function getCompletedChildrenCount(children: { isCompleted: boolean }[]) {
  return children.filter(c => c.isCompleted).length
}

const formattedSelectedDate = computed(() => {
  const [year, month, day] = store.selectedDate.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
})

const sessionProgressPercentage = computed(() => {
  if (store.dailyTargetSessions <= 0) return 0
  return Math.min(100, Math.round((store.totalSessionsToday / store.dailyTargetSessions) * 100))
})
</script>

<template>
  <div
    :class="
      store.isDarkMode
        ? 'bg-[#090d16] text-slate-100 selection:bg-indigo-500/30'
        : 'bg-[#f8fafc] text-slate-800 selection:bg-indigo-500/20'
    "
    class="min-h-screen font-sans transition-colors duration-300 relative overflow-x-hidden pb-28"
  >
    <!-- Ambient Modern Radial Glow Background -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        class="absolute -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[380px] rounded-full blur-[130px] transition-opacity duration-500"
        :class="
          store.isDarkMode
            ? 'bg-gradient-to-tr from-indigo-600/20 via-emerald-500/15 to-purple-600/15 opacity-100'
            : 'bg-gradient-to-tr from-indigo-400/20 via-emerald-300/20 to-sky-300/20 opacity-80'
        "
      ></div>
    </div>

    <div class="max-w-3xl mx-auto px-4 sm:px-6 pt-6 relative z-10">
      <!-- 1. TOP NAVIGATION BAR -->
      <header class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <!-- Brand Logo -->
        <div class="flex items-center gap-2.5">
          <div
            class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white"
          >
            <Timer class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="font-bold text-base tracking-tight">Taskly</h1>
              <span
                class="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                :class="
                  store.activeTaskId
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse'
                    : store.isDarkMode
                      ? 'bg-slate-800 text-slate-400 border border-slate-700/60'
                      : 'bg-slate-200/80 text-slate-600'
                "
              >
                {{ store.activeTaskId ? 'Focusing' : 'Workspace' }}
              </span>
            </div>
            <p class="text-[11px]" :class="store.isDarkMode ? 'text-slate-400' : 'text-slate-500'">
              Mindful Pomodoro & Daily Flow
            </p>
          </div>
        </div>

        <!-- Date Navigation & Theme Controls -->
        <div class="flex items-center gap-2">
          <!-- Date Switcher Pill -->
          <div
            class="flex items-center rounded-xl p-1 border text-xs font-medium transition-colors"
            :class="
              store.isDarkMode
                ? 'bg-slate-900/90 border-slate-800 text-slate-200'
                : 'bg-white border-slate-200/90 text-slate-700 shadow-2xs'
            "
          >
            <button
              @click="store.changeDate(-1)"
              class="p-1.5 rounded-lg transition-colors"
              :class="store.isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'"
              title="Hari sebelumnya"
            >
              <ChevronLeft class="w-4 h-4" />
            </button>
            <button
              @click="store.goToToday()"
              class="px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5"
              :class="store.isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'"
              title="Kembali ke Hari Ini"
            >
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{{ formattedSelectedDate }}</span>
            </button>
            <button
              @click="store.changeDate(1)"
              class="p-1.5 rounded-lg transition-colors"
              :class="store.isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'"
              title="Hari berikutnya"
            >
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>

          <!-- Dark Mode Toggle Button -->
          <button
            @click="store.toggleDarkMode()"
            class="p-2.5 rounded-xl border transition-all"
            :class="
              store.isDarkMode
                ? 'bg-slate-900/90 border-slate-800 text-amber-400 hover:bg-slate-800 hover:border-slate-700'
                : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-100 shadow-2xs'
            "
            :title="store.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
          >
            <Sun v-if="store.isDarkMode" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>
        </div>
      </header>

      <!-- 2. HERO FOCUS CONSOLE (TIMER UTAMA + RINGKASAN STATISTIK HARIAN) -->
      <section
        class="rounded-2xl border p-5 sm:p-6 mb-6 backdrop-blur-xl transition-all relative overflow-hidden"
        :class="
          store.isDarkMode
            ? 'bg-slate-900/75 border-slate-800/90 shadow-2xl shadow-black/40'
            : 'bg-white/90 border-slate-200/80 shadow-xl shadow-slate-200/50'
        "
      >
        <div class="flex flex-col sm:flex-row items-center gap-6">
          <!-- Circular Main Pomodoro Timer -->
          <div class="relative flex items-center justify-center shrink-0">
            <button
              @click="handleMainTimerClick"
              class="relative w-32 h-32 flex items-center justify-center rounded-full group focus:outline-none transition-transform active:scale-95"
              :title="
                store.activeTask
                  ? `Pause ${store.activeTask.title}`
                  : 'Klik untuk mulai fokus pada task pertama'
              "
            >
              <svg class="w-32 h-32 -rotate-90 transform" viewBox="0 0 128 128">
                <defs>
                  <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#10b981" />
                    <stop offset="100%" stop-color="#6366f1" />
                  </linearGradient>
                </defs>
                <!-- Track Circle -->
                <circle
                  cx="64"
                  cy="64"
                  :r="CIRCLE_RADIUS"
                  :stroke="store.isDarkMode ? '#1e293b' : '#f1f5f9'"
                  stroke-width="8"
                  fill="transparent"
                />
                <!-- Progress Circle -->
                <circle
                  cx="64"
                  cy="64"
                  :r="CIRCLE_RADIUS"
                  stroke="url(#timerGrad)"
                  stroke-width="8"
                  stroke-linecap="round"
                  fill="transparent"
                  :stroke-dasharray="CIRCLE_CIRCUMFERENCE"
                  :stroke-dashoffset="circleStrokeDashoffset"
                  class="transition-all duration-500"
                />
              </svg>

              <!-- Center Timer Readout -->
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  class="text-2xl font-bold font-mono tracking-tight"
                  :class="store.isDarkMode ? 'text-white' : 'text-slate-900'"
                >
                  {{ store.mainTimerFormatted }}
                </span>
                <span
                  class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                  :class="
                    store.activeTaskId
                      ? 'bg-amber-500/15 text-amber-400'
                      : store.isDarkMode
                        ? 'bg-slate-800 text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                  "
                >
                  <Pause v-if="store.activeTaskId" class="w-2.5 h-2.5" />
                  <Play v-else class="w-2.5 h-2.5" />
                  {{ store.activeTaskId ? 'PAUSE' : 'START' }}
                </span>
              </div>
            </button>
          </div>

          <!-- Right Column: Active Task Status & Daily Progress -->
          <div class="flex-1 w-full space-y-4">
            <!-- Active Task Banner -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div class="flex items-center gap-1.5 text-xs font-medium" :class="store.isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                  <Flame class="w-3.5 h-3.5" :class="store.activeTask ? 'text-amber-400' : 'text-slate-400'" />
                  <span>{{ store.activeTask ? 'Sedang Fokus Mengerjakan:' : 'Status Fokus Saat Ini:' }}</span>
                </div>
                <h2
                  class="text-base sm:text-lg font-bold tracking-tight mt-0.5 truncate"
                  :class="store.isDarkMode ? 'text-white' : 'text-slate-900'"
                >
                  {{ store.activeTask ? store.activeTask.title : 'Belum ada timer aktif — Pilih task untuk mulai' }}
                </h2>
              </div>

              <!-- Total Focus Time Badge -->
              <div
                class="px-3.5 py-2 rounded-xl border shrink-0 flex items-center gap-2.5"
                :class="
                  store.isDarkMode
                    ? 'bg-slate-950/60 border-slate-800/80'
                    : 'bg-slate-50/80 border-slate-200/70'
                "
              >
                <div class="w-2 h-8 rounded-full bg-gradient-to-b from-emerald-400 to-indigo-500"></div>
                <div>
                  <p class="text-[10px] uppercase tracking-wider font-semibold" :class="store.isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                    Total Fokus Hari Ini
                  </p>
                  <p class="text-sm font-bold font-mono">
                    {{ store.formatReadable(store.totalSecondsToday) }}
                    <span class="text-xs font-normal opacity-60">({{ store.formatHMS(store.totalSecondsToday) }})</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Sessions Progress Bar -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium flex items-center gap-1.5" :class="store.isDarkMode ? 'text-slate-300' : 'text-slate-600'">
                  <Target class="w-3.5 h-3.5 text-emerald-400" />
                  Progress Sesi Harian:
                  <strong :class="store.isDarkMode ? 'text-white' : 'text-slate-900'">
                    {{ store.totalSessionsToday }} / {{ store.dailyTargetSessions }} sesi
                  </strong>
                  <span class="opacity-60">({{ sessionProgressPercentage }}%)</span>
                </span>

                <!-- Adjust Daily Target -->
                <div class="flex items-center gap-1 text-[11px]">
                  <span class="opacity-60 mr-1">Target:</span>
                  <button
                    @click="store.dailyTargetSessions = Math.max(1, store.dailyTargetSessions - 1)"
                    class="w-5 h-5 rounded flex items-center justify-center border transition-colors"
                    :class="store.isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'"
                  >
                    -
                  </button>
                  <button
                    @click="store.dailyTargetSessions++"
                    class="w-5 h-5 rounded flex items-center justify-center border transition-colors"
                    :class="store.isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'"
                  >
                    +
                  </button>
                </div>
              </div>

              <div
                class="h-2.5 w-full rounded-full overflow-hidden p-0.5"
                :class="store.isDarkMode ? 'bg-slate-950 border border-slate-800' : 'bg-slate-100'"
              >
                <div
                  class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500 transition-all duration-500"
                  :style="{ width: `${Math.max(3, sessionProgressPercentage)}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. FILTER KATEGORI PILLS & TOMBOL ANALYTICS BREAKDOWN -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <!-- Category Pills -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            @click="store.selectedCategoryFilter = 'all'"
            class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
            :class="
              store.selectedCategoryFilter === 'all'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-500/20'
                : store.isDarkMode
                  ? 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-slate-200'
                  : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
            "
          >
            Semua
          </button>

          <button
            v-for="cat in store.categories"
            :key="cat.id"
            @click="store.selectedCategoryFilter = cat.id"
            class="px-3 py-1.5 rounded-xl text-xs font-medium transition-all border flex items-center gap-1.5"
            :class="
              store.selectedCategoryFilter === cat.id
                ? store.isDarkMode
                  ? 'bg-slate-800 text-white border-slate-600 shadow-xs'
                  : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : store.isDarkMode
                  ? 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-slate-200'
                  : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
            "
          >
            <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: cat.color }"></span>
            <span>{{ cat.name }}</span>
          </button>

          <!-- Add / Manage Category Button -->
          <button
            @click="showCategoryManager = !showCategoryManager"
            class="px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1"
            :class="
              store.isDarkMode
                ? 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-white hover:border-slate-700'
                : 'bg-white/70 border-slate-200 text-slate-500 hover:text-slate-800'
            "
            title="Kelola Kategori"
          >
            <Tag class="w-3 h-3" />
            <span>+ Kategori</span>
          </button>
        </div>

        <!-- Analytics Breakdown Toggle -->
        <button
          @click="showBreakdown = !showBreakdown"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5"
          :class="
            showBreakdown
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
              : store.isDarkMode
                ? 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
          "
        >
          <BarChart2 class="w-3.5 h-3.5" :class="showBreakdown ? 'text-white' : 'text-purple-400'" />
          <span>Breakdown Kategori</span>
        </button>
      </div>

      <!-- PANEL KELOLA KATEGORI BARU (COLLAPSIBLE) -->
      <div
        v-if="showCategoryManager"
        class="mb-4 p-4 rounded-2xl border transition-all"
        :class="
          store.isDarkMode
            ? 'bg-slate-900/90 border-slate-800'
            : 'bg-white border-slate-200 shadow-md'
        "
      >
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-bold uppercase tracking-wider opacity-70">Tambah & Kelola Kategori</h3>
          <button @click="showCategoryManager = false" class="opacity-60 hover:opacity-100">
            <X class="w-4 h-4" />
          </button>
        </div>
        <form @submit.prevent="handleCreateCategory" class="flex flex-wrap items-center gap-2 mb-3">
          <input
            v-model="newCategoryName"
            type="text"
            placeholder="Nama kategori baru..."
            class="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="
              store.isDarkMode
                ? 'bg-slate-950 border-slate-800 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            "
          />
          <div class="flex items-center gap-1">
            <button
              v-for="color in presetColors"
              :key="color"
              type="button"
              @click="newCategoryColor = color"
              class="w-5 h-5 rounded-full transition-transform"
              :class="newCategoryColor === color ? 'scale-125 ring-2 ring-offset-1 ring-indigo-500' : 'opacity-70 hover:opacity-100'"
              :style="{ backgroundColor: color }"
            ></button>
          </div>
          <button
            type="submit"
            class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
          >
            Simpan
          </button>
        </form>
        <div class="flex flex-wrap gap-1.5">
          <div
            v-for="cat in store.categories"
            :key="cat.id"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border"
            :class="store.isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'"
          >
            <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: cat.color }"></span>
            <span>{{ cat.name }}</span>
            <button
              v-if="cat.id !== 'uncategorized'"
              @click="store.deleteCategory(cat.id)"
              class="ml-1 text-slate-400 hover:text-red-400"
              title="Hapus kategori"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <!-- PANEL TASKS BREAKDOWN BY CATEGORY (COLLAPSIBLE BENTO CARD) -->
      <div
        v-if="showBreakdown"
        class="mb-5 p-5 rounded-2xl border transition-all"
        :class="
          store.isDarkMode
            ? 'bg-slate-900/90 border-slate-800 shadow-xl'
            : 'bg-white border-slate-200 shadow-lg'
        "
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-purple-400" />
            <h3 class="text-xs font-bold uppercase tracking-wider">Tasks Breakdown by Category</h3>
          </div>
          <button @click="showBreakdown = false" class="opacity-60 hover:opacity-100">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div v-if="store.categoryBreakdown.length === 0" class="text-xs opacity-60 py-6 text-center">
          Belum ada durasi fokus yang tercatat pada tanggal ini.
        </div>

        <div v-else class="space-y-4">
          <!-- Multi-segment Bar -->
          <div class="h-3 w-full rounded-full overflow-hidden flex gap-0.5 bg-slate-800/30">
            <div
              v-for="stat in store.categoryBreakdown"
              :key="stat.id"
              class="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              :style="{ width: `${stat.percentage}%`, backgroundColor: stat.color }"
              :title="`${stat.name}: ${stat.percentage}%`"
            ></div>
          </div>

          <!-- Grid Stat Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              v-for="stat in store.categoryBreakdown"
              :key="stat.id"
              class="p-3 rounded-xl border flex items-center justify-between"
              :class="store.isDarkMode ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50/70 border-slate-200/70'"
            >
              <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: stat.color }"></span>
                <div>
                  <p class="text-xs font-semibold capitalize">{{ stat.name }}</p>
                  <p class="text-[11px] opacity-60">{{ stat.formattedTime }}</p>
                </div>
              </div>
              <span
                class="text-xs font-bold font-mono px-2 py-0.5 rounded-md"
                :style="{ backgroundColor: stat.color + '22', color: stat.color }"
              >
                {{ stat.percentage }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. QUICK ADD COMMAND BAR -->
      <form
        @submit.prevent="handleAddMainTask"
        class="mb-6 rounded-2xl border p-2 flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-indigo-500/50"
        :class="
          store.isDarkMode
            ? 'bg-slate-900/80 border-slate-800 shadow-lg shadow-black/20'
            : 'bg-white border-slate-200/90 shadow-md shadow-slate-200/40'
        "
      >
        <!-- Type Selector Pill -->
        <div
          class="flex items-center rounded-xl p-0.5 border text-[11px] font-medium shrink-0"
          :class="store.isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'"
        >
          <button
            type="button"
            @click="newTaskType = 'task'"
            class="px-2.5 py-1 rounded-lg transition-colors"
            :class="
              newTaskType === 'task'
                ? 'bg-indigo-600 text-white'
                : 'opacity-60 hover:opacity-100'
            "
          >
            Task
          </button>
          <button
            type="button"
            @click="newTaskType = 'note'"
            class="px-2.5 py-1 rounded-lg transition-colors"
            :class="
              newTaskType === 'note'
                ? 'bg-amber-500 text-white'
                : 'opacity-60 hover:opacity-100'
            "
          >
            Note
          </button>
          <button
            type="button"
            @click="newTaskType = 'event'"
            class="px-2.5 py-1 rounded-lg transition-colors"
            :class="
              newTaskType === 'event'
                ? 'bg-purple-600 text-white'
                : 'opacity-60 hover:opacity-100'
            "
          >
            Event
          </button>
        </div>

        <input
          v-model="newTaskTitle"
          type="text"
          placeholder="Tambah kerjaan, target fokus, atau catatan hari ini... (Enter)"
          class="flex-1 bg-transparent px-2 py-1.5 text-sm focus:outline-none"
        />

        <button
          type="submit"
          class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1 shrink-0"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Tambah</span>
        </button>
      </form>

      <!-- 5. TASK STREAM -->
      <div v-if="store.structuredItems.length === 0" class="text-center py-14 rounded-2xl border border-dashed" :class="store.isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-300 text-slate-400'">
        <Timer class="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p class="text-sm font-medium">Belum ada task atau catatan pada tanggal ini.</p>
        <p class="text-xs opacity-70 mt-1">Ketik kerjaan di kolom atas lalu tekan Enter untuk memulai.</p>
      </div>

      <div v-else class="space-y-3.5">
        <div v-for="parent in store.structuredItems" :key="parent.id" class="space-y-2">
          <!-- MAIN ITEM CARD -->
          <div
            class="rounded-2xl border p-4 transition-all relative group overflow-visible"
            :class="[
              store.isDarkMode
                ? 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700/90 shadow-lg shadow-black/20'
                : 'bg-white border-slate-200/85 hover:border-slate-300 shadow-sm',
              store.activeTaskId === parent.id
                ? store.isDarkMode
                  ? 'ring-2 ring-emerald-500/50 bg-slate-900'
                  : 'ring-2 ring-emerald-500/50 bg-emerald-50/10'
                : ''
            ]"
          >
            <!-- Left Category Accent Strip -->
            <div
              class="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
              :style="{ backgroundColor: getCategory(parent.categoryId).color }"
            ></div>

            <div class="flex items-start justify-between gap-3 pl-2">
              <div class="flex items-start gap-3 flex-1 min-w-0">
                <GripVertical class="w-4 h-4 opacity-25 group-hover:opacity-60 mt-1.5 shrink-0 cursor-grab transition-opacity" />

                <!-- Play/Pause Button (if Task) or Icon (if Note/Event) -->
                <button
                  v-if="parent.type === 'task'"
                  @click="store.toggleTimer(parent.id)"
                  class="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all shrink-0 shadow-sm"
                  :class="
                    store.activeTaskId === parent.id
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30 animate-pulse'
                      : 'bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 shadow-indigo-500/20'
                  "
                  :title="store.activeTaskId === parent.id ? 'Pause Pomodoro' : 'Mulai Fokus'"
                >
                  <Pause v-if="store.activeTaskId === parent.id" class="w-4 h-4" />
                  <Play v-else class="w-4 h-4 ml-0.5" />
                </button>
                <div
                  v-else-if="parent.type === 'note'"
                  class="mt-0.5 w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0"
                >
                  <FileText class="w-4 h-4" />
                </div>
                <div
                  v-else
                  class="mt-0.5 w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0"
                >
                  <Calendar class="w-4 h-4" />
                </div>

                <div class="flex-1 min-w-0">
                  <!-- Title Row + Badges -->
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4
                      @click="store.syncTaskToDb(parent.id, { isCompleted: !parent.isCompleted })"
                      class="text-sm sm:text-base font-semibold tracking-tight cursor-pointer select-none transition-colors"
                      :class="parent.isCompleted ? 'line-through opacity-40' : ''"
                      title="Klik untuk tandai selesai / belum"
                    >
                      {{ parent.title }}
                    </h4>

                    <!-- Active Running Badge -->
                    <span
                      v-if="store.activeTaskId === parent.id"
                      class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    >
                      RUNNING
                    </span>
                  </div>

                  <!-- Pomodoro Session Dots & Timer Readout -->
                  <div v-if="parent.type === 'task'" class="mt-2.5 flex flex-wrap items-center gap-3">
                    <!-- Dots -->
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <button
                        v-for="n in Math.max(parent.estimatedSessions, parent.completedSessions)"
                        :key="n"
                        @click="store.syncTaskToDb(parent.id, { estimatedSessions: n })"
                        class="w-3 h-3 rounded-full transition-all"
                        :class="
                          n <= parent.completedSessions
                            ? 'bg-emerald-400 shadow-xs shadow-emerald-500/50 scale-105'
                            : store.isDarkMode
                              ? 'bg-slate-700 hover:bg-slate-600'
                              : 'bg-slate-300 hover:bg-slate-400'
                        "
                        :title="`Set target ${n} sesi`"
                      ></button>
                      <button
                        @click="store.syncTaskToDb(parent.id, { estimatedSessions: parent.estimatedSessions + 1 })"
                        class="w-4 h-4 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors"
                        :class="store.isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'"
                        title="Tambah estimasi sesi"
                      >
                        +
                      </button>
                    </div>

                    <!-- Elapsed HMS Pill -->
                    <span
                      class="text-xs font-mono font-semibold px-2 py-0.5 rounded-md"
                      :class="
                        store.activeTaskId === parent.id
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : store.isDarkMode
                            ? 'bg-slate-950/70 text-slate-400'
                            : 'bg-slate-100 text-slate-600'
                      "
                    >
                      {{ store.formatHMS(parent.loggedSeconds) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right Controls: Category Badge, Collapse Sub-items Pill, Add Subtask, Menu -->
              <div class="flex items-center gap-1.5 shrink-0 relative">
                <!-- Category Picker Pill -->
                <div class="relative">
                  <button
                    @click="openCatPickerId = openCatPickerId === parent.id ? null : parent.id"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition-colors"
                    :class="
                      store.isDarkMode
                        ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100 text-slate-600'
                    "
                    title="Ubah Kategori"
                  >
                    <span
                      class="w-2 h-2 rounded-full"
                      :style="{ backgroundColor: getCategory(parent.categoryId).color }"
                    ></span>
                    <span class="hidden sm:inline max-w-[90px] truncate">
                      {{ getCategory(parent.categoryId).name }}
                    </span>
                  </button>

                  <!-- Category Popover -->
                  <div
                    v-if="openCatPickerId === parent.id"
                    class="absolute right-0 top-8 w-44 rounded-xl shadow-xl border p-1.5 z-30 space-y-0.5"
                    :class="
                      store.isDarkMode
                        ? 'bg-slate-900 border-slate-800 text-slate-200'
                        : 'bg-white border-slate-200 text-slate-700'
                    "
                  >
                    <button
                      v-for="cat in store.categories"
                      :key="cat.id"
                      @click="store.syncTaskToDb(parent.id, { categoryId: cat.id }); openCatPickerId = null"
                      class="w-full px-2.5 py-1.5 text-left text-xs rounded-lg flex items-center justify-between transition-colors"
                      :class="store.isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'"
                    >
                      <div class="flex items-center gap-2 truncate">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: cat.color }"></span>
                        <span class="truncate">{{ cat.name }}</span>
                      </div>
                      <Check v-if="parent.categoryId === cat.id" class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    </button>
                  </div>
                </div>

                <!-- Tombol Hide / Show Sub-item Modern dengan Counter -->
                <button
                  v-if="parent.children.length > 0"
                  @click="store.toggleSubitemsCollapse(parent.id)"
                  class="px-2 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all"
                  :class="
                    store.isParentCollapsed(parent.id)
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                      : store.isDarkMode
                        ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                  "
                  :title="store.isParentCollapsed(parent.id) ? 'Tampilkan sub-item' : 'Sembunyikan sub-item'"
                >
                  <span>{{ getCompletedChildrenCount(parent.children) }}/{{ parent.children.length }}</span>
                  <ChevronDown v-if="store.isParentCollapsed(parent.id)" class="w-3.5 h-3.5" />
                  <ChevronUp v-else class="w-3.5 h-3.5" />
                </button>

                <!-- Tombol Tambah Sub-item (+) -->
                <button
                  @click="addingSubtaskTo = addingSubtaskTo === parent.id ? null : parent.id"
                  class="p-1.5 rounded-lg border transition-colors"
                  :class="
                    store.isDarkMode
                      ? 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'border-slate-200/80 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  "
                  title="Tambah Sub-item"
                >
                  <Plus class="w-4 h-4" />
                </button>

                <!-- Three Dots Menu -->
                <button
                  @click="openMenuId = openMenuId === parent.id ? null : parent.id"
                  class="p-1.5 rounded-lg transition-colors"
                  :class="
                    store.isDarkMode
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                  "
                >
                  <MoreVertical class="w-4 h-4" />
                </button>

                <!-- Dropdown Menu -->
                <div
                  v-if="openMenuId === parent.id"
                  class="absolute right-0 top-9 w-48 rounded-xl shadow-xl border py-1.5 z-30 text-xs"
                  :class="
                    store.isDarkMode
                      ? 'bg-slate-900 border-slate-800 text-slate-200'
                      : 'bg-white border-slate-200 text-slate-700'
                  "
                >
                  <button
                    @click="store.syncTaskToDb(parent.id, { type: 'task' }); openMenuId = null"
                    class="w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors"
                    :class="store.isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'"
                  >
                    <CheckSquare class="w-3.5 h-3.5 text-indigo-400" /> Convert to Task
                  </button>
                  <button
                    @click="store.syncTaskToDb(parent.id, { type: 'note' }); openMenuId = null"
                    class="w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors"
                    :class="store.isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'"
                  >
                    <FileText class="w-3.5 h-3.5 text-amber-400" /> Convert to Note
                  </button>
                  <button
                    @click="store.syncTaskToDb(parent.id, { type: 'event' }); openMenuId = null"
                    class="w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors"
                    :class="store.isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'"
                  >
                    <Calendar class="w-3.5 h-3.5 text-purple-400" /> Convert to Event
                  </button>
                  <hr class="my-1" :class="store.isDarkMode ? 'border-slate-800' : 'border-slate-100'" />
                  <button
                    @click="store.deleteItem(parent.id); openMenuId = null"
                    class="w-full px-3 py-2 text-left text-red-400 flex items-center gap-2.5 transition-colors"
                    :class="store.isDarkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-50'"
                  >
                    <Trash2 class="w-3.5 h-3.5" /> Hapus Item
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Input Subtask Baru -->
          <form
            v-if="addingSubtaskTo === parent.id"
            @submit.prevent="handleAddSubtask(parent.id)"
            class="pl-8 sm:pl-10 flex gap-2"
          >
            <input
              v-model="newSubtaskTitle"
              type="text"
              placeholder="Ketik sub-task lalu tekan Enter..."
              class="flex-1 rounded-xl px-3.5 py-2 text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="
                store.isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-indigo-200 text-slate-800 shadow-xs'
              "
              autofocus
            />
            <button
              type="button"
              @click="addingSubtaskTo = null"
              class="px-2.5 py-2 rounded-xl text-xs opacity-60 hover:opacity-100"
            >
              Batal
            </button>
          </form>

          <!-- INDENTED SUB-ITEMS DENGAN TREE LINE (Bisa di-hidden / di-collapse) -->
          <div
            v-if="parent.children.length > 0 && !store.isParentCollapsed(parent.id)"
            class="pl-6 sm:pl-8 ml-4 border-l-2 space-y-2 transition-all"
            :class="store.isDarkMode ? 'border-slate-800/90' : 'border-slate-200'"
          >
            <div
              v-for="child in parent.children"
              :key="child.id"
              class="rounded-xl px-3.5 py-2.5 border flex items-center justify-between transition-all group/sub"
              :class="
                store.isDarkMode
                  ? 'bg-slate-900/55 border-slate-800/80 hover:border-slate-700'
                  : 'bg-white/90 border-slate-200/75 hover:border-slate-300 shadow-2xs'
              "
            >
              <div class="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  @click="store.syncTaskToDb(child.id, { isCompleted: !child.isCompleted })"
                  class="w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0"
                  :class="
                    child.isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : store.isDarkMode
                        ? 'border-slate-600 hover:border-indigo-400'
                        : 'border-slate-300 hover:border-indigo-500'
                  "
                >
                  <Check v-if="child.isCompleted" class="w-3 h-3 stroke-[3]" />
                </button>
                <span
                  @click="store.syncTaskToDb(child.id, { isCompleted: !child.isCompleted })"
                  class="text-xs sm:text-sm font-medium cursor-pointer select-none truncate transition-opacity"
                  :class="child.isCompleted ? 'line-through opacity-40' : ''"
                >
                  {{ child.title }}
                </span>
              </div>

              <button
                @click="store.deleteItem(child.id)"
                class="opacity-0 group-hover/sub:opacity-100 p-1 text-slate-400 hover:text-red-400 transition-opacity"
                title="Hapus sub-item"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
