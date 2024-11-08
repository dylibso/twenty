import createClient from '@dylibso/xtp'
import { CurrentPlugin } from '@extism/extism'
import { Logger } from '@nestjs/common';
import { HostContext } from './host-context'

async function callClaudeAPI(messageRequest) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': String(process.env.ANTHROPIC_API_KEY),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(messageRequest)
    })

    // Check if the request was successful
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        `API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`
      )
    }

    return response.text()

    // // Extract the text content from the response
    // const responseText = data.content[0].text
    // console.log('Claude response:', responseText)

    // // Return full response data for access to usage stats, etc.
    // return data

  } catch (error) {
    console.error('Error calling Claude API:', error)
    throw error
  }
}

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
            console.log(`findManyWorkspaceMembers`)
            const start = performance.now()
            const params = cp.read(offs)!.json()
            const ctx = cp.hostContext<HostContext>()
            console.log(params)
            const results = await ctx.fetch('GET', '/workspaceMembers', params)
            console.log(results)
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
          async findOneWorkspaceMember(cp: CurrentPlugin, offs: bigint) {
            throw new Error(`findOneWorkspaceMember`)
          },
          async createClaudeMessage(cp: CurrentPlugin, offs: bigint) {
            const params = cp.read(offs)!.json()
            logger.log(`createClaudeMessage`, params)
            const response = await callClaudeAPI(params)
            console.log(`response`, response)
            const bytes = new TextEncoder().encode(response)
            return cp.store(bytes);
          }
        }
      }
    })
  }
  return xtpClient
}


