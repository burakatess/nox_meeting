import type { NoxApi } from '../../shared/types';

declare global {
  interface Window {
    nox: NoxApi;
  }
}

export {};
