import { Resolver, Query, Args } from 'type-graphql'
import { EntityManager } from 'typeorm'
import {
  GetAccountTransferrableBalanceArgs,
  GetAccountTransferrableBalanceResult,
  GetCumulativeHistoricalShareAllocationArgs,
  GetCumulativeHistoricalShareAllocationResult,
  GetShareDividendsResult,
  GetShareDividensArgs,
} from './types'
import { CreatorToken, RevenueShare, TokenAccount } from '../../../model'

@Resolver()
export class TokenResolver {
  constructor(private em: () => Promise<EntityManager>) {}

  @Query(() => GetShareDividendsResult)
  async getShareDividend(
    @Args() { tokenId, stakingAmount }: GetShareDividensArgs
  ): Promise<GetShareDividendsResult> {
    const em = await this.em()
    const token = await em.getRepository(CreatorToken).findOneBy({ id: tokenId })
    if (!token) {
      throw new Error('Token not found')
    }
    const { currentRenvenueShareId: revenueShareId, totalSupply } = token
    if (!revenueShareId) {
      throw new Error('No Revenue share ongoing for this token')
    }

    const revenueShare = await em.getRepository(RevenueShare).findOneBy({ id: revenueShareId })
    if (!revenueShare) {
      throw new Error('Revenue share not found')
    }
    const { allocation } = revenueShare

    const dividendJoyAmount = (BigInt(stakingAmount) / totalSupply) * allocation
    return {
      dividendJoyAmount: Number(dividendJoyAmount),
    }
  }

  @Query(() => GetCumulativeHistoricalShareAllocationResult)
  async getCumulativeHistoricalShareAllocation(
    @Args() { tokenId }: GetCumulativeHistoricalShareAllocationArgs
  ): Promise<GetCumulativeHistoricalShareAllocationResult> {
    const em = await this.em()
    const token = await em
      .getRepository(CreatorToken)
      .findOne({ where: { id: tokenId }, relations: { revenueShares: true } })
    if (!token) {
      throw new Error('Token not found')
    }
    let cumulativeAllocationAmount = BigInt(0)
    for (const share of token.revenueShares) {
      cumulativeAllocationAmount += share.allocation
    }
    return {
      cumulativeHistoricalAllocation: Number(cumulativeAllocationAmount),
    }
  }

  @Query(() => GetAccountTransferrableBalanceResult)
  async getAccountTransferrableBalance(
    @Args() { tokenId, memberId, currentBlockHeight: block }: GetAccountTransferrableBalanceArgs
  ): Promise<GetAccountTransferrableBalanceResult> {
    // Your implementation here
    const em = await this.em()
    const tokenAccount = await em.getRepository(TokenAccount).findOne({
      where: { tokenId, memberId },
      relations: {
        vestingSchedules: {
          vesting: true,
        },
      },
    })
    if (!tokenAccount) {
      throw new Error('Token account not found')
    }
    let lockedCrtAmount = BigInt(0)
    for (const { vesting: schedule, totalVestingAmount } of tokenAccount.vestingSchedules) {
      if (schedule.endsAt < block) {
        const remainingBlocks = schedule.endsAt - block
        const postCliffAmount =
          (totalVestingAmount * BigInt(schedule.cliffRatioPermill)) / BigInt(1000000)
        const locked =
          (postCliffAmount * BigInt(remainingBlocks)) / BigInt(schedule.vestingDurationBlocks)
        lockedCrtAmount += locked
      }
    }

    const transferrable =
      tokenAccount.totalAmount - this.bigintMax(lockedCrtAmount, tokenAccount.stakedAmount)
    return {
      transferrableCrtAmount: Number(transferrable),
    }
  }

  private bigintMax(a: bigint, b: bigint): bigint {
    return a > b ? a : b
  }
}
