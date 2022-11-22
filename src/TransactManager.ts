import { BehaviorSubject, distinctUntilChanged, Subject } from "rxjs";
import { Transaction } from "./Transaction";
import { ACTIONS } from "./constants";
import { changeParams } from "./types";
import { Change } from "./Change";
import { ChangeManager } from "./ChangeManager";

/*
  note -- the "value" of the TransactManager is a set of zero or more live transactions.
  it does not directly manage any specific subjects - it just keeps track of pending operations.
 */
export class TransactManager extends BehaviorSubject<Set<Transaction>> {
  changeManager: ChangeManager;

  constructor(changeManager: (tm: TransactManager) => ChangeManager) {
    super(new Set());
    this.changeManager = changeManager(this);
  }

  private _subject?: Subject<any>;
  private _subjectDistinct: any;

  /**
   *   a subject that emits the changeManager's current value
   *   of the changeManager when the transaction count is zero.
   *   note -- transactions that do not change the value noticeably
   *   will not emit from here (see distinctUntilChanged).
   */
  get subject(): Subject<any> {
    if (!this._subject) {
      this._subject = new Subject();
      // @ts-ignore
      this._subjectDistinct = this._subject.pipe(
        distinctUntilChanged()
      );
      const self = this;
      this.subscribe({
        next(value) {
          if (!value.size) {
            self._subject?.next(self.changeManager.value);
          }
        },
        complete() {
          self._subject?.complete();
        },
        error(err) {
          console.log('error in transactManager; should not happen', err);
        }
      })
    }

    return this._subjectDistinct
  }

  perform(action: ACTIONS | string, params: changeParams) {
    if (this.closed) {
      throw new Error("attempt to change a closed transactionManager");
    }

    let change = new Change(action, params);
    const trans = new Transaction(this, change);
    trans.subscribe({
      next(newChange) {
        change = newChange
      },
      error() {
      }
    }); // in the event that the change manager alters the change

    const newSet = new Set(this.value);
    newSet.add(trans);
    this.next(newSet);

    let error;
    try {
      this.changeManager.perform(trans);
    } catch (err) {
      error = err;
    }

    const finalSet = new Set(this.value);
    if (error) {
      this.changeManager.undo(trans);
    }
    finalSet.delete(trans);
    this.next(finalSet);
    if (error) {
      if (!trans.closed) {
        trans.error(error);
      }
      throw error;
    }
    return trans;
  }

  get managedValue() {
    return this.changeManager.value;
  }
}
