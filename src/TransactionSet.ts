import { BehaviorSubject, filter, map, Observable } from "rxjs";
import { Transaction } from "./Transaction";
import { ACTIONS } from "./constants";
import { actionParams } from "./types";
import { Action } from "./Action";
import { ActionManager } from "./ActionManager";
import { asError } from "./utils";
// @ts-ignore
import sortBy from 'lodash.sortby';
// @ts-ignore
import uniq from 'lodash.uniq';

/*
  note -- the "action" of the TransactManager is a set of zero or more live transactions.
  it does not directly manage any specific subjects - it just keeps track of pending operations.
 */

export class TransactManager extends BehaviorSubject<Set<Transaction>> {
  actionManager: ActionManager;

  constructor(amInitializer: (tm: TransactManager) => ActionManager) {
    super(new Set());
    this.actionManager = amInitializer(this);
  }

  perform(action: ACTIONS | string, params: actionParams) {
    if (this.closed) {
      throw new Error("attempt to change a closed transactionManager");
    }

    const trans = new Transaction(this, new Action(action, params));

    const newSet = new Set(this.value);
    newSet.add(trans);
    this.next(newSet);

    let error;
    try {
      this.actionManager.perform(trans);
    } catch (err) {
      error = err;
    }

    const finalSet = new Set(this.value);
    if (error) {
      let higherTrans = Array.from(this.value.values()).filter((trans) => {
        trans.$id > trans.$id
      })
      const orderedTrans = sortBy([...higherTrans, trans], '$id').reverse();
      uniq(orderedTrans).forEach((ot: Transaction) => {
        this.actionManager.undo(ot);
        if (!ot.closed) {
          ot.complete();
        }
        finalSet.delete(ot);
      });
    }
    this.next(finalSet);
    if (error) {
      if (!trans.closed) {
        trans.error(asError(error));
      }
      throw error;
    }
    return trans;
  }
}
