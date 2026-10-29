/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as log from 'N/log';

export const render: EntryPoints.Portlet.render = (params) => {
    const portlet = params.portlet;
    portlet.title = 'Portlet Title';
};
