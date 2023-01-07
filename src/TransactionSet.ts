import { BehaviorSubject } from "rxjs";
import { Transaction } from "./Transaction";
import { actionType, handlerClass, handlerObj, transactFn, transactionSet, transObj, tsOptions } from "./types";

// @ts-ignore
import sortBy from 'lodash.sortby';
// @ts-ignore
import uniq from 'lodash.uniq';
import { Handler } from "./Handler";
import { TRANS_STATES, TRANSACT } from "./constants";

/*
  note -- the "value" of the TransactionSet is a set of zero or more live transactions.
  it does not directly manage any specific subjects - it just keeps track of pending operations.
 */

export class TransactionSet extends BehaviorSubject<Set<transObj>> implements transactionSet {
  constructor({ handlers }: tsOptions) {
    super(new Set());
    this.handlers = handlers;
  }

  get handlers(): handlerObj {
    return this._handlers;
  }

  set handlers(value: handlerObj) {
    Object.keys(value).forEach(
      (name) => {
        const handlerDef = value[name];
        this.addHandler(name, handlerDef);
      });
  }

  public addHandler(name: string, handlerDef: any) {
    this._handlers[name] = new Handler(name, handlerDef);
  }

  private _handlers: handlerObj = {};

  do(action: actionType, ...params: any[]) {
    if (!this.handlers[action]) {
      throw new Error(`no handler for action ${action}`);
    }
    const handler = this.handlers[action];
    return this._do(action, handler, params);
  };

  private _do(action: string, handler: handlerClass, params: any[] = []) {

    const trans = new Transaction(this, action, params);
    let result;
    this.push(trans);
    result = trans.perform(handler);

    if (trans.state === TRANS_STATES.failed) {
      throw trans.result;
    }
    return result;
  }

  transact(fn: transactFn, ...params: any[]) {
    const name = [TRANSACT, fn.name || ''].join(' ');
    const handler = new Handler(name, fn);
    return this._do(name, handler, params);
  };

  private push(trans: Transaction) {
    if (this.value.has(trans)) {
      return;
    }

    const value = new Set(this.value);
    value.add(trans);
    this.next(value);
  }

  updateTrans(trans: transObj) {
    if (this.value.has(trans)) {
      const value = new Set(this.value);
      if (trans.closed) {
        value.delete(trans);
      }
      this.next(value);
    }
  }

}
