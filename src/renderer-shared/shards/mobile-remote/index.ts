import { Dep, IAkariShardInitDispose, Shard } from '@shared/akari-shard'

import { AkariIpcRenderer } from '../ipc'
import { PiniaMobxUtilsRenderer } from '../pinia-mobx-utils'
import { SettingUtilsRenderer } from '../setting-utils'
import {
  MOBILE_REMOTE_MAIN_NAMESPACE,
  MOBILE_REMOTE_RENDERER_NAMESPACE,
  type MobileRemoteRendererContext
} from './context'
import { syncMobileRemoteState } from './state-sync'

@Shard(MobileRemoteRenderer.id)
export class MobileRemoteRenderer implements IAkariShardInitDispose {
  static id = MOBILE_REMOTE_RENDERER_NAMESPACE

  private readonly _context: MobileRemoteRendererContext

  constructor(
    @Dep(AkariIpcRenderer) ipc: AkariIpcRenderer,
    @Dep(PiniaMobxUtilsRenderer) piniaMobxUtils: PiniaMobxUtilsRenderer,
    @Dep(SettingUtilsRenderer) settingUtils: SettingUtilsRenderer
  ) {
    this._context = {
      ipc,
      piniaMobxUtils,
      settingUtils
    }
  }

  async onInit() {
    await syncMobileRemoteState(this._context)
  }

  setEnabled(value: boolean) {
    return this._context.settingUtils.set(MOBILE_REMOTE_MAIN_NAMESPACE, 'enabled', value)
  }

  setPort(value: number) {
    return this._context.settingUtils.set(MOBILE_REMOTE_MAIN_NAMESPACE, 'port', value)
  }

  getLanIps(): Promise<string[]> {
    return this._context.ipc.call(MOBILE_REMOTE_MAIN_NAMESPACE, 'getLanIps')
  }
}
