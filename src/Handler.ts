import { type } from "@wonderlandlabs/walrus";
import { errDef, errorFn, handlerFn } from "./types";

export class Handler {
  public name: string;

  constructor(name: string, value: any) {
    this.name = name;
    const t = type.describe(value) as {type: string};
     switch (t.type) {
      case 'array':
        this.init(value[0], value[1]);
        break

      case 'object':
        const { next: handler, error } = value;
        this.init(handler, error);
        break;

      case 'function':
        this.init(value);
        break;

      default:
        console.log('bad perform definition for ' + name, value);
        throw new Error('bad perform definition for ' + name);
    }
  }


  error?: errorFn;
  perform: handlerFn = function () {};

  private init(handler: handlerFn, error?: errorFn) {
    this.perform = handler;
    this.error = error;
  }

  forErrors(err: errDef) : Handler {
    return new Handler(this.name, (trans: any) => {
      if (this.error) {
        return this.error(err, trans);
      } else {
        throw(err);
      }
    });
  }

}
