<script setup lang="ts">
import type { Anime } from '@/composables/useAnime'

const formatStatus = (status: string | null) => {
  if (status === 'NOT_YET_RELEASED') return 'To Be Released'
  return status || 'TBA'
}

defineProps<{
  anime: Anime
}>()
</script>

<template>
  <a :href="anime.siteUrl" target="_blank" rel="noreferrer"
    class="group anime-card theme-surface theme-entry block overflow-hidden rounded-sm text-left no-underline">
    <div class="relative overflow-hidden">
      <img :src="anime.coverImage.large" :alt="anime.title.english || anime.title.romaji"
        class="h-64 w-full object-cover transition duration-300 group-hover:scale-105">
      <div class="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent opacity-70" />
    </div>

    <div class="p-4">
      <h3 class="line-clamp-2 text-lg font-semibold leading-snug">
        {{ anime.title.english || anime.title.romaji }}
      </h3>

      <p class="mt-1 text-sm theme-muted">
        {{ anime.startDate.year || 'TBA' }}
      </p>

      <div class="mt-3 flex flex-wrap gap-2">
        <span class="theme-chip rounded-full px-2.5 py-1 text-xs">
          {{ anime.format || 'TBA' }}
        </span>
        <span class="theme-chip rounded-full px-2.5 py-1 text-xs">
          {{ formatStatus(anime.status) }}
        </span>
        <span v-if="anime.averageScore" class="rounded-full px-2.5 py-1 text-xs"
          style="background: var(--accent-soft); color: var(--accent);">
          {{ anime.averageScore }}%
        </span>
      </div>
    </div>
  </a>
</template>
