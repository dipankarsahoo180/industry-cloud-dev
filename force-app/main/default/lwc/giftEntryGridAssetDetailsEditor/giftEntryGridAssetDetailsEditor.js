import { api, LightningElement } from 'lwc';

const ASSET_TYPE_OPTIONS = [
    { label: 'Property', value: 'Property' },
    { label: 'Art', value: 'Art' },
    { label: 'Vehicle', value: 'Vehicle' },
    { label: 'Collectible', value: 'Collectible' },
    { label: 'Other', value: 'Other' }
];

export default class GiftEntryGridAssetDetailsEditor extends LightningElement {
    _assets = [];

    @api
    set assets(value) {
        this._assets = normalizeAssets(value);
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

    @api
    validate() {
        this.validateAssetRows();

        const inputsValid = [
            ...this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-record-picker')
        ].reduce((isValid, input) => input.reportValidity() && isValid, true);

        return {
            isValid: inputsValid,
            invalidFields: inputsValid ? new Set() : new Set(['Asset_Details__c'])
        };
    }

    @api
    getAssetDetails() {
        return this._assets
            .filter((asset) => hasAnyAssetValue(asset))
            .map(({ id, displayName, ...asset }) => asset);
    }

    handleAddAsset() {
        this._assets = [...this._assets, createEmptyAsset()];
    }

    handleRemoveAsset(event) {
        const assetId = event.currentTarget.dataset.assetId;
        this._assets = this._assets.filter((asset) => asset.id !== assetId);
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
                [field]: value
            };
        });
    }

    validateAssetRows() {
        this._assets.forEach((asset) => {
            const rowHasValues = hasAnyAssetValue(asset);
            const appraisedValueInput = this.template.querySelector(
                `[data-asset-id="${asset.id}"][data-field="appraisedValue"]`
            );
            const appraisalDateInput = this.template.querySelector(
                `[data-asset-id="${asset.id}"][data-field="appraisalDate"]`
            );
            const assetTypeInput = this.template.querySelector(
                `[data-asset-id="${asset.id}"][data-field="assetType"]`
            );
            const appraisedValue = Number(asset.appraisedValue);
            const today = new Date().toISOString().slice(0, 10);

            appraisedValueInput?.setCustomValidity(
                asset.appraisedValue !== null &&
                    asset.appraisedValue !== '' &&
                    (!Number.isFinite(appraisedValue) || appraisedValue < 0)
                    ? 'Asset Appraised Value cannot be negative.'
                    : ''
            );
            appraisalDateInput?.setCustomValidity(
                asset.appraisalDate && asset.appraisalDate > today
                    ? 'Appraisal Date cannot be in the future.'
                    : ''
            );
            assetTypeInput?.setCustomValidity(
                rowHasValues && !asset.assetType ? 'Asset Type is required.' : ''
            );
        });
    }
}

function normalizeAssets(value) {
    const assets = Array.isArray(value) ? value : [];

    if (!assets.length) {
        return [createEmptyAsset()];
    }

    return assets.map((asset) => ({
        id: asset.id || `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        displayName: asset.displayName || 'Asset',
        appraisedById: asset.appraisedById || null,
        appraisedValue: asset.appraisedValue ?? null,
        appraisalDate: asset.appraisalDate || null,
        assetType: asset.assetType || ''
    }));
}

function createEmptyAsset() {
    return {
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        displayName: 'New Asset',
        appraisedById: null,
        appraisedValue: null,
        appraisalDate: null,
        assetType: ''
    };
}

function hasAnyAssetValue(asset) {
    return (
        asset.appraisedById ||
        asset.appraisedValue !== null ||
        asset.appraisalDate ||
        asset.assetType
    );
}
