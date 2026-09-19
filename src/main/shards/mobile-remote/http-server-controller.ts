import axios from 'axios'
import { app } from 'electron'
import mime from 'mime-types'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import type { MobileRemoteMainContext } from './context'

export function getLanIpv4Addresses(): string[] {
  const interfaces = os.networkInterfaces()
  const ips: string[] = []
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address)
      }
    }
  }
  return ips
}

export class MobileRemoteHttpServerController {
  private _server: http.Server | null = null

  constructor(private readonly _context: MobileRemoteMainContext) {}

  get server() {
    return this._server
  }

  async start(port: number): Promise<void> {
    if (this._server) {
      await this.stop()
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this._handleRequest(req, res)
      })

      server.on('error', (err) => {
        this._context.logger.error(`Mobile remote HTTP server error: ${(err as Error).message}`)
        reject(err)
      })

      server.listen(port, '0.0.0.0', () => {
        this._server = server
        this._context.logger.info(`Mobile remote HTTP server listening on port ${port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (!this._server) {
      return
    }

    return new Promise((resolve) => {
      this._server?.close(() => {
        this._server = null
        this._context.logger.info('Mobile remote HTTP server stopped')
        resolve()
      })
    })
  }

  private _getRendererDistPath(): string {
    // In production, out/renderer is relative to out/main or app root
    const candidates = [
      path.join(app.getAppPath(), 'out', 'renderer'),
      path.join(__dirname, '..', '..', 'out', 'renderer'),
      path.join(__dirname, '..', 'renderer')
    ]

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }

    return candidates[0]
  }

  private async _handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Enable CORS for LAN access
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = parsedUrl.pathname

    // 1. API: Server Status
    if (pathname === '/api/status') {
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 200
      res.end(
        JSON.stringify({
          isRunning: this._context.state.isRunning,
          activePort: this._context.state.activePort,
          clientCount: this._context.state.clientCount,
          ips: this._context.state.ips
        })
      )
      return
    }

    // 2. API: PWA Manifest
    if (pathname === '/manifest.webmanifest' || pathname === '/manifest.json') {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.statusCode = 200
      res.end(
        JSON.stringify({
          name: 'League Akari 实时对局看板',
          short_name: 'Akari对局',
          description: '英雄联盟实时对局数据副屏看板',
          start_url: '/',
          display: 'standalone',
          orientation: 'landscape',
          background_color: '#121212',
          theme_color: '#121212',
          icons: [
            {
              src: '/favicon.ico',
              sizes: '64x64 32x32 24x24 16x16',
              type: 'image/x-icon'
            }
          ]
        })
      )
      return
    }

    // 3. Favicon
    if (pathname === '/favicon.ico') {
      const candidates = [
        path.join(app.getAppPath(), 'resources', 'LA_ICON.ico'),
        path.join(__dirname, '..', '..', '..', 'resources', 'LA_ICON.ico'),
        path.join(__dirname, '..', '..', 'resources', 'LA_ICON.ico'),
        path.join(process.cwd(), 'resources', 'LA_ICON.ico')
      ]
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          res.setHeader('Content-Type', 'image/x-icon')
          res.setHeader('Cache-Control', 'public, max-age=86400')
          res.statusCode = 200
          fs.createReadStream(c).pipe(res)
          return
        }
      }
    }

    // 2. API: Asset Proxy to LCU (League Client)
    if (pathname === '/api/asset') {
      const targetUri = parsedUrl.searchParams.get('uri')
      if (!targetUri) {
        res.statusCode = 400
        res.end('Missing uri parameter')
        return
      }

      await this._handleAssetProxy(targetUri, res)
      return
    }

    // 3. Static Files (Mobile Web App)
    await this._handleStaticFile(parsedUrl, req, res)
  }

  private async _handleAssetProxy(uri: string, res: http.ServerResponse) {
    if (!this._context.leagueClient.state.auth) {
      res.statusCode = 503
      res.end('League client is not connected')
      return
    }

    try {
      const lcuResponse = await this._context.leagueClient.request({
        method: 'GET',
        url: uri,
        responseType: 'stream',
        validateStatus: () => true
      })

      res.statusCode = lcuResponse.status

      const contentType = lcuResponse.headers['content-type']
      if (typeof contentType === 'string') {
        res.setHeader('Content-Type', contentType)
      }
      res.setHeader('Cache-Control', 'public, max-age=86400')

      lcuResponse.data.pipe(res)
    } catch (err) {
      this._context.logger.warn(`Failed to proxy asset ${uri}: ${(err as Error).message}`)
      res.statusCode = 500
      res.end('Failed to proxy asset')
    }
  }

  private async _handleStaticFile(
    parsedUrl: URL,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    // In dev mode with Vite dev server active: proxy web requests to Vite dev server
    const viteDevUrl = process.env['ELECTRON_RENDERER_URL']
    const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
    if (isDev && viteDevUrl) {
      try {
        let devPath = parsedUrl.pathname
        if (devPath === '/' || devPath === '/index.html') {
          devPath = '/mobile-window.html'
        }

        const devTargetUrl = `${viteDevUrl}${devPath}${parsedUrl.search}`
        const proxyHeaders = { ...req.headers }
        delete proxyHeaders['host']
        delete proxyHeaders['connection']

        const proxyRes = await axios.get(devTargetUrl, {
          headers: proxyHeaders as Record<string, string>,
          responseType: 'stream',
          validateStatus: () => true
        })

        if (proxyRes.status >= 200 && proxyRes.status < 400) {
          res.statusCode = proxyRes.status
          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (value !== undefined) {
              res.setHeader(key, value)
            }
          }
          res.setHeader('Access-Control-Allow-Origin', '*')
          proxyRes.data.pipe(res)
          return
        }
      } catch (err) {
        this._context.logger.warn(
          `Dev proxy failed for ${parsedUrl.pathname}${parsedUrl.search}: ${(err as Error).message}`
        )
      }
    }

    // Production / fallback: serve from out/renderer
    const distDir = this._getRendererDistPath()
    let relativeFilePath = parsedUrl.pathname.slice(1) // remove leading slash

    if (!relativeFilePath || relativeFilePath === 'index.html') {
      relativeFilePath = 'mobile-window.html'
    }

    const safePath = path.normalize(relativeFilePath).replace(/^(\.\.[/\\])+/, '')
    let fullPath = path.join(distDir, safePath)

    const hasExtension = path.extname(fullPath) !== ''
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      // SPA Fallback: only for documents / requests without extension or Accept: text/html
      if (!hasExtension || req.headers.accept?.includes('text/html')) {
        fullPath = path.join(distDir, 'mobile-window.html')
      } else {
        res.statusCode = 404
        res.end('Not found')
        return
      }
    }

    if (!fs.existsSync(fullPath)) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404 Not Found</title></head><body><h2>未找到移动端页面产物</h2><p>请先运行 npm run build 构建静态资源</p></body></html>'
      )
      return
    }

    const mimeType = mime.lookup(fullPath) || 'application/octet-stream'
    res.setHeader('Content-Type', mimeType.includes('html') ? 'text/html; charset=utf-8' : mimeType)
    if (mimeType.includes('html')) {
      res.setHeader('Cache-Control', 'no-cache')
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }

    res.statusCode = 200
    fs.createReadStream(fullPath).pipe(res)
  }
}
