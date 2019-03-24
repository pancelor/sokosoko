//
// globals
//

let gameHistory;
let historyCursor;
let currentEpoch;

//
// history / undo
//

function InitHistory() {
  gameHistory = []
  historyCursor = 0
}

function RecordChange(delta) {
  // delta has shape: {id: <actor id>, before: {...}, after: {...}}
  // things name 'pos' are treated specially
  currentEpoch.push(delta)
}

function StartEpoch() {
  // call this before the player gets control
  currentEpoch = []
}

function EndEpoch() {
  // call this after gravity is over
  const events = collateEpoch(currentEpoch)

  if (events.length === 0) { return }

  gameHistory.length = historyCursor
  gameHistory.push(events)
  historyCursor += 1
}

function collateEpoch(buffer) {
  // collates records with the same id together; see testCollateEpoch
  const seen = new Map()
  const res = []
  const resIndex = 0
  for (const delta of buffer) {
    const id = delta.id
    let ix
    if (seen.has(id)) {
      ix = seen.get(id)
      assert(res[ix].id === delta.id, "id mismatch")
      res[ix].before = {
        ...delta.before,
        ...res[ix].before, // the pre-existing delta takes precedence
      }
      res[ix].after = {
        ...res[ix].after,
        ...delta.after, // now the new delta takes precedence
      }
    } else {
      ix = res.length
      res.push(delta)
      seen.set(id, ix)
    }
  }
  return res
}

function testCollateEpoch1() {
  const buffer = [
    {id: 1, before: { x: 1 }, after: { x: 2 }},
    {id: 2, unrelatedStuff: true},
    {id: 1, before: { x: 2 }, after: { x: 3 }},
  ]
  const newBuffer = collateEpoch(buffer)
  assert(newBuffer.length === 2)
  assertObjMatch(newBuffer[0], {id: 1, before: { x: 1 }, after: { x: 3 }})
  assertObjMatch(newBuffer[1], {id: 2, unrelatedStuff: true})
} testCollateEpoch1()

function testCollateEpoch2() {
  const buffer = [
    {id: 1, before: { x: 1 }, after: { x: 2 }},
    {id: 1, before: { y: 10 }, after: { y: 11 }},
  ]
  const newBuffer = collateEpoch(buffer)
  assert(newBuffer.length === 1)
  assertObjMatch(newBuffer[0], {id: 1, before: { x: 1, y: 10 }, after: { x: 2, y: 11 }})
} testCollateEpoch2()

function testCollateEpoch3() {
  const buffer = [
    {id: 1, before: { x: 1 }, after: { x: 2 }},
    {id: 1, before: { x: 2, y: 10 }, after: { x: 3, y: 11 }},
  ]
  const newBuffer = collateEpoch(buffer)
  assert(newBuffer.length === 1)
  assertObjMatch(newBuffer[0], {id: 1, before: { x: 1, y: 10 }, after: { x: 3, y: 11 }})
} testCollateEpoch3()

function logHistory() {
  console.log(historyToString())
}

function historyToString(join=true) {
  // returns a yaml-ish string; made for human debugging purposes
  const lines = []
  for (const e of gameHistory) {
    lines.push("---");
    lines.push(...epochToString(e, false));
  }
  return join ? lines.join('\n') : lines
}

function epochToString(e, join=true) {
  const lines = []
  for (const {id, before, after} of e) {
    lines.push(`    ${getActorId(id).constructor.name}#${id}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`)
  }
  return join ? lines.join('\n') : lines
}

function Undo() {
  if (checkRealWin()) { return }
  if (historyCursor <= 0) { return }
  historyCursor -= 1
  const e = gameHistory[historyCursor]
  for (const { id, before, after } of e) {
    const a = getActorId(id)
    for (const prop of Object.keys(after)) {
      if ([Pos, Frame].includes(a[prop].constructor)) { // TODO: hacky
        assert(a[prop].equals(after[prop]), `undo error on ${a.serialize()} on prop ${prop}`)
      } else {
        assertEqual(a[prop], after[prop], `undo error on ${a.serialize()} on prop ${prop}`)
      }
    }
    Object.assign(a, before)
  }
  Raf()
}

function Redo() {
  if (checkRealWin()) { return }
  if (historyCursor >= gameHistory.length) { return }
  const e = gameHistory[historyCursor]
  historyCursor += 1
  for (const { id, before, after } of e) {
    const a = getActorId(id)
    for (const prop of Object.keys(before)) {
      if ([Pos, Frame].includes(a[prop].constructor)) { // TODO: hacky
        assert(a[prop].equals(before[prop]), `redo error on ${a.serialize()} on prop ${prop}: expected ${before[prop].serialize()}; got ${a[prop].serialize()}`)
      } else {
        assertEqual(a[prop], before[prop], `redo error on ${a.serialize()} on prop ${prop}`)
      }
    }
    Object.assign(a, after)
  }
  Raf()
}
