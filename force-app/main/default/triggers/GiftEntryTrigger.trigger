trigger GiftEntryTrigger on GiftEntry (after insert, after update) {
    GiftEntryStockDetailsService.syncStocks(Trigger.new, Trigger.oldMap);
    GiftEntryAssetDetailsService.syncAssets(Trigger.new, Trigger.oldMap);
}
