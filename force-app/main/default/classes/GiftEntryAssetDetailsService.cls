public without sharing class GiftEntryAssetDetailsService {
    private static final String SUCCESS_STATUS = 'Success';
    private static final String ASSET_PAYMENT_METHOD = 'Asset';
    private static Boolean isSyncing = false;

    public static void syncAssets(List<GiftEntry> newEntries, Map<Id, GiftEntry> oldEntriesById) {
        if (isSyncing || newEntries == null || newEntries.isEmpty()) {
            return;
        }

        Map<Id, GiftEntry> entriesToSyncById = new Map<Id, GiftEntry>();
        Map<Id, List<Asset__c>> assetsByGiftEntryId = new Map<Id, List<Asset__c>>();

        for (GiftEntry giftEntry : newEntries) {
            if (!isAssetSuccess(giftEntry) || !shouldSync(giftEntry, oldEntriesById)) {
                continue;
            }

            entriesToSyncById.put(giftEntry.Id, giftEntry);
            List<Asset__c> parsedAssets = parseAssetDetails(giftEntry);
            if (parsedAssets == null) {
                continue;
            }
            assetsByGiftEntryId.put(giftEntry.Id, parsedAssets);
        }

        if (entriesToSyncById.isEmpty()) {
            return;
        }

        for (Id giftEntryId : entriesToSyncById.keySet()) {
            if (!assetsByGiftEntryId.containsKey(giftEntryId)) {
                return;
            }
        }

        isSyncing = true;
        try {
            List<Asset__c> existingAssets = [
                SELECT Id
                FROM Asset__c
                WHERE Gift_Entry__c IN :entriesToSyncById.keySet()
            ];
            if (!existingAssets.isEmpty()) {
                delete existingAssets;
            }

            List<Asset__c> assetsToInsert = new List<Asset__c>();
            for (List<Asset__c> assets : assetsByGiftEntryId.values()) {
                assetsToInsert.addAll(assets);
            }

            if (!assetsToInsert.isEmpty()) {
                insert assetsToInsert;
            }
        } finally {
            isSyncing = false;
        }
    }

    private static Boolean isAssetSuccess(GiftEntry giftEntry) {
        return giftEntry.GiftProcessingStatus == SUCCESS_STATUS &&
            giftEntry.PaymentMethod == ASSET_PAYMENT_METHOD;
    }

    private static Boolean shouldSync(GiftEntry giftEntry, Map<Id, GiftEntry> oldEntriesById) {
        if (oldEntriesById == null || !oldEntriesById.containsKey(giftEntry.Id)) {
            return true;
        }

        GiftEntry oldGiftEntry = oldEntriesById.get(giftEntry.Id);
        return oldGiftEntry.GiftProcessingStatus != giftEntry.GiftProcessingStatus ||
            oldGiftEntry.PaymentMethod != giftEntry.PaymentMethod ||
            oldGiftEntry.Asset_Details__c != giftEntry.Asset_Details__c ||
            oldGiftEntry.GiftTransactionId != giftEntry.GiftTransactionId;
    }

    private static List<Asset__c> parseAssetDetails(GiftEntry giftEntry) {
        if (String.isBlank(giftEntry.Asset_Details__c)) {
            return new List<Asset__c>();
        }

        Object parsedValue;
        try {
            parsedValue = JSON.deserializeUntyped(giftEntry.Asset_Details__c);
        } catch (JSONException error) {
            giftEntry.addError('Asset Details must contain valid JSON before Asset records can be created.');
            return null;
        }

        if (!(parsedValue instanceof List<Object>)) {
            giftEntry.addError('Asset Details must be a JSON array before Asset records can be created.');
            return null;
        }

        List<Asset__c> assets = new List<Asset__c>();
        for (Object assetValue : (List<Object>) parsedValue) {
            if (!(assetValue instanceof Map<String, Object>)) {
                giftEntry.addError('Each Asset Details item must be a JSON object.');
                return null;
            }

            Map<String, Object> assetDetails = (Map<String, Object>) assetValue;
            if (!hasAnyAssetValue(assetDetails)) {
                continue;
            }

            assets.add(new Asset__c(
                Gift_Entry__c = giftEntry.Id,
                Gift_Transaction__c = giftEntry.GiftTransactionId,
                Appraised_By__c = idValue(assetDetails, 'appraisedById', 'Appraised_By__c'),
                Appraised_Value__c = decimalValue(assetDetails, 'appraisedValue', 'Appraised_Value__c'),
                Appraisal_Date__c = dateValue(assetDetails, 'appraisalDate', 'Appraisal_Date__c'),
                Asset_Type__c = stringValue(assetDetails, 'assetType', 'Asset_Type__c')
            ));
        }

        return assets;
    }

    private static Boolean hasAnyAssetValue(Map<String, Object> assetDetails) {
        return valuePresent(assetDetails.get('appraisedById')) ||
            valuePresent(assetDetails.get('Appraised_By__c')) ||
            valuePresent(assetDetails.get('appraisedValue')) ||
            valuePresent(assetDetails.get('Appraised_Value__c')) ||
            valuePresent(assetDetails.get('appraisalDate')) ||
            valuePresent(assetDetails.get('Appraisal_Date__c')) ||
            valuePresent(assetDetails.get('assetType')) ||
            valuePresent(assetDetails.get('Asset_Type__c'));
    }

    private static Boolean valuePresent(Object value) {
        return value != null && String.isNotBlank(String.valueOf(value));
    }

    private static Id idValue(Map<String, Object> valuesByKey, String primaryKey, String fallbackKey) {
        String value = stringValue(valuesByKey, primaryKey, fallbackKey);
        return String.isBlank(value) ? null : (Id) value;
    }

    private static String stringValue(Map<String, Object> valuesByKey, String primaryKey, String fallbackKey) {
        Object value = valuesByKey.containsKey(primaryKey) ? valuesByKey.get(primaryKey) : valuesByKey.get(fallbackKey);
        return valuePresent(value) ? String.valueOf(value) : null;
    }

    private static Decimal decimalValue(Map<String, Object> valuesByKey, String primaryKey, String fallbackKey) {
        Object value = valuesByKey.containsKey(primaryKey) ? valuesByKey.get(primaryKey) : valuesByKey.get(fallbackKey);
        return valuePresent(value) ? Decimal.valueOf(String.valueOf(value)) : null;
    }

    private static Date dateValue(Map<String, Object> valuesByKey, String primaryKey, String fallbackKey) {
        String value = stringValue(valuesByKey, primaryKey, fallbackKey);
        return String.isBlank(value) ? null : Date.valueOf(value);
    }
}
