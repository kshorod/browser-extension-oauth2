function getBrowserApi() {
    if (window.browser) {
        return browser;
    } else if (window.chrome) {
        return {
            ...chrome,
            storage: {
                ...chrome.storage,
                local: {
                    ...chrome.storage.local,
                    // error handling is not implemented for those
                    get: keys => new Promise(callback => chrome.storage.local.get(keys, callback)),
                    set: model => new Promise(callback => chrome.storage.local.set(model, callback)),
                    remove: keys => new Promise(callback => chrome.storage.local.remove(keys, callback)),
                }
            },
            tabs: {
                ...chrome.tabs,
                create: (createProperties) => new Promise(callback => chrome.tabs.create(createProperties, callback))
            }
        };
    }
    throw new Error("unknown user agent");
}
const browserApi = getBrowserApi();

browserApi.runtime.onMessage.addListener(function (message, sender, callback) {
    switch (message.operation) {
        case 'login':
            return initLogIn(message.url);
        case 'refresh':
            return initSilentRefresh(message.url);
    }
});

function initLogIn(url) {
    const properties = {
        url,
        active: true,
    };
    browserApi.tabs.create(properties);
}

function initSilentRefresh(url) {
    const properties = {
        url,
        active: false,
    };
    browserApi.tabs.create(properties);
}

function extractHashParametersFromUrl(url) {
    const hash = url.split('#')[1];
    return hash.split('&').reduce((result, item) => {
        let parts = item.split('=');
        result[parts[0]] = parts[1];
        return result;
    }, {});
}

browserApi.webNavigation.onErrorOccurred.addListener(function (details) {
    const result = extractHashParametersFromUrl(details.url);
    if (result.error) {
        // we have an error
        const errorData = {
            error: result.error,
            description: result.error_description,
            state: result.state
        }
        // since we have no error handling, don't do anything
        return;
    }

    const data = {
        token: result['id_token'], // or access_token
        exp: new Date().toString(),
        state: result.state
    };

    browserApi.storage.local.set(data).then(function () {
        browserApi.runtime.sendMessage({ operation: 'loggedIn' });
        // use settimeout for debugging, or the tab will be closed almost instantly
        //setTimeout(function () {
        browserApi.tabs.remove(details.tabId);
        //}, 500);
    });
}, {
        url: [{
            hostEquals: 'random.not.existing.url.local.somewhere'
        }]
    });