<template>
  <NConfigProvider :theme="darkTheme" abstract inline-theme-disabled>
    <NMessageProvider placement="bottom">
      <NNotificationProvider>
        <NDialogProvider>
          <GameResourceProvider :value="gameResourceProviderValue">
            <OngoingGameProvider :value="ongoingGameProviderValue">
              <div class="mobile-viewport" :class="{ 'is-portrait': isPortrait }">
                <!-- Portrait tip bar (show only in auto/detected portrait mode) -->
                <div v-if="isPortrait && orientationMode === 'auto'" class="portrait-tip">
                  <NIcon :component="DeviceMobileRotated" class="mr-1.5 text-base" />
                  <span>建议旋转手机至横屏，以获得最佳对局看板体验</span>
                </div>

                <!-- Floating Toolbar -->
                <div class="floating-controls">
                  <!-- Connection status badge -->
                  <div
                    class="status-badge"
                    :class="{
                      'status-connected': wsConnected,
                      'status-disconnected': !wsConnected
                    }"
                  >
                    <span class="status-dot"></span>
                    <span class="text-xs">{{ wsConnected ? '已连接' : '重连中...' }}</span>
                  </div>

                  <!-- Game Stage badge -->
                  <div v-if="phaseText" class="stage-badge text-xs">
                    {{ phaseText }}
                  </div>

                  <!-- Orientation toggle button -->
                  <button
                    class="ctrl-btn cursor-pointer"
                    :title="isPortrait ? '切换为横屏看板' : '切换为竖屏列表'"
                    @click="toggleOrientation"
                  >
                    <NIcon :component="isPortrait ? DeviceMobileRotated : DeviceMobile" />
                  </button>

                  <!-- Reload button -->
                  <button class="ctrl-btn cursor-pointer" title="刷新页面" @click="reloadPage">
                    <NIcon :component="Refresh" />
                  </button>
                </div>

                <!-- Idle state: No ongoing game -->
                <div v-if="isInIdleState" class="idle-container">
                  <div class="flex flex-col items-center gap-3">
                    <template v-if="!wsConnected">
                      <NIcon class="text-5xl text-white/30" :component="PlugConnected" />
                      <div class="text-sm text-white/60">连接 League Akari 客户端中...</div>
                    </template>
                    <template v-else-if="rawState.queryStage.phase === 'unavailable'">
                      <NIcon class="text-5xl text-white/30" :component="GameController" />
                      <div class="text-sm text-white/70">暂无进行中的对局</div>
                      <div class="text-xs text-white/40">进入选人或对局后将自动同步对局数据</div>
                    </template>
                    <template v-else>
                      <NIcon class="text-5xl text-white/30" :component="TimeOutline" />
                      <div class="text-sm text-white/70">等待对局就绪...</div>
                    </template>
                  </div>
                </div>

                <!-- Game Active state: Portrait natural scroll view -->
                <div v-else-if="isPortrait" class="portrait-game-container">
                  <div
                    v-for="(players, teamIdentifier) in sortedTeams"
                    :key="teamIdentifier"
                    class="team-group mb-4"
                  >
                    <div class="mb-2 flex items-center gap-2 px-1">
                      <span
                        v-if="getTeamIndicatorColorClass(String(teamIdentifier))"
                        class="size-2.5 rounded-full"
                        :class="getTeamIndicatorColorClass(String(teamIdentifier))"
                      />
                      <span class="text-sm font-bold text-white/90">
                        {{ getTeamName(String(teamIdentifier)) }}
                      </span>
                      <TeamTagsArea
                        v-if="players.length >= 1"
                        :teamIdentifier="String(teamIdentifier)"
                      />
                    </div>

                    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <MobilePlayerCard
                        v-for="puuid in players"
                        :key="puuid"
                        :puuid="puuid"
                        @select="openModal"
                      />
                    </div>
                  </div>
                </div>

                <!-- Game Active state: Landscape scaled 5x2 overview stage (100% full screen wrapper) -->
                <div v-else class="stage-wrapper">
                  <div
                    class="stage-content"
                    :style="{
                      width: `${BASE_WIDTH}px`,
                      height: `${BASE_HEIGHT}px`,
                      transform: `scale(${scale})`
                    }"
                  >
                    <div class="box-border flex h-full w-full flex-col justify-between p-3">
                      <div
                        v-for="(players, teamIdentifier) in sortedTeams"
                        :key="teamIdentifier"
                        class="team-landscape-group flex flex-col"
                      >
                        <!-- Team header with tags -->
                        <div class="mb-1 flex items-center gap-2 px-1">
                          <span
                            v-if="getTeamIndicatorColorClass(String(teamIdentifier))"
                            class="size-2.5 rounded-full"
                            :class="getTeamIndicatorColorClass(String(teamIdentifier))"
                          />
                          <span class="text-sm font-bold text-white/90">
                            {{ getTeamName(String(teamIdentifier)) }}
                          </span>
                          <TeamTagsArea
                            v-if="players.length >= 1"
                            :teamIdentifier="String(teamIdentifier)"
                          />
                        </div>

                        <!-- 5 columns cards -->
                        <div class="grid grid-cols-5 gap-2">
                          <MobilePlayerCard
                            v-for="puuid in players"
                            :key="puuid"
                            :puuid="puuid"
                            @select="openModal"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Detailed match history modal (unscaled, native viewport) -->
                <MobileMatchHistoryModal v-model:show="isModalOpen" :puuid="selectedPuuid" />
              </div>
            </OngoingGameProvider>
          </GameResourceProvider>
        </NDialogProvider>
      </NNotificationProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { GameResourceProvider } from '@renderer-shared/providers/game-resource'
import { OngoingGameProvider } from '@renderer-shared/providers/ongoing-game'
import {
  POSITION_ORDER,
  PREMADE_TEAMS
} from '@renderer-shared/components/ongoing-game-panel/constants'
import {
  getOngoingGamePanelKdaOutliers,
  provideOngoingGamePanel
} from '@renderer-shared/components/ongoing-game-panel/context'
import { getTeamIndicatorColorClass } from '@renderer-shared/components/ongoing-game-panel/utils/theme'
import TeamTagsArea from '@renderer-shared/components/ongoing-game-panel/widgets/TeamTagsArea.vue'
import { GameController, TimeOutline } from '@vicons/ionicons5'
import { DeviceMobile, DeviceMobileRotated, PlugConnected, Refresh } from '@vicons/tabler'
import {
  darkTheme,
  NConfigProvider,
  NDialogProvider,
  NIcon,
  NMessageProvider,
  NNotificationProvider
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import MobileMatchHistoryModal from './components/MobileMatchHistoryModal.vue'
import MobilePlayerCard from './components/MobilePlayerCard.vue'
import { useMobileOngoingGame } from './composables/useMobileOngoingGame'
import { useWakeLock } from './composables/useWakeLock'

// Prevent mobile screen from sleeping or locking in PWA / browser
useWakeLock()

const BASE_WIDTH = 1140
const BASE_HEIGHT = 560

// Dynamic viewport dimensions with multi-stage updates on rotate
const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)

const updateDimensions = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}

onMounted(() => {
  window.addEventListener('resize', updateDimensions)
  window.addEventListener('orientationchange', () => {
    setTimeout(updateDimensions, 100)
    setTimeout(updateDimensions, 300)
  })
  if (window.screen?.orientation) {
    window.screen.orientation.addEventListener('change', () => {
      setTimeout(updateDimensions, 100)
      setTimeout(updateDimensions, 300)
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateDimensions)
})

// Orientation mode: 'auto' (follow device) | 'portrait' (force portrait) | 'landscape' (force landscape)
const orientationMode = ref<'auto' | 'portrait' | 'landscape'>('auto')

const isPortrait = computed(() => {
  if (orientationMode.value === 'portrait') return true
  if (orientationMode.value === 'landscape') return false
  return windowHeight.value > windowWidth.value
})

const toggleOrientation = () => {
  if (isPortrait.value) {
    orientationMode.value = 'landscape'
  } else {
    orientationMode.value = 'portrait'
  }
}

const reloadPage = () => {
  window.location.reload()
}

// Scale calculation: based on full-screen container dimensions with safe margin
const scale = computed(() => {
  const availWidth = windowWidth.value * 0.95
  const availHeight = Math.max(200, windowHeight.value - 44) * 0.94
  const horizontalScale = availWidth / BASE_WIDTH
  const verticalScale = availHeight / BASE_HEIGHT
  return Math.min(horizontalScale, verticalScale)
})

const { rawState, wsConnected, ongoingGameProviderValue, gameResourceProviderValue } =
  useMobileOngoingGame()

const isInIdleState = computed(() => rawState.queryStage.phase === 'unavailable')

const phaseText = computed(() => {
  const phase = rawState.queryStage.phase
  switch (phase) {
    case 'champ-select':
      return 'BP 选人阶段'
    case 'in-game':
      return '对局进行中'
    case 'draft':
      return '草稿对局模式'
    case 'lobby':
      return '组队房间中'
    case 'unavailable':
      return '等待对局中'
    default:
      return null
  }
})

// Premade groups mapping
const mergedPremadeTeams = computed(() => {
  if (
    ongoingGameProviderValue.queryStage.phase === 'lobby' ||
    ongoingGameProviderValue.queryStage.phase === 'unavailable'
  ) {
    return {
      groups: {},
      premadeTeamIdMap: {}
    }
  }

  const playerMap: {
    groups: Record<string, string[]>
    premadeTeamIdMap: Record<string, string>
  } = {
    groups: {},
    premadeTeamIdMap: {}
  }

  for (const [puuid, premadeId] of Object.entries(ongoingGameProviderValue.mergedPremadeTeamMap)) {
    const groupId = PREMADE_TEAMS[premadeId - 1]
    if (groupId) {
      if (playerMap.groups[groupId]) {
        playerMap.groups[groupId].push(puuid)
      } else {
        playerMap.groups[groupId] = [puuid]
      }
      playerMap.premadeTeamIdMap[puuid] = groupId
    }
  }

  return playerMap
})

// Sorted teams
const sortedTeams = computed(() => {
  if (!ongoingGameProviderValue.teams) {
    return {}
  }

  const sorted: Record<string, string[]> = {}

  Object.entries(ongoingGameProviderValue.teams).forEach(([team, players]) => {
    if (!players.length) {
      return
    }

    sorted[team] = players.toSorted((a, b) => {
      if (ongoingGameProviderValue.settings.orderPlayerBy === 'position') {
        const pa = ongoingGameProviderValue.positionAssignments[a]?.position || 'NONE'
        const pb = ongoingGameProviderValue.positionAssignments[b]?.position || 'NONE'
        return (POSITION_ORDER[pa] ?? 0) - (POSITION_ORDER[pb] ?? 0)
      }

      if (ongoingGameProviderValue.settings.orderPlayerBy === 'premade-team') {
        const info = mergedPremadeTeams.value
        const idMap = info.premadeTeamIdMap
        const groups = info.groups

        const teamA = idMap[a]
        const teamB = idMap[b]

        if (!!teamA !== !!teamB) {
          return teamA ? -1 : 1
        }

        if ((!teamA && !teamB) || teamA === teamB) return 0

        const sizeDiff = (groups[teamB]?.length || 0) - (groups[teamA]?.length || 0)
        if (sizeDiff) return sizeDiff

        return teamA.localeCompare(teamB)
      }

      const statsA = ongoingGameProviderValue.analysis?.players[a]
      const statsB = ongoingGameProviderValue.analysis?.players[b]

      if (ongoingGameProviderValue.settings.orderPlayerBy === 'akari-score') {
        return (statsB?.akariScore.total || 0) - (statsA?.akariScore.total || 0)
      }

      if (ongoingGameProviderValue.settings.orderPlayerBy === 'kda') {
        return (statsB?.summary.avgKda || 0) - (statsA?.summary.avgKda || 0)
      }

      if (ongoingGameProviderValue.settings.orderPlayerBy === 'win-rate') {
        return (statsB?.summary.winRate || 0) - (statsA?.summary.winRate || 0)
      }

      return 0
    })
  })

  return sorted
})

const isTwoTeamsMode = computed(() => {
  return Object.keys(sortedTeams.value).some((t) => t === 'TEAM-100' || t === 'TEAM-200')
})

const kdaOutliers = computed(() =>
  getOngoingGamePanelKdaOutliers(ongoingGameProviderValue.analysis)
)

function getTeamName(team: string) {
  if (team === 'TEAM-100') return '蓝方队伍'
  if (team === 'TEAM-200') return '红方队伍'
  if (team === 'LOBBY') return '组队房间'
  return team
}

// Modal state
const selectedPuuid = ref<string | null>(null)
const isModalOpen = ref(false)

function openModal(puuid: string) {
  selectedPuuid.value = puuid
  isModalOpen.value = true
}

// Provide context required by child widgets
provideOngoingGamePanel({
  contentWidth: () => (isPortrait.value ? windowWidth.value : BASE_WIDTH),
  contentHeight: () => (isPortrait.value ? windowHeight.value : BASE_HEIGHT),
  columnsNeed: computed(() => 5),
  linesPerTeam: computed(() => 1),
  isTwoTeamsMode,
  mergedPremadeTeams,
  ongoingGame: computed(() => ongoingGameProviderValue),
  isStandaloneOngoingGameWindow: computed(() => true),
  kdaOutliers,
  navigateToSummonerByPuuid: (puuid) => {
    openModal(puuid)
  },
  previewGame: () => {}
})
</script>

<style scoped>
.mobile-viewport {
  position: relative;
  width: 100vw;
  height: 100dvh;
  min-height: -webkit-fill-available;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0b0e14;
  touch-action: pan-x pan-y;
}

.mobile-viewport.is-portrait {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  align-items: flex-start;
  justify-content: flex-start;
}

.portrait-tip {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 34px;
  background-color: rgba(234, 179, 8, 0.18);
  color: #fbbf24;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  z-index: 999;
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(234, 179, 8, 0.3);
}

.floating-controls {
  position: fixed;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 100;
  backdrop-filter: blur(12px);
  background-color: rgba(15, 18, 24, 0.85);
  padding: 3px 8px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 6px;
  border-radius: 12px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-connected .status-dot {
  background-color: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.status-disconnected .status-dot {
  background-color: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}

.stage-badge {
  padding: 2px 7px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.1);
  color: #e5e7eb;
}

.ctrl-btn {
  background: none;
  border: none;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 6px;
  font-size: 16px;
  transition: all 0.2s;
}

.ctrl-btn:hover {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.12);
}

.idle-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.portrait-game-container {
  width: 100%;
  min-height: 100dvh;
  padding: 56px 12px 32px 12px;
  box-sizing: border-box;
}

.stage-wrapper {
  position: relative;
  width: 100vw;
  height: 100dvh;
  min-height: -webkit-fill-available;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 16px 0;
}

.stage-content {
  position: relative;
  flex-shrink: 0;
  transform-origin: center center;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  box-sizing: border-box;
}
</style>
