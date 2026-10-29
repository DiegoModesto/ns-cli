/**
 * @NApiVersion 2.1
 * @NScriptType BundleInstallationScript
 * @NModuleScope SameAccount
 */
define(['N/log'], (log) => {

    const beforeInstall = (params) => {};

    const afterInstall = (params) => {};

    const beforeUpdate = (params) => {};

    const afterUpdate = (params) => {};

    const beforeUninstall = (params) => {};

    return {
        beforeInstall,
        afterInstall,
        beforeUpdate,
        afterUpdate,
        beforeUninstall
    };
});
