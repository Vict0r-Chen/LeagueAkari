import http from 'node:http'
import { spawn } from 'node:child_process'
import { WebSocket } from 'ws'

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9223
const TARGET_URL = 'http://127.0.0.1:3890/'

console.log('Starting Edge in headless mode...')
const edgeProcess = spawn(EDGE_PATH, [
  '--headless',
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--user-data-dir=C:\\Users\\v1cto\\AppData\\Local\\Temp\\edge-debug-test',
  TARGET_URL
])

// Wait for debugging port to be ready
async function waitForCdp(port, retries = 20) {
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
    console.log(`Found ${targets.length} targets:`)
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0]
    if (!pageTarget) {
      console.error('No page target found!')
      return
    }

    console.log('Target URL:', pageTarget.url)
    console.log('Connecting to WebSocket:', pageTarget.webSocketDebuggerUrl)

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)

    await new Promise((resolve) => ws.on('open', resolve))

    let id = 1
    const send = (method, params = {}) => {
      ws.send(JSON.stringify({ id: id++, method, params }))
    }

    const reqMap = new Map()
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.id === 998) {
        console.log('[SCRIPT TAGS]:\n', msg.result?.result?.value)
      }
      if (msg.id === 997) {
        if (msg.result?.exceptionDetails) {
          console.error('[IMPORT /src-mobile/main.ts EXCEPTION]:', JSON.stringify(msg.result.exceptionDetails, null, 2))
        } else {
          console.log('[IMPORT /src-mobile/main.ts RESULT]:', JSON.stringify(msg.result))
        }
      }
      if (msg.id === 999) {
        console.log('[APP INNERHTML]:', msg.result?.result?.value)
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type
        const args = msg.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a)).join(' ')
        console.log(`[CONSOLE ${type.toUpperCase()}]`, args)
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[EXCEPTION THROWN]', msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text)
        if (msg.params.exceptionDetails.stackTrace) {
          console.error('[STACK TRACE]', JSON.stringify(msg.params.exceptionDetails.stackTrace, null, 2))
        }
      } else if (msg.method === 'Network.loadingFailed') {
        const url = reqMap.get(msg.params.requestId) || 'unknown url'
        console.error('[NETWORK FAILED]', msg.params.errorText, url)
      } else if (msg.method === 'Network.responseReceived') {
        if (msg.params.response.status >= 400) {
          console.error('[HTTP ERROR]', msg.params.response.status, msg.params.response.url)
        }
      } else if (msg.method === 'Network.requestWillBeSent') {
        reqMap.set(msg.params.requestId, msg.params.request.url)
        // only log if needed
      }
    })

    send('Runtime.enable')
    send('Console.enable')
    send('Network.enable')
    send('Page.enable')

    console.log('Navigating to TARGET_URL and waiting for load...')
    await new Promise((resolve) => {
      const loadHandler = (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.method === 'Page.loadEventFired') {
          ws.removeListener('message', loadHandler)
          resolve()
        }
      }
      ws.on('message', loadHandler)
      send('Page.navigate', { url: TARGET_URL })
    })

    console.log('Waiting for app to mount (up to 10s)...')
    let evalRes = null
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500))
      evalRes = await new Promise((resolve) => {
        const curId = id++
        const handler = (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.id === curId) {
            ws.removeListener('message', handler)
            resolve(msg.result)
          }
        }
        ws.on('message', handler)
        ws.send(
          JSON.stringify({
            id: curId,
            method: 'Runtime.evaluate',
            params: {
              expression: `({
                innerHTML: document.getElementById("app")?.innerHTML?.slice(0, 1000) || "app is empty",
                hasMobileViewport: Boolean(document.querySelector(".mobile-viewport")),
                bodyText: document.body.innerText
              })`,
              returnByValue: true
            }
          })
        )
      })
      if (evalRes?.result?.value?.hasMobileViewport) {
        console.log('App mounted successfully, waiting 1.5s for WebSocket sync...')
        await new Promise((r) => setTimeout(r, 1500))
        const wsRes = await new Promise((resolve) => {
          const curId = id++
          const handler = (data) => {
            const msg = JSON.parse(data.toString())
            if (msg.id === curId) {
              ws.removeListener('message', handler)
              resolve(msg.result)
            }
          }
          ws.on('message', handler)
          ws.send(
            JSON.stringify({
              id: curId,
              method: 'Runtime.evaluate',
              params: {
                expression: 'document.body.innerText',
                returnByValue: true
              }
            })
          )
        })
        console.log('RENDERED TEXT AFTER WS SYNC:\n' + (wsRes.result?.value || JSON.stringify(wsRes)))

        // Take screenshot
        const screenshotRes = await new Promise((resolve) => {
          const curId = id++
          const handler = (data) => {
            const msg = JSON.parse(data.toString())
            if (msg.id === curId) {
              ws.removeListener('message', handler)
              resolve(msg.result)
            }
          }
          ws.on('message', handler)
          ws.send(
            JSON.stringify({
              id: curId,
              method: 'Page.captureScreenshot',
              params: {
                format: 'png'
              }
            })
          )
        })

        if (screenshotRes?.data) {
          const fs = await import('node:fs')
          fs.writeFileSync('scratch/mobile-preview.png', Buffer.from(screenshotRes.data, 'base64'))
          console.log('Saved screenshot to scratch/mobile-preview.png!')
        }
        break
      }
    }

    ws.close()
  } catch (err) {
    console.error('Error:', err)
  } finally {
    edgeProcess.kill()
    process.exit(0)
  }
}

main()
