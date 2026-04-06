import { useState, useMemo, useDeferredValue, useCallback } from 'react'
import type { NormalizedEntry, IssueSeverity, ResourceType, Finding } from '../lib/types'

export type SortField = 'startTime' | 'duration' | 'size' | 'status' | 'url'
export type SortDir = 'asc' | 'desc'
export type GroupBy = 'none' | 'resourceType' | 'domain' | 'status'

export interface FilterState {
  search: string
  resourceType: ResourceType | 'all'
  statusCode: string // 'all' | '2xx' | '3xx' | '4xx' | '5xx'
  minDuration: number // ms, 0 = no filter
  severity: IssueSeverity | 'all'
  sortField: SortField
  sortDir: SortDir
  groupBy: GroupBy
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  resourceType: 'all',
  statusCode: 'all',
  minDuration: 0,
  severity: 'all',
  sortField: 'startTime',
  sortDir: 'asc',
  groupBy: 'none',
}

function matchesStatusRange(status: number, range: string): boolean {
  switch (range) {
    case '2xx': return status >= 200 && status < 300
    case '3xx': return status >= 300 && status < 400
    case '4xx': return status >= 400 && status < 500
    case '5xx': return status >= 500 && status < 600
    default: return true
  }
}

function getDomain(url: string): string {
  try { return new URL(url).hostname } catch { return 'unknown' }
}

export interface GroupedEntries {
  label: string
  entries: NormalizedEntry[]
  indices: number[]
}

export function useFilters(entries: NormalizedEntry[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const deferredSearch = useDeferredValue(filters.search)

  const filtered = useMemo(() => {
    const searchLower = deferredSearch.toLowerCase()
    const result: { entry: NormalizedEntry; index: number }[] = []

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const url = e.entry.request.url

      // Search filter
      if (searchLower && !url.toLowerCase().includes(searchLower)) continue

      // Resource type filter
      if (filters.resourceType !== 'all' && e.resourceType !== filters.resourceType) continue

      // Status code filter
      if (filters.statusCode !== 'all' && !matchesStatusRange(e.entry.response.status, filters.statusCode)) continue

      // Duration filter
      if (filters.minDuration > 0 && e.totalDuration < filters.minDuration) continue

      result.push({ entry: e, index: i })
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (filters.sortField) {
        case 'startTime':
          cmp = a.entry.startTimeMs - b.entry.startTimeMs
          break
        case 'duration':
          cmp = a.entry.totalDuration - b.entry.totalDuration
          break
        case 'size':
          cmp = a.entry.transferSizeResolved - b.entry.transferSizeResolved
          break
        case 'status':
          cmp = a.entry.entry.response.status - b.entry.entry.response.status
          break
        case 'url':
          cmp = a.entry.entry.request.url.localeCompare(b.entry.entry.request.url)
          break
      }
      return filters.sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [entries, deferredSearch, filters.resourceType, filters.statusCode, filters.minDuration, filters.sortField, filters.sortDir])

  const grouped = useMemo((): GroupedEntries[] => {
    if (filters.groupBy === 'none') {
      return [{ label: 'All', entries: filtered.map((f) => f.entry), indices: filtered.map((f) => f.index) }]
    }

    const groups = new Map<string, { entries: NormalizedEntry[]; indices: number[] }>()

    for (const { entry, index } of filtered) {
      let key: string
      switch (filters.groupBy) {
        case 'resourceType':
          key = entry.resourceType
          break
        case 'domain':
          key = getDomain(entry.entry.request.url)
          break
        case 'status': {
          const s = entry.entry.response.status
          key = s >= 500 ? '5xx' : s >= 400 ? '4xx' : s >= 300 ? '3xx' : s >= 200 ? '2xx' : 'other'
          break
        }
      }
      const group = groups.get(key) ?? { entries: [], indices: [] }
      group.entries.push(entry)
      group.indices.push(index)
      groups.set(key, group)
    }

    return Array.from(groups.entries()).map(([label, g]) => ({
      label,
      entries: g.entries,
      indices: g.indices,
    }))
  }, [filtered, filters.groupBy])

  const filteredEntries = useMemo(() => filtered.map((f) => f.entry), [filtered])
  const filteredIndices = useMemo(() => filtered.map((f) => f.index), [filtered])

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const toggleSort = useCallback((field: SortField) => {
    setFilters((prev) => ({
      ...prev,
      sortField: field,
      sortDir: prev.sortField === field && prev.sortDir === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const filterFindings = useCallback((findings: Finding[]): Finding[] => {
    if (filters.severity === 'all') return findings
    const order = { info: 0, warning: 1, critical: 2 }
    const minOrder = order[filters.severity]
    return findings.filter((f) => order[f.severity] >= minOrder)
  }, [filters.severity])

  return {
    filters,
    filteredEntries,
    filteredIndices,
    grouped,
    updateFilter,
    resetFilters,
    toggleSort,
    filterFindings,
  }
}
