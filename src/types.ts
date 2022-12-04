import { ACTIONS, TRANS_STATES } from "./constants";

export type actionType = ACTIONS | string;
export type errDef = Error | string;
export type paramObj = { [key: string]: any };

export type handlerGeneratorFn = (transaction: transaction) => Generator<any>;
export type handlerBaseFn = (transaction: transaction) => void;
export type handlerFn = handlerBaseFn | handlerGeneratorFn;
export type errorFn = (err: errDef, transaction: transaction) => void;

export type handlerDef = { [name: string]: any }; // the parameter acceptable values

export type handlerClass = { name: string, perform: handlerFn, error?: errorFn, forErrors: (err: errDef) => handlerClass }

export type handlerObj = { [name: string]: handlerClass } // the transaction set parameter

export type tsOptions = { handlers: handlerDef, pre?: any[], post?: any[] };

export type transactionSet = {
  do: (action: actionType, params?: paramObj) => any;
}

export type transaction = {
  state: TRANS_STATES;
  action: actionType;
  transactionSet: transactionSet;
  id: number;
  parentId?: number;
  params?: paramObj;
  result: any;
  closed: boolean;
  toJSON: (withId?: boolean) => paramObj
}
