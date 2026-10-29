/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as log from 'N/log';

export const beforeLoad: EntryPoints.UserEvent.beforeLoad = (context) => {};

export const beforeSubmit: EntryPoints.UserEvent.beforeSubmit = (context) => {};

export const afterSubmit: EntryPoints.UserEvent.afterSubmit = (context) => {};
