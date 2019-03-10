function getBrowserApi() {
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
const browserApi = getBrowserApi();

class TokenStorage {

    constructor() {
        this.storageKeys = {
            token: 'token',
            expiration: 'exp',
            state: 'state',
            all: ['token', 'exp', 'state']
        };
    }

    async tokenExists() {
        const data = await this.getTokenWithExpiration();
        return !!data[this.storageKeys.token] && !!data[this.storageKeys.expiration];
    }

    async getTokenWithExpiration() {
        return await browserApi.storage.local.get(this.storageKeys.all);
    }

    async saveToken(token, expiration) {
        const data = {
            [this.storageKeys.token]: token,
            [this.storageKeys.expiration]: expiration
        };

        await browserApi.storage.local.set(data);
    }

    async clearToken() {
        await browserApi.storage.local.remove(this.storageKeys.all);
    }
}

class UI {

    setUI(authState) {
        document.querySelector('.status__logged_in').classList.remove('hidden');
        document.querySelector('.status__logged_out').classList.remove('hidden');

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

class Auth {

    constructor(tokenStore) {
        this.tokenStore = tokenStore;
        this.defaultAuthorizationParameters = {
            clientId: '####ENTER_YOUR_CLIENT_ID_HERE####',
            tenant: 'consumers',
            scope: 'openid email profile',
            responseType: 'id_token',
            redirectUri: 'https://random.not.existing.url.local.somewhere',
            state: 12345,
            nonce: 456789 // generate state and nonce instead of hardcoded
        };
    }

    _generateAuthorizationUrl(config) {
        return `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/authorize?
        client_id=${config.clientId}
        &response_type=${encodeURIComponent(config.responseType)}
        &redirect_uri=${encodeURIComponent(config.redirectUri)}
        &scope=${encodeURIComponent(config.scope)}
        &response_mode=fragment
        &prompt=${config.prompt}
        &state=${config.state}
        &nonce=${config.nonce}`.replace(/\s/g, '');
    }

    get loginUrl() {
        return this._generateAuthorizationUrl({
            ...this.defaultAuthorizationParameters,
            prompt: "select_account"
        })
    }
    get refreshUrl() {
        return this._generateAuthorizationUrl({
            ...this.defaultAuthorizationParameters,
            prompt: "none"
        })
    }

    async getAuthState() {
        const tokenExists = await this.tokenStore.tokenExists();
        if (!tokenExists) {
            return {
                loggedIn: false,
                token: null,
                expiration: 0
            };
        }

        const data = await this.tokenStore.getTokenWithExpiration();

        return {
            loggedIn: true,
            token: data[this.tokenStore.storageKeys.token],
            expiration: data[this.tokenStore.storageKeys.expiration]
        }
    }

    logIn() {
        browserApi.runtime.sendMessage({ operation: 'login', url: this.loginUrl });
    }

    refresh() {
        browserApi.runtime.sendMessage({ operation: 'refresh', url: this.refreshUrl });
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
        await this._reloadAuthUI();
        this.setUpListeners();
    }

    async _reloadAuthUI() {
        const authState = await this.auth.getAuthState();
        this.ui.setUI(authState);
    }

    _logInAction() {
        this.auth.logIn();
    }

    _refreshAction() {
        this.auth.refresh();
    }

    async _logOutAction() {
        this.auth.logOut();
        await this._reloadAuthUI();
    }

    setUpListeners() {
        document.querySelector('.action__log_in').addEventListener('click', this._logInAction.bind(this));
        document.querySelector('.action__silent_refresh').addEventListener('click', this._refreshAction.bind(this));
        document.querySelector('.action__log_out').addEventListener('click', this._logOutAction.bind(this));

        browserApi.runtime.onMessage.addListener(function (message, sender, callback) {
            switch (message.operation) {
                case 'loggedIn':
                    this.onLoginSuccess();
                    break;
            }
        }.bind(this));
    }

    async onLoginSuccess() {
        await this._reloadAuthUI();
    }
}

const controller = new Controller(new UI(), new Auth(new TokenStorage()));
controller.init();