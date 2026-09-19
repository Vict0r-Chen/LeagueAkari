import { toJS } from 'mobx'
import type http from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

import type { MobileRemoteMainContext } from './context'

export class MobileRemoteWsServerController {
  private _wss: WebSocketServer | null = null
  private readonly _clients = new Set<WebSocket>()
  private _disposeReaction: (() => void) | null = null
  private _broadcastTimer: NodeJS.Timeout | null = null

  constructor(private readonly _context: MobileRemoteMainContext) {}

  start(server: http.Server) {
    this.stop()

    const wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws) => {
      this._clients.add(ws)
      this._context.state.setClientCount(this._clients.size)
      this._context.logger.info(
        `Mobile client connected via WebSocket, current clients: ${this._clients.size}`
      )

      // Immediately send current snapshot
      try {
        const snapshot = this._serializeSnapshot()
        ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }))
      } catch (err) {
        this._context.logger.warn(`Failed to send initial snapshot: ${(err as Error).message}`)
      }

      ws.on('close', () => {
        this._clients.delete(ws)
        this._context.state.setClientCount(this._clients.size)
        this._context.logger.info(
          `Mobile client disconnected, remaining clients: ${this._clients.size}`
        )
      })

      ws.on('error', (err) => {
        this._context.logger.warn(`Mobile client WebSocket error: ${err.message}`)
        this._clients.delete(ws)
        this._context.state.setClientCount(this._clients.size)
      })
    })

    this._wss = wss
    this._watchOngoingGameState()
  }

  stop() {
    if (this._disposeReaction) {
      this._disposeReaction()
      this._disposeReaction = null
    }

    if (this._broadcastTimer) {
      clearTimeout(this._broadcastTimer)
      this._broadcastTimer = null
    }

    if (this._wss) {
      for (const client of this._clients) {
        try {
          client.close()
        } catch {
          // ignore
        }
      }
      this._clients.clear()
      this._wss.close()
      this._wss = null
    }

    this._context.state.setClientCount(0)
  }

  private _watchOngoingGameState() {
    const ogState = this._context.ongoingGame.state
    const ogSettings = this._context.ongoingGame.settings
    const lc = this._context.leagueClient

    this._disposeReaction = this._context.mobxUtils.reaction(
      () => ({
        queryStage: toJS(ogState.queryStage),
        teams: toJS(ogState.teams),
        championSelections: toJS(ogState.championSelections),
        positionAssignments: toJS(ogState.positionAssignments),
        analysis: toJS(ogState.analysis),
        summoner: toJS(ogState.summoner),
        rankedStats: toJS(ogState.rankedStats),
        championMastery: toJS(ogState.championMastery),
        savedInfo: toJS(ogState.savedInfo),
        draft: toJS(ogState.draft),
        mergedPremadeTeamMap: toJS(ogState.mergedPremadeTeamMap),
        matchHistory: toJS(ogState.matchHistory),
        matchHistoryLoadingState: toJS(ogState.matchHistoryLoadingState),
        additional: toJS(ogState.additional),
        settings: toJS(ogSettings),
        isConnected: lc.state.isConnected,
        isSpectating: Boolean(lc.data?.champSelect?.session?.isSpectating),
        streamerMode: this._context.appCommon.settings.streamerMode,
        selfPuuid: lc.data?.summoner?.me?.puuid ?? null,
        locale: this._context.appCommon.settings.locale
      }),
      () => {
        this._scheduleBroadcast()
      },
      { fireImmediately: false }
    )
  }

  private _scheduleBroadcast() {
    if (this._clients.size === 0) {
      return
    }

    if (this._broadcastTimer) {
      return
    }

    this._broadcastTimer = setTimeout(() => {
      this._broadcastTimer = null
      this._broadcastSnapshot()
    }, 150)
  }

  private _serializeSnapshot() {
    const ogState = this._context.ongoingGame.state
    const ogSettings = this._context.ongoingGame.settings
    const lc = this._context.leagueClient

    return {
      queryStage: toJS(ogState.queryStage),
      teams: toJS(ogState.teams),
      championSelections: toJS(ogState.championSelections),
      positionAssignments: toJS(ogState.positionAssignments),
      analysis: toJS(ogState.analysis),
      summoner: toJS(ogState.summoner),
      rankedStats: toJS(ogState.rankedStats),
      championMastery: toJS(ogState.championMastery),
      savedInfo: toJS(ogState.savedInfo),
      draft: toJS(ogState.draft),
      mergedPremadeTeamMap: toJS(ogState.mergedPremadeTeamMap),
      matchHistory: this._serializeMatchHistory(ogState),
      matchHistoryLoadingState: toJS(ogState.matchHistoryLoadingState),
      additional: toJS(ogState.additional),
      cachedGames: {},
      gameDetails: {},
      gameData: this._serializeGameData(lc),
      settings: toJS(ogSettings),
      isConnected: lc.state.isConnected,
      isSpectating: Boolean(lc.data?.champSelect?.session?.isSpectating),
      streamerMode: this._context.appCommon.settings.streamerMode,
      selfPuuid: lc.data?.summoner?.me?.puuid ?? null,
      locale: this._context.appCommon.settings.locale
    }
  }

  private _serializeMatchHistory(ogState: any) {
    const raw = ogState.matchHistory || {}
    const currentPuuids = new Set(Object.keys(raw))
    const result: Record<string, any> = {}

    for (const [puuid, val] of Object.entries(raw)) {
      if (!val || typeof val !== 'object') {
        result[puuid] = val
        continue
      }

      const matchObj = toJS(val) as any
      const rawGames = matchObj.data || []
      const prunedGames = rawGames.map((g: any) => {
        if (!g) return g
        const clonedGame = { ...g }
        if (clonedGame.data?.json) {
          const rawJson = clonedGame.data.json
          const prunedParticipants = (rawJson.participants || [])
            .filter((p: any) => currentPuuids.has(p.puuid))
            .map((p: any) => {
              const { challenges, timeline, perks, missions, ...rest } = p
              return rest
            })

          clonedGame.data = {
            ...clonedGame.data,
            json: {
              ...rawJson,
              participants: prunedParticipants
            }
          }
        }
        return clonedGame
      })

      result[puuid] = {
        ...matchObj,
        data: prunedGames
      }
    }

    return result
  }

  private _serializeGameData(lc: any) {
    const raw = lc.data?.gameData
    if (!raw) {
      return {
        champions: {},
        summonerSpells: {},
        queues: {},
        items: {},
        perks: {},
        augments: {}
      }
    }

    const champions: Record<number, any> = {}
    for (const [id, champ] of Object.entries(raw.champions || {})) {
      if (champ) {
        const c = champ as any
        champions[Number(id)] = {
          id: c.id,
          name: c.name,
          squarePortraitPath: c.squarePortraitPath
        }
      }
    }

    const summonerSpells: Record<number, any> = {}
    for (const [id, spell] of Object.entries(raw.summonerSpells || {})) {
      if (spell) {
        const s = spell as any
        summonerSpells[Number(id)] = {
          id: s.id,
          name: s.name,
          iconPath: s.iconPath,
          description: s.description,
          cooldown: s.cooldown
        }
      }
    }

    const queues: Record<number, any> = {}
    for (const [id, q] of Object.entries(raw.queues || {})) {
      if (q) {
        const queue = q as any
        queues[Number(id)] = {
          id: queue.id,
          name: queue.name
        }
      }
    }

    const items: Record<number, any> = {}
    for (const [id, it] of Object.entries(raw.items || {})) {
      if (it) {
        const item = it as any
        items[Number(id)] = {
          id: item.id,
          name: item.name,
          iconPath: item.iconPath,
          description: item.description,
          price: item.price,
          totalPrice: item.totalPrice
        }
      }
    }

    const perks: Record<number, any> = {}
    for (const [id, p] of Object.entries(raw.perks || {})) {
      if (p) {
        const perk = p as any
        perks[Number(id)] = {
          id: perk.id,
          name: perk.name,
          iconPath: perk.iconPath,
          longDesc: perk.longDesc
        }
      }
    }

    const augments: Record<number, any> = {}
    for (const [id, a] of Object.entries(raw.augments || {})) {
      if (a) {
        const aug = a as any
        augments[Number(id)] = {
          id: aug.id,
          name: aug.name || aug.nameTRA,
          iconPath: aug.iconPath,
          rarity: aug.rarity
        }
      }
    }

    return { champions, summonerSpells, queues, items, perks, augments }
  }

  private _broadcastSnapshot() {
    if (this._clients.size === 0) {
      return
    }

    try {
      const payload = JSON.stringify({
        type: 'update',
        data: this._serializeSnapshot()
      })

      for (const client of this._clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload)
        }
      }
    } catch (err) {
      this._context.logger.warn(`Failed to broadcast snapshot: ${(err as Error).message}`)
    }
  }
}
