import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

export const useMobileRemoteStore = defineStore('shard:mobile-remote-renderer', () => {
  const settings = shallowReactive({
    enabled: false,
    port: 3890
  })

  const state = shallowReactive({
    isRunning: false,
    activePort: 3890,
    clientCount: 0,
    ips: [] as string[]
  })

  return {
    settings,
    state
  }
})
