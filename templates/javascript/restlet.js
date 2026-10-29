/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */
define(['N/log'], (log) => {

    const _get = (requestParams) => {
        return JSON.stringify({});
    };

    const _post = (requestBody) => {
        return JSON.stringify({});
    };

    const _put = (requestBody) => {
        return JSON.stringify({});
    };

    const _delete = (requestParams) => {
        return JSON.stringify({});
    };

    return {
        get: _get,
        post: _post,
        put: _put,
        delete: _delete
    };
});
