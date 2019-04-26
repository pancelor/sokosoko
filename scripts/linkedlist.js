function cons(data, list) {
  return { data, parent: list }
}

function loopProtection(node, cb) {
  if (node.iting) return [true, null]
  node.iting = true
  const res = cb()
  node.iting = false

  return [false, res]
}

function append(list, data) {
  if (list === null) return cons(data, null)
  let [loop, par] = loopProtection(list, () => {
    return append(list.parent, data)
  })
  if (loop) throw new Error("Can't append to a loop")
  return cons(list.data, par)
}

function concat(listA, listB) {
  if (listA === null) return listB
  let [loop, par] = loopProtection(listA, () => {
    return concat(listA.parent, listB)
  })
  if (loop) throw new Error("Can't concat to a loop")
  return cons(listA.data, par)
}

function length(list) {
  if (list === null) return 0
  let [loop, par] = loopProtection(list, () => {
    return length(list.parent)
  })
  if (loop) return Infinity
  return 1 + par
}

function lshow(node, n=100) {
  if (node === null) return "null"

  let [loop, par] = loopProtection(node, () => {
    assert(n > 0, "real (but undetected) infinite loop in lshow")
    return lshow(node.parent, n-1)
  })
  if (loop) return `<loop->${node.data}>`
  return `(cons ${node.data} ${par})`
}

function equals(listA, listB, cmp=(a,b)=>a===b) {
  const aNull = listA === null
  const bNull = listB === null
  if (aNull && bNull) return true
  if (aNull !== bNull) return false
  assert(!aNull && !bNull)

  if (!cmp(listA.data, listB.data)) return false

  if (listA.iting) return listB.iting
  if (listB.iting) return listA.iting // always false
  listA.iting = true
  listB.iting = true
  const res = equals(listA.parent, listB.parent)
  listA.iting = false
  listB.iting = false
  return res
}

function makeLoop(list) {
  // points the last element of list to list
  if (list === null) return null
  let node = list
  while (node.parent) {
    node = node.parent
  }
  node.parent = list
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

  const loop = concat(l1, null); makeLoop(loop)
  assert(equals(l1, l2)) // didnt mutate l1
  assertEqual(lshow(loop), "(cons 2 (cons 4 (cons 7 <loop->2>)))")
  expectError(() => append(loop, 5), "Can't append to a loop")
  expectError(() => concat(loop, null), "Can't concat to a loop")
  assertEqual(length(loop), Infinity)
  assert(!equals(loop, l1))
  assert(!equals(loop, null))
  assert(!equals(l0, loop))
  assert(!equals(l1, loop))
  assert(!equals(l2, loop))
  assert(!equals(l3, loop))
  assert(!equals(l4, loop))

  const loop1 = cons(6, cons(7, null)); makeLoop(loop1)
  const loop2 = cons(6, cons(7, cons(8, null))); makeLoop(loop2)
  const loop3 = cons(6, cons(7, cons(6, cons(7, null)))); makeLoop(loop3)
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

  assertEqual(makeLoop(null), null)
})
