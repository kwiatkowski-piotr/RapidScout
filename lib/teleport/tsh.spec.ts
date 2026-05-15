import { beforeEach, describe, expect, it, vi } from 'vitest'

const runCommand = vi.fn()

function createExecaMock() {
  const tagged = (strings: TemplateStringsArray, ...values: unknown[]) =>
    runCommand(strings, ...values)

  const $fn = Object.assign(
    (stringsOrOpts: TemplateStringsArray | Record<string, unknown>, ...values: unknown[]) => {
      if (Array.isArray(stringsOrOpts)) {
        return runCommand(stringsOrOpts, ...values)
      }
      return tagged
    },
    { sync: vi.fn() },
  )

  return $fn
}

vi.mock('execa', () => ({
  $: createExecaMock(),
}))

vi.mock('get-port', () => ({
  default: vi.fn().mockResolvedValue(9800),
  portNumbers: () => [9800, 9900],
}))

vi.mock('./wait-for-port', () => ({
  waitForPort: vi.fn().mockResolvedValue(undefined),
}))

describe('isTshSessionActive', () => {
  beforeEach(() => {
    vi.resetModules()
    runCommand.mockReset()
  })

  it('returns true when tsh status exits 0', async () => {
    runCommand.mockResolvedValue({ exitCode: 0 })

    const { isTshSessionActive } = await import('./tsh')
    await expect(isTshSessionActive()).resolves.toBe(true)
  })

  it('returns false when tsh status exits non-zero', async () => {
    runCommand.mockResolvedValue({ exitCode: 1 })

    const { isTshSessionActive } = await import('./tsh')
    await expect(isTshSessionActive()).resolves.toBe(false)
  })
})

describe('ensureTshSession', () => {
  beforeEach(() => {
    vi.resetModules()
    runCommand.mockReset()
  })

  it('passes when session is active', async () => {
    runCommand
      .mockResolvedValueOnce({ exitCode: 0 })
      .mockResolvedValueOnce({ exitCode: 0 })

    const { ensureTshSession } = await import('./tsh')
    await expect(ensureTshSession()).resolves.toBeUndefined()
  })

  it('throws when session is missing', async () => {
    runCommand
      .mockResolvedValueOnce({ exitCode: 0 })
      .mockResolvedValueOnce({ exitCode: 1 })

    const { ensureTshSession } = await import('./tsh')
    await expect(ensureTshSession()).rejects.toThrow(/tsh login/)
  })
})
