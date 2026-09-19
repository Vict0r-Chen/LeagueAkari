import { MOBILE_REMOTE_MAIN_NAMESPACE, type MobileRemoteRendererContext } from './context'
import { useMobileRemoteStore } from './store'

export async function syncMobileRemoteState(context: MobileRemoteRendererContext) {
  const store = useMobileRemoteStore()

  await context.piniaMobxUtils.sync(MOBILE_REMOTE_MAIN_NAMESPACE, 'settings', store.settings)
  await context.piniaMobxUtils.sync(MOBILE_REMOTE_MAIN_NAMESPACE, 'state', store.state)
}
