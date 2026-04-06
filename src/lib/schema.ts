/**
 * TypeScript types for the YAML rule schema.
 * Defines the contract for rule files, shared conditions, and filters.
 */
import type { IssueSeverity, IssueCategory } from './types.js'

// ── Condition types ────────────────────────────────────────────

export interface FieldCondition {
  field: string
  field_fallback?: string
  equals?: unknown
  not_equals?: unknown
  in?: unknown[]
  not_in?: unknown[]
  gt?: number
  gte?: number
  lt?: number
  lte?: number
  matches?: string
  not_matches?: string
}

export interface ResponseHeaderSpec {
  name: string
  value_matches?: string
  value_gt?: number
  value_lt?: number
}

export interface ResponseHeaderCondition {
  has_response_header?: ResponseHeaderSpec
  no_response_header?: Omit<ResponseHeaderSpec, 'value_gt' | 'value_lt'>
}

export interface ConditionGroup {
  match_all?: ConditionNode[]
  match_any?: ConditionNode[]
}

export type ConditionNode = FieldCondition | ResponseHeaderCondition | ConditionGroup

// ── Severity escalation ────────────────────────────────────────

export interface SeverityEscalation {
  warning_threshold?: number
  critical_threshold?: number
  warning_ratio?: number
  critical_ratio?: number
}

// ── Impact specification ───────────────────────────────────────

export interface ImpactSpec {
  field?: string
  fields?: string[]
  baseline?: number
  value?: number
}

// ── Root cause weight ──────────────────────────────────────────

export interface RootCauseWeight {
  server?: number
  network?: number
  client?: number
}

// ── Prerequisite ───────────────────────────────────────────────

export interface PrerequisiteSpec {
  any_entry_matches: FieldCondition
}

// ── Aggregate condition ────────────────────────────────────────

export interface AggregateCondition {
  min_entries?: number
}

// ── YAML rule definition ───────────────────────────────────────

export interface YamlRule {
  category: IssueCategory | string
  severity: IssueSeverity
  severity_escalation?: SeverityEscalation
  title: string
  description: string
  recommendation: string
  condition?: ConditionGroup
  min_count?: number
  type?: 'per_entry' | 'aggregate'
  aggregate_condition?: AggregateCondition
  prerequisite?: PrerequisiteSpec
  impact?: ImpactSpec
  root_cause_weight?: RootCauseWeight
  inherits?: string[]
  exclude?: string[]
  overrides?: Record<string, FieldCondition>
}

// ── Top-level YAML file structures ─────────────────────────────

export interface IssueRulesFile {
  rules: Record<string, YamlRule>
}

export interface SharedConditionsFile {
  conditions: Record<string, FieldCondition>
}

export interface FiltersFile {
  filters: Record<string, FieldCondition>
}
