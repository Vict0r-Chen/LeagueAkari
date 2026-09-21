<template>
  <div
    class="mobile-player-card group relative box-border flex cursor-pointer flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/90 p-2 shadow-md transition-all select-none hover:border-blue-500/50 hover:shadow-blue-500/10 active:scale-[0.98]"
    :style="{
      borderColor: premadeTeamId ? premadeColors[premadeTeamId]?.borderColor : undefined,
      boxShadow: premadeTeamId
        ? `0 0 10px ${premadeColors[premadeTeamId]?.borderColor}30`
        : undefined
    }"
    @click="emit('select', puuid)"
  >
    <!-- Premade team corner deco -->
    <div
      v-if="premadeTeamId"
      class="absolute top-0 right-0 z-10 h-4 w-4 translate-x-1/2 -translate-y-1/2 rotate-45"
      :style="{
        backgroundColor: premadeColors[premadeTeamId]?.foregroundColor
      }"
    />

    <!-- Header info: champion avatar, summoner name, ranks -->
    <PlayerInfoCardHeader :puuid="puuid" />

    <!-- Stats: win rate, KDA, position & autofill -->
    <PlayerInfoCardStats :puuid="puuid" />

    <!-- Jungle pathing if applicable -->
    <PlayerInfoCardJunglePathing :puuid="puuid" />

    <!-- Tags area: met, easy gank, solo kills, streaks, etc. -->
    <PlayerCardTagsArea :puuid="puuid" />

    <!-- Champion usage pool -->
    <PlayerInfoCardChampionUsage :puuid="puuid" />

    <!-- Clickable footer hint -->
    <div
      class="mt-1 flex items-center justify-between border-t border-white/10 pt-1 text-[11px] text-white/40 transition-colors group-hover:text-blue-400"
    >
      <span class="font-medium">历史战绩详情</span>
      <NIcon
        :component="ChevronRight"
        class="text-xs transition-transform group-hover:translate-x-0.5"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameResourceProvider } from '@renderer-shared/providers/game-resource'
import {
  PREMADE_TEAM_COLORS,
  PREMADE_TEAM_COLORS_LIGHT
} from '@renderer-shared/components/ongoing-game-panel/constants'
import { useOngoingGamePanel } from '@renderer-shared/components/ongoing-game-panel/context'
import PlayerCardTagsArea from '@renderer-shared/components/ongoing-game-panel/widgets/player-info-card/player-card-tags/TagsArea.vue'
import PlayerInfoCardChampionUsage from '@renderer-shared/components/ongoing-game-panel/widgets/player-info-card/PlayerInfoCardChampionUsage.vue'
import PlayerInfoCardHeader from '@renderer-shared/components/ongoing-game-panel/widgets/player-info-card/PlayerInfoCardHeader.vue'
import PlayerInfoCardJunglePathing from '@renderer-shared/components/ongoing-game-panel/widgets/player-info-card/PlayerInfoCardJunglePathing.vue'
import PlayerInfoCardStats from '@renderer-shared/components/ongoing-game-panel/widgets/player-info-card/PlayerInfoCardStats.vue'
import { ChevronRight } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'

const { puuid } = defineProps<{
  puuid: string
}>()

const emit = defineEmits<{
  select: [puuid: string]
}>()

const { mergedPremadeTeams } = useOngoingGamePanel()
const resources = useGameResourceProvider()

const premadeTeamId = computed(() => mergedPremadeTeams.value.premadeTeamIdMap[puuid])

const premadeColors = computed(() => {
  return resources.runtime.colorMode === 'dark' ? PREMADE_TEAM_COLORS : PREMADE_TEAM_COLORS_LIGHT
})
</script>

<style scoped>
.mobile-player-card {
  touch-action: manipulation;
}
</style>
