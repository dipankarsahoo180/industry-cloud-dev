import { api, LightningElement } from 'lwc';

export default class GiftEntryGridCheckPaymentDetails extends LightningElement {
    checkDate = '';
    paymentIdentifier = '';

    @api
    set paymentDetails(value) {
        this.checkDate = value?.checkDate || '';
        this.paymentIdentifier = value?.paymentIdentifier || '';
    }

    get paymentDetails() {
        return this.getPaymentDetails();
    }

    @api
    validate() {
        this.validateCheckDate();

        const inputsValid = [...this.template.querySelectorAll('lightning-input')].reduce(
            (isValid, input) => input.reportValidity() && isValid,
            true
        );

        return {
            isValid: inputsValid,
            invalidFields: inputsValid ? new Set() : new Set(['CheckPaymentDetails'])
        };
    }

    @api
    getPaymentDetails() {
        return {
            checkDate: this.checkDate || null,
            paymentIdentifier: this.paymentIdentifier || null
        };
    }

    handleInputChange(event) {
        this[event.currentTarget.dataset.field] = event.detail.value;
    }

    validateCheckDate() {
        const input = this.template.querySelector('[data-field="checkDate"]');

        if (!this.checkDate) {
            input?.setCustomValidity('');
            return;
        }

        const selectedDate = new Date(`${this.checkDate}T00:00:00`);
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);

        input?.setCustomValidity(selectedDate >= tomorrow ? 'Check Date cannot be in the future.' : '');
    }
}
