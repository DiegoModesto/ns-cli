/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as log from 'N/log';

export const pageInit: EntryPoints.Client.pageInit = (context) => {};

export const saveRecord: EntryPoints.Client.saveRecord = (context) => {
    return true;
};

export const validateField: EntryPoints.Client.validateField = (context) => {
    return true;
};

export const fieldChanged: EntryPoints.Client.fieldChanged = (context) => {};

export const postSourcing: EntryPoints.Client.postSourcing = (context) => {};

export const lineInit: EntryPoints.Client.lineInit = (context) => {};

export const validateDelete: EntryPoints.Client.validateDelete = (context) => {
    return true;
};

export const validateInsert: EntryPoints.Client.validateInsert = (context) => {
    return true;
};

export const validateLine: EntryPoints.Client.validateLine = (context) => {
    return true;
};

export const sublistChanged: EntryPoints.Client.sublistChanged = (context) => {};
