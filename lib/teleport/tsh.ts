import { $, type ResultPromise } from 'execa'
import getPort, { portNumbers } from 'get-port'

import { waitForPort } from './wait-for-port'

export const TELEPORT_PROXY = 'teleport.statscore.com'

export type TshProxyResult = {
  port: number
  proxy: ResultPromise
}

export type TshSetupOptions = {
  proxy?: string
}

export async function isTshInstalled(): Promise<boolean> {
  const result = await $({
    reject: false,
    stdout: 'pipe',
    stderr: 'pipe',
  })`tsh version`
  return result.exitCode === 0
}

/**
 * Returns true when `tsh status` succeeds (active Teleport session).
 */
export async function isTshSessionActive(
  proxy = TELEPORT_PROXY,
): Promise<boolean> {
  const result = await $({
    reject: false,
    stdout: 'pipe',
    stderr: 'pipe',
  })`tsh status --proxy ${proxy}`

  return result.exitCode === 0
}

/**
 * Requires an existing Teleport session (run `tsh login` in terminal first).
 */
export async function ensureTshSession(proxy = TELEPORT_PROXY): Promise<void> {
  if (!(await isTshInstalled())) {
    throw new Error(
      'Polecenie `tsh` nie jest dostępne. Zainstaluj Teleport CLI i dodaj do PATH.',
    )
  }

  if (await isTshSessionActive(proxy)) {
    console.info(`[rapidscout] Teleport session active (${proxy})`)
    return
  }

  throw new Error(
    `Brak aktywnej sesji Teleport. W terminalu uruchom:\n  tsh login --proxy=${proxy}`,
  )
}

export async function tshProxy(target: string): Promise<TshProxyResult> {
  const port = await getPort({ port: portNumbers(9800, 9900) })
  const proxy = $`tsh proxy app ${target} --port ${port}`

  return { proxy, port }
}

export async function tshSetup(
  target: string,
  options: TshSetupOptions = {},
): Promise<TshProxyResult> {
  const proxy = options.proxy ?? TELEPORT_PROXY
  await ensureTshSession(proxy)

  console.info(`[rapidscout] Starting Teleport proxy: ${target}...`)
  const proxyResult = await tshProxy(target)
  await waitForPort(proxyResult.port)
  console.info(`[rapidscout] Teleport proxy ready on port ${proxyResult.port}`)

  return proxyResult
}
