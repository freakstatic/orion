import { FlowProps } from '../../Flow'
import {
  BuyMembershipHappyCaseFixture,
  BuyMembershipWithInsufficienFundsFixture,
} from '../../fixtures/membership'

import { extendDebug } from '../../Debugger'
import { FixtureRunner } from '../../Fixture'
import { assert } from 'chai'

export default async function buyingMemberships({ api, query, env }: FlowProps): Promise<void> {
  const debug = extendDebug('flow:buying-members')
  debug('Started')
  api.enableDebugTxLogs()

  const N: number = +env.MEMBERSHIP_CREATION_N!
  assert(N > 0)

  // Assert membership can be bought if sufficient funds are available
  const nAccounts = (await api.createKeyPairs(N)).map(({ key }) => key.address)
  const happyCaseFixture = new BuyMembershipHappyCaseFixture(api, query, nAccounts)
  await new FixtureRunner(happyCaseFixture).runWithQueryNodeChecks()

  // Assert account can not buy the membership with insufficient funds
  const aAccount = (await api.createKeyPairs(1))[0].key.address
  const insufficientFundsFixture = new BuyMembershipWithInsufficienFundsFixture(api, aAccount)
  await new FixtureRunner(insufficientFundsFixture).run()

  debug('Done')
}
