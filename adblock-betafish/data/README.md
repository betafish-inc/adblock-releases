# betafish-subscriptions.json

## Intro

The contents on the betafish-subscriptions.json file are similiar to the file produced from the rules repository:
    https://gitlab.com/adblockinc/ext/rules


With the addition of the following:
 'url': is the unique key for each entry, and the MV3 URL (instead of an array of objects)
   'mv2_url': is the corresponding MV2 URL for the filter list
   'adblockId': A unique string identifier in human readable form
   'id': a unique string GUID, that should match the 'id' from rulesIndex file in the rulesIndex from the @adblockinc/rules repository
   'index': A integer, and unique value.  Must remain the same throughout the lifetime of the project

Note:  When adding or updating a filter list to this file, the Sync Service module also needs to be updated.
Please review the comments about adding a new filter list in this file (adblock-betafish/picreplacement/sync-service.js).
