import { api, LightningElement } from 'lwc';

const STOCK_PAYMENT_METHOD = 'Stock';
const ASSET_PAYMENT_METHOD = 'Asset';
const CREDIT_CARD_PAYMENT_METHOD = 'Credit Card';
const ACH_PAYMENT_METHOD = 'ACH';
const CHECK_PAYMENT_METHOD = 'Check';

export default class GiftEntryPaymentMethodModal extends LightningElement {
    _modalFields = [];
    _rowData = {};
    paymentMethod = '';
    cardDetails = {};
    achDetails = {};
    checkDetails = {};
    stocks = [];
    assets = [];

    @api
    set modalFields(value) {
        this._modalFields = value || [];
        this.initializeFields();
    }

    get modalFields() {
        return this._modalFields;
    }

    @api
    set rowData(value) {
        this._rowData = value || {};
        this.initializeFields();
    }

    get rowData() {
        return this._rowData;
    }

    get showStockDetails() {
        return this.paymentMethod === STOCK_PAYMENT_METHOD;
    }

    get showAssetDetails() {
        return this.paymentMethod === ASSET_PAYMENT_METHOD;
    }

    get showCreditCardDetails() {
        return this.paymentMethod === CREDIT_CARD_PAYMENT_METHOD;
    }

    get showAchDetails() {
        return this.paymentMethod === ACH_PAYMENT_METHOD;
    }

    get showCheckDetails() {
        return this.paymentMethod === CHECK_PAYMENT_METHOD;
    }

    get showMethodSpecificDetails() {
        return (
            this.showCreditCardDetails ||
            this.showAchDetails ||
            this.showCheckDetails ||
            this.showStockDetails ||
            this.showAssetDetails
        );
    }

    get showNoMethodSpecificDetails() {
        return !this.showMethodSpecificDetails;
    }

    @api
    validate() {
        let isValid = true;
        const invalidFields = new Set();

        if (!this.paymentMethod) {
            isValid = false;
            invalidFields.add('PaymentMethod');
        }

        const paymentInput = this.template.querySelector('[data-field="PaymentMethod"]');
        if (paymentInput && !paymentInput.reportValidity()) {
            isValid = false;
            invalidFields.add('PaymentMethod');
        }

        const childValidation = this.getActiveChildEditor()?.validate();
        if (childValidation && !childValidation.isValid) {
            isValid = false;
            childValidation.invalidFields?.forEach((field) => invalidFields.add(field));
        }

        return {
            isValid,
            invalidFields
        };
    }

    @api
    getComponentValues() {
        const result = this.buildClearedPaymentFields();
        result.PaymentMethod = this.paymentMethod;

        if (this.showCreditCardDetails) {
            const details = this.getActiveChildEditor()?.getPaymentDetails() || this.cardDetails;
            result.Last4 = details.last4 || null;
            result.ExpiryMonth = details.expiryMonth || null;
            result.ExpiryYear = details.expiryYear || null;
        } else if (this.showAchDetails) {
            const details = this.getActiveChildEditor()?.getPaymentDetails() || this.achDetails;
            result.Last4 = details.last4 || null;
        } else if (this.showCheckDetails) {
            const details = this.getActiveChildEditor()?.getPaymentDetails() || this.checkDetails;
            result.CheckDate = details.checkDate || null;
            result.PaymentIdentifier = details.paymentIdentifier || null;
        } else if (this.showStockDetails) {
            result.Stock_Details__c = JSON.stringify(this.getStockDetails());
        } else if (this.showAssetDetails) {
            result.Asset_Details__c = JSON.stringify(this.getAssetDetails());
        }

        return result;
    }

    connectedCallback() {
        this.initializeFields();
    }

    initializeFields() {
        this.paymentMethod = normalizeFieldValue(this._rowData.PaymentMethod);
        this.cardDetails = {
            last4: normalizeFieldValue(this._rowData.Last4),
            expiryMonth: normalizeFieldValue(this._rowData.ExpiryMonth),
            expiryYear: normalizeFieldValue(this._rowData.ExpiryYear)
        };
        this.achDetails = {
            last4: normalizeFieldValue(this._rowData.Last4)
        };
        this.checkDetails = {
            checkDate: normalizeFieldValue(this._rowData.CheckDate),
            paymentIdentifier: normalizeFieldValue(this._rowData.PaymentIdentifier)
        };
        this.stocks = parseStockDetails(normalizeFieldValue(this._rowData.Stock_Details__c));
        this.assets = parseAssetDetails(normalizeFieldValue(this._rowData.Asset_Details__c));
    }

    handlePaymentMethodChange(event) {
        this.paymentMethod = event.detail.value;
    }

    getActiveChildEditor() {
        if (this.showCreditCardDetails) {
            return this.template.querySelector('c-gift-entry-grid-credit-card-payment-details');
        }

        if (this.showAchDetails) {
            return this.template.querySelector('c-gift-entry-grid-ach-payment-details');
        }

        if (this.showCheckDetails) {
            return this.template.querySelector('c-gift-entry-grid-check-payment-details');
        }

        if (this.showStockDetails) {
            return this.template.querySelector('c-gift-entry-grid-stock-details-editor');
        }

        if (this.showAssetDetails) {
            return this.template.querySelector('c-gift-entry-grid-asset-details-editor');
        }

        return null;
    }

    getStockDetails() {
        const stockEditor = this.template.querySelector('c-gift-entry-grid-stock-details-editor');
        return stockEditor?.getStockDetails() || this.stocks || [];
    }

    getAssetDetails() {
        const assetEditor = this.template.querySelector('c-gift-entry-grid-asset-details-editor');
        return assetEditor?.getAssetDetails() || this.assets || [];
    }

    buildClearedPaymentFields() {
        return {
            Last4: null,
            ExpiryMonth: null,
            ExpiryYear: null,
            CheckDate: null,
            PaymentIdentifier: null,
            Stock_Details__c: null,
            Asset_Details__c: null
        };
    }
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

function parseStockDetails(value) {
    return parseJsonArray(value, 'stocks');
}

function parseAssetDetails(value) {
    return parseJsonArray(value, 'assets');
}

function parseJsonArray(value, arrayProperty) {
    if (!value) {
        return [];
    }

    try {
        const parsedValue = JSON.parse(value);
        return Array.isArray(parsedValue) ? parsedValue : parsedValue[arrayProperty] || [];
    } catch (error) {
        return [];
    }
}
