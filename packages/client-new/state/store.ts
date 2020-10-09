import {useMemo} from 'react'

import { configureStore } from '@reduxjs/toolkit'

import reducer from "state/reducer";
import initialState, {State} from "state/initialState";

let store

function initStore(preloadedState: State = initialState) {
  return configureStore(
    { reducer, preloadedState }
  )
}

export const initializeStore = (preloadedState) => {
  let _store = store ?? initStore(preloadedState)

  // After navigating to a page with an initial Redux state, merge that state
  // with the current state in the store, and create a new store
  if (preloadedState && store) {
    _store = initStore({
      ...store.getState(),
      ...preloadedState,
    })
    // Reset the current store
    store = undefined
  }

  // For SSG and SSR always create a new store
  if (typeof window === 'undefined') return _store

  // Create the store once in the client
  if (!store) store = _store

  return _store
}

export function useStore(initialState) {
  return useMemo(() => initializeStore(initialState), [initialState])
}
