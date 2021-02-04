import { ModPack } from './modules/modpacks/types';


// import {ipcRenderer, shell} from 'electron';
// console = remote.app.console;
// Object.assign(console, remote.app.console.functions);
import Vue from 'vue';
import App from './App.vue';
import router from './router';
import {library} from '@fortawesome/fontawesome-svg-core';
import {fas, faToriiGate} from '@fortawesome/free-solid-svg-icons';
import {far} from '@fortawesome/free-regular-svg-icons';
import {fab} from '@fortawesome/free-brands-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/vue-fontawesome';
// @ts-ignore
import VueNativeSock from 'vue-native-websocket';
// @ts-ignore
import vueMoment from 'vue-moment';
// @ts-ignore
// import VueMarkdown from 'vue-markdown';
import VueShowdown, {showdown} from 'vue-showdown';
import moment from 'moment';
// @ts-ignore
import vSelectMenu from 'v-selectmenu';
import '@/assets/tailwind.scss';

import store from './store';
import { logVerbose } from './utils';
import { getAPIRequest } from './modules/modpacks/actions';


const classMap: object = {
    h1: 'text-4xl',
    h2: 'text-3xl',
    h3: 'text-2xl',
    h4: 'text-xl',
    h5: 'text-lg',
    h6: 'title is-6',
    em: 'italic',
    ul: 'list-inside',
    a: 'text-gray-400 hover:text-white leading-none cursor-pointer hover:underline',
    // li: 'ui item'
};

const styleMap = {
    // h3: 'padding-top: 1.5rem; margin-bottom: .5rem; margin-left: 0;'
};

const attributeMap = {
    // a: '@click="openExternal"',
};


showdown.extension('classMap', Object.keys(classMap).map((key) => ({
    type: 'output',
    regex: new RegExp(`<${key}(.*)>`, 'g'),
    // @ts-ignore
    replace: `<${key} class="${classMap[key]}" $1>`,
})));

showdown.extension('attribMap', Object.keys(attributeMap).map((key) => ({
    type: 'output',
    regex: new RegExp(`<${key}(.*)>`, 'g'),
    // @ts-ignore
    replace: `<${key} ${attributeMap[key]} $1>`,
})));

showdown.extension('newLine', () => [{
    type: 'output',
    regex: new RegExp(`\n`, 'g'),
    replace: '<br>',
}]);


library.add(fas);
library.add(far);
library.add(fab);
Vue.use(vueMoment);
Vue.use(vSelectMenu, {language: 'en'});
Vue.use(VueShowdown, {
    options: {
        emoji: true,
        tables: true,
        underline: true,
        openLinksInNewWindow: true,
        strikethrough: true,
        // simpleLineBreaks: true,
    },
});
Vue.component('font-awesome-icon', FontAwesomeIcon);

Vue.config.productionTip = false;
Vue.config.devtools = true;

Vue.mixin({
    methods: {
        openExternal(event: any) {
            event.preventDefault();
            const link = event.target.href;
            //@ts-ignore
            overwolf.utils.openUrlInDefaultBrowser(link);
        },
        copyToClipboard(text: string){
            //@ts-ignore
            overwolf.utils.placeOnClipboard(text);
        },
    },
});

Vue.filter('moment', (value: any) => {
    if (!value) { return ''; }
    value = value.toString();
    return moment.unix(value).format('Do MMMM YYYY');
});

Vue.filter('momentFromNow', (value: any) => {
    if (!value) { return ''; }
    value = value.toString();
    return moment.duration(moment.unix(value).diff(moment())).humanize(true);
});
Vue.filter('formatNumber', (value: number) => {
    if (!value) {return ''; }
    return new Intl.NumberFormat().format(value);
});

Vue.filter('prettyBytes', (num: number) => {
    // jacked from: https://github.com/sindresorhus/pretty-bytes
    if (isNaN(num)) {
        throw new TypeError('Expected a number');
    }

    let exponent;
    let unit;
    const neg = num < 0;
    const units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    if (neg) {
        num = -num;
    }

    if (num < 1) {
        return (neg ? '-' : '') + num + ' B';
    }

    exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), units.length - 1);
    // @ts-ignore
    num = (num / Math.pow(1000, exponent)).toFixed(2) * 1;
    unit = units[exponent];

    return (neg ? '-' : '') + num + ' ' + unit;
});

//@ts-ignore
let mainWindow = overwolf.windows.getMainWindow();
let initialData = mainWindow.getWebsocketData();
console.log("Initial WS data: ", initialData);
let ws: WebSocket;
let reconnectCount = 0;

async function onConnect(){
    console.log("Auth data:", mainWindow.getAuthData());
    //@ts-ignore
    if(mainWindow.getAuthData() !== undefined){
        //@ts-ignore
        let data = overwolf.windows.getMainWindow().getAuthData();
        if(data.token){
            store.dispatch('auth/setSessionID', data.token, {root: true});
        }
        //@ts-ignore
        if(data['app-auth'] && !window.isChat){
            const settings = store.state.settings?.settings;
            if(settings !== undefined){
                if(settings.sessionString !== data['app-auth']){
                    settings.sessionString = data['app-auth'];
                    store.dispatch('settings/saveSettings', settings, {root: true});
                }
            }
        }
    } else {
        await store.dispatch('settings/loadSettings');
        const settings = store.state.settings?.settings;
        if(settings !== undefined){
            if(settings.sessionString !== undefined && settings.sessionString.length > 0){
                store.dispatch('auth/getNewSession', settings.sessionString, {root: true});
            }
        }
    }
    
    //@ts-ignore
    let launchedProtoURL = overwolf.windows.getMainWindow().getProtocolURL();
    if(launchedProtoURL !== undefined){
        parseAndHandleURL(launchedProtoURL);
        launchedProtoURL = undefined;
    }
}

function setupWS(port: Number = 13377){
    ws = new WebSocket('ws://localhost:' + port);
    Vue.prototype.$socket = ws;
    ws.addEventListener('message', (event) => {
        console.log("Message", event.data);
        let content = JSON.parse(event.data);
        if(content.port && content.secret) {
            ws.close(4000, 'newport');
            store.commit('STORE_WS', content);
            mainWindow.setWSData(content);
            setupWS(content.port);
        } else {
            store.commit('SOCKET_ONMESSAGE', content);
        }
    });
    ws.addEventListener('open', (event) => {
        console.log('Connected to socket!');
        if(mainWindow.getWebsocketData().dev || mainWindow.getWebsocketData().secret !== undefined) {
            console.log("Socket opened correctly and ready!")
            setTimeout(() => {
                store.commit('SOCKET_ONOPEN');
                onConnect();
            }, 200);
        }
        reconnectCount = 0;
    });
    ws.addEventListener('error', (err) => {
        console.log('Error!', err);
        store.commit('SOCKET_ONERROR', err);
    });
    ws.addEventListener('close', (event) => {
        if(event.target !== ws) {
            return;
        }
        console.log('Disconnected!', event, event.code, event.reason);
        if(event.reason !== 'newport' || (port === 13377 && mainWindow.getWebsocketData().secret !== undefined)) {
            console.log("Retrying connection");
            setTimeout(() => setupWS(port), 1000);
            reconnectCount++;
            setTimeout(() => store.commit('SOCKET_RECONNECT', reconnectCount), 200);
        }
        setTimeout(() => store.commit('SOCKET_ONCLOSE', event), 200);
    });
}
const vm = new Vue({
    router,
    store,
    render: (h: any) => h(App),
}).$mount('#app');
handleWSInfo(initialData.port, true, initialData.secret, initialData.dev);

function handleWSInfo(port: Number, isFirstConnect: Boolean = false, secret?: String, dev?: Boolean) {
    console.log("Handling WS INFO", port, secret, dev);
    setupWS(port);
    if(secret && !dev) {
        store.commit('STORE_WS', initialData);
    }
}
mainWindow.setNewWebsocketCallback(handleWSInfo);
//@ts-ignore
if(window.isChat === undefined || !window.isChat){
    store.dispatch('registerModProgressCallback', (data: any) => {
        if(data.messageType === "message"){
            if(data.message === "init"){
                store.commit('modpacks/setLaunchProgress', []);
                if(data.instance){
                    router.push({name: 'launchingpage', query: {uuid: data.instance}})
                }
            } else {
                if(router.currentRoute.name === "launchingpage"){
                    router.replace({name: 'instancepage', query: {uuid: data.instance}})
                }
                store.commit('modpacks/setLaunchProgress', undefined);
            }
        } else if(data.messageType === "progress") {
            if(router.currentRoute.name !== "launchingpage"){
                router.push({name: 'launchingpage', query: {uuid: data.instance}})
            }
            if(data.clientData.bars){
                store.commit('modpacks/setLaunchProgress', data.clientData.bars);
            }
        } else if(data.messageType === "clientDisconnect"){
            if(router.currentRoute.name === "launchingpage"){
                router.replace({name: 'instancepage', query: {uuid: data.instance}})
            }
        }
    });
    //@ts-ignore
    overwolf.extensions.onAppLaunchTriggered.addListener(function(event){
        if(event.origin === "urlscheme"){
            let protocolURL = event.parameter;
            if(protocolURL === undefined){
                return;
            }
            protocolURL = decodeURIComponent(protocolURL);
            parseAndHandleURL(protocolURL);
        }
    });
    addWindowListener();
}

async function addWindowListener(){
    let ourWindowID = await new Promise((resolve) => {
        //@ts-ignore
        overwolf.windows.getCurrentWindow(function(e){
            if(e.success){
                resolve(e.window.id);
            }
        });
    });
    //@ts-ignore
    overwolf.windows.onStateChanged.addListener(function(event) {
        if(event.window_id === ourWindowID){
            if(event.window_previous_state_ex === "minimized" && event.window_state_ex === "normal"){
                //@ts-ignore
                if(window.ad){                
                    //@ts-ignore
                    window.ad.refreshAd();
                }
            } else if(event.window_state_ex === "minimized" && event.window_previous_state_ex === "normal"){
                //@ts-ignore
                if(window.ad){       
                    //@ts-ignore
                    window.ad.removeAd();
                }
            }
        }
    })
}

function parseAndHandleURL(protocolURL: string){
    protocolURL = protocolURL.substring(6, protocolURL.length);
    const parts = protocolURL.split('/');
    const command = parts[0];
    const args = parts.slice(1, parts.length);
    if (command === 'modpack') {
        if (args.length === 0) {
            return;
        }
        logVerbose(store.state, 'Received modpack protocol message', args);
        const modpackID = args[0];
        if (args.length === 1) {
            // Navigate to page for modpack
            logVerbose(store.state, 'Navigating to page for modpack', modpackID);
            router.push({name: 'modpackpage', query: {modpackid: modpackID}});
        } else if (args.length === 2) {
            if (args[1] === 'install') {
                // Popup install for modpack
                logVerbose(store.state, 'Popping up install for modpack', modpackID);
                router.push({name: 'modpackpage', query: {modpackid: modpackID, showInstall: 'true'}});
            }
        } else if (args.length === 3) {
            if (args[2] === 'install') {
                // Popup install for modpack with version default selected
                router.push({name: 'modpackpage', query: {modpackid: modpackID, showInstall: 'true', version: args[1]}});
            }
        }
    } else if (command === 'instance') {
        if (args.length === 0) {
            return;
        }
        const instanceID = args[0];
        if (args.length === 1) {
            // Open instance page
            router.push({name: 'instancepage', query: {uuid: instanceID}});
        } else if (args.length === 2) {
            // Start instance
            router.push({name: 'instancepage', query: {uuid: instanceID, shouldPlay: 'true'}});
        }
    } else if (command === 'server') {
        if (args.length === 0) {
            return;
        }
        const serverID = args[0];
        router.push({name: 'server', query: {serverid: serverID}});
    }
}
//@ts-ignore
if(window.isChat){
    router.push('/chat');
    //@ts-ignore
    overwolf.windows.getMainWindow().addCallback((data: any) => {
        if(data.token){
            store.dispatch('auth/setSessionID', data.token, {root: true});
        }
    });
}