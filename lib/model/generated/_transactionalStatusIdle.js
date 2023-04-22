"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionalStatusIdle = void 0;
const marshal = __importStar(require("./marshal"));
/**
 * Represents TransactionalStatus Idle
 */
class TransactionalStatusIdle {
    constructor(props, json) {
        this.isTypeOf = 'TransactionalStatusIdle';
        Object.assign(this, props);
        if (json != null) {
            this._phantom = json.phantom == null ? undefined : marshal.int.fromJSON(json.phantom);
        }
    }
    get phantom() {
        return this._phantom;
    }
    set phantom(value) {
        this._phantom = value;
    }
    toJSON() {
        return {
            isTypeOf: this.isTypeOf,
            phantom: this.phantom,
        };
    }
}
exports.TransactionalStatusIdle = TransactionalStatusIdle;
//# sourceMappingURL=_transactionalStatusIdle.js.map