import { BehaviorSubject, Subject, SubjectLike } from "rxjs";
import { Transaction } from "./Transaction";
import { actionType, errDef, handlerObj, transObj, tsOptions } from "./types";

// @ts-ignore
import sortBy from 'lodash.sortby';
// @ts-ignore
import uniq from 'lodash.uniq';
import { Handler } from "./Handler";
import { TRANS_STATES } from "./constants";

/*
  note -- the "action" of the TransactionSet is a set of zero or more live transactions.
  it does not directly manage any specific subjects - it just keeps track of pending operations.
 */

export class TransactionSet extends BehaviorSubject<Set<Transaction>> {
  constructor({ handlers, pre, post }: tsOptions) {
    super(new Set());
    this.handlers = handlers;
    pre?.forEach((handlerConst) => this.listen(handlerConst, this.preSubject));
    post?.forEach((handlerConst) => this.listen(handlerConst, this.postSubject));
  }

  get handlers(): handlerObj {
    return this._handlers;
  }

  set handlers(value: handlerObj) {
    Object.keys(value).forEach(
      (name) => {
        const handlerDef = value[name];
        this._handlers[name] = new Handler(name, handlerDef);
      });
  }

  private _handlers: handlerObj = {};

  do(action: actionType, ...params: any[]) {
    if (this.closed) {
      throw new Error("attempt to change a closed transactionManager");
    }

    if (!this.handlers[action]) {
      throw new Error(`no handler for action ${action}`);
    }

    const trans = new Transaction(this, action, params);
    let result;

    this.preSubject.next(trans);
    if (trans.closed) {
      this.postSubject.next(trans);
      if (trans.state === TRANS_STATES.failed) {
        throw trans.result;
      }
      return trans.result;
    } else {
      this.push(trans);
      result = trans.perform(this.handlers[action]);
    }
    if (trans.state === TRANS_STATES.failed) {
      throw trans.result;
    }
    return result;
  };

  public preSubject = new Subject<transObj>();
  public postSubject = new Subject<transObj>();

  private push(trans: Transaction) {
    if (this.value.has(trans)) {
      return;
    }

    const value = new Set(this.value);
    value.add(trans);
    this.next(value);
  }

  updateTrans(trans: Transaction) {
    if (this.closed) {
    } else if (this.value.has(trans)) {
      const value = new Set(this.value);
      if (trans.closed) {
        value.delete(trans);
        this.postSubject.next(trans);
      }
      this.next(value);
    }
  }

  private listen(handlerConst: any, listener: SubjectLike<transObj>) {
    const handler = new Handler('', handlerConst);

    listener.subscribe({
      next(trans: transObj) {
        if (trans.closed) {
          return;
        }
        try {
          handler.perform(trans);
        } catch (err) {
          try {
            handler.forErrors(err as errDef).perform(trans);
          } catch (err2) {
            trans.result = err2;
            trans.state = TRANS_STATES.failed;
          }
        }
      },
      error(_err) {
      }
    })
  }
}
