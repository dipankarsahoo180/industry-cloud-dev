import { api, LightningElement } from 'lwc';
import { executeMutation, gql } from 'lightning/graphql';

const CREATE_STOCK_MUTATION = gql`
    mutation CreateGiftEntryStock($input: Stock__cCreateInput!) {
        uiapi {
            Stock__cCreate(input: $input) {
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

const UPDATE_STOCK_MUTATION = gql`
    mutation UpdateGiftEntryStock($input: Stock__cUpdateInput!) {
        uiapi {
            Stock__cUpdate(input: $input) {
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

export default class GiftEntryStockPostProcessing extends LightningElement {
    @api entryId;
    @api giftTransactionId;

    _stocks = [];
    savingStockId;

    @api
    set stocks(value) {
        const freshStocks = (value || []).map((stock) => ({ ...stock }));
        const dirtyStocks = this._stocks.filter((stock) => stock.isDirty);

        if (!dirtyStocks.length) {
            this._stocks = freshStocks;
            this.notifyDirtyCount();
            return;
        }

        const freshById = new Map(freshStocks.map((stock) => [stock.id, stock]));
        const mergedStocks = freshStocks.map((stock) => {
            const dirtyStock = dirtyStocks.find((item) => item.id === stock.id);
            return dirtyStock || stock;
        });

        dirtyStocks
            .filter((stock) => !freshById.has(stock.id))
            .forEach((stock) => mergedStocks.push(stock));

        this._stocks = mergedStocks;
        this.notifyDirtyCount();
    }

    get stocks() {
        return this._stocks;
    }

    get hasStocks() {
        return this._stocks.length > 0;
    }

    get isSaving() {
        return !!this.savingStockId;
    }

    get dirtyCount() {
        return this._stocks.filter((stock) => stock.isDirty).length;
    }

    get hasDirtyStocks() {
        return this.dirtyCount > 0;
    }

    @api
    async saveAll() {
        const dirtyStocks = this._stocks.filter((stock) => stock.isDirty);

        if (!dirtyStocks.length) {
            return { savedCount: 0, failures: [] };
        }

        const allValid = dirtyStocks.reduce(
            (isValid, stock) => this.validateStockInputs(stock.id) && isValid,
            true
        );

        if (!allValid) {
            return { savedCount: 0, failures: ['Fix highlighted stock fields before saving.'] };
        }

        this.savingStockId = 'all';
        const failures = [];
        let savedCount = 0;

        for (const stock of dirtyStocks) {
            try {
                const result = await this.saveStock(stock);
                this.markStockSaved(stock.id, stock, getSavedRecord(result, stock.isNew));
                savedCount += 1;
            } catch (error) {
                failures.push(normalizeError(error));
            }
        }

        this.savingStockId = null;
        this.notifyDirtyCount();

        return { savedCount, failures };
    }

    handleAddStock() {
        this._stocks = [
            ...this._stocks,
            {
                id: `new-stock-${Date.now()}`,
                displayName: 'New Stock',
                numberOfShares: null,
                stockTickerSymbol: '',
                stockPrice: null,
                stockStrikePrice: null,
                isNew: true,
                isDirty: true
            }
        ];
        this.notifyDirtyCount();
    }

    handleStockChange(event) {
        const { stockId, field } = event.currentTarget.dataset;

        this._stocks = this._stocks.map((stock) => {
            if (stock.id !== stockId) {
                return stock;
            }

            return {
                ...stock,
                [field]: event.detail.value,
                isDirty: true
            };
        });
        this.notifyDirtyCount();
    }

    async handleSaveStock(event) {
        const stockId = event.currentTarget.dataset.stockId;
        const stock = this._stocks.find((item) => item.id === stockId);

        if (!stock || !this.validateStockInputs(stockId)) {
            return;
        }

        this.savingStockId = stockId;

        try {
            const result = await this.saveStock(stock);
            this.markStockSaved(stockId, stock, getSavedRecord(result, stock.isNew));
            this.dispatchEvent(
                new CustomEvent('stocksaved', {
                    detail: { savedCount: 1 },
                    bubbles: true,
                    composed: true
                })
            );
        } catch (error) {
            this.dispatchEvent(
                new CustomEvent('stockerror', {
                    detail: { message: normalizeError(error) },
                    bubbles: true,
                    composed: true
                })
            );
        } finally {
            this.savingStockId = null;
            this.notifyDirtyCount();
        }
    }

    async saveStock(stock) {
        const result = await executeMutation({
            query: stock.isNew ? CREATE_STOCK_MUTATION : UPDATE_STOCK_MUTATION,
            variables: { input: this.buildStockInput(stock) },
            operationName: stock.isNew ? 'CreateGiftEntryStock' : 'UpdateGiftEntryStock'
        });

        if (result.errors?.length) {
            throw new Error(result.errors.map((error) => error.message).join(', '));
        }

        return result;
    }

    buildStockInput(stock) {
        const fields = {
            Gift_Entry__c: this.entryId,
            Gift_Transaction__c: this.giftTransactionId || null,
            Number_of_Shares__c: normalizeNumber(stock.numberOfShares),
            Stock_Ticker_Symbol__c: stock.stockTickerSymbol || null,
            Stock_Price__c: normalizeNumber(stock.stockPrice),
            Stock_Strike_Price__c: normalizeNumber(stock.stockStrikePrice)
        };

        if (stock.isNew) {
            return {
                Stock__c: fields
            };
        }

        return {
            Id: stock.id,
            Stock__c: fields
        };
    }

    markStockSaved(stockId, submittedStock, savedRecord) {
        const savedStock = {
            ...submittedStock,
            id: savedRecord?.Id || submittedStock.id,
            displayName: savedRecord?.Name?.value || submittedStock.displayName,
            isNew: false,
            isDirty: false
        };

        this._stocks = this._stocks.map((stock) => (stock.id === stockId ? savedStock : stock));
    }

    validateStockInputs(stockId) {
        return [...this.template.querySelectorAll(`[data-stock-id="${stockId}"]`)].reduce(
            (isValid, input) => {
                if (typeof input.reportValidity !== 'function') {
                    return isValid;
                }

                return input.reportValidity() && isValid;
            },
            true
        );
    }

    notifyDirtyCount() {
        this.dispatchEvent(
            new CustomEvent('stockdirtycountchange', {
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

function getSavedRecord(result, isCreate) {
    return isCreate
        ? result?.data?.uiapi?.Stock__cCreate?.Record
        : result?.data?.uiapi?.Stock__cUpdate?.Record;
}
