# browser-extension-oauth2

A chrome/firefox extension that shows how to perform openid/oauth2 login and silent refresh using tabs (instead of identity API).

Silent refresh has to be triggered manually by clicking on a link, however it should not be a problem to put it on a settimeout or check for token expiration

## F.A.Q.

### How does this work?

When you click on Log in, I send a message to background script (background.js) to open a new tab with the generated login URL. When login is complete, browser navigates to a fake URL that is being listened on. Error event fires in background.js and the token is stored in the extension storage.

If extension window is shown (during silent refresh or potentially in firefox) it will receive an event with information that it should load the token. Otherwise, it will load the token when it is opened next time.

Silent refresh does the same thing except it opens the tab in the background and does not close the extension window.

### Will this work on other browsers?

Firefox and Chrome have some differences between their webextension API and I have no information about other browsers at the time. Short answer: yes, but you may need to add some code.

### Which OpenID provider was used? How do I get this to work?

Microsoft Azure Active Directory is the provider, but you could change the authconfig and connect to any other openid compliant provider.

For MS AAD, see here: https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-implicit-grant-flow 

You will need to enter your own client id.

### Why not identity API?

See here: https://bugs.chromium.org/p/chromium/issues/detail?id=907920&q=identity%20api

Basically, I do not want to lose login information everytime someone closes their browser.

Downsides:
* you can see the tab open and close in the background, may be distracting
* tabs and webNavigation permissions are required - users may question why (since it grants access to all websites)

### Why is the redirect URL so strange?

I redirect the token response to a webpage that does not exist and catch it with background.js using onError event. It can be any page, preferably one that you are hosting (to avoid long wait time on firefox) but remember to change the event to onnavigationcomplete or something else.

### What is missing?

* Basic security (state checking), 
* retrieving access token from the provider to access an actual API,
* ID token parsing (to get user email and name), 
* automatic refresh when token is about to expire (would apply to the access token, not ID token), 
* proper expiration time (shows current date instead)

## Resources
* https://developer.chrome.com/extensions/getstarted
* https://developer.chrome.com/extensions/runtime#method-sendMessage
* https://developer.chrome.com/extensions/tabs#method-create
* https://developer.chrome.com/extensions/webNavigation#event-onErrorOccurred
* https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/events/UrlFilter
* https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-implicit-grant-flow 