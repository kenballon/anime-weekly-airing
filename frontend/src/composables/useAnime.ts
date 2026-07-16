import { computed, ref } from 'vue'

export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
export type AnimeMediaFilter = 'ALL' | 'MOVIE' | 'SHOWS'

const seasonOptions: AnimeSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
const mediaFilterOptions: AnimeMediaFilter[] = ['ALL', 'MOVIE', 'SHOWS']
const CACHE_POLICY = {
    anime: {
        prefix: 'anime-updater:anime',
        ttlMs: 30 * 60 * 1000,
        label: '30 minutes',
    },
    schedule: {
        prefix: 'anime-updater:schedule',
        ttlMs: 15 * 60 * 1000,
        label: '15 minutes',
    },
} as const

type CachedPayload<T> = {
    savedAt: number
    data: T
}

const requestCache = new Map<string, Promise<unknown>>()

export type Anime = {
    id: number
    title: {
        romaji: string
        english: string | null
        native?: string | null
    }
    coverImage: {
        large: string
        color: string | null
    }
    startDate: {
        year: number | null
        month: number | null
        day: number | null
    }
    format: string | null
    status: string | null
    episodes: number | null
    averageScore: number | null
    siteUrl: string
}

export type AiringScheduleItem = {
    id: number
    airingAt: number
    episode: number
    media: {
        id: number
        title: {
            romaji: string
            english: string | null
            native?: string | null
        }
        coverImage: {
            large: string
            color: string | null
        }
        format: string | null
        status: string | null
        siteUrl: string
    }
}

export type WeeklyScheduleDay = {
    key: string
    label: string
    entries: AiringScheduleItem[]
}

export type DataSource = 'cache' | 'live'

const getCurrentAnimeSeason = () => {
    const now = new Date()
    const month = now.getMonth()
    const season: AnimeSeason =
        month < 3 ? 'WINTER' :
            month < 6 ? 'SPRING' :
                month < 9 ? 'SUMMER' :
                    'FALL'

    return {
        season,
        year: now.getFullYear(),
        label: `${season.charAt(0)}${season.slice(1).toLowerCase()} ${now.getFullYear()}`
    }
}

const formatDateLabel = (date: Date) =>
    new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
    }).format(date)

const getMondayOfCurrentWeek = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day

    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() + diff)
    return monday
}

const getWeekDays = () => {
    const monday = getMondayOfCurrentWeek()

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday)
        date.setDate(monday.getDate() + index)

        return {
            key: date.toISOString().slice(0, 10),
            label: `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]} ${formatDateLabel(date)}`,
            date,
        }
    })
}

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const cacheKey = (prefix: string, parts: Array<string | number | null | undefined>) =>
    [prefix, ...parts.map((part) => String(part ?? ''))].join('|')

const readCache = <T>(key: string, ttlMs: number): T | null => {
    if (!isBrowser()) return null

    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return null

        const parsed = JSON.parse(raw) as Partial<CachedPayload<T>>
        if (!parsed || typeof parsed.savedAt !== 'number' || !('data' in parsed)) return null

        if (Date.now() - parsed.savedAt > ttlMs) {
            window.localStorage.removeItem(key)
            return null
        }

        return parsed.data as T
    } catch {
        return null
    }
}

const writeCache = <T>(key: string, data: T) => {
    if (!isBrowser()) return

    try {
        const payload: CachedPayload<T> = {
            savedAt: Date.now(),
            data,
        }
        window.localStorage.setItem(key, JSON.stringify(payload))
    } catch {
        // Ignore quota/privacy mode failures and fall back to network.
    }
}

const withDedupedRequest = async <T>(key: string, request: () => Promise<T>) => {
    const existing = requestCache.get(key) as Promise<T> | undefined
    if (existing) return existing

    const pending = request().finally(() => {
        requestCache.delete(key)
    })

    requestCache.set(key, pending)
    return pending
}

export function useAnime() {
    const animes = ref<Anime[]>([])
    const airingSchedule = ref<AiringScheduleItem[]>([])
    const loading = ref(false)
    const scheduleLoading = ref(false)
    const error = ref<string | null>(null)
    const scheduleError = ref<string | null>(null)
    const currentSeason = getCurrentAnimeSeason()
    const season = ref<AnimeSeason>(currentSeason.season)
    const year = ref<number>(currentSeason.year)
    const mediaFilter = ref<AnimeMediaFilter>('ALL')
    const search = ref('')
    const page = ref(1)
    const perPage = ref(15)
    const totalPages = ref(1)
    const hasNextPage = ref(false)
    const animeLastUpdatedAt = ref<number | null>(null)
    const scheduleLastUpdatedAt = ref<number | null>(null)
    const animeDataSource = ref<DataSource>('live')
    const scheduleDataSource = ref<DataSource>('live')
    const hasPreviousPage = computed(() => page.value > 1)
    const seasonLabel = computed(() => `${season.value.charAt(0)}${season.value.slice(1).toLowerCase()} ${year.value}`)
    const mediaFilterLabel = computed(() => {
        if (mediaFilter.value === 'MOVIE') return 'Movies'
        if (mediaFilter.value === 'SHOWS') return 'Shows'
        return 'All'
    })
    const getFormatFilter = () => {
        if (mediaFilter.value === 'MOVIE') return 'format_in: [MOVIE]'
        if (mediaFilter.value === 'SHOWS') return 'format_in: [TV]'
        return ''
    }

    const fetchAnime = async (options?: { force?: boolean }) => {
        const formatFilter = getFormatFilter()
        const requestKey = cacheKey(CACHE_POLICY.anime.prefix, [
            season.value,
            year.value,
            mediaFilter.value,
            search.value.trim().toLowerCase(),
            page.value,
            perPage.value,
            formatFilter,
        ])
        const cached = options?.force ? null : readCache<{
            animes: Anime[]
            totalPages: number
            hasNextPage: boolean
        }>(requestKey, CACHE_POLICY.anime.ttlMs)

        if (cached) {
            loading.value = false
            error.value = null
            animes.value = cached.animes
            totalPages.value = cached.totalPages
            hasNextPage.value = cached.hasNextPage
            animeLastUpdatedAt.value = Date.now()
            animeDataSource.value = 'cache'
            return
        }

        loading.value = true
        error.value = null

        try {
            const result = await withDedupedRequest(requestKey, async () => {
                const query = `
                    query CurrentSeasonAnime($season: MediaSeason, $seasonYear: Int, $search: String, $page: Int, $perPage: Int) {
                        Page(page: $page, perPage: $perPage) {
                            pageInfo {
                                currentPage
                                lastPage
                                hasNextPage
                            }
                            media(
                                type: ANIME
                                season: $season
                                seasonYear: $seasonYear
                                search: $search
                                ${formatFilter}
                                sort: POPULARITY_DESC
                            ) {
                                id
                                title {
                                    romaji
                                    english
                                    native
                                }
                                coverImage {
                                    large
                                    color
                                }
                                startDate {
                                    year
                                    month
                                    day
                                }
                                format
                                status
                                episodes
                                averageScore
                                siteUrl
                            }
                        }
                    }
                `

                const response = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        query,
                        variables: {
                            season: season.value,
                            seasonYear: year.value,
                            search: search.value.trim() || null,
                            page: page.value,
                            perPage: perPage.value,
                        },
                    }),
                })

                const data = await response.json()

                if (!response.ok) {
                    const apiMessage =
                        data?.errors?.[0]?.message ||
                        data?.error ||
                        'Failed to fetch anime'

                    throw new Error(apiMessage)
                }

                return data
            }) as {
                data?: {
                    Page?: {
                        pageInfo?: {
                            currentPage?: number
                            lastPage?: number
                            hasNextPage?: boolean
                        }
                        media?: Anime[]
                    }
                }
            }

            const pageInfo = result?.data?.Page?.pageInfo

            animes.value = result?.data?.Page?.media ?? []
            totalPages.value = pageInfo?.lastPage ?? 1
            hasNextPage.value = Boolean(pageInfo?.hasNextPage)
            animeLastUpdatedAt.value = Date.now()
            animeDataSource.value = 'live'
            writeCache(requestKey, {
                animes: animes.value,
                totalPages: totalPages.value,
                hasNextPage: hasNextPage.value,
            })
        } catch (err: unknown) {
            error.value = err instanceof Error ? err.message : 'Failed to fetch anime'
            console.error(err)
        } finally {
            loading.value = false
        }
    }

    const fetchWeeklySchedule = async (options?: { force?: boolean }) => {
        const weekDays = getWeekDays()
        const start = Math.floor(weekDays[0].date.getTime() / 1000)
        const end = Math.floor(new Date(weekDays[6].date.getTime() + 24 * 60 * 60 * 1000).getTime() / 1000)
        const requestKey = cacheKey(CACHE_POLICY.schedule.prefix, [
            mediaFilter.value,
            start,
            end,
        ])
        const cached = options?.force ? null : readCache<AiringScheduleItem[]>(requestKey, CACHE_POLICY.schedule.ttlMs)

        if (cached) {
            scheduleLoading.value = false
            scheduleError.value = null
            airingSchedule.value = cached
            scheduleLastUpdatedAt.value = Date.now()
            scheduleDataSource.value = 'cache'
            return
        }

        scheduleLoading.value = true
        scheduleError.value = null

        try {
            if (mediaFilter.value === 'MOVIE') {
                airingSchedule.value = []
                return
            }

            const result = await withDedupedRequest(requestKey, async () => {
                const query = `
                    query WeeklyAiringSchedule($page: Int, $perPage: Int, $airingAt_greater: Int, $airingAt_lesser: Int) {
                        Page(page: $page, perPage: $perPage) {
                            airingSchedules(
                                airingAt_greater: $airingAt_greater
                                airingAt_lesser: $airingAt_lesser
                                sort: TIME
                            ) {
                                id
                                airingAt
                                episode
                                media {
                                    id
                                    title {
                                        romaji
                                        english
                                    }
                                    coverImage {
                                        large
                                        color
                                    }
                                    format
                                    status
                                    siteUrl
                                }
                            }
                        }
                    }
                `

                const response = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        query,
                        variables: {
                            page: 1,
                            perPage: 100,
                            airingAt_greater: start,
                            airingAt_lesser: end,
                        },
                    }),
                })

                const data = await response.json()

                if (!response.ok) {
                    const apiMessage =
                        data?.errors?.[0]?.message ||
                        data?.error ||
                        'Failed to fetch schedule'

                    throw new Error(apiMessage)
                }

                return data
            }) as {
                data?: {
                    Page?: {
                        airingSchedules?: AiringScheduleItem[]
                    }
                }
            }

            airingSchedule.value = result?.data?.Page?.airingSchedules ?? []
            scheduleLastUpdatedAt.value = Date.now()
            scheduleDataSource.value = 'live'
            writeCache(requestKey, airingSchedule.value)
        } catch (err: unknown) {
            scheduleError.value = err instanceof Error ? err.message : 'Failed to fetch schedule'
            console.error(err)
        } finally {
            scheduleLoading.value = false
        }
    }

    const weeklyScheduleDays = computed<WeeklyScheduleDay[]>(() => {
        const weekDays = getWeekDays()

        return weekDays.map((day) => {
            const targetIndex = (new Date(day.date).getDay() + 6) % 7

            return {
                key: day.key,
                label: day.label,
                entries: airingSchedule.value.filter((item) => {
                    return ((new Date(item.airingAt * 1000).getDay() + 6) % 7) === targetIndex
                }),
            }
        })
    })

    const weeklyScheduleLabel = computed(() => {
        const weekDays = getWeekDays()
        return `${weekDays[0].label} - ${weekDays[6].label}`
    })

    return {
        animes,
        airingSchedule,
        loading,
        scheduleLoading,
        error,
        scheduleError,
        animeLastUpdatedAt,
        scheduleLastUpdatedAt,
        animeDataSource,
        scheduleDataSource,
        cachePolicy: CACHE_POLICY,
        currentSeason,
        seasonOptions,
        mediaFilterOptions,
        season,
        year,
        mediaFilter,
        search,
        page,
        perPage,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        seasonLabel,
        mediaFilterLabel,
        weeklyScheduleDays,
        weeklyScheduleLabel,
        fetchAnime,
        fetchWeeklySchedule,
    }
}
