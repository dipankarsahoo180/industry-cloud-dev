@IsTest
private class GiftEntryStockDetailsServiceTest {
    @IsTest
    static void createsStocksWhenGiftEntryProcessingSucceeds() {
        GiftEntry giftEntry = createGiftEntry('New', 'Stock', null);

        Test.startTest();
        giftEntry.GiftProcessingStatus = 'Success';
        giftEntry.Stock_Details__c = '[{"numberOfShares":10,"stockTickerSymbol":"AAPL","stockPrice":190.25,"stockStrikePrice":185.50},{"numberOfShares":5.5,"stockTickerSymbol":"MSFT","stockPrice":420,"stockStrikePrice":410}]';
        update giftEntry;
        Test.stopTest();

        List<Stock__c> stocks = [
            SELECT Gift_Entry__c, Gift_Transaction__c, Number_of_Shares__c, Stock_Ticker_Symbol__c, Stock_Price__c, Stock_Strike_Price__c
            FROM Stock__c
            WHERE Gift_Entry__c = :giftEntry.Id
            ORDER BY Stock_Ticker_Symbol__c
        ];

        System.assertEquals(2, stocks.size(), 'Two Stock rows should be created from the JSON array.');
        System.assertEquals('AAPL', stocks[0].Stock_Ticker_Symbol__c);
        System.assertEquals(10, stocks[0].Number_of_Shares__c);
        System.assertEquals(190.25, stocks[0].Stock_Price__c);
        System.assertEquals(185.50, stocks[0].Stock_Strike_Price__c);
        System.assertEquals('MSFT', stocks[1].Stock_Ticker_Symbol__c);
    }

    @IsTest
    static void replacesExistingStocksWithLatestStockDetails() {
        GiftEntry giftEntry = createGiftEntry(
            'New',
            'Stock',
            '[{"numberOfShares":10,"stockTickerSymbol":"AAPL"},{"numberOfShares":5,"stockTickerSymbol":"MSFT"}]'
        );
        insert new Stock__c(
            Gift_Entry__c = giftEntry.Id,
            Number_of_Shares__c = 99,
            Stock_Ticker_Symbol__c = 'OLD'
        );

        System.assertEquals(1, [
            SELECT COUNT()
            FROM Stock__c
            WHERE Gift_Entry__c = :giftEntry.Id
        ]);

        Test.startTest();
        giftEntry.GiftProcessingStatus = 'Success';
        giftEntry.Stock_Details__c = '[{"numberOfShares":2,"stockTickerSymbol":"TSLA","stockPrice":250}]';
        update giftEntry;
        Test.stopTest();

        List<Stock__c> stocks = [
            SELECT Number_of_Shares__c, Stock_Ticker_Symbol__c, Stock_Price__c
            FROM Stock__c
            WHERE Gift_Entry__c = :giftEntry.Id
        ];

        System.assertEquals(1, stocks.size(), 'Existing Stock rows should mirror the latest JSON instead of duplicating.');
        System.assertEquals('TSLA', stocks[0].Stock_Ticker_Symbol__c);
        System.assertEquals(2, stocks[0].Number_of_Shares__c);
        System.assertEquals(250, stocks[0].Stock_Price__c);
    }

    @IsTest
    static void ignoresNonStockOrUnsuccessfulGiftEntries() {
        GiftEntry creditCardGiftEntry = createGiftEntry(
            'Success',
            'Credit Card',
            '[{"numberOfShares":10,"stockTickerSymbol":"AAPL"}]'
        );
        GiftEntry pendingStockGiftEntry = createGiftEntry(
            'New',
            'Stock',
            '[{"numberOfShares":10,"stockTickerSymbol":"AAPL"}]'
        );

        Test.startTest();
        pendingStockGiftEntry.GiftAmount = 13;
        update pendingStockGiftEntry;
        Test.stopTest();

        System.assertEquals(0, [
            SELECT COUNT()
            FROM Stock__c
            WHERE Gift_Entry__c IN :new Set<Id>{ creditCardGiftEntry.Id, pendingStockGiftEntry.Id }
        ]);
    }

    @IsTest
    static void rejectsInvalidStockDetailsJson() {
        GiftEntry giftEntry = createGiftEntry('New', 'Stock', null);
        giftEntry.GiftProcessingStatus = 'Success';
        giftEntry.Stock_Details__c = '{"numberOfShares":10,"stockTickerSymbol":"AAPL"}';

        Test.startTest();
        try {
            update giftEntry;
            System.assert(false, 'The update should fail when Stock Details is not a JSON array.');
        } catch (DmlException error) {
            System.assert(
                error.getMessage().contains('Stock Details must be a JSON array'),
                'The validation message should explain the Stock Details JSON shape.'
            );
        }
        Test.stopTest();
    }

    private static GiftEntry createGiftEntry(String status, String paymentMethod, String stockDetails) {
        GiftEntry giftEntry = new GiftEntry(
            GiftProcessingStatus = status,
            PaymentMethod = paymentMethod,
            GiftAmount = 100,
            GiftReceivedDate = Date.today(),
            Stock_Details__c = stockDetails
        );
        insert giftEntry;
        return giftEntry;
    }
}
