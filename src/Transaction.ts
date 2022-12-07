import { TransactionSet } from "./TransactionSet";
import { END_STATES, TRANS_STATES } from "./constants";
import { actionType, errDef, handlerClass, paramObj } from "./types";

let nextId = 0;

export class Transaction {

  constructor(manager: TransactionSet, action: actionType, params?: paramObj, parentId?: number) {
    this.state = TRANS_STATES.new;
    this.action = action;
    this.transactionSet = manager;
    this.params = params;
    this.id = ++nextId;
    if (parentId) {
      this.parentId = parentId;
    }
  }

  public meta = new Map(); // scratch for handlers to note progress

  public state: TRANS_STATES;
  public readonly action: actionType;
  public readonly transactionSet: TransactionSet;
  public readonly id: number;
  public readonly parentId?: number;
  public result: any;
  public handled: boolean = false;
  params?: paramObj;

  perform(handler: handlerClass) {
    this.handled = true;
    switch (handler.perform.constructor.name) {
      case 'GeneratorFunction':
        return this.performGenerator(handler);
        break;

      case 'AsyncGeneratorFunction':
        return new Promise(async (done, error) => {
          try {
            await this.performAsyncGenerator(handler);
            done(this.result);
          } catch (err) {
            error(err);
          }
        });
        break;

      case 'AsyncFunction':
        return new Promise(async (done, error) => {
          try {
            await this.performAsync(handler);
            done(this.result);
          } catch (err) {
            error(err);
          }
        });
        break;

      default:
        return this.performBase(handler);
    }
  }

  private handleError(err: errDef, handler: handlerClass) {
    if (handler.error) {
      this.perform(handler.forErrors(err));
    } else {
      this.result = err;
      this.state = TRANS_STATES.failed;
      this.transactionSet.updateTrans(this);
    }
  }

  private performGenerator(handler: handlerClass) {
    const gen = handler.perform(this);
    let count = 0;
    if (gen) {
      do {
        try {
          const { value, done } = gen.next();
          count += 1;

          if (done) {
            if (!this.closed) {
              this.result = value;
              this.updateState(TRANS_STATES.closed);
            }
          } else {
            this.updateState(value);
          }
        } catch (err) {
          this.handleError(err as errDef, handler);
          break;
        }
        if (this.closed) {
          break;
        }
      } while (count < 20 && !this.closed);

      if (count >= 20) {
        this.handleError(new Error('generator "long loop" (>20)'), handler);
      }
    }
  }

  private updateState(value?: any) {
    if (value !== this.state) {
      this.state = value;
      this.transactionSet.updateTrans(this); // may purge from transactionSet
    }
  }

  get closed() {
    return END_STATES.includes(this.state);
  }

  private async performAsyncGenerator(handler: handlerClass) {
    const gen = handler.perform(this);
    let count = 0;
    if (gen) {
      do {
        try {
          const { value, done } = await gen.next();
          count += 1;

          if (done && value) {
            this.result = value;
          }
          this.updateState(value);
          if (this.closed) {
            break;
          }
        } catch (err) {
          this.handleError(err as errDef, handler);
          break;
        }
      } while (count < 20 && !this.closed);

      if (count >= 20) {
        this.handleError(new Error('generator "long loop" (>20)'), handler);
      }
    }
    return this.result;
  }

  private performBase(handler: handlerClass) {
    try {
      this.result = handler.perform(this);
      this.updateState(TRANS_STATES.closed);
    } catch (err) {
      this.handleError(err as errDef, handler);
    }
    return this.result;
  }

  private async performAsync(handler: handlerClass) {
    console.log('performing async', this.action, this.params );
    try {
      this.result = await handler.perform(this);
      console.log('--- async - done with', this.action,
        ' updateState from ', this.state, 'to', TRANS_STATES.closed);
      this.updateState(TRANS_STATES.closed);
    } catch (err) {
      console.log('--- error performing async ', this.action, err);
      this.handleError(err as errDef, handler);
    }
    return this.result;
  }

  toJSON(withId = false): paramObj {
    let out = {
      action: this.action, params: this.params
    }
    if (withId) {
      return { id: this.id, parentId: this.parentId, ...out };
    }
    return out;
  }
}
