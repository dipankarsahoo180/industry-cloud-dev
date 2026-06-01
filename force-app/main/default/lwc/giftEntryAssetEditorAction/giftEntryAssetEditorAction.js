import { LightningElement, api, wire } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';
import { getFieldValue, getRecord } from 'lightning/uiRecordApi';
import GIFT_TRANSACTION_FIELD from '@salesforce/schema/GiftEntry.GiftTransactionId';

const FIELDS = [GIFT_TRANSACTION_FIELD];

export default class GiftEntryAssetEditorAction extends LightningElement {
    @api recordId;

    @wire(getRecord, {
        recordId: '$recordId',
        fields: FIELDS
    })
    giftEntry;

    get giftTransactionId() {
        return getFieldValue(this.giftEntry.data, GIFT_TRANSACTION_FIELD);
    }

    get hasGiftTransactionId() {
        return !!this.giftTransactionId;
    }

    get isLoading() {
        return !this.giftEntry.data && !this.giftEntry.error;
    }

    get errorMessage() {
        return this.giftEntry.error?.body?.message || 'Unable to load this Gift Entry.';
    }

    handleClose() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }
}
