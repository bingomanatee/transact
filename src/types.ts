import { ACTIONS, TRANS_STATES } from "./constants";

export type actionType = ACTIONS | string;
export type errDef = Error | string;
export type paramObj = { [key: string]: any };

export type handlerGeneratorFn = (transaction: transObj) => Generator<any>;
export type handlerBaseFn = (transaction: transObj, ...rest: any[]) => void;
export type handlerFn = handlerBaseFn | handlerGeneratorFn;
export type errorFn = (err: errDef, transaction: transObj) => void;

export type handlerDef = { [name: string]: any }; // the parameter acceptable values

export type handlerClass = { name: string, perform: handlerFn, type: string, error?: errorFn, forErrors: (err: errDef) => handlerClass }

export type handlerObj = { [name: string]: handlerClass } // the transObj set parameter

export type tsOptions = { handlers: handlerDef, pre?: any[], post?: any[] };

export type transactionSet = {
  do: (action: actionType, params?: paramObj) => any;
}

export type transObj = {
  state: TRANS_STATES;
  action: actionType;
  transactionSet: transactionSet;
  id: number;
  parentId?: number;
  params: any[];
  result: any;
  closed: boolean;
  toJSON: (withId?: boolean) => paramObj
}
