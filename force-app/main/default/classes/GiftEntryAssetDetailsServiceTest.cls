@IsTest
private class GiftEntryAssetDetailsServiceTest {
    @IsTest
    static void createsAssetsWhenGiftEntryProcessingSucceeds() {
        GiftEntry giftEntry = createGiftEntry('New', 'Asset', null);

        Test.startTest();
        giftEntry.GiftProcessingStatus = 'Success';
        giftEntry.Asset_Details__c =
            '[{"appraisedById":"' + UserInfo.getUserId() + '","appraisedValue":1200.50,"appraisalDate":"' +
            String.valueOf(Date.today()) +
            '","assetType":"Art"},{"appraisedValue":5000,"assetType":"Property"}]';
        update giftEntry;
        Test.stopTest();

        Map<String, Asset__c> assetsByType = new Map<String, Asset__c>();
        for (Asset__c asset : [
            SELECT Gift_Entry__c, Gift_Transaction__c, Appraised_By__c, Appraised_Value__c, Appraisal_Date__c, Asset_Type__c
            FROM Asset__c
            WHERE Gift_Entry__c = :giftEntry.Id
        ]) {
            assetsByType.put(asset.Asset_Type__c, asset);
        }

        System.assertEquals(2, assetsByType.size(), 'Two Asset rows should be created from the JSON array.');
        System.assertEquals(UserInfo.getUserId(), assetsByType.get('Art').Appraised_By__c);
        System.assertEquals(1200.50, assetsByType.get('Art').Appraised_Value__c);
        System.assertEquals(Date.today(), assetsByType.get('Art').Appraisal_Date__c);
        System.assertEquals(5000, assetsByType.get('Property').Appraised_Value__c);
    }

    @IsTest
    static void replacesExistingAssetsWithLatestAssetDetails() {
        GiftEntry giftEntry = createGiftEntry(
            'New',
            'Asset',
            '[{"appraisedValue":1200,"assetType":"Art"},{"appraisedValue":5000,"assetType":"Property"}]'
        );
        insert new Asset__c(
            Gift_Entry__c = giftEntry.Id,
            Appraised_Value__c = 99,
            Asset_Type__c = 'Other'
        );

        System.assertEquals(1, [
            SELECT COUNT()
            FROM Asset__c
            WHERE Gift_Entry__c = :giftEntry.Id
        ]);

        Test.startTest();
        giftEntry.GiftProcessingStatus = 'Success';
        giftEntry.Asset_Details__c = '[{"appraisedValue":250,"assetType":"Collectible"}]';
        update giftEntry;
        Test.stopTest();

        List<Asset__c> assets = [
            SELECT Appraised_Value__c, Asset_Type__c
            FROM Asset__c
            WHERE Gift_Entry__c = :giftEntry.Id
        ];

        System.assertEquals(1, assets.size(), 'Existing Asset rows should mirror the latest JSON instead of duplicating.');
        System.assertEquals('Collectible', assets[0].Asset_Type__c);
        System.assertEquals(250, assets[0].Appraised_Value__c);
    }

    @IsTest
    static void ignoresNonAssetOrUnsuccessfulGiftEntries() {
        GiftEntry stockGiftEntry = createGiftEntry(
            'Success',
            'Stock',
            '[{"appraisedValue":1200,"assetType":"Art"}]'
        );
        GiftEntry pendingAssetGiftEntry = createGiftEntry(
            'New',
            'Asset',
            '[{"appraisedValue":1200,"assetType":"Art"}]'
        );

        Test.startTest();
        pendingAssetGiftEntry.GiftAmount = 13;
        update pendingAssetGiftEntry;
        Test.stopTest();

        System.assertEquals(0, [
            SELECT COUNT()
            FROM Asset__c
            WHERE Gift_Entry__c IN :new Set<Id>{ stockGiftEntry.Id, pendingAssetGiftEntry.Id }
        ]);
    }

    @IsTest
    static void rejectsInvalidAssetDetailsJson() {
        GiftEntry giftEntry = createGiftEntry('New', 'Asset', null);
        giftEntry.GiftProcessingStatus = 'Success';
        giftEntry.Asset_Details__c = '{"appraisedValue":1200,"assetType":"Art"}';

        Test.startTest();
        try {
            update giftEntry;
            System.assert(false, 'The update should fail when Asset Details is not a JSON array.');
        } catch (DmlException error) {
            System.assert(
                error.getMessage().contains('Asset Details must be a JSON array'),
                'The validation message should explain the Asset Details JSON shape.'
            );
        }
        Test.stopTest();
    }

    private static GiftEntry createGiftEntry(String status, String paymentMethod, String assetDetails) {
        GiftEntry giftEntry = new GiftEntry(
            GiftProcessingStatus = status,
            PaymentMethod = paymentMethod,
            GiftAmount = 100,
            GiftReceivedDate = Date.today(),
            Asset_Details__c = assetDetails
        );
        insert giftEntry;
        return giftEntry;
    }
}
