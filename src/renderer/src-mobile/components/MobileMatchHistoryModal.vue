<template>
  <NModal
    :show="show"
    :mask-closable="true"
    :auto-focus="false"
    class="mobile-match-history-modal"
    @update:show="(val) => emit('update:show', val)"
  >
    <div
      class="modal-wrapper flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#141822] text-white shadow-2xl backdrop-blur-xl"
    >
      <!-- Modal Header -->
      <div
        class="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3"
      >
        <div class="flex min-w-0 items-center gap-3">
          <ChampionIcon
            v-if="championId"
            :champion-id="championId"
            round
            ring
            ring-color="rgba(255, 255, 255, 0.4)"
            class="size-11 shrink-0"
          />
          <div class="flex min-w-0 flex-col">
            <div class="flex items-center gap-1.5 truncate">
              <span class="truncate text-base font-bold text-white">{{ summonerName }}</span>
              <span class="text-xs text-white/50">#{{ tagLine }}</span>
              <span v-if="level" class="rounded bg-white/10 px-1 text-[10px] text-white/70">
                Lv.{{ level }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-xs text-white/60">
              <span v-if="tierText" class="font-medium text-amber-400/90">{{ tierText }}</span>
              <span v-if="winRateText" class="text-white/80">{{ winRateText }}</span>
              <span v-if="kdaText" class="text-blue-300">{{ kdaText }}</span>
            </div>
          </div>
        </div>

        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          @click="emit('update:show', false)"
        >
          <NIcon :component="X" class="text-xl" />
        </button>
      </div>

      <!-- Loading state -->
      <div
        v-if="loadingState === 'loading'"
        class="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-white/60"
      >
        <NSpin :size="22" />
        <span>加载战绩记录中...</span>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="matches.length === 0"
        class="flex flex-1 flex-col items-center justify-center py-16 text-sm text-white/50"
      >
        <NIcon :component="DeviceGamepad" class="mb-2 text-4xl text-white/20" />
        <span>暂无近期对局记录</span>
      </div>

      <!-- Match History List -->
      <div v-else class="modal-list-body flex-1 space-y-2 overflow-y-auto px-2.5 py-2">
        <div
          v-for="item in matches"
          :key="item.gameId"
          class="match-item relative flex flex-col gap-2 rounded-lg border p-2.5 transition-colors"
          :class="[
            item.participant.winResult === 'win'
              ? 'border-blue-500/30 bg-blue-950/25 hover:bg-blue-950/40'
              : item.participant.winResult === 'loss'
                ? 'border-rose-500/30 bg-rose-950/25 hover:bg-rose-950/40'
                : 'border-neutral-500/20 bg-neutral-900/40 hover:bg-neutral-900/60'
          ]"
        >
          <!-- Left Status strip -->
          <div
            class="absolute top-0 bottom-0 left-0 w-1 rounded-l-lg"
            :class="[
              item.participant.winResult === 'win'
                ? 'bg-blue-500'
                : item.participant.winResult === 'loss'
                  ? 'bg-rose-500'
                  : 'bg-neutral-500'
            ]"
          />

          <!-- Row 1: Champion, Spells, Mode, Time, Result, KDA -->
          <div class="flex items-center justify-between gap-2 pl-1.5">
            <!-- Left: Avatar + Spells + Mode & Time -->
            <div class="flex min-w-0 items-center gap-2">
              <!-- Champion avatar + level -->
              <div class="relative shrink-0">
                <ChampionIcon
                  :champion-id="item.participant.championId"
                  class="size-9 rounded-md bg-[#2a354b] shadow-inner"
                />
                <span
                  v-if="item.participant.level"
                  class="absolute -right-1 -bottom-1 rounded bg-black/85 px-1 text-[9px] font-bold text-white/90"
                >
                  {{ item.participant.level }}
                </span>
              </div>

              <!-- 2 Summoner Spells -->
              <div class="flex shrink-0 flex-col gap-0.5">
                <div
                  v-for="(spellId, sIdx) in item.participant.spells"
                  :key="sIdx"
                  class="size-4 overflow-hidden rounded border border-white/15 bg-black/60"
                >
                  <img
                    v-if="spellId && resources.summonerSpells.display(spellId)"
                    :src="resources.summonerSpells.display(spellId)?.iconPath"
                    :alt="resources.summonerSpells.display(spellId)?.name"
                    class="h-full w-full object-cover"
                  />
                </div>
              </div>

              <!-- Mode & Time & Result Badge -->
              <div class="flex min-w-0 flex-col">
                <div class="flex items-center gap-1.5">
                  <span
                    class="py-0.2 shrink-0 rounded px-1.5 text-[10px] font-bold"
                    :class="[
                      item.participant.winResult === 'win'
                        ? 'bg-blue-500/25 text-blue-400'
                        : item.participant.winResult === 'loss'
                          ? 'bg-rose-500/25 text-rose-400'
                          : 'bg-neutral-500/25 text-neutral-400'
                    ]"
                  >
                    {{
                      item.participant.winResult === 'win'
                        ? '胜利'
                        : item.participant.winResult === 'loss'
                          ? '失败'
                          : '重开'
                    }}
                  </span>
                  <span class="truncate text-xs font-semibold text-white/90">
                    {{ resources.queues.name(item.basicInfo.queueId) }}
                  </span>
                </div>
                <span class="mt-0.5 text-[10px] text-white/45">
                  {{ dayjs(item.basicInfo.gameCreation).format('MM-DD HH:mm') }}
                </span>
              </div>
            </div>

            <!-- Right: KDA info -->
            <div class="flex shrink-0 flex-col items-end">
              <div class="text-[13px] font-bold tabular-nums">
                <span class="text-white">{{ item.participant.kills }}</span>
                <span class="text-white/40">/</span>
                <span class="text-rose-400">{{ item.participant.deaths }}</span>
                <span class="text-white/40">/</span>
                <span class="text-white">{{ item.participant.assists }}</span>
              </div>
              <div class="text-[10px] text-white/50 tabular-nums">
                {{
                  (
                    (item.participant.kills + item.participant.assists) /
                    Math.max(1, item.participant.deaths)
                  ).toFixed(2)
                }}
                KDA
              </div>
            </div>
          </div>

          <!-- Row 2: Equipment Items + Trinket (Cleanly wrapped on second row) -->
          <div class="flex items-center justify-between border-t border-white/10 pt-1.5 pl-1.5">
            <div class="flex items-center gap-1">
              <!-- 6 main items -->
              <div class="flex items-center gap-1">
                <div
                  v-for="(itemId, itmIdx) in item.participant.items.slice(0, 6)"
                  :key="itmIdx"
                  class="flex size-6.5 shrink-0 items-center justify-center overflow-hidden rounded border border-white/15 bg-black/60"
                >
                  <img
                    v-if="itemId && resources.items.display(itemId)"
                    :src="resources.items.display(itemId)?.iconPath"
                    :alt="resources.items.display(itemId)?.name"
                    class="h-full w-full object-cover"
                  />
                </div>
              </div>

              <!-- Trinket item -->
              <div
                class="ml-1 flex size-6.5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-400/50 bg-black/60"
              >
                <img
                  v-if="
                    item.participant.items[6] && resources.items.display(item.participant.items[6])
                  "
                  :src="resources.items.display(item.participant.items[6])?.iconPath"
                  :alt="resources.items.display(item.participant.items[6])?.name"
                  class="h-full w-full object-cover"
                />
              </div>
            </div>

            <div class="text-[10px] text-white/40 tabular-nums">
              金币 {{ item.participant.goldEarned.toLocaleString() }} · 补刀
              {{ item.participant.cs }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </NModal>
</template>

<script setup lang="ts">
import ChampionIcon from '@renderer-shared/components/widgets/ChampionIcon.vue'
import { useGameResourceProvider } from '@renderer-shared/providers/game-resource'
import { useOngoingGameProvider } from '@renderer-shared/providers/ongoing-game'
import { toBasicInfo } from '@shared/data-adapter/match-history/match-basic'
import { toParticipants } from '@shared/data-adapter/match-history/participants'
import { DeviceGamepad, X } from '@vicons/tabler'
import dayjs from 'dayjs'
import { NIcon, NModal, NSpin } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{
  show: boolean
  puuid: string | null
}>()

const emit = defineEmits<{
  'update:show': [val: boolean]
}>()

const ongoingGame = useOngoingGameProvider()
const resources = useGameResourceProvider()

// Player info
const summoner = computed(() => (props.puuid ? ongoingGame.summoner[props.puuid] : null))
const summonerName = computed(
  () => summoner.value?.gameName || summoner.value?.displayName || '玩家'
)
const tagLine = computed(() => summoner.value?.tagLine || '')
const level = computed(() => summoner.value?.summonerLevel || null)

const championId = computed(() =>
  props.puuid ? ongoingGame.championSelections[props.puuid] || null : null
)

// Ranked Tier
const ranked = computed(() => (props.puuid ? ongoingGame.rankedStats[props.puuid] : null))
const tierText = computed(() => {
  if (!ranked.value?.queueMap) return null
  const solo = ranked.value.queueMap['RANKED_SOLO_5x5']
  if (solo && solo.tier) {
    return `${solo.tier} ${solo.division || ''} ${solo.leaguePoints ?? 0}LP`
  }
  return null
})

// Win Rate & KDA summary
const analysis = computed(() =>
  props.puuid && ongoingGame.analysis?.players ? ongoingGame.analysis.players[props.puuid] : null
)
const winRateText = computed(() => {
  if (!analysis.value?.winLoss?.all) return null
  const all = analysis.value.winLoss.all
  return `胜率 ${(all.winRate * 100).toFixed()}% (${all.count}场)`
})
const kdaText = computed(() => {
  if (!analysis.value?.summary?.avgKda) return null
  return `${analysis.value.summary.avgKda.toFixed(2)} KDA`
})

// Match history list
const loadingState = computed(() =>
  props.puuid ? ongoingGame.matchHistoryLoadingState[props.puuid] : 'loading'
)

const matches = computed(() => {
  if (!props.puuid) return []
  const history = ongoingGame.matchHistory[props.puuid]
  const rawGames = history?.data
  if (!Array.isArray(rawGames)) return []

  return rawGames
    .map((game) => {
      try {
        const basicInfo = toBasicInfo(game)
        const participant = toParticipants(game, basicInfo).find((p) => p.puuid === props.puuid)
        if (!participant) return null

        return {
          gameId: game.gameId,
          basicInfo,
          participant
        }
      } catch {
        return null
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
})
</script>

<style scoped>
.modal-wrapper {
  width: min(94vw, 580px);
  max-height: min(88dvh, 560px);
}

.modal-list-body {
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}
</style>
