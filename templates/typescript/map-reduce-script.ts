/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as log from 'N/log';

export const getInputData: EntryPoints.MapReduce.getInputData = (context) => {};

export const map: EntryPoints.MapReduce.map = (context) => {};

export const reduce: EntryPoints.MapReduce.reduce = (context) => {};

export const summarize: EntryPoints.MapReduce.summarize = (summary) => {
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
