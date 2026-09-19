<template>
  <NConfigProvider :theme="darkTheme" abstract inline-theme-disabled>
    <NMessageProvider placement="bottom">
      <NNotificationProvider>
        <NDialogProvider>
          <GameResourceProvider :value="gameResourceProviderValue">
            <OngoingGameProvider :value="ongoingGameProviderValue">
              <div class="mobile-viewport" :class="{ 'is-portrait': isPortrait }">
                <!-- Portrait tip bar -->
                <div v-if="isPortrait" class="portrait-tip">
                  <NIcon :component="DeviceMobileRotated" class="mr-1.5 text-base" />
                  <span>建议旋转手机至横屏，以获得最佳对局观看体验</span>
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

                  <!-- Fullscreen toggle button -->
                  <button
                    class="ctrl-btn cursor-pointer"
                    :title="isFullscreen ? '退出全屏' : '进入全屏'"
                    @click="toggleFullscreen"
                  >
                    <NIcon :component="isFullscreen ? ArrowsMinimize : ArrowsMaximize" />
                  </button>
                </div>

                <!-- Scaled Stage Container -->
                <div
                  class="stage-wrapper"
                  :style="{
                    width: isPortrait ? '100%' : `${BASE_WIDTH * scale}px`,
                    height: isPortrait ? 'auto' : `${BASE_HEIGHT * scale}px`
                  }"
                >
                  <div
                    class="stage-content"
                    :style="{
                      width: `${BASE_WIDTH}px`,
                      height: `${BASE_HEIGHT}px`,
                      transform: isPortrait
                        ? `scale(${windowWidth / BASE_WIDTH})`
                        : `scale(${scale})`
                    }"
                  >
                    <OngoingGamePanel
                      :content-width="BASE_WIDTH"
                      :content-height="BASE_HEIGHT"
                      is-standalone-ongoing-game-window
                    />
                  </div>
                </div>
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
import OngoingGamePanel from '@renderer-shared/components/ongoing-game-panel/OngoingGamePanel.vue'
import { ArrowsMaximize, ArrowsMinimize, DeviceMobileRotated } from '@vicons/tabler'
import { useWindowSize } from '@vueuse/core'
import {
  darkTheme,
  NConfigProvider,
  NDialogProvider,
  NIcon,
  NMessageProvider,
  NNotificationProvider
} from 'naive-ui'
import { computed } from 'vue'

import { useMobileOngoingGame } from './composables/useMobileOngoingGame'

const BASE_WIDTH = 1440
const BASE_HEIGHT = 860

const { width: windowWidth, height: windowHeight } = useWindowSize()

const isPortrait = computed(() => windowHeight.value > windowWidth.value)

const scale = computed(() => {
  const horizontalScale = windowWidth.value / BASE_WIDTH
  const verticalScale = windowHeight.value / BASE_HEIGHT
  return Math.min(horizontalScale, verticalScale)
})

const {
  rawState,
  wsConnected,
  isFullscreen,
  toggleFullscreen,
  ongoingGameProviderValue,
  gameResourceProviderValue
} = useMobileOngoingGame()

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
</script>

<style scoped>
.mobile-viewport {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0f1218;
  touch-action: pan-x pan-y;
}

.mobile-viewport.is-portrait {
  overflow-y: auto;
  align-items: flex-start;
  padding-top: 48px;
}

.portrait-tip {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background-color: rgba(234, 179, 8, 0.2);
  color: #fbbf24;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  z-index: 999;
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(234, 179, 8, 0.3);
}

.floating-controls {
  position: fixed;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 100;
  backdrop-filter: blur(12px);
  background-color: rgba(15, 18, 24, 0.75);
  padding: 4px 8px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
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
  padding: 2px 8px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.08);
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
  font-size: 18px;
  transition: all 0.2s;
}

.ctrl-btn:hover {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.1);
}

.stage-wrapper {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stage-content {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}
</style>
