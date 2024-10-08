import { AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { toQuery } from './query'

export class HostContext {
  authContext: AuthContext;

  constructor(authContext: AuthContext) {
    this.authContext = authContext
  }

  // TODO this is hacky, this currently ACTUALLY calls the API through
  // localhost because i couldn't figure out how to just call
  // the functions directly due to all the layers of abstraction...
  // So it's a lot slower than necessary, but simpler to code up and understand
  // In theory we'd just call the controller action directly here.
  async fetch(method: string, path: string, params: any) {
    // TODO get from auth context, it's null?
    const apiKey = String(process.env.TWENTY_API_KEY)
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`
    }

    const url = `http://localhost:3000/rest${path}?${toQuery(params)}`
    const response = await fetch(url,
      {
        method,
        headers
      }
    )

    return await response.json()
  }
}

