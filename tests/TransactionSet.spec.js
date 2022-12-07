import tap from "tap";
import * as main from "./../dist/main.js";
import pkg from "../package.json" assert { type: 'json' };

const { TransactionSet } = main;

const { name: pkgName } = pkg;

function historyToJson(history) {
  return history.map(
    transList => Array.from(transList)
      .map(
        trans => trans.toJSON(false)
      )
  )
}

tap.test(pkgName, (suite) => {
  suite.test('transact', (txTest) => {

    txTest.test('TransactionSet', (tsTest) => {
      tsTest.test('basic change', (basicTest) => {
        const points = [];
        let ts = new TransactionSet(
          {
            handlers: {
              addPoint: (trans, point) => {
                points.push(point);
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

        basicTest.same(historyToJson(history),
          [
            [],
            [
              {
                "action": "addPoint",
                "params": [{
                  "x": 1,
                  "y": 2,
                }],
              },
            ],
            [],
          ]);
        basicTest.same(points, [{ x: 1, y: 2 }]);
        basicTest.notOk(complete);
        basicTest.end();
      });
      tsTest.test('nested action', (nestedTest) => {
        const points = [];
        let nextId = 100;
        let ts = new TransactionSet(
          {
            handlers: {
              newPoint() {
                let point = { x: 0, y: 0, id: ++nextId };
                points.push(point);
                return point;
              },
              setPointCoord(trans,  ...args ) {
                const [{ id, field, value }] = args;
                let point = points.find((p) => p.id === id);
                point[field] = value;
              },
              addPoint(trans, point) {
                const newPoint = trans.transactionSet.do('newPoint');

                Object.keys(point).forEach((field) => {
                  const value = point[field];
                  trans.transactionSet.do(
                    'setPointCoord',
                    { id: newPoint.id, field, value }
                  );
                })
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

        nestedTest.same(
          historyToJson(history),
          [[],
            [{
              "action": "addPoint",
              "params": [{
                "x": 1,
                "y": 2
              }]
            }],
            [{
              "action": "addPoint",
              "params": [{
                "x": 1,
                "y": 2
              }]
            },
              { "action": "newPoint", params: [] }],
            [{
              "action": "addPoint",
              "params": [{
                "x": 1,
                "y": 2
              }]
            }],
            [{
              "action": "addPoint",
              "params": [{
                "x": 1,
                "y": 2
              }]
            },
              {
                "action": "setPointCoord",
                "params": [{
                  "id": 101,
                  "field": "x",
                  "value": 1
                }]
              }],
            [{
              "action": "addPoint",
              "params": [{
                "x": 1,
                "y": 2
              }]
            }],
            [{
              "action": "addPoint",
              "params": [{
                "x": 1,
                "y": 2
              }]
            },
              {
                "action": "setPointCoord",
                "params": [{
                  "id": 101,
                  "field": "y",
                  "value": 2
                }]
              }],
            [{
              "action": "addPoint",
              "params": [{
                "x": 1,
                "y": 2
              }]
            }],

            []]
        );
        nestedTest.same(points, [{ id: 101, x: 1, y: 2 }]);
        nestedTest.notOk(complete);
        nestedTest.end();
      });

      tsTest.test('async change', async (asyncTest) => {
        const points = [];
        let ts = new TransactionSet(
          {
            handlers: {
              addPoint: async (trans, point) => {
                await Promise.resolve(null);
                points.push(point);
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

        let promise = ts.do('addPoint', { x: 1, y: 2 });

        asyncTest.same(historyToJson(history), [
          [],
          [
            {
              "action": "addPoint",
              "params": [{
                "x": 1,
                "y": 2,
              }],
            },
          ]
        ]);
        asyncTest.same(points, []);

        await promise;
        asyncTest.same(
          historyToJson(history),
          [
            [],
            [
              {
                "action": "addPoint",
                "params": [{
                  "x": 1,
                  "y": 2,
                }],
              },
            ],
            []
          ]);
        asyncTest.same(points, [{ x: 1, y: 2 }]);
        asyncTest.notOk(complete);
        asyncTest.end();
      });

      tsTest.test('action with error', (errTest) => {
        const points = [];
        let ts = new TransactionSet(
          {
            handlers: {
              addPoint: (trans, point) => {
                if (!('x' in point && 'y' in point)) {
                  throw new Error('Bad Point');
                }
                points.push(point);
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
        });

        let e = null;
        ts.do('addPoint', { x: 1, y: 2 });
        try {
          ts.do('addPoint', { x: 2, z: 3 });
        } catch (err) {
          e = err;
        }
        ts.do('addPoint', { x: 4, y: 8 });

        errTest.same(e.message, 'Bad Point');
        errTest.same(points, [
          { x: 1, y: 2 },
          { x: 4, y: 8 }
        ]);
        errTest.same(
          historyToJson(history),
          [
            [],
            [{ "action": "addPoint", "params": [{ "x": 1, "y": 2 }] }],
            [],
            [{ "action": "addPoint", "params": [{ "x": 2, "z": 3 }] }],
            [],
            [{ "action": "addPoint", "params": [{ "x": 4, "y": 8 }] }],
            []
          ]
        );
        errTest.end();
      });

      tsTest.end();
    });

    txTest.end();
  });

  suite.end();
})
