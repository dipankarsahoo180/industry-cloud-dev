import { LightningElement, api, wire } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';
import { CurrentPageReference } from 'lightning/navigation';
import {
    closeTab,
    getFocusedTabInfo
} from 'lightning/platformWorkspaceApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { executeMutation, gql, graphql } from 'lightning/graphql';

const GIFT_ENTRIES_QUERY = gql`
    query GiftEntryAssetPostProcessing($recordId: ID!) {
        uiapi {
            query {
                GiftEntry(
                    first: 200
                    where: {
                        GiftBatchId: { eq: $recordId }
                        PaymentMethod: { eq: "Asset" }
                        GiftProcessingStatus: { eq: "Success" }
                    }
                    orderBy: { GiftReceivedDate: { order: DESC } }
                ) {
                    edges {
                        node {
                            Id
                            Name {
                                value
                            }
                            Donor @optional {
                                Name {
                                    value
                                }
                            }
                            GiftReceivedDate {
                                value
                                displayValue
                            }
                            GiftAmount {
                                value
                                displayValue
                            }
                            PaymentMethod {
                                value
                                displayValue
                            }
                            GiftDesignation1 @optional {
                                Name {
                                    value
                                }
                            }
                            GiftTransactionId {
                                value
                            }
                            GiftEntryAssets__r(first: 50) @optional {
                                edges {
                                    node {
                                        Id
                                        Name {
                                            value
                                        }
                                        Appraised_By__c {
                                            value
                                        }
                                        Appraised_By__r @optional {
                                            Name {
                                                value
                                            }
                                        }
                                        Appraised_Value__c {
                                            value
                                            displayValue
                                        }
                                        Appraisal_Date__c {
                                            value
                                            displayValue
                                        }
                                        Asset_Type__c {
                                            value
                                            displayValue
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`;

const GIFT_ENTRY_BY_TRANSACTION_QUERY = gql`
    query GiftEntryByTransactionAssetPostProcessing($giftTransactionId: ID!) {
        uiapi {
            query {
                GiftEntry(
                    first: 1
                    where: {
                        GiftTransactionId: { eq: $giftTransactionId }
                        PaymentMethod: { eq: "Asset" }
                        GiftProcessingStatus: { eq: "Success" }
                    }
                ) {
                    edges {
                        node {
                            Id
                            Name {
                                value
                            }
                            Donor @optional {
                                Name {
                                    value
                                }
                            }
                            GiftReceivedDate {
                                value
                                displayValue
                            }
                            GiftAmount {
                                value
                                displayValue
                            }
                            PaymentMethod {
                                value
                                displayValue
                            }
                            GiftDesignation1 @optional {
                                Name {
                                    value
                                }
                            }
                            GiftTransactionId {
                                value
                            }
                            GiftEntryAssets__r(first: 50) @optional {
                                edges {
                                    node {
                                        Id
                                        Name {
                                            value
                                        }
                                        Appraised_By__c {
                                            value
                                        }
                                        Appraised_By__r @optional {
                                            Name {
                                                value
                                            }
                                        }
                                        Appraised_Value__c {
                                            value
                                            displayValue
                                        }
                                        Appraisal_Date__c {
                                            value
                                            displayValue
                                        }
                                        Asset_Type__c {
                                            value
                                            displayValue
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`;

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

export default class GiftEntryPostProcessing extends LightningElement {
    _recordId;
    _giftTransactionId;

    entries = [];
    errors;
    isLoading = true;
    missingRecordId = false;
    savingAssetId;
    wiredQueryResult;
    missingRecordIdTimeout;
    savedAssetPins = new Map();

    @api
    set recordId(value) {
        this._recordId = value;
        this.isLoading = true;
        this.missingRecordId = false;
    }

    get recordId() {
        return this._recordId;
    }

    @api
    set giftTransactionId(value) {
        this._giftTransactionId = value;
        this.isLoading = true;
        this.missingRecordId = false;
    }

    get giftTransactionId() {
        return this._giftTransactionId;
    }

    @api modalMode = false;

    @api closeComponentName = 'c/giftEntryPostProcessingCustom';

    get query() {
        if (this.effectiveGiftTransactionId) {
            return GIFT_ENTRY_BY_TRANSACTION_QUERY;
        }

        return GIFT_ENTRIES_QUERY;
    }

    get variables() {
        if (this.effectiveGiftTransactionId) {
            return {
                giftTransactionId: this.effectiveGiftTransactionId
            };
        }

        if (!this.effectiveRecordId) {
            return undefined;
        }

        return {
            recordId: this.effectiveRecordId
        };
    }

    @wire(CurrentPageReference)
    setCurrentPageReference(pageReference) {
        const pageRecordId = pageReference?.state?.c__recordId;

        if (pageRecordId && pageRecordId !== this._recordId) {
            this._recordId = pageRecordId;
            this.isLoading = true;
            this.missingRecordId = false;
        }
    }

    connectedCallback() {
        this.missingRecordIdTimeout = window.setTimeout(() => {
            if (!this.effectiveGiftTransactionId && !this.effectiveRecordId) {
                this.isLoading = false;
                this.missingRecordId = true;
            }
        }, 1500);
    }

    disconnectedCallback() {
        window.clearTimeout(this.missingRecordIdTimeout);
    }

    get effectiveRecordId() {
        return this._recordId;
    }

    get effectiveGiftTransactionId() {
        return this._giftTransactionId;
    }

    get isSingleGiftMode() {
        return !!this.effectiveGiftTransactionId;
    }

    get title() {
        return this.isSingleGiftMode ? 'Gift Entry Asset Post Processing' : 'Gift Entry Post Processing';
    }

    get heading() {
        return this.isSingleGiftMode ? 'Asset details for processed gift' : 'Successful asset gift entries';
    }

    get description() {
        return this.isSingleGiftMode
            ? 'Add or update the asset details for this processed Gift Entry.'
            : 'Gift entries with Payment Method = Asset and Status = Success.';
    }

    get missingContextMessage() {
        return this.isSingleGiftMode
            ? 'Gift Transaction id was not available from the post-processing modal.'
            : 'Open this page from a Gift Batch record so the record id can be passed in.';
    }

    get emptyStateMessage() {
        return this.isSingleGiftMode
            ? 'This processed gift entry was not found, or it is not an Asset gift with Success status.'
            : 'No successful Gift Entries with Asset payment method were found for this batch.';
    }

    get assetTypeOptions() {
        return ASSET_TYPE_OPTIONS;
    }

    get hasEntries() {
        return this.entries.length > 0;
    }

    get isSaving() {
        return !!this.savingAssetId;
    }

    get dirtyAssetCount() {
        return this.getDirtyAssets().length;
    }

    get hasDirtyAssets() {
        return this.dirtyAssetCount > 0;
    }

    get isSaveAllDisabled() {
        return this.isSaving || !this.hasDirtyAssets;
    }

    get showEmptyState() {
        return (
            !!(this.effectiveGiftTransactionId || this.effectiveRecordId) &&
            !this.isLoading &&
            !this.errors &&
            !this.hasEntries
        );
    }

    get errorMessages() {
        return normalizeErrors(this.errors);
    }

    @wire(graphql, {
        query: '$query',
        variables: '$variables',
        operationName: '$operationName'
    })
    wiredGiftEntries(result) {
        this.wiredQueryResult = result;

        if (!this.effectiveGiftTransactionId && !this.effectiveRecordId) {
            this.isLoading = true;
            return;
        }

        const { data, errors } = result;

        if (data) {
            this.entries = this.mergeDirtyAssets(this.mapGiftEntries(data));
            this.errors = undefined;
            this.isLoading = false;
        } else if (errors) {
            this.entries = [];
            this.errors = errors;
            this.isLoading = false;
        } else {
            this.isLoading = true;
        }
    }

    get operationName() {
        return this.effectiveGiftTransactionId
            ? 'GiftEntryByTransactionAssetPostProcessing'
            : 'GiftEntryAssetPostProcessing';
    }

    mapGiftEntries(data) {
        const edges = data?.uiapi?.query?.GiftEntry?.edges || [];

        return edges.map(({ node }) => {
            const assets = (node.GiftEntryAssets__r?.edges || []).map(({ node: asset }) =>
                this.mapAsset(asset)
            );

            return {
                id: node.Id,
                giftTransactionId: fieldValue(node.GiftTransactionId),
                name: fieldValue(node.Name) || node.Id,
                donor: fieldValue(node.Donor?.Name),
                giftReceivedDate: displayOrValue(node.GiftReceivedDate),
                giftAmount: displayOrValue(node.GiftAmount),
                paymentMethod: displayOrValue(node.PaymentMethod),
                designation: fieldValue(node.GiftDesignation1?.Name),
                assets
            };
        });
    }

    mapAsset(asset) {
        return {
            id: asset.Id,
            displayName: fieldValue(asset.Name) || 'Asset',
            appraisedById: fieldValue(asset.Appraised_By__c),
            appraisedByName: fieldValue(asset.Appraised_By__r?.Name),
            appraisedValue: fieldValue(asset.Appraised_Value__c),
            appraisedValueDisplay: displayOrValue(asset.Appraised_Value__c),
            appraisalDate: fieldValue(asset.Appraisal_Date__c),
            appraisalDateDisplay: displayOrValue(asset.Appraisal_Date__c),
            assetType: fieldValue(asset.Asset_Type__c),
            assetTypeDisplay: displayOrValue(asset.Asset_Type__c),
            isNew: false,
            isDirty: false
        };
    }

    mergeDirtyAssets(freshEntries) {
        const dirtyByEntryId = new Map(
            this.entries.map((entry) => [entry.id, entry.assets.filter((asset) => asset.isDirty)])
        );
        const pinnedByEntryId = this.getActivePinsByEntryId();

        return freshEntries.map((entry) => {
            const dirtyAssets = dirtyByEntryId.get(entry.id) || [];
            const pinnedAssets = pinnedByEntryId.get(entry.id) || [];

            if (!dirtyAssets.length && !pinnedAssets.length) {
                return entry;
            }

            const freshAssetsById = new Map(entry.assets.map((asset) => [asset.id, asset]));
            const mergedAssets = entry.assets.map((asset) => {
                const dirtyAsset = dirtyAssets.find((item) => item.id === asset.id);
                const pinnedAsset = pinnedAssets.find((item) => item.id === asset.id);
                return dirtyAsset || pinnedAsset || asset;
            });

            [...dirtyAssets, ...pinnedAssets]
                .filter((asset) => !freshAssetsById.has(asset.id))
                .forEach((asset) => mergedAssets.push(asset));

            return {
                ...entry,
                assets: mergedAssets
            };
        });
    }

    getActivePinsByEntryId() {
        const now = Date.now();
        const activePinsByEntryId = new Map();

        this.savedAssetPins.forEach((pin, originalAssetId) => {
            if (pin.expiresAt <= now) {
                this.savedAssetPins.delete(originalAssetId);
                return;
            }

            if (!activePinsByEntryId.has(pin.entryId)) {
                activePinsByEntryId.set(pin.entryId, []);
            }

            activePinsByEntryId.get(pin.entryId).push(pin.asset);
        });

        return activePinsByEntryId;
    }

    handleAddAsset(event) {
        const entryId = event.currentTarget.dataset.entryId;
        const tempId = `new-${Date.now()}`;

        this.entries = this.entries.map((entry) => {
            if (entry.id !== entryId) {
                return entry;
            }

            return {
                ...entry,
                assets: [
                    ...entry.assets,
                    {
                        id: tempId,
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
                ]
            };
        });
    }

    handleAssetChange(event) {
        const { entryId, assetId, field } = event.currentTarget.dataset;
        const value = Object.prototype.hasOwnProperty.call(event.detail, 'recordId')
            ? event.detail.recordId
            : event.detail.value;

        this.entries = this.entries.map((entry) => {
            if (entry.id !== entryId) {
                return entry;
            }

            return {
                ...entry,
                assets: entry.assets.map((asset) => {
                    if (asset.id !== assetId) {
                        return asset;
                    }

                    return {
                        ...asset,
                        [field]: value,
                        isDirty: true
                    };
                })
            };
        });
    }

    async handleSaveAsset(event) {
        const { entryId, assetId } = event.currentTarget.dataset;
        const entry = this.entries.find((item) => item.id === entryId);
        const asset = entry?.assets.find((item) => item.id === assetId);

        if (!entry || !asset) {
            return;
        }

        if (!this.validateAssetInputs(assetId)) {
            this.showToast('Review asset details', 'Fix the highlighted fields before saving.', 'error');
            return;
        }

        this.savingAssetId = assetId;

        try {
            const input = this.buildAssetInput(entry, asset);
            const result = await executeMutation({
                query: asset.isNew ? CREATE_ASSET_MUTATION : UPDATE_ASSET_MUTATION,
                variables: { input },
                operationName: asset.isNew ? 'CreateGiftEntryAsset' : 'UpdateGiftEntryAsset'
            });

            if (result.errors?.length) {
                throw new Error(result.errors.map((error) => error.message).join(', '));
            }

            this.markAssetSaved(entryId, assetId, asset, getSavedRecord(result, asset.isNew));
            this.showToast('Asset saved', `${entry.name} asset details were saved.`, 'success');
        } catch (error) {
            this.showToast('Unable to save asset', normalizeError(error), 'error');
        } finally {
            this.savingAssetId = null;
        }
    }

    async handleSaveAll() {
        const dirtyAssets = this.getDirtyAssets();

        if (!dirtyAssets.length) {
            this.showToast('Nothing to save', 'There are no unsaved asset changes.', 'info');
            return;
        }

        const allValid = dirtyAssets.reduce(
            (isValid, { asset }) => this.validateAssetInputs(asset.id) && isValid,
            true
        );

        if (!allValid) {
            this.showToast('Review asset details', 'Fix the highlighted fields before saving.', 'error');
            return;
        }

        this.savingAssetId = 'all';
        const failures = [];
        let savedCount = 0;

        for (const { entry, asset } of dirtyAssets) {
            try {
                const input = this.buildAssetInput(entry, asset);
                const result = await executeMutation({
                    query: asset.isNew ? CREATE_ASSET_MUTATION : UPDATE_ASSET_MUTATION,
                    variables: { input },
                    operationName: asset.isNew ? 'CreateGiftEntryAsset' : 'UpdateGiftEntryAsset'
                });

                if (result.errors?.length) {
                    throw new Error(result.errors.map((error) => error.message).join(', '));
                }

                this.markAssetSaved(entry.id, asset.id, asset, getSavedRecord(result, asset.isNew));
                savedCount += 1;
            } catch (error) {
                failures.push(`${entry.name}: ${normalizeError(error)}`);
            }
        }

        this.savingAssetId = null;

        if (failures.length) {
            this.showToast(
                'Some assets were not saved',
                `${savedCount} saved, ${failures.length} failed. ${failures.join(' ')}`,
                'error'
            );
            return;
        }

        this.showToast('Assets saved', `${savedCount} asset records were saved.`, 'success');
    }

    getDirtyAssets() {
        return this.entries.flatMap((entry) =>
            entry.assets
                .filter((asset) => asset.isDirty)
                .map((asset) => ({
                    entry,
                    asset
                }))
        );
    }

    markAssetSaved(entryId, assetId, submittedAsset, savedRecord) {
        const savedAsset = this.buildSavedAsset(submittedAsset, savedRecord);

        this.savedAssetPins.set(assetId, {
            asset: savedAsset,
            entryId,
            expiresAt: Date.now() + SAVED_VALUE_PIN_DURATION_MS
        });

        this.entries = this.entries.map((entry) => {
            if (entry.id !== entryId) {
                return entry;
            }

            return {
                ...entry,
                assets: entry.assets.map((asset) => {
                    if (asset.id !== assetId) {
                        return asset;
                    }

                    return savedAsset;
                })
            };
        });
    }

    buildSavedAsset(asset, savedRecord) {
        return {
            ...asset,
            id: savedRecord?.Id || asset.id,
            displayName: fieldValue(savedRecord?.Name) || asset.displayName,
            appraisedValue: asset.appraisedValue,
            appraisedValueDisplay: formatSavedValue(asset.appraisedValue),
            appraisalDate: asset.appraisalDate,
            appraisalDateDisplay: asset.appraisalDate,
            assetType: asset.assetType,
            assetTypeDisplay: asset.assetType,
            isNew: false,
            isDirty: false
        };
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

    buildAssetInput(entry, asset) {
        const fields = {
            Gift_Entry__c: entry.id,
            Gift_Transaction__c: entry.giftTransactionId,
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

    async refreshEntries() {
        if (this.wiredQueryResult?.refresh) {
            await this.wiredQueryResult.refresh();
        }
    }

    handleRefresh() {
        if (!this.effectiveGiftTransactionId && !this.effectiveRecordId) {
            this.showToast('Waiting for record', 'Gift Entry context is not available yet.', 'info');
            return;
        }

        if (this.hasDirtyAssets) {
            this.showToast('Unsaved changes', 'Save all asset changes before refreshing.', 'warning');
            return;
        }

        this.savedAssetPins.clear();
        this.isLoading = true;
        this.refreshEntries().finally(() => {
            this.isLoading = false;
        });
    }

    async handleClose() {
        if (this.modalMode) {
            this.dispatchEvent(
                new CustomEvent('assetpostprocessingclose', {
                    detail: {
                        componentName: this.closeComponentName
                    }
                })
            );
            return;
        }

        try {
            const focusedTabInfo = await getFocusedTabInfo();
            await closeTab(focusedTabInfo.tabId);
            return;
        } catch (error) {
            window.close();
            window.history.back();
            this.dispatchEvent(new CloseActionScreenEvent());
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}

function fieldValue(field) {
    return field?.value ?? '';
}

function displayOrValue(field) {
    return field?.displayValue || field?.value || '';
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

function normalizeErrors(errors) {
    if (!errors) {
        return [];
    }

    if (Array.isArray(errors)) {
        return errors.map((error) => error.message || normalizeError(error));
    }

    return [normalizeError(errors)];
}

function formatSavedValue(value) {
    return value === null || value === undefined || value === '' ? '' : String(value);
}

function getSavedRecord(result, isCreate) {
    return isCreate
        ? result?.data?.uiapi?.Asset__cCreate?.Record
        : result?.data?.uiapi?.Asset__cUpdate?.Record;
}
