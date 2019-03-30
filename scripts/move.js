function maybePushableUpdate_(that, dir) {
  // DRY without subclassing for pushable objects
  assert(that.frameStack)

  const nextPos = that.pos.addDir(dir)
  const oldPos = that.pos

  // hack: we'd like to do these next two lines with r(true) and r(false),
  // but it's too hard to know whether we should be teleporting out _after_
  // leaving the opening, if there is one

  const r = (b) => {
    if (b) {
      that.playMoveSound()
    } else {
      that.setPos(oldPos)
    }
    return b
  }
  that.setPos(nextPos) // do this early; we'll undo it later if we need to

  if (maybeTeleOut(that, dir)) return r(true)
  if (!CanMoveToTile(nextPos)) return r(false)
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

function maybeTeleOut_(that, dir) {
  // if that is standing in a room opening and moving out (dir)
  //   move that to the parent Frame (teleport out one room)
  // else do nothing
  // returns whether the tele happened
  assert(that.frameStack)

  const oldPos = that.pos
  const oldFrameStack = that.frameStack

  const r = (b) => {
    if (b) {
      that.playTeleOutSound()
    } else {
      that.setPos(oldPos)
      that.setFrameStack(oldFrameStack)
    }
    return b
  }

  const innerLevel = that.frameStack.innerRoom()
  const outPos = innerLevel.openings()[dir]
  if (!outPos || !outPos.addDir(dir).equals(that.pos)) return r(false)

  // teleport
  const parent = that.frameStack.parent
  const mini = that.frameStack.mini
  that.setPos(mini.pos)
  that.setFrameStack(parent)

  // that has now teleported; try to move
  if (maybePushableUpdate(that, dir)) return r(true)

  // pretty sure this is a bad idea; the physics don't work
  // (e.g. if `that` is pushing against a wall, the normal force gets
  // transmitted to the player inside the mini, not the mini itself)
  // // try to counter-push the mini we're teleporting out of
  // if (lifted(that, mini, ()=>maybePushableUpdate(mini, oppDir(dir)))) {
  //   return true
  // }

  return r(false)
}
const maybeTeleOut = tracer.tracify(maybeTeleOut_)

// let hack_seen_teles

function maybeTeleIn_(that, dir) {
  // if `that` is standing _on_ a Mini,
  //   move `that` into the mini
  // else do nothing
  // returns whether the tele happened
  assert(that.frameStack)
  if (that.frameStack.length() >= 200) {
    // this is really really hacky
    console.warn("HACK infinite mini recursion")
    PlayAndRecordSound(sndInfinite)
    that.die()
    return true
  }

  const oldPos = that.pos
  const oldFrameStack = that.frameStack

  const r = (b) => {
    if (b) {
      that.playTeleInSound()
    } else {
      that.setPos(oldPos)
      that.setFrameStack(oldFrameStack)
    }
    return b
  }

  const mini = findActorUnderMe(Mini, that)
  if (!mini) return r(false)
  const op = mini.innerRoom.openings()[oppDir(dir)]
  if (!op) return r(false)
  // if (hack_seen_teles.has(mini.id)) {
  //   console.warn('infinite mini recursion detected; killing', serialize(that))
  //   PlayAndRecordSound(sndInfinite)
  //   that.die()
  //   return true
  // }
  // hack_seen_teles.add(mini.id)

  that.setPos(op.addDir(oppDir(dir)))
  that.setFrameStack(new Frame(mini, that.frameStack))

  // `that` has now teleported to an oob-location
  // next to the mini; try to move into the mini
  if (maybePushableUpdate(that, dir)) return r(true)
  return r(false)
}
const maybeTeleIn = tracer.tracify(maybeTeleIn_)

function maybeConsume_(that, food, dir) {
  // dir is the direction the _mini_ is moving
  assert(food.frameStack)
  if (that.constructor !== Mini) return false

    // todo r

  const oldPos = that.pos
  const nextPos = that.pos.addDir(dir)

  const r = (b) => {
    if (b) {
      that.playMoveSound()
    } else {
      that.setPos(oldPos)
    }
    return b
  }

  if (!maybeTeleIn(food, oppDir(dir))) return r(false)
  const surprise = findActorUnderMe([Crate, Mini], that)
  if (surprise) {
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