import { describe, it, expect } from 'vitest'
import { HarError, HAR_ERRORS, RULE_ERRORS, CLI_ERRORS, createWarning } from '../../src/lib/errors.js'

describe('HarError', () => {
  it('creates error with code, message, help, and docsUrl', () => {
    const err = new HarError({
      code: 'HAR001',
      message: 'Invalid JSON',
      help: 'Check the file format',
    })

    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(HarError)
    expect(err.code).toBe('HAR001')
    expect(err.message).toBe('Invalid JSON')
    expect(err.help).toBe('Check the file format')
    expect(err.docsUrl).toContain('HAR001.md')
    expect(err.name).toBe('HarError')
  })

  it('uses custom docsUrl when provided', () => {
    const err = new HarError({
      code: 'HAR001',
      message: 'test',
      help: 'test',
      docsUrl: 'https://custom.com/docs',
    })
    expect(err.docsUrl).toBe('https://custom.com/docs')
  })

  it('preserves stack trace', () => {
    const err = new HarError({ code: 'HAR001', message: 'test', help: 'test' })
    expect(err.stack).toBeDefined()
    expect(err.stack).toContain('HarError')
  })

  it('works with instanceof checks', () => {
    const err = new HarError({ code: 'HAR001', message: 'test', help: 'test' })
    expect(err instanceof HarError).toBe(true)
    expect(err instanceof Error).toBe(true)
  })
})

describe('Error codes', () => {
  it('HAR_ERRORS has expected codes', () => {
    expect(HAR_ERRORS.HAR001).toBe('HAR001')
    expect(HAR_ERRORS.HAR002).toBe('HAR002')
    expect(HAR_ERRORS.HAR003).toBe('HAR003')
    expect(HAR_ERRORS.HAR004).toBe('HAR004')
  })

  it('RULE_ERRORS has expected codes', () => {
    expect(RULE_ERRORS.RULE001).toBe('RULE001')
    expect(RULE_ERRORS.RULE003).toBe('RULE003')
    expect(RULE_ERRORS.RULE005).toBe('RULE005')
  })

  it('CLI_ERRORS has expected codes', () => {
    expect(CLI_ERRORS.CLI001).toBe('CLI001')
    expect(CLI_ERRORS.CLI002).toBe('CLI002')
  })
})

describe('createWarning', () => {
  it('creates a warning with code, message, help, docsUrl', () => {
    const warning = createWarning('RULE001', 'Bad rule', 'Fix the YAML')
    expect(warning.code).toBe('RULE001')
    expect(warning.message).toBe('Bad rule')
    expect(warning.help).toBe('Fix the YAML')
    expect(warning.docsUrl).toContain('RULE001.md')
  })
})
