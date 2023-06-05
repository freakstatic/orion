import { FlowProps } from '../../Flow'
import { extendDebug } from '../../Debugger'
import { FixtureRunner } from '../../Fixture'
import { expect } from 'chai'
import { Resource } from '../../Resources'
import { ChangeToPermissionlessFixture } from '../../fixtures/token/ChangeToPermissionlessFixture'

export default async function changeToPermissionlessFlow({
  api,
  query,
  lock,
}: FlowProps): Promise<void> {
  const debug = extendDebug('flow:change to Permissionless')
  debug('Started')
  api.enableDebugTxLogs()

  const channelId = api.channel

  // retrieve owner info
  const unlockCreatorAccess = await lock(Resource.Creator)
  const [creatorAddress, creatorMemberId] = api.creator
  unlockCreatorAccess()

  const changeToPerissionlessFixture = new ChangeToPermissionlessFixture(
    api,
    query,
    creatorAddress,
    creatorMemberId,
    channelId
  )
  await new FixtureRunner(changeToPerissionlessFixture).runWithQueryNodeChecks()
}
