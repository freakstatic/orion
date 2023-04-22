"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OffchainState = exports.V2_MIGRATION_USER_PREFIX = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("@subsquid/logger");
const assert_1 = __importDefault(require("assert"));
const crypto_1 = require("./crypto");
const model_1 = require("../model");
const DEFAULT_EXPORT_PATH = path_1.default.resolve(__dirname, '../../db/export/export.json');
const exportedStateMap = {
    VideoViewEvent: true,
    ChannelFollow: true,
    Report: true,
    GatewayConfig: true,
    NftFeaturingRequest: true,
    VideoHero: true,
    VideoFeaturedInCategory: true,
    EncryptionArtifacts: true,
    SessionEncryptionArtifacts: true,
    Session: true,
    User: true,
    Account: true,
    Token: true,
    Channel: ['is_excluded', 'video_views_num', 'follows_num'],
    Video: ['is_excluded', 'views_num'],
    Comment: ['is_excluded'],
    OwnedNft: ['is_featured'],
    VideoCategory: ['is_supported'],
};
exports.V2_MIGRATION_USER_PREFIX = 'v2-migration-';
function migrateExportDataToV300(data) {
    const migrationUser = {
        id: `${exports.V2_MIGRATION_USER_PREFIX}${(0, crypto_1.uniqueId)()}`,
        isRoot: false,
    };
    data.User = { type: 'insert', values: [migrationUser] };
    const replaceIpWithUserId = (v) => {
        delete v.ip;
        v.userId = migrationUser.id;
    };
    data.VideoViewEvent?.values.forEach(replaceIpWithUserId);
    data.Report?.values.forEach(replaceIpWithUserId);
    data.NftFeaturingRequest?.values.forEach(replaceIpWithUserId);
    // We don't migrate channel follows from v2, because in v3
    // an account is required in order to follow a channel
    delete data.ChannelFollow;
    data.Channel?.values.forEach((v) => {
        v.follows_num = 0;
    });
    return data;
}
class OffchainState {
    constructor() {
        this.logger = (0, logger_1.createLogger)('offchainState');
        this._isImported = false;
        this.globalCountersMigration = {
            // destination version : [global counters names]
            '3.0.1': ['Account'],
        };
        this.migrations = {
            '3.0.0': migrateExportDataToV300,
        };
    }
    get isImported() {
        return this._isImported;
    }
    async export(em, exportFilePath = DEFAULT_EXPORT_PATH) {
        if (!fs_1.default.existsSync(path_1.default.dirname(exportFilePath))) {
            this.logger.info(`Creating exports directory: ${path_1.default.dirname(exportFilePath)}`);
            fs_1.default.mkdirSync(path_1.default.dirname(exportFilePath), { recursive: true });
        }
        const packageJsonPath = path_1.default.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf-8'));
        const orionVersion = packageJson.version;
        this.logger.info('Exporting offchain state');
        const exportedState = await em.transaction(async (em) => {
            const blockNumberPre = (await em.query('SELECT height FROM squid_processor.status WHERE id = 0'))[0].height;
            this.logger.info(`Export orion version: ${orionVersion}`);
            this.logger.info(`Export block number: ${blockNumberPre}`);
            const data = Object.fromEntries((await Promise.all(Object.entries(exportedStateMap).map(async ([entityName, fields]) => {
                const type = Array.isArray(fields) ? 'update' : 'insert';
                const values = Array.isArray(fields)
                    ? await em
                        .getRepository(entityName)
                        .createQueryBuilder()
                        .select(['id', ...fields])
                        .getRawMany()
                    : await em.getRepository(entityName).find({});
                if (!values.length) {
                    return [];
                }
                this.logger.info(`Exporting ${values.length} ${entityName} entities ` +
                    `(type: ${type}` +
                    (Array.isArray(fields) ? `, fields: ${fields.join(', ')})` : ')'));
                return [[entityName, { type, values }]];
            }))).flat());
            const blockNumberPost = (await em.query('SELECT height FROM squid_processor.status WHERE id = 0'))[0].height;
            (0, assert_1.default)(blockNumberPre === blockNumberPost, 'Block number changed during export');
            return { data, blockNumber: blockNumberPost, orionVersion };
        });
        this.logger.info(`Saving export data to ${exportFilePath}`);
        fs_1.default.writeFileSync(exportFilePath, JSON.stringify(exportedState));
        this.logger.info('Done');
    }
    versionToNumber(version) {
        const [major = '0', minor = '0', patch = '0'] = version.split('.');
        return parseInt(major) * (1000 * 1000) + parseInt(minor) * 1000 + parseInt(patch);
    }
    prepareExportData(exportState, em) {
        let { data } = exportState;
        Object.entries(this.migrations)
            .sort(([a], [b]) => this.versionToNumber(a) - this.versionToNumber(b))
            .forEach(([version, fn]) => {
            if (this.versionToNumber(exportState.orionVersion || '0') < this.versionToNumber(version)) {
                this.logger.info(`Migrating export data to version ${version}`);
                data = fn(data, em);
            }
        });
        return data;
    }
    async import(em, exportFilePath = DEFAULT_EXPORT_PATH) {
        if (!fs_1.default.existsSync(exportFilePath)) {
            throw new Error(`Cannot perform offchain data import! Export file ${exportFilePath} does not exist!`);
        }
        const exportFile = JSON.parse(fs_1.default.readFileSync(exportFilePath, 'utf-8'));
        const data = this.prepareExportData(exportFile, em);
        this.logger.info('Importing offchain state');
        for (const [entityName, { type, values }] of Object.entries(data)) {
            if (!values.length) {
                continue;
            }
            this.logger.info(`${type === 'update' ? 'Updating' : 'Inserting'} ${values.length} ${entityName} entities...`);
            if (type === 'update') {
                // We're using "batched" updates, because otherwise the process becomes extremely slow
                const meta = em.connection.getMetadata(entityName);
                const batchSize = 1000;
                let batchNumber = 0;
                const fieldNames = Object.keys(values[0]);
                const fieldTypes = Object.fromEntries(fieldNames.map((fieldName) => {
                    const metaType = meta.columns.find((c) => c.databaseNameWithoutPrefixes === fieldName)?.type;
                    return [fieldName, metaType === String ? 'text' : metaType];
                }));
                while (values.length) {
                    const batch = values.splice(0, batchSize);
                    this.logger.info(`Executing batch #${++batchNumber} of ${batch.length} entities (${values.length} entities left)...`);
                    let paramCounter = 1;
                    await em.query(`UPDATE "${meta.tableName}"
            SET ${fieldNames
                        .filter((f) => f !== 'id')
                        .map((f) => `"${f}" = "data"."${f}"`)
                        .join(', ')}
            FROM (
              SELECT
              ${fieldNames
                        .map((fieldName) => {
                        return `unnest($${paramCounter++}::${fieldTypes[fieldName]}[])
                  AS "${fieldName}"`;
                    })
                        .join(', ')}
            ) AS "data"
            WHERE "${meta.tableName}"."id" = "data"."id"`, fieldNames.map((fieldName) => batch.map((v) => v[fieldName])));
                }
            }
            else {
                // For inserts we also use batches, but this is because otherwise the query may fail
                // if the number of entities is very large
                const batchSize = 1000;
                let batchNumber = 0;
                while (values.length) {
                    const batch = values.splice(0, batchSize);
                    this.logger.info(`Executing batch #${++batchNumber} of ${batch.length} entities (${values.length} entities left)...`);
                    await em.getRepository(entityName).insert(batch);
                }
            }
            this.logger.info(`Done ${type === 'update' ? 'updating' : 'inserting'} ${entityName} entities`);
        }
        // migrate counters for NextEntityId
        const { orionVersion } = exportFile;
        await this.migrateCounters(orionVersion, em);
        const renamedExportFilePath = `${exportFilePath}.imported`;
        this.logger.info(`Renaming export file to ${renamedExportFilePath})...`);
        fs_1.default.renameSync(exportFilePath, renamedExportFilePath);
        this._isImported = true;
        this.logger.info('Done');
    }
    getExportBlockNumber(exportFilePath = DEFAULT_EXPORT_PATH) {
        if (!fs_1.default.existsSync(exportFilePath)) {
            this.logger.warn(`Export file ${exportFilePath} does not exist`);
            this._isImported = true;
            return -1;
        }
        const { blockNumber } = JSON.parse(fs_1.default.readFileSync(exportFilePath, 'utf-8'));
        this.logger.info(`Last export block number established: ${blockNumber}`);
        return blockNumber;
    }
    async migrateCounters(exportedVersion, em) {
        const migrationData = Object.entries(this.globalCountersMigration).sort(([a], [b]) => this.versionToNumber(a) - this.versionToNumber(b)); // sort in increasing order
        for (const [version, counters] of migrationData) {
            if (this.versionToNumber(exportedVersion) <= this.versionToNumber(version)) {
                this.logger.info(`Migrating global counters to version ${version}`);
                for (const entityName of counters) {
                    // build query that gets the entityName with the highest id
                    const rowNumber = await em.query(`SELECT COUNT(*) FROM ${entityName}`);
                    const latestId = parseInt(rowNumber[0].count);
                    this.logger.info(`Setting next id for ${entityName} to ${latestId + 1}`);
                    await em.save(new model_1.NextEntityId({ entityName, nextId: latestId + 1 }));
                }
            }
        }
    }
}
exports.OffchainState = OffchainState;
//# sourceMappingURL=offchainState.js.map