import { describe, expect, it, vi } from 'vitest'

import { getLanIpv4Addresses } from './http-server-controller'
import { MobileRemoteSettings, MobileRemoteState } from './state'

vi.mock('electron', () => ({
  app: {
    getAppPath: () => 'd:/Repos/LeagueAkari'
  }
}))

describe('MobileRemote State & Settings', () => {
  it('should initialize settings with default values', () => {
    const settings = new MobileRemoteSettings()
    expect(settings.enabled).toBe(false)
    expect(settings.port).toBe(3890)

    settings.setEnabled(true)
    expect(settings.enabled).toBe(true)

    settings.setPort(8080)
    expect(settings.port).toBe(8080)
  })

  it('should initialize state with default values and update correctly', () => {
    const state = new MobileRemoteState()
    expect(state.isRunning).toBe(false)
    expect(state.activePort).toBe(3890)
    expect(state.clientCount).toBe(0)
    expect(state.ips).toEqual([])

    state.setIsRunning(true)
    state.setActivePort(8080)
    state.setClientCount(2)
    state.setIps(['192.168.1.100'])

    expect(state.isRunning).toBe(true)
    expect(state.activePort).toBe(8080)
    expect(state.clientCount).toBe(2)
    expect(state.ips).toEqual(['192.168.1.100'])
  })

  it('should get LAN IPv4 addresses as non-empty or array', () => {
    const ips = getLanIpv4Addresses()
    expect(Array.isArray(ips)).toBe(true)
    // Every found IP should be a valid IPv4 and not loopback
    for (const ip of ips) {
      expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
      expect(ip).not.toBe('127.0.0.1')
    }
  })
})
