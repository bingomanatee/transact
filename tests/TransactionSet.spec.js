import tap from "tap";
import { TransactionSet, constants } from "./../dist/main.js";
import pkg from "../package.json" assert { type: 'json' };

const { name: pkgName } = pkg;

tap.test(pkgName, (suite) => {
  suite.test('transact', (txTest) => {

    txTest.test('TransactionSet', (huTest) => {
      let tm = new TransactManager();


      const history = [];
      let complete = false;
      tm.subject.subscribe({
        next(value) {
          history.push(value);
        },
        error(err) {
          console.log('error in tm', err);
        },
        complete() {
          complete = true;
        }
      })

      tm.perform(constants.ACTIONS.set, { key: 0, value: 1 });
      tm.perform(constants.ACTIONS.set, { key: 1, value: 2 });
      tm.perform(constants.ACTIONS.set, { key: 2, value: 3 });

      huTest.same(history, [
        [1],
        [1, 2],
        [1, 2, 3],
      ]);
      huTest.notOk(complete);

      huTest.end();
    })

    txTest.test('healthy use with action protectors', (huTest) => {

      class ChangeMgr extends ChangeManager {
        constructor(mgr) {
          super(mgr);
          this._value = [];
        }

        beforeExecute(trans) {

          const change = trans.value;
          const len = this.value.length;
          switch (change.action) {
            case constants.ACTIONS.set:

              if (change.key < len) {
                this.transManager.perform('shift', { key: change.key, value: 1 })
              }
              break;

            default:
          }
        }

        execute(trans) {
          const change = trans.value;
          try {

            change.before = this._value;
            let value = [...this._value];
            switch (change.action) {
              case constants.ACTIONS.set:
                value[change.key] = change.value;
                break;

              case 'shift':
                const items = new Array(change.value);
                value.splice(change.key, 0, items)
                break;

              default:
                throw new Error('cannot handle action', { cause: trans });
            }

            this._value = value;
          } catch (err) {
            throw err;
          }
        }
      }

      let cm
      const tm = new TransactManager((transManager) => {
        cm = new ChangeMgr(transManager);
        return cm;
      })

      const history = [];
      let complete = false;
      tm.subject.subscribe({
        next(value) {
          history.push(value);
        },
        error(err) {
          console.log('error in tm', err);
        },
        complete() {
          complete = true;
        }
      })

      tm.perform(constants.ACTIONS.set, { key: 2, value: 3 });
      tm.perform(constants.ACTIONS.set, { key: 1, value: 2 });
      tm.perform(constants.ACTIONS.set, { key: 0, value: 1 });

      huTest.same(history, [
          [undefined, undefined, 3],
          [undefined, 2, undefined, 3],
          [1, undefined, 2, undefined, 3]
        ]
      );
      huTest.notOk(complete);

      huTest.end();
    })


    txTest.test('bad values kicked out', (huTest) => {

      class ChangeMgr extends ChangeManager {
        constructor(mgr) {
          super(mgr);
          this._value = [];
        }

        beforeExecute(trans) {

          const change = trans.value;

          if (['set', 'push'].includes(change.action)) {
            if (change.value % 2) {
              console.log('bad action: ', change.value);
              throw new Error('only even values accepted');
            }
          }
        }

        execute(trans) {
          const change = trans.value;
          try {
            change.before = this._value;
            let value = [...this._value];
            switch (change.action) {
              case constants.ACTIONS.set:
                value[change.key] = change.value;
                break;

              case 'push':
                value.push(change.value);
                break;

              default:
                throw new Error('cannot handle action', { cause: trans });
            }

            console.log('set action to ', value, 'due to ', change);
            this._value = value;
          } catch (err) {
            throw err;
          }
        }

        undo(trans) {
          if (trans.value.before) {
            console.log('resetting to ', trans.value.before);
            this._value = trans.value.before;
          }
        }
      }

      let cm;
      const tm = new TransactManager((transManager) => {
        cm = new ChangeMgr(transManager);
        return cm;
      })

      const history = [];
      let complete = false;
      tm.subject.subscribe({
        next(value) {
          console.log('--- subject result:', value);
          history.push(value);
        },
        error(err) {
          console.log('error in tm', err);
        },
        complete() {
          complete = true;
        }
      })

      let errors = [];
      let values = [1, 2, 3, 4, 5, 6, 7, 8];
      values.forEach((value) => {
        try {
          tm.perform('push', { value });
        } catch (err) {
          console.log('error intercepted:', err.message);
          errors.push(err);
        }
      })

      huTest.same(errors.length, 4);
      console.log('partial history: ', history);
      huTest.same(history,
        [[], [2], [2, 4], [2, 4, 6], [2, 4, 6, 8]]
      );
      huTest.notOk(complete);
      huTest.end();
    });

    txTest.end();
  });

  suite.end();
})
