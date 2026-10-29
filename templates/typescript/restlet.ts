/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as log from 'N/log';

export const get: EntryPoints.RESTlet.get = (requestParams) => {
    return JSON.stringify({});
};

export const post: EntryPoints.RESTlet.post = (requestBody) => {
    return JSON.stringify({});
};

export const put: EntryPoints.RESTlet.put = (requestBody) => {
    return JSON.stringify({});
};

const delete_: EntryPoints.RESTlet.delete_ = (requestParams) => {
    return JSON.stringify({});
};
export { delete_ as delete };
