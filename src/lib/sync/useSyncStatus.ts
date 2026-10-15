import { useSyncExternalStore } from "react"
import { getSyncStatus, subscribeSyncStatus } from "./engine"

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus)
}
