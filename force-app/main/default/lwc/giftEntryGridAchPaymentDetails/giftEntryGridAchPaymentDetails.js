import { api, LightningElement } from 'lwc';

export default class GiftEntryGridAchPaymentDetails extends LightningElement {
    last4 = '';

    @api
    set paymentDetails(value) {
        this.last4 = value?.last4 || '';
    }

    get paymentDetails() {
        return this.getPaymentDetails();
    }

    @api
    validate() {
        const input = this.template.querySelector('lightning-input');
        const digits = this.last4.replace(/\D/g, '');

        if (this.last4 && digits.length !== 4) {
            input?.setCustomValidity('Enter exactly 4 digits.');
        } else {
            input?.setCustomValidity('');
        }

        const isValid = input?.reportValidity() ?? true;

        return {
            isValid,
            invalidFields: isValid ? new Set() : new Set(['AchPaymentDetails'])
        };
    }

    @api
    getPaymentDetails() {
        return {
            last4: this.last4 || null
        };
    }

    handleInputChange(event) {
        this.last4 = event.detail.value;
    }
}
