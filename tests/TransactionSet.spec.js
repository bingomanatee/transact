import tap from "tap";
import * as main from "./../dist/main.js";
import pkg from "../package.json" assert { type: 'json' };

const { TransactionSet } = main;

const { name: pkgName } = pkg;

tap.test(pkgName, (suite) => {
  suite.test('transact', (txTest) => {

    txTest.test('TransactionSet', (tsTest) => {
      tsTest.test('basic change', (basicTest) => {
        const points = [];
        let ts = new TransactionSet(
          {
            handlers: {
              addPoint: (trans) => {
                points.push(trans.params);
              }
            }
          }
        );


        const history = [];
        let complete = false;
        ts.subscribe({
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

        ts.do('addPoint', { x: 1, y: 2 });

         basicTest.same(history.map(
            transList => Array.from(transList).map(trans => trans.toJSON(false))),
          [
            [],
            [
              {
                "action": "addPoint",
                "params": {
                  "x": 1,
                  "y": 2,
                },
              },
            ],
            [],
          ]);
        basicTest.same(points, [{ x: 1, y: 2 }]);
        basicTest.notOk(complete);
        basicTest.end();
      });


      tsTest.end();
    });

    txTest.end();
  });

  suite.end();
})
