import { contextBridge, ipcRenderer } from 'electron';
import type { NoxApi } from '../shared/types';

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;

const api: NoxApi = {
  config: {
    get: () => invoke('config:get'),
    setServerUrl: (url) => invoke('config:setServerUrl', url),
  },
  auth: {
    login: (username, password) => invoke('auth:login', username, password),
    restore: () => invoke('auth:restore'),
    logout: () => invoke('auth:logout'),
  },
  server: { health: () => invoke('server:health') },
  audit: {
    events: () => invoke('audit:events'),
    verify: () => invoke('audit:verify'),
  },
};

contextBridge.exposeInMainWorld('nox', api);
