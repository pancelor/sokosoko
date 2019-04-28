// these two are pretty much the only functions that know that data is a mini;
// everything else is an abstract linked list with loop support
function serFrame(list) {
  const {nonLoopPart, loopPart} = splitOnLoop(list)
  if (!loopPart) {
    return serFrame_(nonLoopPart)
  } else {
    return `${serFrame_(loopPart)} <LOOP> ${serFrame_(nonLoopPart)}`
  }
}
function serFrame_(list) {
  // assert list has no loops
  if (list === null) return "<null>"
  const color = innerRoom(list).name
  const id = list.data.id || "-"

  return `${serFrame_(list.parent)} | ${color}#${id}`
}

function innerRoom(node) {
  const { data } = node
  if (data.constructor === Room) {
    assert(!node.parent)
    return data
  } else {
    assert(data)
    assert(data.constructor === Mini)
    return data.innerRoom
  }
}

//
//
// everything below here knows nothing about what data is; it could be anything
//
//

function cons(data, list) {
  return { data, parent: list }
}

function loopProtection(node, cb) {
  if (node.iting) return [node, null]
  node.iting = true
  const res = cb()
  node.iting = false

  return [false, res]
}

function includes(list, target) {
  if (list === null) return false
  if (list.data === target) return list
  const [loop, par] = loopProtection(list, () => {
    return includes(list.parent, target)
  })
  return par
}

function append(list, data) {
  if (list === null) return cons(data, null)
  const [loop, par] = loopProtection(list, () => {
    return append(list.parent, data)
  })
  if (loop) throw new Error("cannot call 'append' on a loop")
  return cons(list.data, par)
}

function concat(listA, listB) {
  if (listA === null) return listB
  const [loop, par] = loopProtection(listA, () => {
    return concat(listA.parent, listB)
  })
  if (loop) throw new Error("cannot call 'concat' on a loop")
  return cons(listA.data, par)
}

function length(list) {
  if (list === null) return 0
  const [loop, par] = loopProtection(list, () => {
    return length(list.parent)
  })
  if (loop) return Infinity
  return 1 + par
}

function fromArray(arr, rev=false) {
  let res = null
  for (let i = 0; i < arr.length; ++i) {
    const data = arr[rev ? arr.length - 1 - i : i]
    res = cons(data, res)
  }
  return res
}

function insertAll(list, pred, data) {
  // e.g.:
  //   const list = cons(2, cons(3, cons(4, cons(3, null))))
  //   insertAll(list, x=>x===3, 100)
  // -> cons(2, cons(3, cons(100, cons(4, cons(3, cons(100, null))))))
  // if (list === null) return null
  const {nonLoopPart, loopPart} = splitOnLoop(list)
  return concat(
    insertAll_(nonLoopPart, pred, data),
    makeLoop(insertAll_(loopPart, pred, data)))
}

function insertAll_(list, pred, data) {
  // assert list has no loops
  if (list === null) return null
  let par = insertAll_(list.parent, pred, data)
  if (pred(list.data)) {
    par = cons(data, par)
  }
  return cons(list.data, par)
}

function lshow(node) {
  if (node === null) return "null"

  const [loop, par] = loopProtection(node, () => {
    return lshow(node.parent)
  })
  if (loop) return `<loop->${node.data}>`
  return `(cons ${node.data} ${par})`
}

function equals(listA, listB, cmp=(a,b)=>a===b) {
  const {nonLoopPart: nlA, loopPart: lA} = splitOnLoop(listA)
  const {nonLoopPart: nlB, loopPart: lB} = splitOnLoop(listB)
  return equals_(nlA, nlB, cmp) && equals_(lA, lB, cmp)
}

// function reduce(list, cb) {
//   if (list === null) return null
//   const [loop, par] = loopProtection(list, () => {
//     return reduce(list.parent, cb)
//   })
//   if (loop) throw new Error("cannot call 'reduce' on a loop")
//   return cb()
// }

function equals_(listA, listB, cmp=(a,b)=>a===b) {
  // assert neither listA nor listB has a loop

  const aNull = (listA === null)
  const bNull = (listB === null)
  if (aNull && bNull) return true
  if (aNull !== bNull) return false
  assert(!aNull && !bNull)

  if (!cmp(listA.data, listB.data)) return false

  assert(!listA.iting)
  assert(!listB.iting)
  listA.iting = true
  listB.iting = true
  const res = equals_(listA.parent, listB.parent, cmp)
  listA.iting = false
  listB.iting = false
  return res
}

function extractLoop(list) {
  return splitOnLoop(list).loopPart
}
function extractNonLoop(list) {
  return splitOnLoop(list).nonLoopPart
}

function splitOnLoop(list) {
  // returns { nonLoopPart, loopPart }
  // neither of these are loops; they are both normal linked lists
  const flattened = []
  const atlas = new Map()
  let node = list
  let i
  for (i = 0; i < 1000; ++i) {
    if (!node) break
    if (atlas.has(node)) break
    atlas.set(node, i)
    flattened.push(node.data)
    node = node.parent
  }
  if (i >= 1000) throw new Error("inf loop")
  let nonLoopPart = null
  let loopPart = null
  const iStop = node ? atlas.get(node) : flattened.length
  for (let i = flattened.length-1; i >= 0; --i) {
    if (i >= iStop) loopPart = cons(flattened[i], loopPart)
    else nonLoopPart = cons(flattened[i], nonLoopPart)
  }
  return { nonLoopPart, loopPart }
}

function makeLoop(list) {
  // points the last element of list to list
  if (list === null) return null
  // const [loop, par]
  let node = list
  while (node.parent) {
    node = node.parent
  }
  node.parent = list
  return list
}

RegisterTest("linkedlist", () => {
  //
  // normal list stuff
  //

  // make sure append and concat are nondestructive
  const l0 = null
  const l1 = cons(2, cons(4, cons(7, null)))
  const l2 = cons(2, cons(4, cons(7, null)))
  const l3 = append(l2, 5)
  const l4 = concat(l1, l3)
  assertEqual(lshow(l0), "null")
  assertEqual(lshow(l1), "(cons 2 (cons 4 (cons 7 null)))")
  assertEqual(lshow(l3), "(cons 2 (cons 4 (cons 7 (cons 5 null))))")
  assertEqual(lshow(l4), "(cons 2 (cons 4 (cons 7 (cons 2 (cons 4 (cons 7 (cons 5 null)))))))")

  assertEqual(length(l0), 0)
  assertEqual(length(l1), 3)
  assertEqual(length(l2), 3)
  assertEqual(length(l3), 4)
  assertEqual(length(l4), 7)

  assert( equals(l0, l0))
  assert(!equals(l0, l1))
  assert(!equals(l0, l2))
  assert(!equals(l0, l3))
  assert(!equals(l0, l4))

  assert(!equals(l1, l0))
  assert( equals(l1, l1))
  assert( equals(l1, l2))
  assert(!equals(l1, l3))
  assert(!equals(l1, l4))

  assert(!equals(l3, l0))
  assert(!equals(l3, l1))
  assert(!equals(l3, l2))
  assert( equals(l3, l3))
  assert(!equals(l3, l4))

  assert(!equals(l4, l0))
  assert(!equals(l4, l1))
  assert(!equals(l4, l2))
  assert(!equals(l4, l3))
  assert( equals(l4, l4))

  // edge cases
  assert(equals(
    concat(null, null),
    null))
  assert(equals(
    concat(cons(1, null), null),
    cons(1, null)))
  assert(equals(
    concat(null, cons(1, null)),
    cons(1, null)))
  assert(equals(
    append(null, 1),
    cons(1, null)))

  //
  // loops
  //

  const loop = makeLoop(concat(l1, null))
  assert(equals(l1, l2)) // didnt mutate l1
  assertEqual(lshow(loop), "(cons 2 (cons 4 (cons 7 <loop->2>)))")
  expectError(() => append(loop, 5), "cannot call 'append' on a loop")
  expectError(() => concat(loop, null), "cannot call 'concat' on a loop")
  assertEqual(length(loop), Infinity)
  assert(!equals(loop, l1))
  assert(!equals(loop, null))
  assert(!equals(l0, loop))
  assert(!equals(l1, loop))
  assert(!equals(l2, loop))
  assert(!equals(l3, loop))
  assert(!equals(l4, loop))

  const loop1 = makeLoop(cons(6, cons(7, null)))
  const loop2 = makeLoop(cons(6, cons(7, cons(8, null))))
  const loop3 = makeLoop(cons(6, cons(7, cons(6, cons(7, null)))))
  assertEqual(lshow(loop1), "(cons 6 (cons 7 <loop->6>))")
  assertEqual(lshow(loop2), "(cons 6 (cons 7 (cons 8 <loop->6>)))")
  assertEqual(lshow(loop3), "(cons 6 (cons 7 (cons 6 (cons 7 <loop->6>))))")
  assert( equals(loop1, loop1))
  assert(!equals(loop1, loop2))
  assert(!equals(loop1, loop3)) // tricky

  assert(!equals(loop2, loop1))
  assert( equals(loop2, loop2))
  assert(!equals(loop2, loop3))

  assert(!equals(loop3, loop1))
  assert(!equals(loop3, loop2))
  assert( equals(loop3, loop3))

  // extractLoop
  assert(equals(extractLoop(l0), null))
  assert(equals(extractNonLoop(l0), l0))
  assert(equals(extractLoop(l1), null))
  assert(equals(extractNonLoop(l1), l1))
  assert(equals(
    extractLoop(loop1),
    cons(6, cons(7, null))))
  assert(equals(extractNonLoop(loop1), null))
  assert(equals(
    extractLoop(cons(1, makeLoop(cons(2, null)))), // 1 222...
    cons(2, null)))
  assert(equals(
    extractNonLoop(cons(1, makeLoop(cons(2, null)))), // 1 222...
    cons(1, null)))

  // tricky loops: (regression tests)
  assertEqual(makeLoop(null), null)
  assert(!equals(
    cons(1, makeLoop(cons(2, null))), // 1 222...
    makeLoop(cons(1, cons(2, null))))) // 1 21 21 21...
  assert(!equals(
    makeLoop(cons(6, cons(7, cons(0, cons(6, cons(7, null)))))), // 67067 67067 67067...
    cons(6, cons(7, cons(0, makeLoop(cons(6, cons(7, null)))))))) // 670 67 67 67...
  assert(equals( // failing
    makeLoop(cons(6, cons(7, cons(0, cons(6, cons(7, null)))))), // 67067 67067 67067...
    makeLoop(cons(6, cons(7, cons(0, cons(6, cons(7, null)))))))) // 67067 67067 67067...
  assert(equals(
    cons(6, cons(7, cons(0, makeLoop(cons(6, cons(7, null)))))), // 670 67 67 67...
    cons(6, cons(7, cons(0, makeLoop(cons(6, cons(7, null)))))))) // 670 67 67 67...

  // //
  // // map (tabled for now)
  // //
  // assert(equals(
  //   map(l1, x=>x*10),
  //   cons(20, cons(40, cons(70, null)))))
  // assert(equals(l1, l2)) // didn't mutate l1

  // // failing:
  // const expected = cons(30, makeLoop(cons(60, cons(70, null))))
  // const actual = map(cons(3, loop1), x=>x*10)
  // console.log(lshow(expected))
  // console.log(lshow(actual))
  // assert(equals(
  //   actual,
  //   expected))
})
RegisterTest("linkedlist insertAll", () => {
  const list = cons(2, cons(3, cons(4, cons(3, null))))
  const backup = concat(list, null)
  const actual = insertAll(list, x=>x===3, 100)
  const expected = cons(2, cons(3, cons(100, cons(4, cons(3, cons(100, null))))))
  assert(equals(actual, expected))

  assert(equals(
    insertAll(null, ()=>true, 100),
    null))
  assert(equals(
    insertAll(list, ()=>false, 100),
    list))
  assert(equals(list, backup))
})
RegisterTest("linkedlist insertAll on loop", () => {
  const loop = cons(3, cons(1, cons(3, makeLoop(cons(3, cons(4, null))))))
  const actual = insertAll(loop, x=>x===3, 100)
  const expected = cons(3, cons(100, cons(1, cons(3, cons(100, makeLoop(cons(3, cons(100, cons(4, null)))))))))
  assert(equals(actual, expected))
})
RegisterTest("linkedlist includes", () => {
  assert(!includes(null, 3), false)
  assert(!includes(cons(1, null), 3), false)
  assert(includes(cons(3, null), 3))

  assert(equals(
    includes(cons(1, cons(3, cons(5, null))), 3),
    cons(3, cons(5, null))))

  const loop = cons(1, cons(3, makeLoop(cons(4, cons(5, null)))))
  assert(equals(
    includes(loop, 4),
    makeLoop(cons(4, cons(5, null)))))
  assert(equals(
    includes(loop, 5),
    makeLoop(cons(5, cons(4, null)))))
})
RegisterTest("linkedlist fromArray", () => {
  assert(equals(
    fromArray([]),
    null))
  assert(equals(
    fromArray([1]),
    cons(1, null)))
  assert(equals(
    fromArray([1, 2, 3]),
    cons(3, cons(2, cons(1, null)))))
  assert(equals(
    fromArray([1, 2, 3], true),
    cons(1, cons(2, cons(3, null)))))
})
