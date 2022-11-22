import { Transaction } from "./Transaction";
import { TransactManager } from "./TransactManager";

function asError(value: any, def?: any) {
  if (!value) {
    return def ? new Error(def) : value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  return value;
}

export abstract class ChangeManager {

  constructor(mgr: TransactManager) {
    this.transManager = mgr;
  }

  protected transManager : TransactManager;
  /**
   * This method must be customized; accepts the transaction,
   * performs actions, and updates the _value property.
   *
   * This method call is sandwiched between execute and afterExecute.
   *
   * // NOTE: if you want a method to SILENTLY FAIL -- i.e., to skip
   * afterExecute AND undo -- you can call `trans.complete` in execute;
   *
   * it's expected that when you execute a transaction, the value property
   * will be updated with a new (and ideally, referentially unique) value.
   *
   * @param trans
   * @protected
   */
  protected abstract execute(trans: Transaction): void;

  /**
   * perform any validation, prep work needed
   * to execute transaction. Can throw.
   *
   * beforeExecute can
   * 1) change / clean up the trans; may call next() to do so
   * 2) silently reject the transaction by closing it therefore blocking execution
   * 3) not so silently throw. (will call `trans.error(err)` on thrown error
   * 4) this method can also remain undefined.
   * @param trans
   */
  abstract beforeExecute?(trans: Transaction): any;

  /**
   * this is the -->PUBLIC<--- method to handle a transaction.
   * @param trans
   */
  perform(trans: Transaction): Transaction {
    try {
      if (this.beforeExecute) {
        const result = this.beforeExecute(trans);
        if (result) {

          if (!trans.closed) {
            trans.error(asError(result));
          }
          throw result;
        }
      }

      this.execute(trans);
      if (!trans.closed) {
        if (this.afterExecute) {
          const err = asError(this.afterExecute(trans), 'pre-validate error');
          if (err) {
            if (!trans.closed) {
              trans.error(err);
            }
            throw err;
          }
        }
        trans.complete();
      }
    } catch (err) {
      if (!trans.closed) {
        trans.error(err);
      }
    }
    return trans;
  }

  protected _value: any;

  public get value() {
    return this._value;
  }

  /**
   * perform any post-execution activity; transaction is still live,
   * but throwing can void it.
   * It should never get a closed transaction.
   * afterExecute is not a required member; can remain undefined.
   * @param trans
   */
  protected abstract afterExecute(trans: Transaction): any;

  /**
   * resetting any changes done by the transaction.
   * @param trans
   */
  abstract undo(trans: Transaction): void;
}
