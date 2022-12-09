import assert from "assert"
import * as marshal from "./marshal"
import {Bid} from "./bid.model"
import {NftOwner, fromJsonNftOwner} from "./_nftOwner"

export class EnglishAuctionSettledEventData {
    public readonly isTypeOf = 'EnglishAuctionSettledEventData'
    private _winningBid!: string
    private _previousNftOwner!: NftOwner

    constructor(props?: Partial<Omit<EnglishAuctionSettledEventData, 'toJSON'>>, json?: any) {
        Object.assign(this, props)
        if (json != null) {
            this._winningBid = marshal.string.fromJSON(json.winningBid)
            this._previousNftOwner = fromJsonNftOwner(json.previousNftOwner)
        }
    }

    /**
     * English auction winning bid
     */
    get winningBid(): string {
        assert(this._winningBid != null, 'uninitialized access')
        return this._winningBid
    }

    set winningBid(value: string) {
        this._winningBid = value
    }

    /**
     * NFT owner before the english auction was settled
     */
    get previousNftOwner(): NftOwner {
        assert(this._previousNftOwner != null, 'uninitialized access')
        return this._previousNftOwner
    }

    set previousNftOwner(value: NftOwner) {
        this._previousNftOwner = value
    }

    toJSON(): object {
        return {
            isTypeOf: this.isTypeOf,
            winningBid: this.winningBid,
            previousNftOwner: this.previousNftOwner.toJSON(),
        }
    }
}
