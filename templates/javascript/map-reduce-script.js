/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/log'], (log) => {

    const getInputData = (context) => {};

    const map = (context) => {};

    const reduce = (context) => {};

    const summarize = (summary) => {
        if (summary.inputSummary.error) {
            log.error({ title: 'getInputData', details: summary.inputSummary.error });
        }
        summary.mapSummary.errors.iterator().each((key, error) => {
            log.error({ title: `map: ${key}`, details: error });
            return true;
        });
        summary.reduceSummary.errors.iterator().each((key, error) => {
            log.error({ title: `reduce: ${key}`, details: error });
            return true;
        });
    };

    return {
        getInputData,
        map,
        reduce,
        summarize
    };
});
