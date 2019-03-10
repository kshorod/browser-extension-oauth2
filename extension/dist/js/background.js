function browserApi() {
    if (typeof browser !== 'undefined' && browser) {
        return browser;
    } else if (typeof chrome !== 'undefined' && chrome) {
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



chrome.runtime.onMessage.addListener(function (message, sender, callback) {
    switch (message.operation) {
        case 'login':
            initLogIn(message.url);
            break;
        case 'refresh':
            initSilentRefresh(message.url);
            break;
    }
});


function initLogIn(url) {
    let properties = {
        url: url,
        active: true,
    };
    chrome.tabs.create(properties);
}

function initSilentRefresh(url) {
    let properties = {
        url: url,
        active: false,
    };
    chrome.tabs.create(properties);
}

chrome.webNavigation.onErrorOccurred.addListener(function (details) {
    var hash = details.url.split('#')[1];

    var result = hash.split('&').reduce(function (result, item) {
        var parts = item.split('=');
        result[parts[0]] = parts[1];
        return result;
    }, {});

    // warning: there is no error handling here

    if ("error" in result) {
        // we have an error
        let errorData = {
            error: result.error,
            description: result.error_description,
            state: result.state
        }
        // since we have no handling, don't do anything
        return;
    }

    let data = {
        token: result['id_token'], // or access_token
        exp: new Date().toString(),
        state: result.state
    };
    chrome.storage.local.set(data, function () {
        chrome.runtime.sendMessage({ operation: 'loggedIn' });
        // use settimeout for debugging, or the tab will be closed almost instantly
        //setTimeout(function () {
        chrome.tabs.remove(details.tabId);
        //}, 500);
    });

}, {
        url: [{
            hostEquals: 'random.not.existing.url.local.somewhere'
        }]
    });