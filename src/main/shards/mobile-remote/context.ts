import type { AppCommonMain } from '../app-common'
import type { AkariIpcMain } from '../ipc'
import type { LeagueClientMain } from '../league-client'
import type { AkariLogger } from '../logger-factory'
import type { MobxUtilsMain } from '../mobx-utils'
import type { OngoingGameMain } from '../ongoing-game'
import type { SetterSettingService } from '../setting-factory/setter-setting-service'
import type { MobileRemoteSettings, MobileRemoteState } from './state'

export const MOBILE_REMOTE_MAIN_NAMESPACE = 'mobile-remote-main'

export interface MobileRemoteMainContext {
  namespace: string
  settings: MobileRemoteSettings
  state: MobileRemoteState
  logger: AkariLogger
  ipc: AkariIpcMain
  mobxUtils: MobxUtilsMain
  settingService: SetterSettingService<MobileRemoteSettings>
  leagueClient: LeagueClientMain
  ongoingGame: OngoingGameMain
  appCommon: AppCommonMain
}
