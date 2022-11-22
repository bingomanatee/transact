import { ACTIONS } from "./constants";
import { changeParams } from "./types";

export class Change {
  public target: any;
  public before?: any;
  public value: any;
  public action: ACTIONS | string;
  public key?: any;

  constructor(action: ACTIONS | string, params: changeParams) {
    this.action = action;
    this.target = params.target;
    this.value = params.value;
    this.before = params.before;
    this.key = params.key;
  }
}
