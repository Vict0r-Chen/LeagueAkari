import type { AkariIpcRenderer } from '../ipc'
import type { PiniaMobxUtilsRenderer } from '../pinia-mobx-utils'
import type { SettingUtilsRenderer } from '../setting-utils'

export const MOBILE_REMOTE_MAIN_NAMESPACE = 'mobile-remote-main'
export const MOBILE_REMOTE_RENDERER_NAMESPACE = 'mobile-remote-renderer'

export interface MobileRemoteRendererContext {
  ipc: AkariIpcRenderer
  piniaMobxUtils: PiniaMobxUtilsRenderer
  settingUtils: SettingUtilsRenderer
}
