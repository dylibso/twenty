import createClient from '@dylibso/xtp'
import { CurrentPlugin } from '@extism/extism'
import { Logger } from '@nestjs/common';
import { HostContext } from './host-context'

const logger = new Logger('Extism');

let xtpClient: any = null
export async function getXtpClient() {
  if (!xtpClient) {
    xtpClient = await createClient({
      appId: String(process.env.XTP_APP_ID),
      token: String(process.env.XTP_API_KEY),
      logger: console,
      useWasi: true,
      runInWorker: true,
      functions: {
        "extism:host/user": {
          async findManyWorkspaceMembers(cp: CurrentPlugin, offs: bigint) {
            const start = performance.now()
            const params = cp.read(offs)!.json()
            const ctx = cp.hostContext<HostContext>()
            const results = await ctx.fetch('GET', '/workspaceMembers', params)
            const bytes = JSON.stringify({
              totalCount: results.totalCount || 0,
              workspaceMembers: results.data.workspaceMembers
            })
            logger.log(`findManyWorkspaceMembers time: ${performance.now() - start} ms`);
            return cp.store(bytes)
          },
          async findManyTasks(cp: CurrentPlugin, offs: bigint) {
            const start = performance.now()
            const params = cp.read(offs)!.json()
            logger.log(`findManytasks`, params)
            const ctx = cp.hostContext<HostContext>()
            const results = await ctx.fetch('GET', '/tasks', params)
            logger.log(results)
            const bytes = JSON.stringify({
              totalCount: results.totalCount || 0,
              tasks: results.data.tasks
            })
            logger.log(`findManyTasks time: ${performance.now() - start} ms`);
            return cp.store(bytes)
          },
          findOneWorkspaceMember(cp: CurrentPlugin, offs: bigint) {
            const params = cp.read(offs)!.json()
            logger.log(`findOneWorkspaceMember`, params)
            const bytes = new TextEncoder().encode(JSON.stringify({ user: "ok" }))
            return cp.store(bytes);
          }
        }
      }
    })
  }
  return xtpClient
}


