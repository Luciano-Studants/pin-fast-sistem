import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import * as store from "./store"

/** Como useState, mas persistido no cache do usuário e sincronizado com a API. */
export function useStoredState<T>(
  key: string,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => store.get(key, fallback))
  const ref = useRef(state)
  const fallbackRef = useRef(fallback)

  useEffect(
    () =>
      store.subscribe(key, () => {
        const next = store.get(key, fallbackRef.current)
        ref.current = next
        setState(next)
      }),
    [key],
  )

  const setAndPersist: Dispatch<SetStateAction<T>> = useCallback(
    (action) => {
      const next =
        typeof action === "function"
          ? (action as (previous: T) => T)(ref.current)
          : action
      ref.current = next
      setState(next)
      store.set(key, next, { notify: false })
    },
    [key],
  )

  return [state, setAndPersist]
}
