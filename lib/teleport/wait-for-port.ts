import { createConnection } from 'node:net'

export async function waitForPort(
  port: number,
  host = '127.0.0.1',
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const open = await tryConnect(host, port)
    if (open) return
    await sleep(250)
  }

  throw new Error(
    `Timeout: proxy not listening on ${host}:${port} after ${timeoutMs}ms`,
  )
}

function tryConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.setTimeout(500, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
