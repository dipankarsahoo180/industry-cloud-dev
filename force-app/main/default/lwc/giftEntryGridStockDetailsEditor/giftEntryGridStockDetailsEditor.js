import { api, LightningElement } from 'lwc';

export default class GiftEntryGridStockDetailsEditor extends LightningElement {
    _stocks = [];

    @api
    set stocks(value) {
        this._stocks = normalizeStocks(value);
    }

    get stocks() {
        return this._stocks;
    }

    get hasStocks() {
        return this._stocks.length > 0;
    }

    @api
    validate() {
        this.validateStockRows();

        const inputsValid = [...this.template.querySelectorAll('lightning-input')].reduce(
            (isValid, input) => input.reportValidity() && isValid,
            true
        );

        return {
            isValid: inputsValid,
            invalidFields: inputsValid ? new Set() : new Set(['Stock_Details__c'])
        };
    }

    @api
    getStockDetails() {
        return this._stocks
            .filter((stock) => hasAnyStockValue(stock))
            .map(({ id, ...stock }) => stock);
    }

    handleAddStock() {
        this._stocks = [...this._stocks, createEmptyStock()];
    }

    handleRemoveStock(event) {
        const stockId = event.currentTarget.dataset.stockId;
        this._stocks = this._stocks.filter((stock) => stock.id !== stockId);
    }

    handleStockChange(event) {
        const { stockId, field } = event.currentTarget.dataset;
        const value = event.detail.value;

        this._stocks = this._stocks.map((stock) => {
            if (stock.id !== stockId) {
                return stock;
            }

            return {
                ...stock,
                [field]: value
            };
        });
    }

    validateStockRows() {
        this._stocks.forEach((stock) => {
            const rowHasValues = hasAnyStockValue(stock);
            const sharesInput = this.template.querySelector(
                `[data-stock-id="${stock.id}"][data-field="numberOfShares"]`
            );
            const tickerInput = this.template.querySelector(
                `[data-stock-id="${stock.id}"][data-field="stockTickerSymbol"]`
            );
            const priceInput = this.template.querySelector(
                `[data-stock-id="${stock.id}"][data-field="stockPrice"]`
            );
            const strikeInput = this.template.querySelector(
                `[data-stock-id="${stock.id}"][data-field="stockStrikePrice"]`
            );
            const shares = Number(stock.numberOfShares);
            const price = Number(stock.stockPrice);
            const strike = Number(stock.stockStrikePrice);

            sharesInput?.setCustomValidity(
                rowHasValues && (!Number.isFinite(shares) || shares <= 0)
                    ? 'Number of Shares must be greater than 0.'
                    : ''
            );
            tickerInput?.setCustomValidity(
                rowHasValues && !stock.stockTickerSymbol
                    ? 'Stock Ticker Symbol is required.'
                    : ''
            );
            priceInput?.setCustomValidity(
                stock.stockPrice !== null &&
                    stock.stockPrice !== '' &&
                    (!Number.isFinite(price) || price < 0)
                    ? 'Stock Price cannot be negative.'
                    : ''
            );
            strikeInput?.setCustomValidity(
                stock.stockStrikePrice !== null &&
                    stock.stockStrikePrice !== '' &&
                    (!Number.isFinite(strike) || strike < 0)
                    ? 'Stock Strike Price cannot be negative.'
                    : ''
            );
        });
    }
}

function normalizeStocks(value) {
    const stocks = Array.isArray(value) ? value : [];

    if (!stocks.length) {
        return [createEmptyStock()];
    }

    return stocks.map((stock) => ({
        id: stock.id || `stock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        displayName: stock.displayName || 'Stock',
        numberOfShares: stock.numberOfShares ?? null,
        stockTickerSymbol: stock.stockTickerSymbol || '',
        stockPrice: stock.stockPrice ?? null,
        stockStrikePrice: stock.stockStrikePrice ?? null
    }));
}

function createEmptyStock() {
    return {
        id: `stock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        displayName: 'New Stock',
        numberOfShares: null,
        stockTickerSymbol: '',
        stockPrice: null,
        stockStrikePrice: null
    };
}

function hasAnyStockValue(stock) {
    return (
        stock.numberOfShares !== null ||
        stock.stockTickerSymbol ||
        stock.stockPrice !== null ||
        stock.stockStrikePrice !== null
    );
}
