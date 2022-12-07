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

function observe(ts) {
  let history = [];
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
  return { history, complete };
}

tap.test(pkgName, (suite) => {

  suite.test('TransactionSet', (tsTest) => {
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


      const { history, complete } = observe(ts);

      ts.do('addPoint', { x: 1, y: 2 });

      basicTest.same(
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
              state: 'closed'
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
            setPointCoord(trans, ...args) {
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
            }],
            state: 'closed'
          }],
          [{
            "action": "addPoint",
            "params": [{
              "x": 1,
              "y": 2
            }],
            state: 'closed'
          },
            {
              "action": "newPoint", params: [],
              state: 'closed'
            }],
          [{
            "action": "addPoint",
            "params": [{
              "x": 1,
              "y": 2
            }],
            state: 'closed'
          }],
          [{
            "action": "addPoint",
            "params": [{
              "x": 1,
              "y": 2
            }],
            state: 'closed'
          },
            {
              "action": "setPointCoord",
              "params": [{
                "id": 101,
                "field": "x",
                "value": 1
              }],
              state: 'closed'
            }],
          [{
            "action": "addPoint",
            "params": [{
              "x": 1,
              "y": 2
            }],
            state: 'closed'
          }],
          [{
            "action": "addPoint",
            "params": [{
              "x": 1,
              "y": 2
            }],
            state: 'closed'
          },
            {
              "action": "setPointCoord",
              "params": [{
                "id": 101,
                "field": "y",
                "value": 2
              }],
              state: 'closed'
            }],
          [{
            "action": "addPoint",
            "params": [{
              "x": 1,
              "y": 2
            }],
            state: 'closed'
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
            state: 'new'
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
              state: 'closed'
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
      const { history } = observe(ts);

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
          [{
            "action": "addPoint", "params": [{ "x": 1, "y": 2 }],
            state: 'closed'
          }],
          [],
          [{
            "action": "addPoint", "params": [{ "x": 2, "z": 3 }],
            state: 'failed'
          }],
          [],
          [{
            "action": "addPoint", "params": [{ "x": 4, "y": 8 }],
            state: 'closed'
          }],
          []
        ]
      );
      errTest.end();
    });
    tsTest.test('pre/post listeners', (ppl) => {
      let number = 0;

      const ts = new TransactionSet({
        handlers: {
          add(trans, n) {
            return number + n;
          },
          subtract(trans, n) {
            return number - n;
          },
          multiply(trans, n) {
            return number * n;
          },
          divide(trans, n) {
            return number / n;
          }
        },
        pre: [
          (trans) => {
            trans.meta.set('number', number);
          },
          (trans) => {
            if (isNaN(trans.params[0])) {
              trans.result = Error('non-numeric input');
              trans.state = 'failure';
            }
            trans.params[0] = Math.floor(trans.params[0]);
          }
        ],
        post: [
          (trans) => {
            console.log('--- post: test number', trans.result, 'in trans', trans.toJSON());
            if (isNaN(trans.result) || !Number.isFinite(trans.result)) {
              trans.state = 'failed';
              console.log('state set to failed');
            }
          },
          (trans) => {
            console.log('--- post: trans: ', trans.toJSON());
            if (trans.state === 'failed') {
              trans.result = trans.meta.get('number');
            }
          }
        ]
      });

      const { history } = observe(ts);

      number = ts.do('add', Math.PI);
      ppl.same(number, 3);

      try {
        number = ts.do('divide', 0);
      } catch (err) {
        console.log('error got:', err);
      }
      ppl.same(number, 3);

      number = ts.do('subtract', 10);
      ppl.same(number, -7);

      ppl.same(
        historyToJson(history),
        [
          [],
          [{
            "action": "add",
            "params": [3],
            "state": "closed",
            "meta": [["number", 0]]
          }],
          [],
          [{ "action": "divide", "params": [0], "state": "failed", "meta": [["number", 3]] }],
          [],
          [{ "action": "subtract", "params": [10], "state": "closed", "meta": [["number", 3]] }],
          []
        ]
      )

      ppl.end();
    });

    tsTest.end();
  });

  suite.end();
})
