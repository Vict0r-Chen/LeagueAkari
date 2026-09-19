import { makeAutoObservable, observable } from 'mobx'

export class MobileRemoteSettings {
  enabled: boolean = false
  port: number = 3890

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  setPort(port: number) {
    this.port = port
  }

  constructor() {
    makeAutoObservable(this)
  }
}

export class MobileRemoteState {
  isRunning: boolean = false
  activePort: number = 3890
  clientCount: number = 0
  ips: string[] = []

  setIsRunning(isRunning: boolean) {
    this.isRunning = isRunning
  }

  setActivePort(port: number) {
    this.activePort = port
  }

  setClientCount(count: number) {
    this.clientCount = count
  }

  setIps(ips: string[]) {
    this.ips = ips
  }

  constructor() {
    makeAutoObservable(this, {
      ips: observable.ref
    })
  }
}
