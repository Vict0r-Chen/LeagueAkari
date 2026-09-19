<template>
  <NModal
    preset="card"
    v-model:show="show"
    size="small"
    class="w-130! max-w-[90vw]"
    transform-origin="center"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <NIcon :component="DeviceMobile" class="text-akari-500 text-xl" />
        <span class="text-base font-bold">手机副屏 (局域网实时对局看板)</span>
      </div>
    </template>

    <div class="flex flex-col gap-4 text-sm">
      <!-- Master Switch -->
      <div class="flex items-center justify-between rounded-lg bg-black/5 p-3 dark:bg-white/5">
        <div class="flex flex-col">
          <span class="font-medium text-black/85 dark:text-white/90">启用手机副屏服务</span>
          <span class="text-xs text-black/50 dark:text-white/50">
            在局域网内开启内置 HTTP 与 WebSocket 服务，允许手机实时查看对局数据
          </span>
        </div>
        <NSwitch :value="mobileStore.settings.enabled" @update:value="handleToggleEnabled" />
      </div>

      <template v-if="mobileStore.settings.enabled">
        <!-- Status & Port -->
        <div class="flex items-center justify-between rounded-lg bg-black/5 p-3 dark:bg-white/5">
          <div class="flex items-center gap-2">
            <span
              class="h-2.5 w-2.5 rounded-full"
              :class="
                mobileStore.state.isRunning
                  ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                  : 'bg-red-500'
              "
            ></span>
            <span class="text-xs text-black/75 dark:text-white/75">
              {{ mobileStore.state.isRunning ? '服务运行中' : '服务未启动' }}
            </span>
            <span v-if="mobileStore.state.clientCount > 0" class="text-xs text-emerald-500">
              ({{ mobileStore.state.clientCount }} 台手机已连接)
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-black/60 dark:text-white/60">端口:</span>
            <NInputNumber
              size="tiny"
              class="w-24"
              :min="1024"
              :max="65535"
              :value="mobileStore.settings.port"
              @update:value="handleUpdatePort"
            />
          </div>
        </div>

        <!-- IP Address Selector / Display -->
        <div v-if="ipOptions.length > 0" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-black/70 dark:text-white/70">
              电脑局域网 IP 地址:
            </span>
            <span class="text-xs text-black/45 dark:text-white/45">
              若手机打不开，请切换下方 IP 重试
            </span>
          </div>
          <NSelect size="small" v-model:value="selectedIp" :options="ipOptions" />

          <!-- URL with Copy Button -->
          <div class="flex items-center gap-2">
            <div
              class="flex-1 overflow-hidden rounded border border-black/10 bg-black/5 px-3 py-1.5 font-mono text-xs text-ellipsis whitespace-nowrap text-black/80 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
            >
              {{ targetUrl }}
            </div>
            <NButton size="small" secondary @click="copyUrl">
              <template #icon>
                <NIcon :component="Copy" />
              </template>
              复制
            </NButton>
          </div>
        </div>

        <NAlert v-else type="warning" title="未检测到可用的局域网 IP">
          请检查您的电脑是否已连接到家庭 WiFi 或局域网路由器。
        </NAlert>

        <!-- QR Code -->
        <div
          class="flex flex-col items-center justify-center gap-2 rounded-lg border border-black/10 bg-black/2 p-4 dark:border-white/10 dark:bg-white/2"
        >
          <NQrCode :value="targetUrl" :size="180" class="rounded bg-white p-2" />
          <span class="text-xs text-black/60 dark:text-white/60">
            手机使用系统相机或微信扫一扫直达
          </span>
        </div>

        <!-- Usage Tips -->
        <div
          class="rounded-lg bg-black/5 p-3 text-xs leading-relaxed text-black/65 dark:bg-white/5 dark:text-white/65"
        >
          <div class="mb-1 font-semibold text-black/85 dark:text-white/85">💡 使用建议：</div>
          <div>1. 手机与电脑必须处于<strong>同一个 WiFi</strong> 网络下。</div>
          <div>2. 首次启动时若 Windows 防火墙弹窗，请勾选<strong>允许访问专用网络</strong>。</div>
          <div>
            3. 手机扫码打开后，建议在浏览器菜单中选择“<strong>添加到主屏幕</strong>”，打开即是全屏
            App 体验。
          </div>
          <div>4. 手机旋转至<strong>横屏</strong>，即可获得与电脑一致的高清实时对局看板。</div>
        </div>
      </template>
    </div>
  </NModal>
</template>

<script setup lang="ts">
import { useInstance } from '@renderer-shared/shards'
import { MobileRemoteRenderer } from '@renderer-shared/shards/mobile-remote'
import { useMobileRemoteStore } from '@renderer-shared/shards/mobile-remote/store'
import { Copy, DeviceMobile } from '@vicons/tabler'
import {
  NAlert,
  NButton,
  NIcon,
  NInputNumber,
  NModal,
  NQrCode,
  NSelect,
  NSwitch,
  useMessage
} from 'naive-ui'
import { computed, ref, watch } from 'vue'

const show = defineModel<boolean>('show', { default: false })

const mobileStore = useMobileRemoteStore()
const mobileRenderer = useInstance(MobileRemoteRenderer)
const message = useMessage()

const selectedIp = ref<string>('')

const ipOptions = computed(() => {
  return mobileStore.state.ips.map((ip) => ({
    label: ip,
    value: ip
  }))
})

watch(
  () => mobileStore.state.ips,
  (ips) => {
    if (ips.length > 0 && (!selectedIp.value || !ips.includes(selectedIp.value))) {
      selectedIp.value = ips[0]
    }
  },
  { immediate: true }
)

const targetUrl = computed(() => {
  const ip = selectedIp.value || '127.0.0.1'
  const port = mobileStore.state.activePort || mobileStore.settings.port || 3890
  return `http://${ip}:${port}`
})

const handleToggleEnabled = async (val: boolean) => {
  await mobileRenderer.setEnabled(val)
  if (val) {
    const ips = await mobileRenderer.getLanIps()
    if (ips && ips.length > 0) {
      selectedIp.value = ips[0]
    }
  }
}

const handleUpdatePort = async (val: number | null) => {
  if (val && val >= 1024 && val <= 65535) {
    await mobileRenderer.setPort(val)
  }
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(targetUrl.value)
    message.success('已复制访问地址到剪贴板')
  } catch {
    message.error('复制失败，请手动复制')
  }
}
</script>

<style scoped>
@reference '@renderer-shared/assets/css/tailwind.css';
</style>
