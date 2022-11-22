import { BehaviorSubject } from "rxjs";
import { Change } from "./Change";
import { TransactManager } from "./TransactManager";

export class Transaction extends BehaviorSubject<Change> {
  manager: TransactManager;

  constructor(manager: TransactManager, change: Change) {
    super(change);
    this.manager = manager;
  }
}
