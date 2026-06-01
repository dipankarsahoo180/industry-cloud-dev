import { LightningElement, api } from 'lwc';

/**
 * Gift Entry Post-Processing Modal
 * Education Cloud Native Fundraising — Gift Entry Grid
 *
 * Official contract (from EC docs):
 *   @api rowData        — setter; object containing all row data incl. GiftTransactionId
 *   @api configuration  — object containing templateConfig and recordId for navigation
 *
 * To close the modal the component MUST dispatch 'closemodal' with
 * { detail: { componentName: 'c/<componentName>' } }
 *
 * Register this component as a Post-Processing Modal step inside the
 * Gift Entry Grid template (e.g. SF_GE_ST_Clone) and set it as the
 * Single Entry Default to activate it.
 */
export default class GiftEntryPostProcessingCustom extends LightningElement {

    /** Configuration object passed by the GE Grid (templateConfig + recordId). */
    @api configuration;

    _rowData = {};
    _giftTransactionId = '';

    /**
     * Row data passed by the GE Grid after a successful save.
     * Includes GiftTransactionId and other gift row fields.
     */
    @api
    set rowData(value) {
        this._rowData = value || {};
        this.initializeFields();
    }
    get rowData() {
        return this._rowData;
    }

    @api
    set giftTransactionId(value) {
        this._giftTransactionId = value || '';
    }

    /** Gift Transaction Id extracted from rowData for display. */
    get giftTransactionId() {
        return this._giftTransactionId;
    }

    get hasGiftTransactionId() {
        return !!this.giftTransactionId;
    }

    get hasAssetContext() {
        return this.hasGiftTransactionId;
    }

    /**
     * Close the GE Grid modal.
     * Dispatches 'closemodal' — the required event name per EC documentation.
     */
    handleDone() {
        this.dispatchEvent(
            new CustomEvent('closemodal', {
                detail: {
                    componentName: 'c/giftEntryPostProcessingCustom'
                }
            })
        );
    }

    connectedCallback() {
        this.initializeFields();
    }

    initializeFields() {
        const rowGiftTransactionId = getFirstValue(this._rowData, ['GiftTransactionId']);

        if (rowGiftTransactionId) {
            this._giftTransactionId = rowGiftTransactionId;
        }
    }
}

function getFirstValue(source, keys) {
    if (!source) {
        return '';
    }

    const key = keys.find((candidate) => normalizeFieldValue(source[candidate]));
    return key ? normalizeFieldValue(source[key]) : '';
}

function normalizeFieldValue(value) {
    if (!value) {
        return '';
    }

    if (typeof value === 'object') {
        return value.value || value.recordId || value.id || '';
    }

    return value;
}
