import { i18next } from '@renderer-shared/i18n'
import type {
  ColorMode,
  GameResourceProviderValue
} from '@renderer-shared/providers/game-resource/types'
import type { OngoingGameProviderValue } from '@renderer-shared/providers/ongoing-game/types'
import type { QueryStage } from '@shared/shards/ongoing-game'
import { createDefaultOngoingGamePanelPlayerCardTagSettings } from '@shared/shards/ongoing-game/settings'
import { onMounted, onUnmounted, reactive, ref } from 'vue'

const AKARI_LEAGUE_CLIENT_PREFIX = 'akari://league-client'

export function useMobileOngoingGame() {
  const wsConnected = ref(false)
  const isFullscreen = ref(false)

  const rawState = reactive<{
    queryStage: QueryStage
    teams: Record<string, string[]>
    championSelections: Record<string, number>
    positionAssignments: Record<string, { position: string; role: any }>
    analysis: { players: any; teams: any } | null
    summoner: Record<string, any>
    rankedStats: Record<string, any>
    championMastery: Record<string, any>
    savedInfo: Record<string, any>
    draft: any
    mergedPremadeTeamMap: Record<string, number>
    matchHistory: Record<string, any>
    matchHistoryLoadingState: Record<string, string>
    additional: any
    cachedGames: Record<number, any>
    gameDetails: Record<number, any>
    settings: any
    gameData: {
      champions: Record<number, any>
      summonerSpells: Record<number, any>
      queues: Record<number, any>
      items: Record<number, any>
      perks: Record<number, any>
      augments: Record<number, any>
    }
    isConnected: boolean
    isSpectating: boolean
    streamerMode: boolean
    selfPuuid: string | null
  }>({
    queryStage: { phase: 'unavailable', gameInfo: null } as QueryStage,
    teams: {},
    championSelections: {},
    positionAssignments: {},
    analysis: null,
    summoner: {},
    rankedStats: {},
    championMastery: {},
    savedInfo: {},
    draft: null,
    mergedPremadeTeamMap: {},
    matchHistory: {},
    matchHistoryLoadingState: {},
    additional: {
      teams: {},
      selections: {},
      teamParticipantGroups: {},
      spells: {},
      positions: {}
    },
    cachedGames: {},
    gameDetails: {},
    settings: {
      enabled: true,
      matchHistoryLoadCount: 20,
      orderPlayerBy: 'default',
      showChampionUsage: 'recent',
      showMatchHistoryItemBorder: false,
      showJunglePathing: true,
      showJunglePathingForAllPlayers: false,
      playerCardTags: createDefaultOngoingGamePanelPlayerCardTagSettings()
    },
    gameData: {
      champions: {},
      summonerSpells: {},
      queues: {},
      items: {},
      perks: {},
      augments: {}
    },
    isConnected: false,
    isSpectating: false,
    streamerMode: false,
    selfPuuid: null
  })

  if (import.meta.env.DEV) {
    ;(window as any).__AKARI_MOBILE_RAW_STATE__ = rawState
    ;(window as any).__AKARI_APPLY_SNAPSHOT__ = (data: any) => {
      Object.assign(rawState, data)
    }
  }

  let ws: WebSocket | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  let isUnmounted = false

  const connectWebSocket = () => {
    if (isUnmounted) return

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${location.host}/ws`

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        wsConnected.value = true
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'snapshot' || message.type === 'update') {
            if (message.data.locale && message.data.locale !== i18next.language) {
              i18next.changeLanguage(message.data.locale)
            }
            Object.assign(rawState, message.data)
          }
        } catch {
          // ignore parse error
        }
      }

      ws.onclose = () => {
        wsConnected.value = false
        scheduleReconnect()
      }

      ws.onerror = () => {
        wsConnected.value = false
        ws?.close()
      }
    } catch {
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (isUnmounted || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connectWebSocket()
    }, 2000)
  }

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen()
        isFullscreen.value = true
      } catch {
        // fallback
      }
    } else {
      try {
        await document.exitFullscreen()
        isFullscreen.value = false
      } catch {
        // fallback
      }
    }
  }

  const handleFullscreenChange = () => {
    isFullscreen.value = Boolean(document.fullscreenElement)
  }

  onMounted(() => {
    connectWebSocket()
    document.addEventListener('fullscreenchange', handleFullscreenChange)
  })

  onUnmounted(() => {
    isUnmounted = true
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
  })

  // 1. OngoingGameProviderValue
  const ongoingGameProviderValue: OngoingGameProviderValue = {
    get settings() {
      return rawState.settings
    },
    get queryStage() {
      return rawState.queryStage
    },
    get draft() {
      return rawState.draft
    },
    get teams() {
      return rawState.teams
    },
    get championSelections() {
      return rawState.championSelections
    },
    get positionAssignments() {
      return rawState.positionAssignments
    },
    get mergedPremadeTeamMap() {
      return rawState.mergedPremadeTeamMap
    },
    get analysis() {
      return rawState.analysis
    },
    get summoner() {
      return rawState.summoner
    },
    get rankedStats() {
      return rawState.rankedStats
    },
    get championMastery() {
      return rawState.championMastery
    },
    get savedInfo() {
      return rawState.savedInfo
    },
    get cachedGames() {
      return rawState.cachedGames
    },
    get gameDetails() {
      return rawState.gameDetails
    },
    get matchHistory() {
      return rawState.matchHistory
    },
    get matchHistoryLoadingState() {
      return rawState.matchHistoryLoadingState
    },
    get spells() {
      return rawState.additional?.spells || {}
    },
    get isConnected() {
      return rawState.isConnected
    },
    get isSpectating() {
      return rawState.isSpectating
    },
    get streamerMode() {
      return rawState.streamerMode
    },
    get selfPuuid() {
      return rawState.selfPuuid
    },
    reloadPlayer() {
      // no-op in mobile client for phase 1
    }
  }

  // 2. GameResourceProviderValue (Asset resolution through /api/asset proxy)
  const gameResourceProviderValue: GameResourceProviderValue = {
    runtime: {
      get locale() {
        return 'zh-CN'
      },
      get colorMode(): ColorMode {
        return 'dark'
      }
    },
    assets: {
      resolve(source: string): string | null {
        if (!source) return null
        const trimmed = source.trim()
        if (!trimmed) return null

        if (trimmed.startsWith(AKARI_LEAGUE_CLIENT_PREFIX)) {
          const lcuPath = trimmed.slice(AKARI_LEAGUE_CLIENT_PREFIX.length)
          return `/api/asset?uri=${encodeURIComponent(lcuPath)}`
        }

        if (trimmed.startsWith('/lol-game-data/') || trimmed.startsWith('/assets/')) {
          return `/api/asset?uri=${encodeURIComponent(trimmed)}`
        }

        if (
          trimmed.startsWith('http://') ||
          trimmed.startsWith('https://') ||
          trimmed.startsWith('data:')
        ) {
          return trimmed
        }

        return `/api/asset?uri=${encodeURIComponent(trimmed.startsWith('/') ? trimmed : `/${trimmed}`)}`
      }
    },
    champions: {
      name(id: number) {
        return rawState.gameData.champions[id]?.name || id.toString()
      },
      icon(id: number) {
        const champ = rawState.gameData.champions[id]
        const iconPath =
          champ?.squarePortraitPath || `/lol-game-data/assets/v1/champion-icons/${id}.png`
        return {
          id,
          iconPath: `/api/asset?uri=${encodeURIComponent(iconPath)}`,
          source: 'url'
        }
      }
    },
    queues: {
      name(id: number) {
        return rawState.gameData.queues[id]?.name || id.toString()
      }
    },
    maps: {
      name(id: number) {
        return `Map ${id}`
      }
    },
    items: {
      display(id: number) {
        const item = rawState.gameData.items[id]
        if (!item) return null
        return {
          id,
          name: item.name || '',
          iconPath: `/api/asset?uri=${encodeURIComponent(item.iconPath || '')}`,
          descriptionHtml: item.description || '',
          price: item.price || 0,
          totalPrice: item.totalPrice || 0,
          from: [],
          to: []
        }
      }
    },
    perks: {
      name(id: number) {
        return rawState.gameData.perks[id]?.name || id.toString()
      },
      display(id: number) {
        const perk = rawState.gameData.perks[id]
        if (!perk) return null
        return {
          id,
          name: perk.name || '',
          iconPath: `/api/asset?uri=${encodeURIComponent(perk.iconPath || '')}`,
          longDescriptionHtml: perk.longDesc || '',
          endOfGameStatDescriptions: []
        }
      }
    },
    perkStyles: {
      display(_id: number) {
        return null
      }
    },
    summonerSpells: {
      name(id: number) {
        return rawState.gameData.summonerSpells[id]?.name || id.toString()
      },
      display(id: number) {
        const spell = rawState.gameData.summonerSpells[id]
        if (!spell) return null
        return {
          id,
          name: spell.name || '',
          iconPath: `/api/asset?uri=${encodeURIComponent(spell.iconPath || '')}`,
          description: spell.description || '',
          cooldown: spell.cooldown || 0,
          summonerLevel: 1
        }
      }
    },
    augments: {
      name(id: number) {
        return rawState.gameData.augments[id]?.name || id.toString()
      },
      display(id: number) {
        const aug = rawState.gameData.augments[id]
        if (!aug) return null
        return {
          id,
          name: aug.name || '',
          iconPath: `/api/asset?uri=${encodeURIComponent(aug.iconPath || '')}`,
          rarity: aug.rarity || 'kSilver'
        }
      }
    }
  }

  return {
    rawState,
    wsConnected,
    isFullscreen,
    toggleFullscreen,
    ongoingGameProviderValue,
    gameResourceProviderValue
  }
}
