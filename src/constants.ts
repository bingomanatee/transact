export enum ACTIONS {
  perform = 'PER', // execute: 'action' must be a function; will accept the transObj as sn argument
  create = 'CRE', // insert a new element
  delete = 'DEL', // remove an element
  set = 'SET', // change an elements property
  update = 'UPDATE', // change the action of a property
}

export enum TRANS_STATES {
  new = 'new',
  validated = 'validated',
  expanded = 'expanded',
  closed = 'closed',
  failed = 'failed',
  performed = 'performed',
}

export const END_STATES = [
  TRANS_STATES.closed,
  TRANS_STATES.failed,
]
