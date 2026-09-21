import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { WebSocket } from 'ws'

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9223
const TARGET_URL = 'http://127.0.0.1:3890/'

console.log('Starting Edge in headless mode...')
const edgeProcess = spawn(EDGE_PATH, [
  '--headless',
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--user-data-dir=C:\\Users\\v1cto\\AppData\\Local\\Temp\\edge-debug-test-mobile-v5',
  TARGET_URL
])

async function waitForCdp(port, retries = 25) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`)
      if (res.ok) {
        return await res.json()
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('CDP port failed to become available')
}

async function main() {
  try {
    const targets = await waitForCdp(DEBUG_PORT)
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0]
    if (!pageTarget) {
      console.error('No page target found!')
      return
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
    await new Promise((resolve) => ws.on('open', resolve))

    let id = 1
    const send = (method, params = {}) => {
      return new Promise((resolve) => {
        const curId = id++
        const handler = (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.id === curId) {
            ws.removeListener('message', handler)
            resolve(msg.result)
          }
        }
        ws.on('message', handler)
        ws.send(JSON.stringify({ id: curId, method, params }))
      })
    }

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type
        const args = msg.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a)).join(' ')
        console.log(`[CONSOLE ${type.toUpperCase()}]`, args)
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const text = msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text
        console.error('[EXCEPTION TEXT]:', text)
        fs.appendFileSync('scratch/error.log', text + '\n---\n')
      }
    })

    await send('Runtime.enable')
    await send('Console.enable')
    await send('Network.enable')
    await send('Page.enable')

    // 1. Set Landscape viewport (844x390, iPhone 14/15/16 landscape)
    console.log('Setting Landscape viewport: 844x390...')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 844,
      height: 390,
      deviceScaleFactor: 2,
      mobile: true
    })

    // Install mock data interceptor before navigation
    console.log('Installing WebSocket mock injector on new document...')
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__LAST_WS__ = null;
        window.__MOCK_DATA__ = null;
        window.__INJECT_MOCK_DATA__ = function(data) {
          window.__MOCK_DATA__ = data;
          if (window.__LAST_WS__) {
            window.__LAST_WS__.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({ type: 'snapshot', data })
            }));
          }
        };

        const OrigWS = window.WebSocket;
        window.WebSocket = function(...args) {
          const instance = new OrigWS(...args);
          window.__LAST_WS__ = instance;
          instance.addEventListener('open', () => {
            setTimeout(() => {
              if (window.__MOCK_DATA__) {
                instance.dispatchEvent(new MessageEvent('message', {
                  data: JSON.stringify({ type: 'snapshot', data: window.__MOCK_DATA__ })
                }));
              }
            }, 300);
          });
          return instance;
        };
        window.WebSocket.prototype = OrigWS.prototype;
      `
    })

    console.log('Navigating to TARGET_URL...')
    await send('Page.navigate', { url: TARGET_URL })

    await new Promise((r) => setTimeout(r, 1000))

    // Inject rich ongoing game data
    console.log('Injecting ongoing game snapshot...')
    const injectRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const bluePuuids = ['p-blue-1', 'p-blue-2', 'p-blue-3', 'p-blue-4', 'p-blue-5'];
        const redPuuids = ['p-red-1', 'p-red-2', 'p-red-3', 'p-red-4', 'p-red-5'];
        const allPuuids = [...bluePuuids, ...redPuuids];

        const mockSnapshot = {
          queryStage: { phase: 'in-game', gameInfo: { mode: 'CLASSIC' } },
          teams: {
            'TEAM-100': bluePuuids,
            'TEAM-200': redPuuids
          },
          positionAssignments: {
            'p-blue-1': { position: 'TOP', role: 'SOLO' },
            'p-blue-2': { position: 'JUNGLE', role: 'NONE' },
            'p-blue-3': { position: 'MIDDLE', role: 'SOLO' },
            'p-blue-4': { position: 'BOTTOM', role: 'DUO_CARRY' },
            'p-blue-5': { position: 'UTILITY', role: 'DUO_SUPPORT' },
            'p-red-1': { position: 'TOP', role: 'SOLO' },
            'p-red-2': { position: 'JUNGLE', role: 'NONE' },
            'p-red-3': { position: 'MIDDLE', role: 'SOLO' },
            'p-red-4': { position: 'BOTTOM', role: 'DUO_CARRY' },
            'p-red-5': { position: 'UTILITY', role: 'DUO_SUPPORT' }
          },
          championSelections: {
            'p-blue-1': 266, 'p-blue-2': 64, 'p-blue-3': 103, 'p-blue-4': 222, 'p-blue-5': 412,
            'p-red-1': 84, 'p-red-2': 113, 'p-red-3': 7, 'p-red-4': 81, 'p-red-5': 89
          },
          summoner: {},
          rankedStats: {},
          matchHistoryLoadingState: {},
          matchHistory: {},
          analysis: { players: {}, teams: {} },
          mergedPremadeTeamMap: {
            'p-blue-1': 1, 'p-blue-2': 1
          }
        };

        allPuuids.forEach((p, idx) => {
          mockSnapshot.summoner[p] = {
            displayName: '选手' + (idx + 1),
            gameName: '选手' + (idx + 1),
            tagLine: 'CN' + (idx + 1),
            summonerLevel: 100 + idx * 10
          };
          mockSnapshot.rankedStats[p] = {
            queueMap: {
              RANKED_SOLO_5x5: { tier: 'DIAMOND', division: 'II', leaguePoints: 65 }
            }
          };
          mockSnapshot.matchHistoryLoadingState[p] = 'loaded';
          mockSnapshot.matchHistory[p] = {
            data: [
              {
                source: 'lcu',
                gameId: 2001 + idx,
                data: {
                  gameId: 2001 + idx,
                  gameCreation: Date.now() - 3600000,
                  gameDuration: 1850,
                  queueId: 420,
                  gameMode: 'CLASSIC',
                  gameVersion: '14.1.1',
                  participantIdentities: [
                    { participantId: 1, player: { puuid: p } }
                  ],
                  participants: [
                    {
                      participantId: 1,
                      championId: mockSnapshot.championSelections[p] || 266,
                      spell1Id: 4,
                      spell2Id: 12,
                      stats: {
                        champLevel: 16,
                        item0: 3078,
                        item1: 3053,
                        item2: 3153,
                        item3: 3026,
                        item4: 3111,
                        item5: 3748,
                        item6: 3364,
                        kills: 14,
                        deaths: 2,
                        assists: 9,
                        win: true,
                        goldEarned: 16800,
                        totalMinionsKilled: 210,
                        neutralMinionsKilled: 32
                      }
                    }
                  ]
                }
              },
              {
                source: 'lcu',
                gameId: 2002 + idx,
                data: {
                  gameId: 2002 + idx,
                  gameCreation: Date.now() - 7200000,
                  gameDuration: 1620,
                  queueId: 420,
                  gameMode: 'CLASSIC',
                  gameVersion: '14.1.1',
                  participantIdentities: [
                    { participantId: 1, player: { puuid: p } }
                  ],
                  participants: [
                    {
                      participantId: 1,
                      championId: 64,
                      spell1Id: 4,
                      spell2Id: 11,
                      stats: {
                        champLevel: 14,
                        item0: 3074,
                        item1: 6692,
                        item2: 3047,
                        item3: 3156,
                        item4: 3814,
                        item5: 0,
                        item6: 3340,
                        kills: 6,
                        deaths: 7,
                        assists: 10,
                        win: false,
                        goldEarned: 11500,
                        totalMinionsKilled: 145,
                        neutralMinionsKilled: 16
                      }
                    }
                  ]
                }
              }
            ]
          };
          mockSnapshot.analysis.players[p] = {
            summary: { avgKda: 4.2, winRate: 0.65 },
            winLoss: { all: { count: 28, winRate: 0.65 } },
            akariScore: { total: 88 },
            spells: { flashOnD: 10, flashOnF: 0, smite: 0, teleport: 0 },
            champions: {
              266: { championId: 266, winLoss: { all: { count: 12, winRate: 0.75 } } }
            }
          };
        });

        window.__INJECT_MOCK_DATA__(mockSnapshot);
        return true;
      })()`,
      returnByValue: true
    })

    console.log('Injected mock data:', injectRes?.result?.value)
    // Wait for Vue reactivity to mount cards
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 300))
      const countRes = await send('Runtime.evaluate', {
        expression: 'document.querySelectorAll(".mobile-player-card").length',
        returnByValue: true
      })
      if (countRes?.result?.value >= 10) {
        console.log('Mounted card count:', countRes.result.value)
        break
      }
    }

    // 1. Verify Landscape Fullscreen stage-wrapper & Buttons
    const landscapeCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const wrapper = document.querySelector(".stage-wrapper");
        const stageContent = document.querySelector(".stage-content");
        const ctrlButtons = Array.from(document.querySelectorAll(".floating-controls .ctrl-btn")).map(b => b.title);
        const rect = wrapper ? wrapper.getBoundingClientRect() : null;
        const stageRect = stageContent ? stageContent.getBoundingClientRect() : null;
        const cards = document.querySelectorAll(".mobile-player-card");
        return {
          wrapperRect: rect ? { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom) } : null,
          stageRect: stageRect ? { w: Math.round(stageRect.width), h: Math.round(stageRect.height), top: Math.round(stageRect.top), bottom: Math.round(stageRect.bottom) } : null,
          ctrlButtons,
          cardCount: cards.length,
          windowH: window.innerHeight,
          windowW: window.innerWidth,
          isInsideScreen: stageRect ? (stageRect.top >= 0 && stageRect.bottom <= window.innerHeight) : false
        };
      })()`,
      returnByValue: true
    })
    console.log('Landscape Fullscreen & Controls Result:\n', JSON.stringify(landscapeCheck?.result?.value, null, 2))

    const landscapeShot = await send('Page.captureScreenshot', { format: 'png' })
    if (landscapeShot?.data) {
      fs.writeFileSync('scratch/mobile-preview-fullscreen-landscape.png', Buffer.from(landscapeShot.data, 'base64'))
      console.log('Saved landscape overview screenshot: scratch/mobile-preview-fullscreen-landscape.png')
    }

    // 2. Click the first card to open modal and verify wrapped items layout
    console.log('Clicking the first mobile-player-card to open modal...')
    await send('Runtime.evaluate', {
      expression: `(() => {
        const card = document.querySelector(".mobile-player-card");
        if (card) { card.click(); return true; }
        return false;
      })()`
    })

    await new Promise((r) => setTimeout(r, 800))

    const modalCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.querySelector(".modal-wrapper");
        const items = document.querySelectorAll(".match-item");
        const firstItem = items[0];
        let hasOverflow = false;
        if (firstItem) {
          hasOverflow = firstItem.scrollWidth > firstItem.clientWidth;
        }
        return {
          hasModal: Boolean(modal),
          matchItemsCount: items.length,
          firstItemHasHorizontalOverflow: hasOverflow,
          firstItemScrollWidth: firstItem?.scrollWidth,
          firstItemClientWidth: firstItem?.clientWidth
        };
      })()`,
      returnByValue: true
    })
    console.log('Modal Items Layout Result:\n', JSON.stringify(modalCheck?.result?.value, null, 2))

    const modalShot = await send('Page.captureScreenshot', { format: 'png' })
    if (modalShot?.data) {
      fs.writeFileSync('scratch/mobile-modal-wrapped.png', Buffer.from(modalShot.data, 'base64'))
      console.log('Saved modal wrapped screenshot: scratch/mobile-modal-wrapped.png')
    }

    // Close modal
    await send('Runtime.evaluate', {
      expression: `(() => {
        const closeBtn = document.querySelector(".modal-wrapper button");
        if (closeBtn) closeBtn.click();
      })()`
    })
    await new Promise((r) => setTimeout(r, 400))

    // 3. Test Manual Orientation Toggle Button (Switch to Portrait)
    console.log('Clicking Orientation Toggle Button (switch to Portrait)...')
    await send('Runtime.evaluate', {
      expression: `(() => {
        const toggleBtn = Array.from(document.querySelectorAll(".ctrl-btn")).find(b => b.title.includes("切换为竖屏") || b.title.includes("切换为横屏"));
        if (toggleBtn) {
          toggleBtn.click();
          return true;
        }
        return false;
      })()`
    })
    await new Promise((r) => setTimeout(r, 600))

    const toggledCheck = await send('Runtime.evaluate', {
      expression: `({
        isPortraitNow: document.querySelector(".mobile-viewport.is-portrait") !== null,
        hasPortraitContainer: document.querySelector(".portrait-game-container") !== null,
        cardCount: document.querySelectorAll(".mobile-player-card").length,
        newToggleBtnTitle: Array.from(document.querySelectorAll(".ctrl-btn")).find(b => b.title.includes("切换"))?.title
      })`,
      returnByValue: true
    })
    console.log('Toggled to Portrait Result:\n', JSON.stringify(toggledCheck?.result?.value, null, 2))

    const toggledShot = await send('Page.captureScreenshot', { format: 'png' })
    if (toggledShot?.data) {
      fs.writeFileSync('scratch/mobile-preview-toggled-portrait.png', Buffer.from(toggledShot.data, 'base64'))
      console.log('Saved toggled portrait screenshot: scratch/mobile-preview-toggled-portrait.png')
    }

    ws.close()
  } catch (err) {
    console.error('Error during test:', err)
  } finally {
    edgeProcess.kill()
    process.exit(0)
  }
}

main()
