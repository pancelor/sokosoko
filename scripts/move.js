class Tracer {
  static indent_str = "  "
  constructor(silent) {
    this.indent = 0
    this.silent = silent
  }

  tracify(fxn) {
    return (...args) => {
      this.enter(fxn.name, args)
      const ret = fxn(...args)
      this.exit(fxn.name, args, ret)
      return ret
    }
  }

  toggle() {
    this.silent = !this.silent
  }

  // main fxnality
  printSignature(name, args) {
    const parts = []
    parts.push(`${name}(`)
    for (const a of args) {
      if (a.str) {
        parts.push(`${a.str()}, `)
      } else {
        parts.push(`${serialize(a)}, `)
      }
    }
    parts.push(")")
    return parts.join('')
  }
  enter(name, args) {
    this.print(`-> ${this.printSignature(name, args)}`)
    this.changeIndent(1)
  }
  exit(name, args, ret) {
    this.changeIndent(-1)
    this.print(`${ret} <- ${this.printSignature(name, args)}`)
  }
  changeIndent(di) {
    this.indent += di
    assert(this.indent >= 0)
  }
  print(msg) {
    if (this.silent) return
    const parts = []
    for (let i = 0; i < this.indent; i++) {
      parts.push(Tracer.indent_str)
    }
    parts.push(msg)
    console.log(parts.join(''))
  }
}
const tracer = new Tracer()
// tracer.toggle()

function arrEqual(a1, a2) {
  assert(a1.length === a2.length)
  for (let i = 0; i < a1.length; i += 1) {
    if (a1[i] !== a2[i]) return false
  }
  return true
}

let pushCache = new Map()
function resetPushableCache() {
  pushCache = new Map()
}
function pushableCached(fxn, altFxn) {
  return (that, ...args) => {
    args = [that, that.pos.x, that.pos.y, ...args]
    let entries = pushCache.get(fxn.name)
    if (!entries) {
      entries = []
      pushCache.set(fxn.name, entries)
    }
    let foundMatch = false
    for (const pastArgs of entries) {
      assert(pastArgs.length === args.length)
      if (arrEqual(args, pastArgs)) foundMatch = true
    }
    if (foundMatch) return altFxn(...args)
    const ret = fxn(...args)
    entries.push([...args])
    return ret
  }
}
RegisterTest("pushCache", () => {
  const divertedResults = []
  function spy(x, y) { const res = 10*x+y; divertedResults.push(res); return res }

  let callCount = 0
  function foo_(x, y) { callCount += 1; return 10*x + y }
  const foo = pushableCached(foo_, spy)

  assertEqual(callCount, 0)
  assertEqual(foo(1, 2), 12)
  assertEqual(divertedResults.length, 0)
  assertEqual(callCount, 1)

  assertEqual(foo(3, 4), 34)
  assertEqual(divertedResults.length, 0)
  assertEqual(callCount, 2)

  assertEqual(foo(3, 4), 34)
  assertEqual(divertedResults.length, 1)
  assertEqual(callCount, 2) // didnt increment
  assertEqual(divertedResults[0], 34) // routed to the alternate function

  resetPushableCache()
})

function cullInfinite(...args) {
  console.log("culling", args);
  const that = args[0]
  PlayAndRecordSound(sndInfinite)
  that.die()
  return true // `that` was able to move,, into the infinite abyss
}

function buildRet(that, oldPos, oldFrameStack) {
  return (b) => {
    if (b) {
      if (!findActorUnderMe([Crate, Mini, Player], that)) {
        that.playMoveSound()
        return true
      } else {
        console.warn("advanced NEW surprise")
        that.die()
        return true // we moved off into infinity, "succesfully"
      }
    }
    if (oldPos) that.setPos(oldPos)
    if (oldFrameStack) that.setFrameStack(oldFrameStack)
    return false
  }
}

// DRY without subclassing for pushable objects
//
// Do each of these steps, aborting when the
// * optimistically move in the given direction (might have to revert later)
// * maybe teleport out
// * check if im in a wall
// * maybe teleport in
// * see if I'm on top of something i should have pushed
//   * try eating it, if i'm a mini
//   * try pushing it
// * succeed!
function maybePushableUpdate_(that, dir) {
  assert(that.frameStack)

  const oldPos = that.pos
  const r = buildRet(that, oldPos)
  that.setPos(that.pos.addDir(dir)) // do this early; we'll undo it later if we need to

  if (maybeTeleOut(that, dir)) return r(true)
  if (!CanMoveToTile(that.pos)) return r(false)
  if (maybeTeleIn(that, dir)) return r(true)

  let numIters = 0
  for (const cst of [Crate, Mini]) {
    const toPush = findActorUnderMe(cst, that)
    if (!toPush) continue
    numIters += 1
    // how can toPush be a mini if we already called maybeTeleIn?
    // well, if there was either no opening, or we failed to get into the opening
    if (lifted(that, toPush, ()=>maybeConsume(that, toPush, dir))) return r(true)
    if (!lifted(that, toPush, ()=>maybePushableUpdate(toPush, dir))) return r(false)
    const surprise = findActorUnderMe([Crate, Mini], that)
    if (surprise) {
      assert(0, "push surprise oh no")
      // weird recursion happened and we can't go where we wanted to go,
      // even though we just pushed toPush off of that position

      // For consistency with the other inf cases,
      // we should maybe that.die here... that feels bad imo
      // The other inf cases are like hilbert's hotel; this case
      // compresses the crates infinitely, which is no good
      // (any maybe good justification for why they expand back out?
      // so that it looks like nothing happened?)
      console.warn("surprise!", that.serialize(), "->", surprise.serialize())
      that.die()
    }
  }
  assert(numIters === 0 || numIters === 1)
  return r(true)
}
const maybePushableUpdate = tracer.tracify(maybePushableUpdate_)
// const maybePushableUpdate = tracer.tracify(pushableCached(maybePushableUpdate_, cullInfinite))



// * if the position/direction we were just at was at a level opening,
//   * (remember, we've already optimistically moved)
// * optimistically teleport out of the mini - new pos is right on top of mini
// * try moving out
function maybeTeleOut_(that, dir) {
  // if that is standing in a room opening and moving out (dir)
  //   move that to the parent Frame (teleport out one room)
  // else do nothing
  // returns whether the tele happened
  assert(that.frameStack)

  const oldPos = that.pos
  const oldFrameStack = that.frameStack
  const r = buildRet(that, oldPos, oldFrameStack)

  const outPos = that.frameStack.innerRoom().openings()[dir] // the logic near here can be simplified/sped up; prolly doesn't matter tho
  if (!outPos || !outPos.addDir(dir).equals(that.pos)) return r(false)

  // teleport
  const parent = that.frameStack.parent
  const mini = that.frameStack.mini
  that.setPos(mini.pos)
  that.setFrameStack(parent)

  // that has now teleported; try to move
  if (maybePushableUpdate(that, dir)) return r(true)

  return r(false)
}
const maybeTeleOut = tracer.tracify(maybeTeleOut_)
// const maybeTeleOut = tracer.tracify(pushableCached(maybeTeleOut_, cullInfinite))

// * if we're standing on a mini,
//   * (remember, we've already optimistically moved)
// * if it has an opening receptive to our direction,
// * optimistically teleport into the mini - one tile before the opening
// * try moving in
function maybeTeleIn_(that, dir) {
  // if `that` is standing _on_ a Mini,
  //   move `that` into the mini
  // else do nothing
  // returns whether the tele happened
  assert(that.frameStack)
  if (that.frameStack.length() >= 30) {
    // this is really really hacky
    console.warn("HACK infinite mini recursion")
    PlayAndRecordSound(sndInfinite)
    that.die()
    return true
  }

  const oldPos = that.pos
  const oldFrameStack = that.frameStack
  const r = buildRet(that, oldPos, oldFrameStack)

  const mini = findActorUnderMe(Mini, that)
  if (!mini) return r(false)
  const op = mini.innerRoom.openings()[oppDir(dir)]
  if (!op) return r(false)

  that.setPos(op.addDir(oppDir(dir)))
  that.setFrameStack(new Frame(mini, that.frameStack))

  // `that` has now teleported to an oob-location
  // next to the mini; try to move into the mini
  if (maybePushableUpdate(that, dir)) return r(true)
  return r(false)
}
const maybeTeleIn = tracer.tracify(maybeTeleIn_)
// const maybeTeleIn = tracer.tracify(pushableCached(maybeTeleIn_, cullInfinite))

// * try to tele the food into me
function maybeConsume_(that, food, dir) {
  // dir is the direction the _mini_ is moving
  assert(food.frameStack)
  if (that.constructor !== Mini) return false

  const oldPos = that.pos // might change during e.g. maybetelein
  const r = buildRet(that, oldPos)

  if (!maybeTeleIn(food, oppDir(dir))) return r(false)
  const surprise = findActorUnderMe([Crate, Mini], that)
  if (surprise) {
    assert(0, "consume surprise oh no")
    // this is very weird; eating the food has pushed/recursed some stuff
    // around in a way such that the food's old position is occupied again.
    // (e.g. green or purple/yellow room of newpush.lvl)

    // Im so so conflicted about what to do here;
    // I think we should succeed and evaporate the food out of existence
    // That seems to be the case in the green room of newpush.lvl
    // But what about the purple/yellow combo? which block gets eaten?
    // Wouldn't it be all of them but none of them at once? so now the three
    // remaining objects are weird half-and-half glitchy abominations?
    // (could randomize which one is murdered, but that seems like
    // a cop out and a bad experience as a player imo)

    console.warn("infinite nastiness occurs")
    PlayAndRecordSound(sndInfinite)
    // edit: god im playing with it more and everything is so fucky;
    // return false here is no good... but return true isn't great either

    that.die()
  }
  return r(true)
}
const maybeConsume = tracer.tracify(maybeConsume_)
// const maybeConsume = tracer.tracify(pushableCached(maybeConsume_, cullInfinite))

function lifted(lifter, target, cb) {
  // lifts target into lifter's frame, tries to update it in some way (with cb), and unlifts it
  // returns whatever cb returns
  assert(lifter.frameStack)

  if (target.frameStack) return false
  // TODO: get player here and break the assert? is that possible
  assert(!target.frameStack)

  target.frameStack = lifter.frameStack
  const success = cb()
  delete target.frameStack

  return success
}
