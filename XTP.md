# XTP


First setup docker database in another tab:

```
make postgres-on-docker
```

copy over env files:

```
cp ./packages/twenty-front/.env.example ./packages/twenty-front/.env
cp ./packages/twenty-server/.env.example ./packages/twenty-server/.env
```

Add these to the server .env. You need a valid xtp app and key. Use these values or your own. You
might need to get twenty running first to [generate](https://twenty.com/user-guide/section/functions/api-webhooks) the TWENTY_API_KEY then come back and set it and restart.

```
XTP_API_KEY="xtp0_abcd1234"
XTP_APP_ID="app_abcd1234"
XTP_EXT_POINT="TwentyLifecyclePlugin"
XTP_GUEST_KEY="apple-inc"
TWENTY_API_KEY="eyJhbGciOiJIUzI1NiIs...."
```

install deps:

```
yarn
```

setup the database:

```
npx nx database:reset twenty-server
```

Run front and backend like this

```
npx nx start
```

Open [http://localhost:3000](http://localhost:3000)


You can find the extension point schema at [./twenty-xtp.yaml](./twenty-xtp.yaml).
I wrote the ruby script [./openapi-transform.rb](./openapi-transform.rb) to transform the
original OpenAPI doc to XTP, but did some things by hand so don't run it and overwrite it.


## Making plugin

> *Note*: the plugin needs to have the name `default`

```
xtp plugin init --name default
```

Here is an example of a typescript plugin to do the manager escalation process:

```typescript
import { findManyTasks, findManyWorkspaceMembers, TaskUpdate, TaskChange, TaskStatus } from "./pdk";

const escalationPolicy = [
  { email: 'phil.schiler@apple.dev', maxTasks: 3 },
  { email: 'jony.ive@apple.dev', maxTasks: 3 },
  { email: 'tim@apple.dev', maxTasks: 1000 },
]

/**
 * Called before a task is updated
 *
 * @param {TaskUpdate} input - The original task and the changes requested by the user
 * @returns {TaskChange} The changes you wish you apply
 */
export function beforeTaskUpdateImpl(input: TaskUpdate): TaskChange {
  const changes = input.change

  if (changes.status === TaskStatus.DONE) {
    for (let manager of escalationPolicy) {
      // find next manager in the escalation policy
      const memberResult = findManyWorkspaceMembers(
        {
          filter: { userEmail: { eq: manager.email } },
          limit: 1
        }
      )
      const memberId = memberResult.workspaceMembers[0].id
      // check to see how many tasks they have
      const taskResult = findManyTasks({
        filter: { assigneeId: { eq: memberId } }
      })
      // if they have less than max, assign this to them
      if (taskResult.totalCount < manager.maxTasks) {
        changes.assigneeId = memberId
        break
      }
    }
  }
  return changes
}

/**
 * Called after a task is updated
 *
 * @param {TaskUpdate} input - The original task and the changes requested by the user
 */
export function afterTaskUpdateImpl(input: TaskUpdate) {
  console.log(`afterTaskUpdate not implemented`)
}
```

This should work without any setup when using the tim@apple demo account.

Here is the python equivalent:

```python
import extism  # noqa: F401 # pyright: ignore

from pdk_types import (
    FindManyTasksParameters,
    FindManyWorkspaceMembersParameters,
    TaskUpdate,
)  # noqa: F401

from pdk_imports import (
    find_many_tasks,
    find_many_workspace_members,
)  # noqa: F401

from typing import List, TypedDict, Optional  # noqa: F401

class EscalationPolicyItem(TypedDict):
    email: str
    maxTasks: int

escalation_policy: List[EscalationPolicyItem] = [
    {"email": "phil.schiler@apple.dev", "maxTasks": 2},
    {"email": "jony.ive@apple.dev", "maxTasks": 1},
    {"email": "tim@apple.dev", "maxTasks": 1000},
]

def before_task_update(input: TaskUpdate) -> TaskUpdate:
    if input.change.status == "DONE":
        for manager in escalation_policy:
            # find next manager in the escalation policy
            member_result = find_many_workspace_members(
                FindManyWorkspaceMembersParameters(
                    filter={"userEmail": {"eq": manager["email"]}},
                    limit=1
                )
            )
            member_id = member_result.workspaceMembers[0].id
            # check to see how many tasks they have
            task_result = find_many_tasks(
                    FindManyTasksParameters(
                        filter={"assigneeId": {"eq": member_id}},
                        limit=None,
                    )
            )
            # if they have less than max, assign this to them
            if task_result.totalCount < manager["maxTasks"]:
                input.change.assigneeId = member_id
                break
    
    return input



# Called after a task is updated
def after_task_update(input: TaskUpdate):
    print("Unimplemented: afterTaskUpdate")

```
