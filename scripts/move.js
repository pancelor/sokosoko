// Hello traveller
// Do not edit this file
// I know you think you've got some good reason that I didn't think of,
//   but be prepared to spend days debugging anything you change
// here there be dragons

// (editing Tracer is maybe acceptable. touch nothing else)

// Are you trying to add multiple exits to rooms? That's a very very
//   bad idea - where tf are you gonna store the "openingStack" that
//   keeps track of which nested openings you're in?
//   Just redesign the level so that the openings align - like
//   what you did by adding the orange room to DOLPHIN

class Tracer {
  static indent_str = "  "
  constructor(silent) {
    this.indent = 0
    this.silent = silent
  }

  tracify(fxn) {
    const wrapped = (...args) => {
      this.enter(fxn.name, args)
      const ret = fxn(...args)
      this.exit(fxn.name, args, ret)
      return ret
    }
    Object.defineProperty(wrapped, "name", { value: fxn.name })
    return wrapped
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
  const wrapped = (that, ...args) => {
    let hashArgs = [that, that.pos.x, that.pos.y, ...args]
    let entries = pushCache.get(fxn.name)
    if (!entries) {
      entries = []
      pushCache.set(fxn.name, entries)
    }
    let foundMatch = false
    for (const pastArgs of entries) {
      assert(pastArgs.length === hashArgs.length)
      if (arrEqual(hashArgs, pastArgs)) foundMatch = true
    }
    if (foundMatch) return altFxn(that, ...args)
    entries.push([...hashArgs]) // need to do this _before_ calling fxn, b/c its recursive
    return fxn(that, ...args)
  }
  Object.defineProperty(wrapped, "name", { value: fxn.name })
  return wrapped
}
RegisterTest("pushCache", () => {
  const divertedResults = []
  function spy(that, x, y) { assert(that); const res = 10*x+y; divertedResults.push(res); return res }

  let callCount = 0
  function foo_(that, x, y) { assert(that); callCount += 1; return 10*x + y }
  const foo = pushableCached(foo_, spy)

  const that = {pos: {x:10, y:20}}
  assertEqual(callCount, 0)
  assertEqual(foo(that, 1, 2), 12)
  assertEqual(divertedResults.length, 0)
  assertEqual(callCount, 1)

  assertEqual(foo(that, 3, 4), 34)
  assertEqual(divertedResults.length, 0)
  assertEqual(callCount, 2)

  assertEqual(foo(that, 3, 4), 34)
  assertEqual(divertedResults.length, 1)
  assertEqual(callCount, 2) // didnt increment
  assertEqual(divertedResults[0], 34) // routed to the alternate function

  that.pos.x = 9
  assertEqual(foo(that, 3, 4), 34)
  assertEqual(divertedResults.length, 1) // didnt divert
  assertEqual(callCount, 3) // incremented again

  resetPushableCache()
})

function cullInfinite(that) {
  // console.log("gone:", that);
  assert(that)
  PlayAndRecordSound(sndDestroy)
  that.die()
  return true // `that` was able to move,, into the infinite abyss
}

function buildRet(that, successCb, failCb) {
  return (b) => {
    if (b) {
      if (!findActorUnderMe([Crate, Mini, Player], that)) {
        successCb()
        return true
      } else {
        successCb()
        // console.warn("advanced NEW surprise", that.dead)
        return cullInfinite(that)
        // ^ this catches some cases during infbug and infbug2
      }
    }
    failCb()
    return false
  }
}

// DRY without subclassing for pushable objects
// maybeX means:
//   try to do X
//   if you did X, return true
//   if you couldn't do X, revert all changed state and return false
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
  const oldFrameStack = that.frameStack // might change during e.g. maybeteleout; idk
  const r = buildRet(that, ()=>that.playMoveSound(), ()=> {
    that.setPos(oldPos)
    that.setFrameStack(oldFrameStack)
  })
  that.setPos(that.pos.addDir(dir)) // do this early; we'll undo it later if we need to

  // if (that.pos.equals(new RoomPos(Room.findName("Orange"), 7, 4))) {
  //   debugger;
  // }

  if (maybeTeleOut(that, dir)) return r(true)
  if (!CanMoveToTile(that.pos)) return r(false)
  if (maybeTeleIn(that, dir)) return r(true)

  let numIters = 0
  for (const cst of [Crate, Mini, Player]) {
    const toPush = findActorUnderMe(cst, that)
    if (!toPush) continue
    numIters += 1
    // how can toPush be a mini if we already called maybeTeleIn?
    // well, if there was either no opening, or we failed to get into the opening
    if (lifted(that, toPush, ()=>maybeConsume(that, toPush, dir))) return r(true)
    if (lifted(that, toPush, ()=>!maybePushableUpdate(toPush, dir))) return r(false)
    const surprise = findActorUnderMe([Crate, Mini, Player], that)
    if (surprise) { // todo: delete this block eventually
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
// const maybePushableUpdate = tracer.tracify(maybePushableUpdate_)
const maybePushableUpdate = pushableCached(tracer.tracify(maybePushableUpdate_), cullInfinite)
// ^ this cullInfinite catches the dolphin tutorial

// * if the position/direction we were just at was at a level opening,
//   * (remember, we've already optimistically moved)
// * optimistically teleport out of the mini - new pos is right on top of mini
// * try moving out
function maybeTeleOut_(that, dir) {
  assert(that.frameStack)

  const oldPos = that.pos
  const oldFrameStack = that.frameStack
  const r = buildRet(that, ()=>that.playTeleOutSound(), () => {
    that.setPos(oldPos)
    that.setFrameStack(oldFrameStack)
  })

  const outPos = innerRoom(that.frameStack).openings()[dir] // the logic near here can be simplified/sped up; prolly doesn't matter tho
  if (!outPos || !outPos.addDir(dir).equals(that.pos)) return r(false)

  // teleport
  let fs = that.frameStack
  let mini = fs.data
  // START SELF-TELE BULLSHIT
  let depth = 0
  while (that === mini) {
    assert(0)
    depth += 1
    console.warn("teleporting out of... myself?")
    fs = fs.parent
    mini = fs.data
  }
  assert(mini)
  // END SELF-TELEBULLSHIT
  that.setPos(mini.pos)
  that.setFrameStack(fs.parent)

  // that has now teleported; try to move
  if (maybePushableUpdate(that, dir)) {
    // RE-START SELF-TELE BULLSHIT
    if (depth) {
      assert(0)
      assert(that.constructor === Mini)
      PlayAndRecordSound(sndDuplicate)
      const clones = [that]
      let nextMini = that
      let sent = getSafeSentinel(100)
      const lifter = { frameStack: that.frameStack } // hack
      while (sent()) {
        nextMini = Actor.clone(nextMini)
        if (lifted(lifter, nextMini, () => {
          const res = !maybePushableUpdate(nextMini, dir)
          lifter.frameStack = nextMini.frameStack // store lifter state for next mini
          return res
        })) {
          nextMini.dead = true
          break
        }
        nextMini.dead = true
        nextMini.setDead(false) // make undo work to re-kill nextMini
        clones.push(nextMini)
      }
      let newInnardMini
      if (depth - 1 < clones.length) {
        newInnardMini = clones[depth - 1]
      } else {
        newInnardMini = back(clones)
      }

      // HACK: assume the player directly pushed `that` from within the same
      // frameStack, not from afar using, idk a box stick
      assert(player.frameStack.data === that)
      let pfs = player.frameStack
      let sent2 = getSafeSentinel()
      while (sent2()) {
        pfs = pfs.parent
        assert(pfs)
        if (!pfs || pfs === that.frameStack) break
      }
      player.setFrameStack(cons(newInnardMini, pfs))
    }
    // RE-END SELF-TELE BULLSHIT

    // If we're a mini and we teleported out, update the player's framestack
    // We should maybe update _everyone's_ framestack, but I think we
    //   can assume that the turn is over now, since this chain of movement
    //   finished successfully?
    if (that.constructor === Mini) {
      const higherFs = includes(player.frameStack, that)
      if (higherFs) {
        spaceRipped = true

        let pfs = player.frameStack
        let nonLoopPart = []
        let sent3 = getSafeSentinel()
        while (sent3()) {
          const { data } = pfs
          nonLoopPart.push(data)
          if (data === mini) break
          pfs = pfs.parent
        }

        let loopPart = []
        let sent4 = getSafeSentinel()
        while (sent4()) {
          pfs = pfs.parent
          loopPart.push(pfs.data)
          if (equals(pfs, higherFs)) break
        }

        nonLoopPart = fromArray(nonLoopPart, true)
        loopPart = fromArray(loopPart, true)
        player.setFrameStack(concat(nonLoopPart, makeLoop(loopPart)))
      }
    }

    return r(true)
  }

  return r(false)
}
// const maybeTeleOut = pushableCached(tracer.tracify(maybeTeleOut_), cullInfinite)
const maybeTeleOut = tracer.tracify(maybeTeleOut_)


function xxTesting() {
  reset("riptest2")
  play("0000103330111122", 0)
  setTimeout(() => {
    const that = findActor(Mini, new RoomPos(Room.findName("Red"), 1, 4));
    console.log("pfs", xx(player.frameStack))
    console.log("pfs.p", xx(player.frameStack.parent))
    console.log("pfs.p.p", xx(player.frameStack.parent.parent))
    console.log("pfs.p.p.p", xx(player.frameStack.parent.parent.parent))
    console.log("pfs.p.p.p.p", xx(player.frameStack.parent.parent.parent.parent))
    console.log("-----");
    player.frameStack.parent.parent.parent = player.frameStack.parent
    player.frameStack.parent.parent.data = that
    console.log("pfs", xx(player.frameStack))
    console.log("pfs.p", xx(player.frameStack.parent))
    console.log("pfs.p.p", xx(player.frameStack.parent.parent))
    console.log("pfs.p.p.p", xx(player.frameStack.parent.parent.parent))
    console.log("pfs.p.p.p.p", xx(player.frameStack.parent.parent.parent.parent))
  }, 1000)
}

function xx(node) {
  return `${innerRoom(node).name} ${node.data.pos && node.data.pos.roomPos().str()}`
}

// * if we're standing on a mini,
//   * (remember, we've already optimistically moved)
// * if it has an opening receptive to our direction,
// * optimistically teleport into the mini - one tile before the opening
// * try moving in
function maybeTeleIn_(that, dir) {
  assert(that.frameStack)

  const oldPos = that.pos
  const oldFrameStack = that.frameStack
  const r = buildRet(that, ()=>that.playTeleInSound(), () => {
    that.setPos(oldPos)
    that.setFrameStack(oldFrameStack)
  })

  const mini = findActorUnderMe(Mini, that)
  if (!mini) return r(false)
  const op = mini.innerRoom.openings()[oppDir(dir)]
  if (!op) return r(false)

  that.setPos(op.addDir(oppDir(dir)))
  that.setFrameStack(cons(mini, that.frameStack))

  // `that` has now teleported to an oob-location
  // next to the mini; try to move into the mini
  if (maybePushableUpdate(that, dir)) {
    // If we're a mini and we teleported in, update the player's frameStack
    // We should maybe update _everyone's_ frameStack, but I think we
    //   can assume that the turn is over now, since this chain of movement
    //   finished successfully?
    if (that.constructor === Mini) {
      const targetRoom = innerRoom(oldFrameStack)
      const newParent = insertAll(
        player.frameStack.parent,
        m=>innerRoom({data: m}) === targetRoom,
        mini)
      const newFs = cons(player.frameStack.data, newParent)
      player.setFrameStack(newFs)
    }
    return r(true)
  }
  return r(false)
}
// const maybeTeleIn = pushableCached(tracer.tracify(maybeTeleIn_), cullInfinite)
const maybeTeleIn = tracer.tracify(maybeTeleIn_)

// * try to tele the food into me
function maybeConsume_(that, food, dir) {
  // dir is the direction the _mini_ is moving
  assert(food.frameStack)
  if (that.constructor !== Mini) return false

  const oldPos = that.pos // might change during e.g. maybetelein; idk
  const oldFrameStack = that.frameStack // might change during e.g. maybeteleout; idk
  const r = buildRet(that, ()=>that.playMoveSound(), () => {
    that.setPos(oldPos)
    that.setFrameStack(oldFrameStack)
  })

  if (!maybeTeleIn(food, oppDir(dir))) return r(false)
  const surprise = findActorUnderMe([Crate, Mini, Player], that)
  if (surprise) { // todo: delete this block eventually
    assert(0, "consume surprise oh no", that.serialize())
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
    PlayAndRecordSound(sndDestroy)
    // edit: god im playing with it more and everything is so fucky;
    // return false here is no good... but return true isn't great either

    that.die()
  }
  return r(true)
}
// const maybeConsume = tracer.tracify(pushableCached(maybeConsume_, cullInfinite))
const maybeConsume = tracer.tracify(maybeConsume_)

function lifted(lifter, target, cb) {
  // lifts target into lifter's frame, tries to update it in some way (with cb), and unlifts it
  // returns whatever cb returns
  // Might cull lifter if it detects infinity

  // at one point i call this with a fake object with just a frameStack var;
  // don't assume it has anything else pls

  assert(lifter.frameStack)

  if (target.frameStack) {
    // Target has already moved this turn; we must be in an infinite loop
    // The deepest object dies, so bye bye lifter
    return cullInfinite(lifter)
    // ^ this catches the infbug and infbug2 cases
  }
  assert(!target.frameStack)

  target.frameStack = lifter.frameStack
  const success = cb()
  delete target.frameStack

  return success
}
