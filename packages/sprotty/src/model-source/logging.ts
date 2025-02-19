/********************************************************************************
 * Copyright (c) 2017-2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject } from 'inversify';
import { Action, LoggingAction as ProtocolLoggingAction } from 'sprotty-protocol/lib/actions';
import { ILogger, LogLevel } from '../utils/logging';
import { TYPES } from '../base/types';
import { ModelSource } from './model-source';

/**
 * @deprecated Use the declaration from `sprotty-protocol` instead.
 */
export interface LoggingAction extends Action {
    kind: typeof LoggingAction.KIND;
    severity: string
    time: string
    caller: string
    message: string
    params: string[]
}
export namespace LoggingAction {
    export const KIND = 'logging';

    export function create(options: { severity: string, time: string, caller: string, message: string, params: string[] }): LoggingAction {
        return {
            kind: KIND,
            ...options
        };
    }
}

/**
 * A logger that forwards messages of type 'error', 'warn', and 'info' to the model source.
 */
@injectable()
export class ForwardingLogger implements ILogger {

    @inject(TYPES.ModelSourceProvider) protected modelSourceProvider: () => Promise<ModelSource>;
    @inject(TYPES.LogLevel) public logLevel: LogLevel;

    error(thisArg: any, message: string, ...params: any[]): void {
        if (this.logLevel >= LogLevel.error)
            this.forward(thisArg, message, LogLevel.error, params);
    }

    warn(thisArg: any, message: string, ...params: any[]): void {
        if (this.logLevel >= LogLevel.warn)
            this.forward(thisArg, message, LogLevel.warn, params);
    }

    info(thisArg: any, message: string, ...params: any[]): void {
        if (this.logLevel >= LogLevel.info)
            this.forward(thisArg, message, LogLevel.info, params);
    }

    log(thisArg: any, message: string, ...params: any[]): void {
        if (this.logLevel >= LogLevel.log) {
            // We cannot forward 'log' level messages since that would lead to endless loops
            try {
                const caller = typeof thisArg === 'object' ? thisArg.constructor.name : String(thisArg);
                console.log.apply(thisArg, [caller + ': ' + message, ...params]);
            } catch (error) {}
        }
    }

    protected forward(thisArg: any, message: string, logLevel: LogLevel, params: any[]) {
        const date = new Date();
        const action = ProtocolLoggingAction.create({
            message,
            severity: LogLevel[logLevel],
            time: date.toLocaleTimeString(),
            caller: typeof thisArg === 'object' ? thisArg.constructor.name : String(thisArg),
            params: params.map(p => JSON.stringify(p))
        });
        this.modelSourceProvider().then(modelSource => {
            try {
                modelSource.handle(action);
            } catch (error) {
                try {
                    console.log.apply(thisArg, [message, action, error]);
                } catch (e) {}
            }
        });
    }
}
