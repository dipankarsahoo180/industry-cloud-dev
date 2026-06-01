import { api, LightningElement } from 'lwc';
import { executeMutation, gql } from 'lightning/graphql';

const CREATE_ASSET_MUTATION = gql`
    mutation CreateGiftEntryAsset($input: Asset__cCreateInput!) {
        uiapi {
            Asset__cCreate(input: $input) {
                Record {
                    Id
                    Name {
                        value
                    }
                }
            }
        }
    }
`;

const UPDATE_ASSET_MUTATION = gql`
    mutation UpdateGiftEntryAsset($input: Asset__cUpdateInput!) {
        uiapi {
            Asset__cUpdate(input: $input) {
                Record {
                    Id
                    Name {
                        value
                    }
                }
            }
        }
    }
`;

const ASSET_TYPE_OPTIONS = [
    { label: 'Property', value: 'Property' },
    { label: 'Art', value: 'Art' },
    { label: 'Vehicle', value: 'Vehicle' },
    { label: 'Collectible', value: 'Collectible' },
    { label: 'Other', value: 'Other' }
];

const SAVED_VALUE_PIN_DURATION_MS = 30000;

export default class GiftEntryAssetPostProcessing extends LightningElement {
    @api entryId;
    @api giftTransactionId;

    _assets = [];
    savedAssetPins = new Map();
    savingAssetId;

    @api
    set assets(value) {
        const freshAssets = (value || []).map((asset) => ({ ...asset }));
        const dirtyAssets = this._assets.filter((asset) => asset.isDirty);
        const pinnedAssets = this.getActivePins();

        if (!dirtyAssets.length && !pinnedAssets.length) {
            this._assets = freshAssets;
            this.notifyDirtyCount();
            return;
        }

        const freshById = new Map(freshAssets.map((asset) => [asset.id, asset]));
        const mergedAssets = freshAssets.map((asset) => {
            const dirtyAsset = dirtyAssets.find((item) => item.id === asset.id);
            const pinnedAsset = pinnedAssets.find((item) => item.id === asset.id);
            return dirtyAsset || pinnedAsset || asset;
        });

        [...dirtyAssets, ...pinnedAssets]
            .filter((asset) => !freshById.has(asset.id))
            .forEach((asset) => mergedAssets.push(asset));

        this._assets = mergedAssets;
        this.notifyDirtyCount();
    }

    get assets() {
        return this._assets;
    }

    get assetTypeOptions() {
        return ASSET_TYPE_OPTIONS;
    }

    get hasAssets() {
        return this._assets.length > 0;
    }

    get isSaving() {
        return !!this.savingAssetId;
    }

    get dirtyCount() {
        return this._assets.filter((asset) => asset.isDirty).length;
    }

    @api
    async saveAll() {
        const dirtyAssets = this._assets.filter((asset) => asset.isDirty);

        if (!dirtyAssets.length) {
            return { savedCount: 0, failures: [] };
        }

        const allValid = dirtyAssets.reduce(
            (isValid, asset) => this.validateAssetInputs(asset.id) && isValid,
            true
        );

        if (!allValid) {
            return { savedCount: 0, failures: ['Fix highlighted asset fields before saving.'] };
        }

        this.savingAssetId = 'all';
        const failures = [];
        let savedCount = 0;

        for (const asset of dirtyAssets) {
            try {
                const result = await this.saveAsset(asset);
                this.markAssetSaved(asset.id, asset, getSavedRecord(result, asset.isNew));
                savedCount += 1;
            } catch (error) {
                failures.push(normalizeError(error));
            }
        }

        this.savingAssetId = null;
        this.notifyDirtyCount();

        return { savedCount, failures };
    }

    handleAddAsset() {
        this._assets = [
            ...this._assets,
            {
                id: `new-asset-${Date.now()}`,
                displayName: 'New Asset',
                appraisedById: null,
                appraisedByName: '',
                appraisedValue: null,
                appraisedValueDisplay: '',
                appraisalDate: null,
                appraisalDateDisplay: '',
                assetType: '',
                assetTypeDisplay: '',
                isNew: true,
                isDirty: true
            }
        ];
        this.notifyDirtyCount();
    }

    handleAssetChange(event) {
        const { assetId, field } = event.currentTarget.dataset;
        const value = Object.prototype.hasOwnProperty.call(event.detail, 'recordId')
            ? event.detail.recordId
            : event.detail.value;

        this._assets = this._assets.map((asset) => {
            if (asset.id !== assetId) {
                return asset;
            }

            return {
                ...asset,
                [field]: value,
                isDirty: true
            };
        });
        this.notifyDirtyCount();
    }

    async handleSaveAsset(event) {
        const assetId = event.currentTarget.dataset.assetId;
        const asset = this._assets.find((item) => item.id === assetId);

        if (!asset || !this.validateAssetInputs(assetId)) {
            return;
        }

        this.savingAssetId = assetId;

        try {
            const result = await this.saveAsset(asset);
            this.markAssetSaved(assetId, asset, getSavedRecord(result, asset.isNew));
            this.dispatchEvent(
                new CustomEvent('assetsaved', {
                    detail: { savedCount: 1 },
                    bubbles: true,
                    composed: true
                })
            );
        } catch (error) {
            this.dispatchEvent(
                new CustomEvent('asseterror', {
                    detail: { message: normalizeError(error) },
                    bubbles: true,
                    composed: true
                })
            );
        } finally {
            this.savingAssetId = null;
            this.notifyDirtyCount();
        }
    }

    async saveAsset(asset) {
        const result = await executeMutation({
            query: asset.isNew ? CREATE_ASSET_MUTATION : UPDATE_ASSET_MUTATION,
            variables: { input: this.buildAssetInput(asset) },
            operationName: asset.isNew ? 'CreateGiftEntryAsset' : 'UpdateGiftEntryAsset'
        });

        if (result.errors?.length) {
            throw new Error(result.errors.map((error) => error.message).join(', '));
        }

        return result;
    }

    buildAssetInput(asset) {
        const fields = {
            Gift_Entry__c: this.entryId,
            Gift_Transaction__c: this.giftTransactionId || null,
            Appraised_By__c: asset.appraisedById || null,
            Appraised_Value__c: normalizeNumber(asset.appraisedValue),
            Appraisal_Date__c: asset.appraisalDate || null,
            Asset_Type__c: asset.assetType || null
        };

        if (asset.isNew) {
            return {
                Asset__c: fields
            };
        }

        return {
            Id: asset.id,
            Asset__c: fields
        };
    }

    markAssetSaved(assetId, submittedAsset, savedRecord) {
        const savedAsset = {
            ...submittedAsset,
            id: savedRecord?.Id || submittedAsset.id,
            displayName: savedRecord?.Name?.value || submittedAsset.displayName,
            appraisedValueDisplay: formatSavedValue(submittedAsset.appraisedValue),
            appraisalDateDisplay: submittedAsset.appraisalDate,
            assetTypeDisplay: submittedAsset.assetType,
            isNew: false,
            isDirty: false
        };

        this.savedAssetPins.set(assetId, {
            asset: savedAsset,
            expiresAt: Date.now() + SAVED_VALUE_PIN_DURATION_MS
        });

        this._assets = this._assets.map((asset) => (asset.id === assetId ? savedAsset : asset));
    }

    validateAssetInputs(assetId) {
        return [...this.template.querySelectorAll(`[data-asset-id="${assetId}"]`)].reduce(
            (isValid, input) => {
                if (typeof input.reportValidity !== 'function') {
                    return isValid;
                }

                return input.reportValidity() && isValid;
            },
            true
        );
    }

    getActivePins() {
        const now = Date.now();
        const activePins = [];

        this.savedAssetPins.forEach((pin, originalAssetId) => {
            if (pin.expiresAt <= now) {
                this.savedAssetPins.delete(originalAssetId);
                return;
            }

            activePins.push(pin.asset);
        });

        return activePins;
    }

    notifyDirtyCount() {
        this.dispatchEvent(
            new CustomEvent('assetdirtycountchange', {
                detail: {
                    entryId: this.entryId,
                    count: this.dirtyCount
                },
                bubbles: true,
                composed: true
            })
        );
    }
}

function normalizeNumber(value) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    return Number(value);
}

function normalizeError(error) {
    if (Array.isArray(error?.body)) {
        return error.body.map((item) => item.message).join(', ');
    }

    return error?.body?.message || error?.message || 'An unexpected error occurred.';
}

function formatSavedValue(value) {
    return value === null || value === undefined || value === '' ? '' : String(value);
}

function getSavedRecord(result, isCreate) {
    return isCreate
        ? result?.data?.uiapi?.Asset__cCreate?.Record
        : result?.data?.uiapi?.Asset__cUpdate?.Record;
}
