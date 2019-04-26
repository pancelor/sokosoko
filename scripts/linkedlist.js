
function loopProtection(node, cb) {
  const tag = randName(10)
  assert(!node[tag], "inifinte loop in frameStack")

  this[tag] = true
  const res = cb()
  delete this[tag]

  return res
}

function lshow(node, n=100) {
  if (node === null) return "null"
  assert(n > 0, "infinite loop in lshow")
  return `(cons ${node.data} ${lshow(node.parent, n-1)})`
}

function cons(data, list) {
  return { data, parent: list }
}

function equals(listA, listB, cmp=(a,b)=>a===b) {
  const a0 = listA === null
  const b0 = listB === null
  if (a0 && b0) return true
  if (a0 !== b0) return false
  assert(!a0 && !b0)
  return cmp(listA.data, listB.data) && equals(listA.parent, listB.parent)
}

RegisterTest("linkedlist", () => {
  // normal list stuff
  const l0 = null
  const l1 = cons(2, cons(4, cons(7, null)))
  const l2 = cons(2, cons(4, cons(7, null)))
  assertEqual(lshow(l0), "null")
  assertEqual(lshow(l1), "(cons 2 (cons 4 (cons 7 null)))")
  assert( equals(l0, l0))
  assert(!equals(l0, l1))
  assert(!equals(l0, l2))
  assert(!equals(l1, l0))
  assert( equals(l1, l1))
  assert( equals(l1, l2))
})
