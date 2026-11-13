import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState, reduce } from '../reducer/reduce'
import type { ConversationState, FixtureEvent } from '../reducer/types'

export interface Replay {
  readonly state: ConversationState
  /** 已应用的事件数，0…events.length。 */
  readonly index: number
  readonly playing: boolean
  readonly speed: number
  readonly cursorMs: number
  readonly durationMs: number
  readonly finished: boolean
  play: () => void
  pause: () => void
  toggle: () => void
  restart: () => void
  seekRatio: (ratio: number) => void
  setSpeed: (speed: number) => void
}

/**
 * 按夹具里的 `dt` 回放事件流。一次 rAF 里把到期的所有事件批量归约，
 * 因此倍速不影响终态；暂停/拖动会从事件 0 重放到目标位置，保证纯函数语义。
 * @param events - 夹具事件（切换夹具时自动归零）。
 * @returns 归约状态与回放控制。
 */
export function useReplay(events: readonly FixtureEvent[]): Replay {
  const times = useRef<number[]>([])
  const duration = useRef(0)
  const indexRef = useRef(0)
  const cursorRef = useRef(0)
  const stateRef = useRef<ConversationState>(createInitialState())
  const speedRef = useRef(1)
  const rafRef = useRef(0)
  const lastTickRef = useRef(0)

  const [state, setState] = useState<ConversationState>(stateRef.current)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const [cursorMs, setCursorMs] = useState(0)

  // 夹具变化：重置绝对时间轴与状态
  useEffect(() => {
    const stamps: number[] = []
    let total = 0
    for (const event of events) {
      total += Math.max(0, event.dt)
      stamps.push(total)
    }
    times.current = stamps
    duration.current = total
    indexRef.current = 0
    cursorRef.current = 0
    stateRef.current = createInitialState()
    setState(stateRef.current)
    setIndex(0)
    setCursorMs(0)
    setPlaying(events.length > 0)
  }, [events])

  const applyUntil = useCallback(
    (position: number) => {
      let decision = stateRef.current
      let changed = false
      while (indexRef.current < events.length && (times.current[indexRef.current] ?? 0) <= position) {
        decision = reduce(decision, events[indexRef.current].ev, times.current[indexRef.current] ?? 0)
        indexRef.current += 1
        changed = true
      }
      if (changed) {
        stateRef.current = decision
        setState(decision)
        setIndex(indexRef.current)
      }
    },
    [events],
  )

  // 播放循环
  useEffect(() => {
    if (!playing) return
    lastTickRef.current = performance.now()
    const tick = (now: number) => {
      const elapsed = (now - lastTickRef.current) * speedRef.current
      lastTickRef.current = now
      cursorRef.current += elapsed
      const capped = Math.min(cursorRef.current, duration.current)
      applyUntil(capped)
      setCursorMs(capped)
      if (indexRef.current >= events.length) {
        setPlaying(false)
        cursorRef.current = duration.current
        setCursorMs(duration.current)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, events.length, applyUntil])

  const seekRatio = useCallback(
    (ratio: number) => {
      const clamped = Math.min(1, Math.max(0, ratio))
      const target = duration.current * clamped
      // 从 0 重放：归约是纯函数，拖动后终态与顺序播放一致
      let decision = createInitialState()
      let cursor = 0
      while (cursor < events.length && (times.current[cursor] ?? 0) <= target) {
        decision = reduce(decision, events[cursor].ev, times.current[cursor] ?? 0)
        cursor += 1
      }
      indexRef.current = cursor
      cursorRef.current = target
      stateRef.current = decision
      setState(decision)
      setIndex(cursor)
      setCursorMs(target)
      if (target < duration.current) setPlaying(false)
    },
    [events],
  )

  const restart = useCallback(() => {
    indexRef.current = 0
    cursorRef.current = 0
    stateRef.current = createInitialState()
    setState(stateRef.current)
    setIndex(0)
    setCursorMs(0)
    setPlaying(true)
  }, [])

  const setSpeed = useCallback((next: number) => {
    speedRef.current = next
    setSpeedState(next)
  }, [])

  return {
    state,
    index,
    playing,
    speed,
    cursorMs,
    durationMs: duration.current,
    finished: events.length > 0 && index >= events.length,
    play: () => {
      if (indexRef.current >= events.length) restart()
      else setPlaying(true)
    },
    pause: () => setPlaying(false),
    toggle: () => (playing ? setPlaying(false) : (indexRef.current >= events.length ? restart() : setPlaying(true))),
    restart,
    seekRatio,
    setSpeed,
  }
}
