import { useState, useCallback, useMemo, useRef } from 'react'
import { useAnalyzer } from './hooks/useAnalyzer'
import { useTheme } from './hooks/useTheme'
import { useFilters } from './hooks/useFilters'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { TAB_KEYS, TAB_LABELS, type TabKey } from './constants'
import { ToastProvider } from './components/Toast'
import { ThemeToggle } from './components/ThemeToggle'
import { FileUpload } from './components/FileUpload'
import { ProgressBar } from './components/ProgressBar'
import { SummaryDashboard } from './components/SummaryDashboard'
import { RequestTable } from './components/RequestTable'
import { WaterfallChart } from './components/WaterfallChart'
import { RequestDetail } from './components/RequestDetail'
import { CategoryView } from './components/CategoryView'
import { FilterBar, focusFilterInput } from './components/FilterBar'
import { ExportButtons } from './components/ExportButtons'
import { RuleEditor } from './components/RuleEditor'
import { SplitPane } from './components/SplitPane'
import { CompareDashboard } from './components/CompareDashboard'
import { HelpPanel } from './components/HelpPanel'
import { ShortcutHelp } from './components/ShortcutHelp'
import { ProveIt } from './components/ProveIt'

export function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}

function AppInner() {
  const { mode, cycleTheme } = useTheme()
  const { analysis, diffState, analyzeHar, diffHar, reset } = useAnalyzer()

  const [activeTab, setActiveTab] = useState<TabKey>('summary')
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null)
  const [fileName, setFileName] = useState('')
  const [highlightIndices, setHighlightIndices] = useState<Set<number> | undefined>()
  const [showHelp, setShowHelp] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showProveIt, setShowProveIt] = useState(false)

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false)
  const [compareNames, setCompareNames] = useState<[string, string]>(['', ''])

  const entries = analysis.result?.entries ?? []
  const {
    filters,
    filteredEntries,
    updateFilter,
    resetFilters,
    toggleSort,
    filterFindings,
  } = useFilters(entries)

  const filteredFindings = useMemo(
    () => filterFindings(analysis.result?.findings ?? []),
    [filterFindings, analysis.result?.findings],
  )

  // File handling
  const handleFile = useCallback((content: string, name: string) => {
    setFileName(name)
    setSelectedEntry(null)
    setHighlightIndices(undefined)
    setCompareMode(false)
    setActiveTab('summary')
    resetFilters()
    analyzeHar(content)
  }, [analyzeHar, resetFilters])

  const handleCompare = useCallback((before: string, after: string, beforeName: string, afterName: string) => {
    setCompareMode(true)
    setCompareNames([beforeName, afterName])
    setSelectedEntry(null)
    setHighlightIndices(undefined)
    diffHar(before, after)
  }, [diffHar])

  const handleNewFile = useCallback(() => {
    reset()
    setFileName('')
    setSelectedEntry(null)
    setHighlightIndices(undefined)
    setCompareMode(false)
    setActiveTab('summary')
    resetFilters()
  }, [reset, resetFilters])

  // Navigation from Summary cards
  const handleNavigate = useCallback((tab: TabKey) => {
    setActiveTab(tab)
  }, [])

  // Finding -> Waterfall cross-link
  const handleShowInWaterfall = useCallback((entryIndices: number[]) => {
    setActiveTab('waterfall')
    setHighlightIndices(new Set(entryIndices))
    if (entryIndices.length > 0) setSelectedEntry(entryIndices[0])
  }, [])

  const clearHighlight = useCallback(() => {
    setHighlightIndices(undefined)
  }, [])

  // Row selection
  const handleSelectEntry = useCallback((index: number) => {
    setSelectedEntry((prev) => (prev === index ? null : index))
  }, [])

  // Keyboard shortcuts
  const shortcutHandlers = useMemo(() => ({
    onNextRow: () => {
      if (activeTab === 'requests' || activeTab === 'waterfall') {
        setSelectedEntry((prev) => {
          const max = filteredEntries.length - 1
          if (prev === null) return 0
          return Math.min(prev + 1, max)
        })
      }
    },
    onPrevRow: () => {
      if (activeTab === 'requests' || activeTab === 'waterfall') {
        setSelectedEntry((prev) => {
          if (prev === null || prev <= 0) return 0
          return prev - 1
        })
      }
    },
    onExpand: () => {
      // Already handled by row click
    },
    onClose: () => {
      if (showShortcuts) { setShowShortcuts(false); return }
      if (showHelp) { setShowHelp(false); return }
      if (showProveIt) { setShowProveIt(false); return }
      if (selectedEntry !== null) { setSelectedEntry(null); return }
      if (highlightIndices) { clearHighlight(); return }
    },
    onFocusFilter: focusFilterInput,
    onShowHelp: () => setShowShortcuts(true),
    onSwitchTab: (tab: TabKey) => {
      if (analysis.status === 'done' && !compareMode) setActiveTab(tab)
    },
  }), [activeTab, filteredEntries.length, selectedEntry, showShortcuts, showHelp, showProveIt, analysis.status, compareMode, highlightIndices, clearHighlight])

  useKeyboardShortcuts(shortcutHandlers)

  const selectedEntryData = selectedEntry !== null ? filteredEntries[selectedEntry] ?? null : null

  // ── Compare mode ──
  if (compareMode && diffState.status === 'done' && diffState.result) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Header
          mode={mode}
          onCycleTheme={cycleTheme}
          onHelp={() => setShowHelp(true)}
          onNewFile={handleNewFile}
          fileName=""
        />
        <CompareDashboard
          diff={diffState.result}
          beforeScore={diffState.beforeScore!}
          afterScore={diffState.afterScore!}
          beforeName={compareNames[0]}
          afterName={compareNames[1]}
          onBack={handleNewFile}
        />
        {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      </div>
    )
  }

  // ── Loading / analyzing state ──
  if (compareMode && diffState.status === 'analyzing') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {diffState.progress && <ProgressBar progress={diffState.progress} />}
      </div>
    )
  }

  // ── Empty state ──
  if (analysis.status === 'idle') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Header
          mode={mode}
          onCycleTheme={cycleTheme}
          onHelp={() => setShowHelp(true)}
          onNewFile={handleNewFile}
          fileName=""
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileUpload onFile={handleFile} onCompare={handleCompare} />
        </div>
        <Footer onProveIt={() => setShowProveIt(true)} />
        {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
        {showProveIt && <ProveIt onClose={() => setShowProveIt(false)} />}
      </div>
    )
  }

  // ── Analyzing state ──
  if (analysis.status === 'analyzing') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {analysis.progress && <ProgressBar progress={analysis.progress} />}
      </div>
    )
  }

  // ── Error state ──
  if (analysis.status === 'error') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        <div style={{ color: 'var(--severity-critical)', fontSize: 14 }}>
          Analysis failed: {analysis.error}
        </div>
        <button
          onClick={handleNewFile}
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            cursor: 'pointer',
            padding: '6px 16px',
            fontSize: 13,
          }}
        >
          Try another file
        </button>
      </div>
    )
  }

  // ── Results view ──
  const showFilterBar = activeTab === 'requests' || activeTab === 'waterfall' || activeTab === 'findings'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surface-0)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Header
        mode={mode}
        onCycleTheme={cycleTheme}
        onHelp={() => setShowHelp(true)}
        onNewFile={handleNewFile}
        fileName={fileName}
        exportProps={
          analysis.result && analysis.healthScore
            ? { result: analysis.result, healthScore: analysis.healthScore, fileName }
            : undefined
        }
      />

      {/* Tab bar */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--surface-3)',
          padding: '0 var(--space-4)',
          background: 'var(--surface-1)',
          flexShrink: 0,
        }}
      >
        {TAB_KEYS.map((key, i) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: activeTab === key ? 600 : 400,
              fontFamily: 'var(--font-sans)',
              transition: 'color 150ms, border-color 150ms',
            }}
          >
            {TAB_LABELS[key]}
            {key === 'findings' && analysis.result && (
              <span style={{
                marginLeft: 6,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}>
                ({analysis.result.findings.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      {showFilterBar && (
        <FilterBar
          filters={filters}
          onUpdate={updateFilter}
          onReset={resetFilters}
          entryCount={filteredEntries.length}
          totalCount={entries.length}
        />
      )}

      {/* Highlight banner */}
      {highlightIndices && (
        <div style={{
          background: 'var(--severity-warning-bg)',
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          flexShrink: 0,
        }}>
          <span style={{ color: 'var(--severity-warning)' }}>
            {highlightIndices.size} entries highlighted
          </span>
          <button
            onClick={clearHighlight}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Clear highlight
          </button>
          <button
            onClick={() => { clearHighlight(); setActiveTab('findings') }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Back to Findings
          </button>
        </div>
      )}

      {/* Tab content */}
      <div
        role="tabpanel"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {activeTab === 'summary' && analysis.result && analysis.healthScore && (
          <SummaryDashboard
            result={analysis.result}
            healthScore={analysis.healthScore}
            onNavigate={handleNavigate}
          />
        )}
        {activeTab === 'requests' && (
          selectedEntryData ? (
            <SplitPane
              left={
                <RequestTable
                  entries={filteredEntries}
                  selectedIndex={selectedEntry}
                  onSelect={handleSelectEntry}
                  onSort={toggleSort}
                  sortField={filters.sortField}
                  sortDir={filters.sortDir}
                  highlightIndices={highlightIndices}
                />
              }
              right={
                <RequestDetail
                  entry={selectedEntryData}
                  onClose={() => setSelectedEntry(null)}
                />
              }
            />
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <RequestTable
                entries={filteredEntries}
                selectedIndex={selectedEntry}
                onSelect={handleSelectEntry}
                onSort={toggleSort}
                sortField={filters.sortField}
                sortDir={filters.sortDir}
                highlightIndices={highlightIndices}
              />
            </div>
          )
        )}
        {activeTab === 'waterfall' && (
          selectedEntryData ? (
            <SplitPane
              left={
                <WaterfallChart
                  entries={filteredEntries}
                  selectedIndex={selectedEntry}
                  onSelect={handleSelectEntry}
                  highlightIndices={highlightIndices}
                />
              }
              right={
                <RequestDetail
                  entry={selectedEntryData}
                  onClose={() => setSelectedEntry(null)}
                />
              }
            />
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <WaterfallChart
                entries={filteredEntries}
                selectedIndex={selectedEntry}
                onSelect={handleSelectEntry}
                highlightIndices={highlightIndices}
              />
            </div>
          )
        )}
        {activeTab === 'findings' && (
          <CategoryView
            findings={filteredFindings}
            onShowInWaterfall={handleShowInWaterfall}
          />
        )}
        {activeTab === 'rules' && (
          <RuleEditor entries={entries} />
        )}
      </div>

      <Footer onProveIt={() => setShowProveIt(true)} />

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
      {showProveIt && <ProveIt onClose={() => setShowProveIt(false)} />}
    </div>
  )
}

function Header({
  mode,
  onCycleTheme,
  onHelp,
  onNewFile,
  fileName,
  exportProps,
}: {
  mode: Parameters<typeof ThemeToggle>[0]['mode']
  onCycleTheme: () => void
  onHelp: () => void
  onNewFile: () => void
  fileName: string
  exportProps?: Parameters<typeof ExportButtons>[0]
}) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 16px',
      borderBottom: '1px solid var(--surface-3)',
      background: 'var(--surface-1)',
      flexShrink: 0,
      gap: 12,
    }}>
      <span style={{
        fontSize: 16,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      }} onClick={onNewFile}>
        har-o-scope
      </span>
      {fileName && (
        <span style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {fileName}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {exportProps && <ExportButtons {...exportProps} />}
      <button
        onClick={onHelp}
        aria-label="Help"
        style={{
          background: 'transparent',
          border: '1px solid var(--surface-3)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '4px 8px',
          fontSize: 12,
        }}
      >
        Help
      </button>
      <ThemeToggle mode={mode} onCycle={onCycleTheme} />
      {fileName && (
        <button
          onClick={onNewFile}
          aria-label="Load new file"
          style={{
            background: 'transparent',
            border: '1px solid var(--surface-3)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: 12,
          }}
        >
          New
        </button>
      )}
    </header>
  )
}

function Footer({ onProveIt }: { onProveIt: () => void }) {
  return (
    <footer style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 16px',
      borderTop: '1px solid var(--surface-2)',
      fontSize: 11,
      color: 'var(--text-muted)',
      flexShrink: 0,
    }}>
      <span>
        har-o-scope — zero-trust HAR analyzer
      </span>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onProveIt}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 11,
            padding: 0,
          }}
        >
          Prove it
        </button>
        <span>
          Press <kbd style={{
            background: 'var(--surface-2)',
            padding: '0 4px',
            borderRadius: 2,
            fontSize: 10,
          }}>?</kbd> for shortcuts
        </span>
      </div>
    </footer>
  )
}
