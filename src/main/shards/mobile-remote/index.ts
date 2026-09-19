import { IAkariShardInitDispose, Shard } from '@shared/akari-shard'
import { z } from 'zod'

import { AppCommonMain } from '../app-common'
import { AkariIpcMain } from '../ipc'
import { LeagueClientMain } from '../league-client'
import { AkariLogger, LoggerFactoryMain } from '../logger-factory'
import { MobxUtilsMain } from '../mobx-utils'
import { OngoingGameMain } from '../ongoing-game'
import { SettingFactoryMain } from '../setting-factory'
import { SetterSettingService } from '../setting-factory/setter-setting-service'
import { MOBILE_REMOTE_MAIN_NAMESPACE, type MobileRemoteMainContext } from './context'
import { MobileRemoteHttpServerController, getLanIpv4Addresses } from './http-server-controller'
import { MobileRemoteIpcHandlers } from './ipc-handlers'
import { MobileRemoteSettings, MobileRemoteState } from './state'
import { MobileRemoteWsServerController } from './ws-server-controller'

@Shard(MobileRemoteMain.id)
export class MobileRemoteMain implements IAkariShardInitDispose {
  static id = MOBILE_REMOTE_MAIN_NAMESPACE

  public readonly settings = new MobileRemoteSettings()
  public readonly state = new MobileRemoteState()

  private readonly _logger: AkariLogger
  private readonly _settingService: SetterSettingService<MobileRemoteSettings>
  private readonly _context: MobileRemoteMainContext
  private readonly _httpServer: MobileRemoteHttpServerController
  private readonly _wsServer: MobileRemoteWsServerController
  private readonly _ipcHandlers: MobileRemoteIpcHandlers

  constructor(
    private readonly _loggerFactory: LoggerFactoryMain,
    private readonly _settingFactory: SettingFactoryMain,
    private readonly _ipc: AkariIpcMain,
    private readonly _mobxUtils: MobxUtilsMain,
    private readonly _leagueClient: LeagueClientMain,
    private readonly _ongoingGame: OngoingGameMain,
    private readonly _appCommon: AppCommonMain
  ) {
    this._logger = this._loggerFactory.create(MobileRemoteMain.id)
    this._settingService = this._settingFactory.register(
      MobileRemoteMain.id,
      {
        enabled: {
          default: false,
          schema: z.boolean(),
          sideEffect: async ({ value }) => {
            if (value) {
              await this._startServer()
            } else {
              await this._stopServer()
            }
          }
        },
        port: {
          default: 3890,
          schema: z.number().int().min(1024).max(65535),
          sideEffect: async ({ value }) => {
            if (this.settings.enabled) {
              await this._stopServer()
              await this._startServer(value)
            }
          }
        }
      },
      this.settings
    )

    this._context = {
      namespace: MobileRemoteMain.id,
      settings: this.settings,
      state: this.state,
      logger: this._logger,
      ipc: this._ipc,
      mobxUtils: this._mobxUtils,
      settingService: this._settingService,
      leagueClient: this._leagueClient,
      ongoingGame: this._ongoingGame,
      appCommon: this._appCommon
    }

    this._httpServer = new MobileRemoteHttpServerController(this._context)
    this._wsServer = new MobileRemoteWsServerController(this._context)
    this._ipcHandlers = new MobileRemoteIpcHandlers(this._context)
  }

  async onInit() {
    await this._settingService.applyToState()

    this.state.setIps(getLanIpv4Addresses())

    this._mobxUtils.propSync(MobileRemoteMain.id, 'settings', this.settings, ['enabled', 'port'])
    this._mobxUtils.propSync(MobileRemoteMain.id, 'state', this.state, [
      'isRunning',
      'activePort',
      'clientCount',
      'ips'
    ])

    this._ipcHandlers.register()

    if (this.settings.enabled) {
      await this._startServer()
    }
  }

  async onDispose() {
    await this._stopServer()
  }

  private async _startServer(targetPort?: number) {
    const port = targetPort ?? this.settings.port
    try {
      this.state.setIps(getLanIpv4Addresses())
      await this._httpServer.start(port)
      if (this._httpServer.server) {
        this._wsServer.start(this._httpServer.server)
      }
      this.state.setIsRunning(true)
      this.state.setActivePort(port)
      this._logger.info(`Mobile remote services successfully started on port ${port}`)
    } catch (err) {
      this.state.setIsRunning(false)
      this._logger.error(`Failed to start mobile remote services: ${(err as Error).message}`)
    }
  }

  private async _stopServer() {
    this._wsServer.stop()
    await this._httpServer.stop()
    this.state.setIsRunning(false)
    this._logger.info('Mobile remote services stopped')
  }
}
