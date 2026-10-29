/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @NModuleScope SameAccount
 */
define(['N/log'], (log) => {

    const render = (params) => {
        const portlet = params.portlet;
        portlet.title = 'Portlet Title';
    };

    return {
        render
    };
});
