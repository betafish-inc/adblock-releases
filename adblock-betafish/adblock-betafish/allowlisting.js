/* For ESLint: List any global identifiers used in this file below */
/* global createFilterMetaData */

import { initialize } from './alias/subscriptionInit';
import ServerMessages from './servermessages';
import * as ewe from '../vendor/webext-sdk/dist/ewe-api';

const authorizedKeys = [
  `MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAuePfbm865kumeftXjlbt
J68DTXLTn0VeOgdSTqOcpADVqH0Kxz5hfLMaoKC/QhO3SmAu1yZwJZ1WP9Uyu3I5
EvJwEt7OHjJv54GhyYCtylMDCqSZgIIkUtB9PSXqFe3qyKAXACzwnLHmYIMMC1rx
bViqMD06+S4NKtzEh602/JsOOTHkXDJFQi5gGpd7Yn/r1YFG20JzU5lr0pf3dOEK
gNXiEwSRCuVSZ2+MHMtkFdP83/k59rTOfz5+ZThYmxECytD0JyY+bpDbso/XxQeL
fThNEEnSpbbeJRZQM5Lwf4D/f1wzSvyRrQiQz6Bo6TrA9DpL/BHqgUBv4O+DwhAu
8tFaaI+YWUmA1M6DRCL1aPQlFf3RB+aAf/TXFRU6enm8y/DFKWnwZja1YlApxTYT
MGnZ5hrsXZZImjcKBKwXi3JCtLkfV+osAHYrMAJPPAfECkch/ovrEUcdBEu4WsJ+
gKlL2C1/ZL+fTZc+H9qt38qba8my5XlQmhXmzXFKKyp+1pqNkQuYzzT0M8PUqtlh
z5aNu4gc/sOrQayusssUkkwISWm9yKc9pwOE+2Ax45iq2xNhjx0+rl9nc/chV21T
ZLfyePid/4N3Q7obmQ9a6trOBIF5ONyg16CK61RjacnG76AMKrVOoq9lzF2UufL8
Myzw9X8Wsw3VrjJyYbWhUtkCAwEAAQ==`,
];

initialize.then(() => {
  ewe.allowlisting.setAuthorizedKeys(authorizedKeys);

  async function onAllowlisting(domain) {
    await ewe.filters.add([`@@||${domain}^$document`], createFilterMetaData('web'));
  }
  ewe.allowlisting.setAllowlistingCallback(onAllowlisting);

  ewe.allowlisting.onUnauthorized.addListener((error) => {
    ServerMessages.recordErrorMessage('one_click_allowlisting_error ', undefined, { errorMessage: error.toString() });
    // eslint-disable-next-line no-console
    console.error(error);
  });
});
