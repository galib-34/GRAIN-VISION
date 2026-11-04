import { createContext, useContext } from 'react'

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
export interface AppRuntimeValue { installAvailable: boolean; installApp: () => Promise<void> }

export const AppRuntimeContext = createContext<AppRuntimeValue>({ installAvailable: false, installApp: async () => {} })
export function useAppRuntime() { return useContext(AppRuntimeContext) }
