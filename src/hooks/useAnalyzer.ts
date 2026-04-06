import { useState, useRef, useCallback, useEffect } from 'react'
import type { AnalysisResult, HealthScore, DiffResult, SanitizeOptions } from '../lib/types'
import type { WorkerRequest, WorkerResponse } from '../workers/analyzer.worker'

export interface AnalyzerProgress {
  phase: string
  percent: number
}

export interface AnalysisState {
  status: 'idle' | 'analyzing' | 'done' | 'error'
  progress: AnalyzerProgress | null
  result: AnalysisResult | null
  healthScore: HealthScore | null
  error: string | null
}

export interface DiffState {
  status: 'idle' | 'analyzing' | 'done' | 'error'
  progress: AnalyzerProgress | null
  result: DiffResult | null
  beforeScore: HealthScore | null
  afterScore: HealthScore | null
  error: string | null
}

let idCounter = 0
function nextId() {
  return `req-${++idCounter}`
}

export function useAnalyzer() {
  const workerRef = useRef<Worker | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisState>({
    status: 'idle',
    progress: null,
    result: null,
    healthScore: null,
    error: null,
  })
  const [diffState, setDiffState] = useState<DiffState>({
    status: 'idle',
    progress: null,
    result: null,
    beforeScore: null,
    afterScore: null,
    error: null,
  })

  const activeIdRef = useRef<string | null>(null)

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/analyzer.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (msg.id !== activeIdRef.current) return

      switch (msg.type) {
        case 'progress':
          setAnalysis((s) =>
            s.status === 'analyzing'
              ? { ...s, progress: { phase: msg.phase, percent: msg.percent } }
              : s,
          )
          setDiffState((s) =>
            s.status === 'analyzing'
              ? { ...s, progress: { phase: msg.phase, percent: msg.percent } }
              : s,
          )
          break
        case 'analyze-result':
          setAnalysis({
            status: 'done',
            progress: null,
            result: msg.result,
            healthScore: msg.healthScore,
            error: null,
          })
          break
        case 'diff-result':
          setDiffState({
            status: 'done',
            progress: null,
            result: msg.result,
            beforeScore: msg.beforeScore,
            afterScore: msg.afterScore,
            error: null,
          })
          break
        case 'error':
          setAnalysis((s) =>
            s.status === 'analyzing'
              ? { ...s, status: 'error', progress: null, error: msg.message }
              : s,
          )
          setDiffState((s) =>
            s.status === 'analyzing'
              ? { ...s, status: 'error', progress: null, error: msg.message }
              : s,
          )
          break
      }
    }

    return () => worker.terminate()
  }, [])

  const analyzeHar = useCallback((data: string, customRules?: unknown[]) => {
    const id = nextId()
    activeIdRef.current = id
    setAnalysis({
      status: 'analyzing',
      progress: { phase: 'Starting...', percent: 0 },
      result: null,
      healthScore: null,
      error: null,
    })
    workerRef.current?.postMessage({
      type: 'analyze',
      id,
      data,
      customRules,
    } satisfies WorkerRequest)
  }, [])

  const diffHar = useCallback((before: string, after: string) => {
    const id = nextId()
    activeIdRef.current = id
    setDiffState({
      status: 'analyzing',
      progress: { phase: 'Starting...', percent: 0 },
      result: null,
      beforeScore: null,
      afterScore: null,
      error: null,
    })
    workerRef.current?.postMessage({
      type: 'diff',
      id,
      before,
      after,
    } satisfies WorkerRequest)
  }, [])

  const sanitizeHar = useCallback((data: string, options: SanitizeOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
      const id = nextId()
      const worker = workerRef.current
      if (!worker) return reject(new Error('Worker not ready'))

      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id !== id) return
        worker.removeEventListener('message', handler)
        if (e.data.type === 'sanitize-result') resolve(e.data.data)
        else if (e.data.type === 'error') reject(new Error(e.data.message))
      }
      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'sanitize', id, data, options } satisfies WorkerRequest)
    })
  }, [])

  const reset = useCallback(() => {
    activeIdRef.current = null
    setAnalysis({ status: 'idle', progress: null, result: null, healthScore: null, error: null })
    setDiffState({ status: 'idle', progress: null, result: null, beforeScore: null, afterScore: null, error: null })
  }, [])

  return { analysis, diffState, analyzeHar, diffHar, sanitizeHar, reset }
}
