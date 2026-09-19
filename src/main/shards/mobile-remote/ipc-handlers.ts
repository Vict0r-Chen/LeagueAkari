import type { MobileRemoteMainContext } from './context'
import { getLanIpv4Addresses } from './http-server-controller'

export class MobileRemoteIpcHandlers {
  constructor(private readonly _context: MobileRemoteMainContext) {}

  register() {
    this._context.ipc.onCall(this._context.namespace, 'getLanIps', () => {
      return getLanIpv4Addresses()
    })

    this._context.ipc.onCall(this._context.namespace, 'setEnabled', async (_, enabled: boolean) => {
      await this._context.settingService.set('enabled', enabled)
    })

    this._context.ipc.onCall(this._context.namespace, 'setPort', async (_, port: number) => {
      await this._context.settingService.set('port', port)
    })
  }
}
