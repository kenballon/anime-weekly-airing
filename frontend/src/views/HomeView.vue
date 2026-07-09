<script setup lang="ts">
import { watch } from 'vue'
import { useAnime } from '@/composables/useAnime'
import { useTheme } from '@/composables/useTheme'
import AnimeCard from '@/components/AnimeCard.vue'
import WeeklyScheduleTable from '@/components/WeeklyScheduleTable.vue'

const {
  animes,
  loading,
  error,
  seasonOptions,
  mediaFilterOptions,
  season,
  year,
  mediaFilter,
  page,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  seasonLabel,
  mediaFilterLabel,
  fetchAnime,
  fetchWeeklySchedule,
  weeklyScheduleDays,
  weeklyScheduleLabel,
  scheduleLoading,
  scheduleError,
} = useAnime()

useTheme()

const formatMediaFilter = (value: string) => {
  if (value === 'MOVIE') return 'Movie'
  if (value === 'SHOWS') return 'Shows'
  return 'All'
}

const goToPage = async (nextPage: number) => {
  if (nextPage < 1 || nextPage > totalPages.value) return

  page.value = nextPage
  await fetchAnime()
}

watch(
  [season, year, mediaFilter],
  (_, __, onCleanup) => {
    page.value = 1

    const timer = window.setTimeout(() => {
      fetchAnime()
      fetchWeeklySchedule()
    }, 250)

    onCleanup(() => {
      window.clearTimeout(timer)
    })
  },
  { immediate: true },
)
</script>

<template>
  <section class="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 px-4 py-6 md:px-6 lg:px-8">
    <div class="rounded-sm p-5 md:p-6">
      <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] theme-subtle">Anime Explorer</p>
          <h1 class="mt-2 capitalize font-bold">Seasonal anime and weekly airings</h1>
          <p class="mt-2 max-w-3xl text-sm theme-muted">
            Season: {{ seasonLabel }} · {{ mediaFilterLabel }}
          </p>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1 text-sm">
            Season
            <select v-model="season" class="theme-button rounded-sm px-3 py-2">
              <option v-for="option in seasonOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            Year
            <input v-model.number="year" type="number" min="1900" max="2100"
              class="theme-button w-28 rounded-sm px-3 py-2">
          </label>

          <label class="flex flex-col gap-1 text-sm">
            Type
            <select v-model="mediaFilter" class="theme-button rounded-sm px-3 py-2">
              <option v-for="option in mediaFilterOptions" :key="option" :value="option">
                {{ formatMediaFilter(option) }}
              </option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div v-if="loading" class="theme-surface rounded-sm px-4 py-10 text-center theme-muted">
      Loading anime...
    </div>

    <div v-else-if="error" class="theme-surface rounded-sm px-4 py-10 text-red-400">
      Error: {{ error }}
    </div>

    <div v-else class="grid grid gap-4 md:grid-cols-3 xl:grid-cols-5 xl:gap-6">
      <AnimeCard v-for="anime in animes" :key="anime.id" :anime="anime" />
    </div>

    <div class="theme-surface flex items-center justify-between gap-4 rounded-sm px-4 py-4 md:px-6">
      <button type="button" class="theme-button rounded-sm px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!hasPreviousPage" @click="goToPage(page - 1)">
        Previous
      </button>

      <p class="text-sm theme-muted">
        Page {{ page }} of {{ totalPages }}
      </p>

      <button type="button" class="theme-button rounded-sm px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!hasNextPage" @click="goToPage(page + 1)">
        Next
      </button>
    </div>

    <WeeklyScheduleTable :days="weeklyScheduleDays" :label="weeklyScheduleLabel" :loading="scheduleLoading"
      :error="scheduleError" :is-movie-filter="mediaFilter === 'MOVIE'" />
  </section>
</template>
