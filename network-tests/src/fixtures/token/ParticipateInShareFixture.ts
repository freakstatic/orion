import { StandardizedFixture } from '../../Fixture'
import { SubmittableExtrinsic } from '@polkadot/api/types'
import { AnyQueryNodeEvent, EventDetails, EventType } from '../../types'
import { SubmittableResult } from '@polkadot/api'
import { OrionApi } from '../../OrionApi'
import { Api } from '../../Api'
import BN from 'bn.js'

type UserParticipatedInSplitEventDetails = EventDetails<EventType<'projectToken', 'UserParticipatedInSplit'>>

export class ParticipateInShareFixture extends StandardizedFixture {
  protected memberAddress: string
  protected memberId: number
  protected tokenId: number
  protected amount: BN

  public constructor(
    api: Api,
    query: OrionApi,
    memberAddress: string,
    memberId: number,
    tokenId: number,
    amount: BN
  ) {
    super(api, query)
    this.memberId =  memberId
    this.memberAddress =  memberAddress
    this.tokenId = tokenId 
    this.amount = amount 
  }

  protected async getSignerAccountOrAccounts(): Promise<string[]> {
    return [this.memberAddress]
  }

  protected async getExtrinsics(): Promise<SubmittableExtrinsic<'promise'>[]> {
    return [this.api.tx.projectToken.participateInSplit(this.tokenId, this.memberId, this.amount)]
  }

  protected async getEventFromResult(result: SubmittableResult): Promise<UserParticipatedInSplitEventDetails> {
    return this.api.getEventDetails(result, 'projectToken', 'UserParticipatedInSplit')
  }

  public async tryQuery(): Promise<void> {
    const token = await this.query.getTokenById(this.api.createType('u64', 0))
    console.log(`Query result:\n ${token}`)
  }

  public assertQueryNodeEventIsValid(qEvent: AnyQueryNodeEvent, i: number): void {
  }
}