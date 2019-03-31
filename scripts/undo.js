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
  currentEpoch.half1.push(delta)
}

function PlayAndRecordSound(sound) {
  playSound(sound)
  RecordSound(sound.id)
}

function RecordSound(id) {
  currentEpoch.sounds.push(id)
}

function StartEpoch() {
  // call this before the player gets control
  currentEpoch = { half1: [], sounds: [] }
}

function EndEpoch() {
  // call this after gravity is over
  const epoch = collateEpoch(currentEpoch)

  if (epoch.half1.length === 0 && epoch.sounds.length === 0) { return epoch }

  gameHistory.length = historyCursor
  gameHistory.push(epoch)
  historyCursor += 1
  return epoch // might be useful to inspect, but not necessary
}

function propEqual(p1, p2) {
  // TODO: hacky
  if (p1 && [MapPos, RoomPos, Frame].includes(p1.constructor)) {
    return p1.equals(p2)
  } else {
    return p1 === p2
  }
}

function collateEpoch(epoch) {
  epoch = collateEpoch1(epoch)
  epoch = collateEpoch2(epoch)
  return epoch
}

function collateEpoch1(epoch) {
  // collates records with the same id together; see testCollateEpoch
  const seen = new Map()
  const res = []
  const resIndex = 0
  for (const delta of epoch.half1) {
    const id = delta.id
    let ix
    if (seen.has(id)) {
      ix = seen.get(id)
      assertEqual(res[ix].id, delta.id)
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
  return { half1: res, sounds: epoch.sounds }
}

function collateEpoch2(epoch) {
  // remove records without any actual change
  // this might happen if an object moves and then moves back to its starting position
  const res = []
  for (const {id, before, after} of epoch.half1) {
    const newBefore = objFilter(before, (k, v) => !propEqual(v, after[k]))
    const newAfter = objFilter(after, (k, v) => !propEqual(v, before[k]))
    const nBefore = Object.keys(newBefore).length
    const nAfter = Object.keys(newAfter).length
    if (nBefore === 0 && nAfter === 0) { continue }
    res.push({id, before: newBefore, after: newAfter})
  }
  return { half1: res, sounds: epoch.sounds }
}
RegisterTest("collateEpoch 0", () => {
  const epoch = { half1: [], sounds: ["fooSoundId"] }
  const { half1, sounds } = collateEpoch(epoch)
  assertEqual(half1.length, 0)
  assertEqual(sounds.length, 1)
  assertEqual(sounds[0], "fooSoundId")
})
RegisterTest("collateEpoch 1", () => {
  const epoch = { half1: [
    {id: 1, before: { x: 1 }, after: { x: 2 }},
    {id: 2, before: { y: 8 }, after: { y: 9 }},
    {id: 1, before: { x: 2 }, after: { x: 3 }},
  ]}
  const { half1 } = collateEpoch(epoch)
  assertEqual(half1.length, 2)
  assertObjEqual(half1[0], {id: 1, before: { x: 1 }, after: { x: 3 }})
  assertObjEqual(half1[1], {id: 2, before: { y: 8 }, after: { y: 9 }})
})
RegisterTest("collateEpoch 2", () => {
  const epoch = { half1: [
    {id: 1, before: { x: 1 }, after: { x: 2 }},
    {id: 1, before: { y: 10 }, after: { y: 11 }},
  ]}
  const { half1 } = collateEpoch(epoch)
  assertEqual(half1.length, 1)
  assertObjEqual(half1[0], {id: 1, before: { x: 1, y: 10 }, after: { x: 2, y: 11 }})
})
RegisterTest("collateEpoch 3", () => {
  const epoch = { half1: [
    {id: 1, before: { x: 1 }, after: { x: 2 }},
    {id: 1, before: { x: 2, y: 10 }, after: { x: 3, y: 11 }},
  ]}
  const { half1 } = collateEpoch(epoch)
  assertEqual(half1.length, 1)
  assertObjEqual(half1[0], {id: 1, before: { x: 1, y: 10 }, after: { x: 3, y: 11 }})
})
RegisterTest("collateEpoch 4", () => {
  const epoch = { half1: [
    {id: 1, before: { x: 1 }, after: { x: 1 }},
  ]}
  const { half1 } = collateEpoch(epoch)
  assertEqual(half1.length, 0)
})
RegisterTest("collateEpoch 5", () => {
  const epoch = { half1: [
    {id: 1, before: { x: 1 }, after: { x: 1, y: 2 }},
  ]}
  const { half1 } = collateEpoch(epoch)
  assertEqual(half1.length, 1)
  assertObjEqual(half1[0], {id: 1, before: {}, after: { y: 2 }})
})
RegisterTest("collateEpoch 6", () => {
  const epoch = { half1: [
    {id: 1, before: {}, after: { dead: true }},
  ]}
  const { half1 } = collateEpoch(epoch)
  assertEqual(half1.length, 1)
  assertObjEqual(half1[0], epoch.half1[0])
})
RegisterTest("collateEpoch 7", () => {
  const epoch = { half1: [
    {id: 1, before: {}, after: { dead: true }}
  ]}
  const { half1 } = collateEpoch(epoch)
  assertEqual(half1.length, 1)
  assertObjEqual(half1[0], epoch.half1[0])
})
RegisterTest("collateEpoch 8", () => {
  const epoch = { half1: [
    {id: 1, before: { dead: true }, after: {}}
  ]}
  const { half1 } = collateEpoch(epoch)
  assertEqual(half1.length, 1)
  assertObjEqual(half1[0], epoch.half1[0])
})

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
  for (const {id, before, after} of e.half1) {
    lines.push(`    ${getActorId(id).constructor.name}#${id}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`)
  }
  for (const id of e.sounds) {
    lines.push(`    > ${id}`)
  }
  return join ? lines.join('\n') : lines
}

function Undo() {
  if (checkWin()) { return }
  if (historyCursor <= 0) { return }
  historyCursor -= 1
  const e = gameHistory[historyCursor]

  // undo changes
  for (const { id, before, after } of e.half1) {
    const a = getActorId(id)
    for (const prop of Object.keys(after)) {
      assert(propEqual(a[prop], after[prop]), `undo error on ${serialize(a)} on prop ${prop}: expected ${serialize(after[prop])}; got ${serialize(a[prop])}`)
    }
    Object.assign(a, before)
  }

  // play sounds
  playSound(sndUndo)

  Raf()
}

function Redo() {
  if (checkWin()) { return }
  if (historyCursor >= gameHistory.length) { return }
  const e = gameHistory[historyCursor]
  historyCursor += 1

  // redo changes
  for (const { id, before, after } of e.half1) {
    const a = getActorId(id)
    for (const prop of Object.keys(before)) {
      assert(propEqual(a[prop], before[prop]), `redo error on ${serialize(a)} on prop ${prop}: expected ${serialize(before[prop])}; got ${serialize(a[prop])}`)
    }
    Object.assign(a, after)
  }

  // play sounds
  for (const id of e.sounds) {
    playSound(document.getElementById(id))
  }

  Raf()
}
