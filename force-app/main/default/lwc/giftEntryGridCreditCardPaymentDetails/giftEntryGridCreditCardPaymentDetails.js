import { api, LightningElement } from 'lwc';

export default class GiftEntryGridCreditCardPaymentDetails extends LightningElement {
    cardNumber = '';
    last4 = '';
    expiryMonth = '';
    expiryYear = '';

    @api
    set paymentDetails(value) {
        this.last4 = value?.last4 || '';
        this.expiryMonth = value?.expiryMonth || '';
        this.expiryYear = value?.expiryYear || '';
    }

    get paymentDetails() {
        return this.getPaymentDetails();
    }

    @api
    validate() {
        this.validateCardNumber();
        this.validateExpiryMonth();
        this.validateExpiryYear();

        const inputsValid = [...this.template.querySelectorAll('lightning-input')].reduce(
            (isValid, input) => input.reportValidity() && isValid,
            true
        );

        return {
            isValid: inputsValid,
            invalidFields: inputsValid ? new Set() : new Set(['CreditCardPaymentDetails'])
        };
    }

    @api
    getPaymentDetails() {
        return {
            last4: this.cardNumber ? this.cardNumber.replace(/\D/g, '').slice(-4) : this.last4 || null,
            expiryMonth: this.expiryMonth || null,
            expiryYear: this.expiryYear || null
        };
    }

    handleInputChange(event) {
        this[event.currentTarget.dataset.field] = event.detail.value;

        if (event.currentTarget.dataset.field === 'cardNumber') {
            this.last4 = this.cardNumber.replace(/\D/g, '').slice(-4);
        }
    }

    validateCardNumber() {
        const input = this.template.querySelector('[data-field="cardNumber"]');
        const digits = this.cardNumber.replace(/\D/g, '');

        if (!digits) {
            input?.setCustomValidity('Credit Card Number is required.');
        } else if (![13, 14, 15, 16, 19].includes(digits.length)) {
            input?.setCustomValidity('Enter a valid credit card number.');
        } else {
            input?.setCustomValidity('');
        }
    }

    validateExpiryMonth() {
        const input = this.template.querySelector('[data-field="expiryMonth"]');
        const month = Number(this.expiryMonth);

        if (!this.expiryMonth) {
            input?.setCustomValidity('Expiry Month is required.');
        } else if (!Number.isInteger(month) || month < 1 || month > 12) {
            input?.setCustomValidity('Expiry Month must be between 1 and 12.');
        } else {
            input?.setCustomValidity('');
        }
    }

    validateExpiryYear() {
        const input = this.template.querySelector('[data-field="expiryYear"]');
        const year = Number(this.expiryYear);
        const currentYear = new Date().getFullYear();

        if (!this.expiryYear) {
            input?.setCustomValidity('Expiry Year is required.');
        } else if (!Number.isInteger(year) || year < currentYear || year > currentYear + 20) {
            input?.setCustomValidity(`Expiry Year must be between ${currentYear} and ${currentYear + 20}.`);
        } else {
            input?.setCustomValidity('');
        }
    }
}
