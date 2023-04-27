import { ApplicationMetadata, IOpeningMetadata } from '@joystream/metadata-protobuf'
import { assert } from 'chai'
import { Api } from '../../Api'
import {
  ApplicationFieldsFragment,
  AppliedOnOpeningEventFieldsFragment,
} from '../../graphql/generated/queries'
import { OrionApi } from '../../OrionApi'
import { EventDetails, EventType, WorkingGroupModuleName } from '../../types'
import { BaseWorkingGroupFixture } from './BaseWorkingGroupFixture'
import _ from 'lodash'
import { MemberId, ApplicationId, OpeningId } from '@joystream/types/primitives'
import { PalletWorkingGroupOpening as Opening } from '@polkadot/types/lookup'
import { SubmittableExtrinsic } from '@polkadot/api/types'
import { ISubmittableResult } from '@polkadot/types/types/'
import { Utils } from '../../utils'

export type ApplicantDetails = {
  memberId: MemberId
  roleAccount: string
  rewardAccount: string
  stakingAccount: string
}

export type OpeningApplications = {
  openingId: OpeningId
  openingMetadata: IOpeningMetadata
  applicants: ApplicantDetails[]
}

export type OpeningApplicationsFlattened = {
  openingId: OpeningId
  openingMetadata: IOpeningMetadata
  applicant: ApplicantDetails
}[]

// 'contentWorkingGroup' used just as a reference group (all working-group events are the same)
type AppliedOnOpeningEventDetails = EventDetails<
  EventType<'contentWorkingGroup', 'AppliedOnOpening'>
>

export class ApplyOnOpeningsHappyCaseFixture extends BaseWorkingGroupFixture {
  protected applications: OpeningApplicationsFlattened
  protected events: AppliedOnOpeningEventDetails[] = []
  protected createdApplicationsByOpeningId: Map<number, ApplicationId[]> = new Map<
    number,
    ApplicationId[]
  >()

  public constructor(
    api: Api,
    query: OrionApi,
    group: WorkingGroupModuleName,
    openingsApplications: OpeningApplications[]
  ) {
    super(api, query, group)
    this.applications = this.flattenOpeningApplicationsData(openingsApplications)
  }

  protected flattenOpeningApplicationsData(
    openingsApplications: OpeningApplications[]
  ): OpeningApplicationsFlattened {
    return openingsApplications.reduce(
      (curr, details) =>
        curr.concat(
          details.applicants.map((a) => ({
            openingId: details.openingId,
            openingMetadata: details.openingMetadata,
            applicant: a,
          }))
        ),
      [] as OpeningApplicationsFlattened
    )
  }

  protected async getSignerAccountOrAccounts(): Promise<string[]> {
    return this.applications.map((a) => a.applicant.roleAccount)
  }

  protected async getExtrinsics(): Promise<SubmittableExtrinsic<'promise'>[]> {
    const openingIds = _.uniq(this.applications.map((a) => a.openingId.toString()))
    const openings = await this.api.query[this.group].openingById.multi<Opening>(openingIds)
    return this.applications.map((a, i) => {
      const openingIndex = openingIds.findIndex((id) => id === a.openingId.toString())
      const opening = openings[openingIndex]
      return this.api.tx[this.group].applyOnOpening({
        memberId: a.applicant.memberId,
        description: Utils.metadataToBytes(
          ApplicationMetadata,
          this.getApplicationMetadata(a.openingMetadata, i)
        ),
        openingId: a.openingId,
        rewardAccountId: a.applicant.rewardAccount,
        roleAccountId: a.applicant.roleAccount,
        stakeParameters: {
          stake: opening.stakePolicy.stakeAmount,
          stakingAccountId: a.applicant.stakingAccount,
        },
      })
    })
  }

  protected async getEventFromResult(
    result: ISubmittableResult
  ): Promise<AppliedOnOpeningEventDetails> {
    return this.api.getEventDetails(result, this.group, 'AppliedOnOpening')
  }

  public async execute(): Promise<void> {
    await super.execute()
    this.applications.map(({ openingId }, i) => {
      this.createdApplicationsByOpeningId.set(openingId.toNumber(), [
        ...(this.createdApplicationsByOpeningId.get(openingId.toNumber()) || []),
        this.events[i].event.data[1],
      ])
    })
  }

  public getCreatedApplicationsByOpeningId(openingId: OpeningId): ApplicationId[] {
    const applicationIds = this.createdApplicationsByOpeningId.get(openingId.toNumber())
    if (!applicationIds) {
      throw new Error(`No created application ids by opening id ${openingId.toString()} found!`)
    }
    return applicationIds
  }

  protected getApplicationMetadata(
    openingMetadata: IOpeningMetadata,
    i: number
  ): ApplicationMetadata {
    const metadata = new ApplicationMetadata({ answers: [] })
    ;(openingMetadata.applicationFormQuestions || []).forEach((question, j) => {
      metadata.answers.push(`Answer to question ${j} by applicant number ${i}`)
    })
    return metadata
  }

  protected assertQueriedApplicationsAreValid(
    qApplications: ApplicationFieldsFragment[],
    qEvents: AppliedOnOpeningEventFieldsFragment[]
  ): void {
    this.events.map((e, i) => {
      const applicationDetails = this.applications[i]
      const qApplication = qApplications.find((a) => a.runtimeId === e.event.data[1].toNumber())
      const qEvent = this.findMatchingQueryNodeEvent(e, qEvents)
      Utils.assert(qApplication, 'Query node: Application not found!')
      assert.equal(qApplication.runtimeId, e.event.data[1].toNumber())
      assert.equal(qApplication.createdInEvent.id, qEvent.id)
      assert.equal(qApplication.opening.runtimeId, applicationDetails.openingId.toNumber())
      assert.equal(qApplication.applicant.id, applicationDetails.applicant.memberId.toString())
      assert.equal(qApplication.roleAccount, applicationDetails.applicant.roleAccount)
      assert.equal(qApplication.rewardAccount, applicationDetails.applicant.rewardAccount)
      assert.equal(qApplication.stakingAccount, applicationDetails.applicant.stakingAccount)
      assert.equal(qApplication.status.__typename, 'ApplicationStatusPending')
      assert.equal(qApplication.stake, e.event.data[0].stakeParameters.stake)

      const applicationMetadata = this.getApplicationMetadata(applicationDetails.openingMetadata, i)
      assert.deepEqual(
        qApplication.answers.map(({ question: { question }, answer }) => ({ question, answer })),
        (applicationDetails.openingMetadata.applicationFormQuestions || []).map(
          ({ question }, index) => ({
            question,
            answer: applicationMetadata.answers[index],
          })
        )
      )
    })
  }

  protected assertQueryNodeEventIsValid(
    qEvent: AppliedOnOpeningEventFieldsFragment,
    i: number
  ): void {
    const applicationDetails = this.applications[i]
    assert.equal(qEvent.group.name, this.group)
    assert.equal(qEvent.opening.runtimeId, applicationDetails.openingId.toNumber())
    assert.equal(qEvent.application.runtimeId, this.events[i].event.data[1].toNumber())
  }

  async runQueryNodeChecks(): Promise<void> {
  }
}
