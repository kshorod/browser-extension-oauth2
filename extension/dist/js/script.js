
class AuthState {
    loggedIn;
    token;
    expiration;
}

function isEmpty(str) {
    return (!str || 0 === str.length);
}

class UI {
    setup(logInCallback, refreshCallback, logoutCallback) {
        document.querySelector('.action__log_in').addEventListener('click', logInCallback);
        document.querySelector('.action__silent_refresh').addEventListener('click', refreshCallback);
        document.querySelector('.action__log_out').addEventListener('click', logoutCallback);
    }

    setUI(authState) {
        document.querySelector('.status__logged_in').classList.remove('hidden');
        document.querySelector('.status__logged_out').classList.remove('hidden');

        document.querySelector('.field__hash').textContent = window.location.hash;
        if (authState.loggedIn) {
            document.querySelector('.status__logged_out').classList.add('hidden');
            document.querySelector('.status__token').value = authState.token;
            document.querySelector('.status__expiration').value = authState.expiration.toString();
        } else {
            document.querySelector('.status__logged_in').classList.add('hidden');
        }

    }

    showMessage(message) {
        document.querySelector('.field__message').textContent = message;
    }
}

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

class TokenStorage {

    storageKeys = {
        token: 'token',
        expiration: 'exp',
        all: ['token', 'exp']
    };

    async tokenExists() {
        let data = await browserApi().storage.local.get(this.storageKeys.all);
        return !isEmpty(data[this.storageKeys.token]) && !isEmpty(data[this.storageKeys.expiration]);
    }
    tokenIsValid() {
    }
    async getTokenWithExpiration() {
        let data = await browserApi().storage.local.get(this.storageKeys.all);
        return data;
    }
    async saveToken(token, expiration) {
        let data = {};
        data[this.storageKeys.token] = token;
        data[this.storageKeys.expiration] = expiration;
        await browserApi().storage.local.set(data);
    }
    async clearToken() {
        await browserApi().storage.local.remove(this.storageKeys.all);
    }
}

class Auth {

    config = {
        url: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?
        client_id={client_id}
        &response_type=id_token
        &redirect_uri={redirect_uri}
        &scope={scope}
        &response_mode=fragment
        &prompt={prompt}
        &state=12345
        &nonce=678910`.replace(/\s/g, ''),
        tenant: 'consumers',
        clientId: '##############################ENTER_CLIENT_ID_HERE############################',
        openIdScopes: 'openid email profile',
        redirectUri: 'https://random.not.existing.url.local.somewhere',
        regularPrompt: "select_account",
        silentPrompt: "none",
        getLoginUrl: function () {
            return this.url
                .replace('{client_id}', this.clientId)
                .replace('{tenant}', this.tenant)
                .replace('{prompt}', this.regularPrompt)
                .replace('{scope}', encodeURIComponent(this.openIdScopes))
                .replace('{redirect_uri}', encodeURIComponent(this.redirectUri));
        },
        getRefreshUrl: function () {
            return this.url
                .replace('{client_id}', this.clientId)
                .replace('{tenant}', this.tenant)
                .replace('{prompt}', this.silentPrompt)
                .replace('{scope}', encodeURIComponent(this.openIdScopes))
                .replace('{redirect_uri}', encodeURIComponent(this.redirectUri));
        }
    };

    constructor() {
        this.tokenStore = new TokenStorage();
    }

    async getAuthState() {
        let tokenExists = await this.tokenStore.tokenExists();
        if (tokenExists) {
            let data = await this.tokenStore.getTokenWithExpiration();

            return {
                loggedIn: true,
                token: data[this.tokenStore.storageKeys.token],
                expiration: data[this.tokenStore.storageKeys.expiration]
            }
        } else {
            return {
                loggedIn: false,
                token: null,
                expiration: 0
            };
        }
    }


    logIn() {
        var loginUrl = this.config.getLoginUrl();
        browserApi().runtime.sendMessage({ operation: 'login', url: loginUrl });
    }
    refresh() {
        var refreshUrl = this.config.getRefreshUrl();
        browserApi().runtime.sendMessage({ operation: 'refresh', url: refreshUrl });
    }
    async logOut() {
        await this.tokenStore.clearToken();
    }
}

class Controller {
    constructor(ui, auth) {
        this.ui = ui;
        this.auth = auth;
    }
    async init() {
        this.ui.setup(this.logInAction.bind(this), this.refreshAction.bind(this), this.logOutAction.bind(this));
        var authState = await this.auth.getAuthState();
        this.ui.setUI(authState);
        this.setUpListeners();
    }
    logInAction() {
        this.auth.logIn();
    }
    refreshAction() {
        this.auth.refresh();
    }
    async logOutAction() {
        this.auth.logOut();
        let authState = await this.auth.getAuthState();
        this.ui.setUI(authState)
    }


    setUpListeners() {
        chrome.runtime.onMessage.addListener(function (message, sender, callback) {
            switch (message.operation) {
                case 'loggedIn':
                    this.onLoginSuccess(message.data);
                    break;
            }
        }.bind(this));
    }

    async onLoginSuccess(data) {
        let authState = await this.auth.getAuthState();
        this.ui.setUI(authState)
    }
}

var controller = new Controller(new UI(), new Auth());
controller.init();