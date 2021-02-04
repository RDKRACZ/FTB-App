import fs from 'fs';
import path from 'path';
let appVersion = 'Missing Version File';
let webVersion = 'Missing Version File';
let dateCompiled = 'Missing Version File';
let javaLicenses: object = {};
declare const __static: string;

interface Config {
    apiURL: string;
    appVersion: string;
    webVersion: string;
    dateCompiled: string;
    javaLicenses: object;
}
//@ts-ignore
if (overwolf.windows.getMainWindow().getVersionData()) {
    //@ts-ignore
    let versionData = overwolf.windows.getMainWindow().getVersionData();
    appVersion = versionData.jarVersion;
    webVersion = versionData.webVersion;
    dateCompiled = versionData.timestampBuilt;
    javaLicenses = versionData.javaLicense;
}

const config: Config = {
    apiURL: process.env.NODE_ENV === 'production' ? `https://api.modpacks.ch` : `https://modpack-api-production.ch.tools`,
    appVersion,
    webVersion,
    dateCompiled,
    javaLicenses,
};
export default config;
