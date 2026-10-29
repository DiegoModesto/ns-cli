/**
 * @NApiVersion 2.1
 * @NScriptType BundleInstallationScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as log from 'N/log';

export const beforeInstall: EntryPoints.BundleInstallation.beforeInstall = (params) => {};

export const afterInstall: EntryPoints.BundleInstallation.afterInstall = (params) => {};

export const beforeUpdate: EntryPoints.BundleInstallation.beforeUpdate = (params) => {};

export const afterUpdate: EntryPoints.BundleInstallation.afterUpdate = (params) => {};

export const beforeUninstall: EntryPoints.BundleInstallation.beforeUninstall = (params) => {};
