public without sharing class GiftEntryStockDetailsService {
    private static final String SUCCESS_STATUS = 'Success';
    private static final String STOCK_PAYMENT_METHOD = 'Stock';
    private static Boolean isSyncing = false;

    public static void syncStocks(List<GiftEntry> newEntries, Map<Id, GiftEntry> oldEntriesById) {
        if (isSyncing || newEntries == null || newEntries.isEmpty()) {
            return;
        }

        Map<Id, GiftEntry> entriesToSyncById = new Map<Id, GiftEntry>();
        Map<Id, List<Stock__c>> stocksByGiftEntryId = new Map<Id, List<Stock__c>>();

        for (GiftEntry giftEntry : newEntries) {
            if (!isStockSuccess(giftEntry) || !shouldSync(giftEntry, oldEntriesById)) {
                continue;
            }

            entriesToSyncById.put(giftEntry.Id, giftEntry);
            List<Stock__c> parsedStocks = parseStockDetails(giftEntry);
            if (parsedStocks == null) {
                continue;
            }
            stocksByGiftEntryId.put(giftEntry.Id, parsedStocks);
        }

        if (entriesToSyncById.isEmpty()) {
            return;
        }

        for (Id giftEntryId : entriesToSyncById.keySet()) {
            if (!stocksByGiftEntryId.containsKey(giftEntryId)) {
                return;
            }
        }

        isSyncing = true;
        try {
            List<Stock__c> existingStocks = [
                SELECT Id
                FROM Stock__c
                WHERE Gift_Entry__c IN :entriesToSyncById.keySet()
            ];
            if (!existingStocks.isEmpty()) {
                delete existingStocks;
            }

            List<Stock__c> stocksToInsert = new List<Stock__c>();
            for (List<Stock__c> stocks : stocksByGiftEntryId.values()) {
                stocksToInsert.addAll(stocks);
            }

            if (!stocksToInsert.isEmpty()) {
                insert stocksToInsert;
            }
        } finally {
            isSyncing = false;
        }
    }

    private static Boolean isStockSuccess(GiftEntry giftEntry) {
        return giftEntry.GiftProcessingStatus == SUCCESS_STATUS &&
            giftEntry.PaymentMethod == STOCK_PAYMENT_METHOD;
    }

    private static Boolean shouldSync(GiftEntry giftEntry, Map<Id, GiftEntry> oldEntriesById) {
        if (oldEntriesById == null || !oldEntriesById.containsKey(giftEntry.Id)) {
            return true;
        }

        GiftEntry oldGiftEntry = oldEntriesById.get(giftEntry.Id);
        return oldGiftEntry.GiftProcessingStatus != giftEntry.GiftProcessingStatus ||
            oldGiftEntry.PaymentMethod != giftEntry.PaymentMethod ||
            oldGiftEntry.Stock_Details__c != giftEntry.Stock_Details__c ||
            oldGiftEntry.GiftTransactionId != giftEntry.GiftTransactionId;
    }

    private static List<Stock__c> parseStockDetails(GiftEntry giftEntry) {
        if (String.isBlank(giftEntry.Stock_Details__c)) {
            return new List<Stock__c>();
        }

        Object parsedValue;
        try {
            parsedValue = JSON.deserializeUntyped(giftEntry.Stock_Details__c);
        } catch (JSONException error) {
            giftEntry.addError('Stock Details must contain valid JSON before Stock records can be created.');
            return null;
        }

        if (!(parsedValue instanceof List<Object>)) {
            giftEntry.addError('Stock Details must be a JSON array before Stock records can be created.');
            return null;
        }

        List<Stock__c> stocks = new List<Stock__c>();
        for (Object stockValue : (List<Object>) parsedValue) {
            if (!(stockValue instanceof Map<String, Object>)) {
                giftEntry.addError('Each Stock Details item must be a JSON object.');
                return null;
            }

            Map<String, Object> stockDetails = (Map<String, Object>) stockValue;
            if (!hasAnyStockValue(stockDetails)) {
                continue;
            }

            stocks.add(new Stock__c(
                Gift_Entry__c = giftEntry.Id,
                Gift_Transaction__c = giftEntry.GiftTransactionId,
                Number_of_Shares__c = decimalValue(stockDetails, 'numberOfShares', 'Number_of_Shares__c'),
                Stock_Ticker_Symbol__c = stringValue(stockDetails, 'stockTickerSymbol', 'Stock_Ticker_Symbol__c'),
                Stock_Price__c = decimalValue(stockDetails, 'stockPrice', 'Stock_Price__c'),
                Stock_Strike_Price__c = decimalValue(stockDetails, 'stockStrikePrice', 'Stock_Strike_Price__c')
            ));
        }

        return stocks;
    }

    private static Boolean hasAnyStockValue(Map<String, Object> stockDetails) {
        return valuePresent(stockDetails.get('numberOfShares')) ||
            valuePresent(stockDetails.get('Number_of_Shares__c')) ||
            valuePresent(stockDetails.get('stockTickerSymbol')) ||
            valuePresent(stockDetails.get('Stock_Ticker_Symbol__c')) ||
            valuePresent(stockDetails.get('stockPrice')) ||
            valuePresent(stockDetails.get('Stock_Price__c')) ||
            valuePresent(stockDetails.get('stockStrikePrice')) ||
            valuePresent(stockDetails.get('Stock_Strike_Price__c'));
    }

    private static Boolean valuePresent(Object value) {
        return value != null && String.isNotBlank(String.valueOf(value));
    }

    private static String stringValue(Map<String, Object> valuesByKey, String primaryKey, String fallbackKey) {
        Object value = valuesByKey.containsKey(primaryKey) ? valuesByKey.get(primaryKey) : valuesByKey.get(fallbackKey);
        return valuePresent(value) ? String.valueOf(value) : null;
    }

    private static Decimal decimalValue(Map<String, Object> valuesByKey, String primaryKey, String fallbackKey) {
        Object value = valuesByKey.containsKey(primaryKey) ? valuesByKey.get(primaryKey) : valuesByKey.get(fallbackKey);
        return valuePresent(value) ? Decimal.valueOf(String.valueOf(value)) : null;
    }
}
