# betafish-subscriptions.json

## Intro

The contents on the betafish-subscriptions.json file are based on the entries in the ABP Core file:
  adblockplusui/adblockpluschrome/adblockpluscore/data

With the addition of the following attributes
 'id': A unique string identifier
 'language': A Boolean, indicates if this is a filter list for a specific language
 'hidden': A Boolean, indicates if this is a filter list should be shown on the options page

AdBlock specific filter lists (such as AdBlock Custom) have also been added to this file.

Note:  When adding or updating a filter list to this file, the Sync Service module also needs to be updated.
Please review the comments about adding a new filter list in this file (adblock-betafish/picreplacement/sync-service.js).


