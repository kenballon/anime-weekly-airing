<script setup lang="ts">
import { ref } from 'vue'
import type { AiringScheduleItem, WeeklyScheduleDay } from '@/composables/useAnime'

const props = defineProps<{
  days: WeeklyScheduleDay[]
  label: string
  loading: boolean
  error: string | null
  isMovieFilter: boolean
}>()

const activeEntry = ref<AiringScheduleItem | null>(null)
const previewPosition = ref({ x: 0, y: 0 })
const showPreview = ref(false)

const formatTime = (airingAt: number) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(airingAt * 1000))

const formatTitle = (title: string | null) => title || 'Untitled'

const setActiveEntry = (entry: AiringScheduleItem) => {
  activeEntry.value = entry
  showPreview.value = true
}

const updatePreviewPosition = (event: MouseEvent | FocusEvent) => {
  const previewWidth = 320
  const previewHeight = 420
  const offsetX = 18
  const offsetY = 18
  const padding = 12

  const maxX = window.innerWidth - previewWidth - padding
  const maxY = window.innerHeight - previewHeight - padding

  if ('clientX' in event && 'clientY' in event) {
    previewPosition.value = {
      x: Math.min(event.clientX + offsetX, Math.max(padding, maxX)),
      y: Math.min(event.clientY + offsetY, Math.max(padding, maxY)),
    }
    return
  }

  const target = event.target as HTMLElement | null
  const rect = target?.getBoundingClientRect()

  if (!rect) return

  previewPosition.value = {
    x: Math.min(rect.left + rect.width / 2 + offsetX, Math.max(padding, maxX)),
    y: Math.min(rect.top + rect.height / 2 + offsetY, Math.max(padding, maxY)),
  }
}

const setPreviewFromEvent = (entry: AiringScheduleItem, event: MouseEvent | FocusEvent) => {
  setActiveEntry(entry)
  updatePreviewPosition(event)
}

const hidePreview = () => {
  activeEntry.value = null
  showPreview.value = false
}
</script>

<template>
  <section class="theme-surface rounded-sm p-5 md:p-6">
    <div class="space-y-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] theme-subtle">Weekly Airing Schedule</p>
          <h2 class="mt-1 text-2xl font-semibold">Monday to Sunday lineup</h2>
          <p class="mt-1 text-sm theme-muted">{{ label }}</p>
        </div>
      </div>

      <div v-if="isMovieFilter" class="theme-soft rounded-2xl px-4 py-3 text-sm theme-muted">
        Weekly airing schedules are for TV shows, so switch the type filter to Shows or All to see entries here.
      </div>

      <div v-else-if="loading" class="rounded-2xl theme-soft px-4 py-6 text-center text-sm theme-muted">
        Loading weekly schedule...
      </div>

      <div v-else-if="error" class="rounded-2xl theme-soft px-4 py-6 text-sm text-red-400">
        Error: {{ error }}
      </div>

      <div v-else class="pb-1">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          <article v-for="day in days" :key="day.key" class="theme-day overflow-hidden rounded-2xl">
            <header class="border-b border-(--border) px-4 py-3 md:px-3">
              <p class="text-sm font-semibold">{{ day.label }}</p>
              <p class="mt-1 text-xs theme-muted">{{ day.entries.length }} airing</p>
            </header>

            <div class="space-y-2 p-3">
              <button v-for="entry in day.entries" :key="entry.id" type="button"
                class="theme-entry group w-full rounded-sm p-3 text-left"
                @mouseenter="setPreviewFromEvent(entry, $event)" @mousemove="updatePreviewPosition"
                @focus="setPreviewFromEvent(entry, $event)" @mouseleave="hidePreview" @blur="hidePreview">
                <div class="flex items-center justify-between gap-2 text-xs theme-subtle">
                  <span>{{ formatTime(entry.airingAt) }}</span>
                  <span>Ep {{ entry.episode }}</span>
                </div>

                <p class="mt-2 line-clamp-2 text-sm font-medium leading-snug capitalize">
                  {{ formatTitle(entry.media.title.english || entry.media.title.romaji) }}
                </p>

              </button>

              <p v-if="day.entries.length === 0" class="px-1 py-2 text-xs theme-subtle">
                Nothing airing here yet
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>

  <teleport to="body">
    <div v-if="activeEntry && showPreview"
      class="theme-preview fixed z-50 w-[320px] overflow-hidden rounded-3xl pointer-events-none"
      :style="{ left: `${previewPosition.x}px`, top: `${previewPosition.y}px` }">
      <div class="overflow-hidden">
        <img :src="activeEntry.media.coverImage.large"
          :alt="activeEntry.media.title.english || activeEntry.media.title.romaji" class="h-62.5 w-full object-cover">
      </div>

      <div class="px-4 py-4">
        <h3 class="my-2 line-clamp-2 text-lg font-semibold leading-tight capitalize">
          {{ formatTitle(activeEntry.media.title.english || activeEntry.media.title.romaji) }}
        </h3>
        <p class="mt-2 text-sm theme-muted">
          {{ formatTime(activeEntry.airingAt) }} · Ep {{ activeEntry.episode }}
        </p>
      </div>
    </div>
  </teleport>
</template>
