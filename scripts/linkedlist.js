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

  let [loop, par] = loopProtection(listA, () => {
    return equals(listA.parent, listB.parent)
  })
  if (loop) return false // TODO
  return par
}

function createLoop(list) {
  // points the last element of list to loopPoint
  assert(list)
  let node = list
  while (node.parent) {
    node = node.parent
  }
  node.parent = list
}

RegisterTest("linkedlist", () => {
  // normal list stuff
  // also, make sure append and concat are nondestructive
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

  // loops
  const loop = concat(l1, null)
  createLoop(loop)
  assert(equals(l1, l2)) // didnt mutate l1
  assertEqual(lshow(loop), "(cons 2 (cons 4 (cons 7 <loop->2>)))")
  expectError(() => append(loop, 5), "Can't append to a loop")
  expectError(() => concat(loop, null), "Can't concat to a loop")
  assertEqual(length(loop), Infinity)
  assert(!equals(loop, l1))
  assert(!equals(loop, null))
  assert( equals(loop, loop))
})
