import { describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'

import { MobileRemoteHttpServerController } from './http-server-controller'
import { MobileRemoteSettings, MobileRemoteState } from './state'
import { MobileRemoteWsServerController } from './ws-server-controller'

vi.mock('electron', () => ({
  app: {
    getAppPath: () => process.cwd()
  }
}))

describe('MobileRemote Server Integration', () => {
  it('should serve HTML, status API, PWA manifest and handle WebSocket snapshot', async () => {
    const settings = new MobileRemoteSettings()
    const state = new MobileRemoteState()

    const mockContext: any = {
      namespace: 'mobile-remote-main',
      settings,
      state,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      },
      mobxUtils: {
        reaction: vi.fn(() => () => {})
      },
      leagueClient: {
        state: { auth: null },
        data: null,
        request: vi.fn()
      },
      ongoingGame: {
        state: {
          queryStage: { phase: 'unavailable', gameInfo: null },
          teams: {},
          championSelections: {},
          positionAssignments: {},
          analysis: null,
          summoner: {},
          rankedStats: {},
          championMastery: {},
          savedInfo: {},
          draft: null,
          mergedPremadeTeamMap: {},
          matchHistory: {},
          matchHistoryLoadingState: {},
          additional: {},
          additionalGame: {},
          gameDetails: {}
        },
        settings: {
          enabled: true,
          orderPlayerBy: 'default'
        }
      },
      appCommon: {
        settings: { streamerMode: false }
      }
    }

    const httpController = new MobileRemoteHttpServerController(mockContext)
    const wsController = new MobileRemoteWsServerController(mockContext)

    const TEST_PORT = 13890

    try {
      // 1. Start HTTP Server
      await httpController.start(TEST_PORT)
      expect(httpController.server).toBeDefined()
      wsController.start(httpController.server!)

      // 2. Test GET / (HTML)
      const htmlRes = await fetch(`http://127.0.0.1:${TEST_PORT}/`)
      expect(htmlRes.status).toBe(200)
      const htmlText = await htmlRes.text()
      expect(htmlText).toContain('League Akari')
      expect(htmlText).toContain('mobileWindow')

      // 3. Test GET /api/status (JSON)
      const statusRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/status`)
      expect(statusRes.status).toBe(200)
      const statusJson = await statusRes.json()
      expect(statusJson).toHaveProperty('activePort')

      // 4. Test GET /manifest.webmanifest
      const manifestRes = await fetch(`http://127.0.0.1:${TEST_PORT}/manifest.webmanifest`)
      expect(manifestRes.status).toBe(200)
      const manifestJson = (await manifestRes.json()) as any
      expect(manifestJson.display).toBe('standalone')
      expect(manifestJson.orientation).toBe('landscape')

      // 5. Test WebSocket Connection
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`)
      const receivedMessages: any[] = []

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {})
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString())
            receivedMessages.push(parsed)
            resolve()
          } catch (e) {
            reject(e)
          }
        })
        ws.on('error', reject)
        setTimeout(() => reject(new Error('WebSocket timeout')), 3000)
      })

      expect(receivedMessages.length).toBeGreaterThan(0)
      expect(receivedMessages[0].type).toBe('snapshot')
      expect(receivedMessages[0].data).toHaveProperty('queryStage')

      ws.close()
    } finally {
      wsController.stop()
      await httpController.stop()
    }
  })
})
