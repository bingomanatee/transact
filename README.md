# @wonderlandlabs/transact

Transact is a state utility that lets you journal activity and regress it on any thrown errors. 

It is designed to externalize a complicated aspect of @wonderlandlabs/forest but should be suitable for any "quasi-atomic" scenario
in which this sort of flow control is needed. 

## Creating a TransactionSet

TransactionSets are the "controller" for transactional flow.

The TransactionSet itself is an RXJS BehaviorSubject, that emit all *pending* transactions
as actions are processed -- inside a Set instance; the impact being, you can throttle changes to your view layer
to only occur when the TransactionSet's current value is a set whose size === 0. 

```javascript

const ts = new TransactionSet({
  handers: {
    addItem(trans, item) { ...},
    removeItem(trans, item) {...}
  }
});

const viewSub = ts.subscribe({
  next(pending) {
    if (pending.size === 0) {
      updateView();
    }
  },
  error() {}
})

```

or, using RxJS, 

```javascript
import { filter } from 'rxjs/operators';  

ts.pipe(filter((pending) => pending.size === 0)).subscribe({
  next() {
    updateView();
  },
  error() {}
})

```

<small>**note**: its always best to have an error listener every time you
subscribe to an RXJS observable. In theory TransactionSets should not error out,
but in the odd event they do, its good to have the hook in place</small>

### TransactionSet Handlers

Currently the only argument to TransactionSet is an object with `{handlers}`; 
handlers is a POJO with "do" functions attached to it. 

A very simple example of handlers in action for a simple "array value manager" 
might be:

```javascript

let values = [];
const ts = new TransactionSet({
   handlers: {
     add(trans) {
       const {params: value} = trans;
       values = [...values, value];
     },
      remove(trans) {
         const {params: value} = trans;
         values = values.filter((item) => item !== value);
      }
   }
});

ts.subscribe((pending) => {
  if (pending.size === 0) {
    console.log('values are', values);
  }
});

// 'values are', [];
ts.do('add', 3);
// 'values are', [3];
ts.do('add', 60);
// 'values are', [3, 60];
t.do('remove', 3);
// 'values are', [60];

```

## What the TransactionSet does *not* do

TransactionSets by design to not have any facility to store or manage data, state,
or anything having to do with DOM. They are purely event coordination managers. 
It is **up to the user to ensure that their "do" hooks properly manage their stores/
local data systems properly.

## Flow of Control

In general TransactionSets work best with *synchronous* methods; jamming up transactional 
flow with async/generators can result in long pauses in your view layer or other bad
user experiences. However, in an attempt to be as flexible as possible, the TransactionSet
accepts both async functions and generators -- as well as async generators. (Yea that's a thing.)
The reason is that in general you don't want to jam up your application with pending transactions longer
than necessary. 

I.e., just because you *can* write async handlers doesn't mean you *should*. Reason being, if you 
suspend a transObj's update cycle during the lifespan of an async function, your app freezes, 
and that is rarely a desirable outcome. 

### TransactionSet emission

TransactionSet emits the pending transactions every time 
* a transObj is added to the pending transObj set
* a pending transactions' state is changed
* a transObj is removed from pending queue

closed/failed transactions are removed from the queue before the pending set is emitted. 

The transactions in an emitted set should be ordered in ascending order; but when in doubt,
each transObj as an integral ID that reflects the order of transObj creation. 

### Basic (synchronous) Flow Control

Assuming your "do" handlers are all synchronous functions the flow of activity around 
the calling of a single do method is as follows:

1. `myTransactionSet.do('actionName', arguments?)` is called
2. A new Transaction with the arguments to `do()` embedded in it. 
3. `myTransactionSet.preSubject.net(trans)` is emitted, to enable any shared "pre-action" preparation. (1).
4. A new set with all current pending transactions AND the new one from step 2. is emitted \
   from your transactionSet
5. `myTransaction.perform(handler)` is executed, The handler is the one defined  \
   to handle a specific named action. 
   * The output of the handler (if any) is embedded into the transactions' "result" field. 
   * The transObj is set to state: closed
   * the `transactionState.updateTrans(trans)` removes the closed transObj from the queue
   * The new pending transactions (less the current one) are emitted from the TransactionSet. 

## Error Handling inside action execution

Transactions can be "closed" without causing errors to be thrown. 
Any errors thrown by a handler or pre/post hook will be captured into
a transactions' response and thrown after the transObj has been 
processed.

### Errors / closed transactions from the preSubject hook 

An error throw (or captured in a failed transObj) by a preSubject
hook will cause the handler to be skipped, and be set as the transactions'
result; the transObj will be marked as `state:failed`, but the 
postSubject will still receive the transObj.

Similarly, closing a transObj in the preSubject listener will also
cause the handler to be skipped, but postSubject hooks will still
receive the transObj. 

Therefore, when writing postSubject hooks, be prepared to receive 
failed/closed transactions and don't assume they passed through the 
hook. (the 'handled' property of a transObj indicates that the 
transObj reached the `perform` hook. )

in both cases *nothing will be emitted from the transactionSet; the 
presumption is that the lack of execution of the actual handler
means no change will be enacted, and any partial work done by the
preSubject hook(s) will be reset by the postSubject hook. 

### Errors / closed transactions from handlers

Errors thrown by handler hooks will be set as the transactions' result
and the transObj will be marked as state:failed. 

You can write a "rescue" hook that responds to any thrown error; instead of a 
single function you can define a handler response as `[handleFn, onErrorFn]` or 
`{next: handleFn, error: errorFn}` (the RxJS listener signature). 

in both cases the error function accepts `(error, trans)`. If a handler has a 
"rescue" function, the error is thrown only if *the error hook* itself fails. 

### Errors in postSubject hooks

Errors in postSubject hooks are for the most part treated as errors in handlers; 
they are to be avoided whenever possible. 

### Multiple Transaction Sets 

You can have more than one in your application if necessary, but *all actions that you want to synchronize transactionally
must be managed by the same transObj set. For instance, you may have one transObj
set for sending data back and forth to your APIs and a second one for managing a particular 
client side form. But an error in your API TransactionSet won't cause your form TransactionSet to 
register an error (unless you do so manually), or vice versa. 

________
(1) it is not required that you have any listeners to preSubject/postSubject.
