
function maybeTeleOut_(that, dir) {
  // if that is standing in a room opening and moving out (dir)
  //   move that to the parent Frame (teleport out one room)
  // else do nothing
  // returns whether the tele happened
  assert(that.frameStack)

  const innerLevel = that.frameStack.room()
  const outPos = innerLevel.openings()[dir]
  if (outPos && outPos.equals(that.pos)) {
    // prepare to teleport
    const oldPos = that.pos
    const oldFrameStack = that.frameStack

    const parent = that.frameStack.parent
    const mini = that.frameStack.mini()
    that.setPos(mini.pos)
    that.setFrameStack(parent)

    // that has now teleported; try to move
    if (pushableUpdate(that, dir)) {
      that.playTeleOutSound()
      return true
    } else {
      // pretty sure this is a bad idea; the physics don't work
      // (e.g. if `that` is pushing against a wall, the normal force gets
      // transmitted to the player inside the mini, not the mini itself)
      // // try to counter-push the mini we're teleporting out of
      // if (lifted(that, mini, ()=>pushableUpdate(mini, oppDir(dir)))) {
      //   return true
      // }

      // undo
      that.setPos(oldPos)
      that.setFrameStack(oldFrameStack)
    }
  }
  return false
}
const maybeTeleOut = tracer.tracify(maybeTeleOut_)

// let hack_seen_teles

function maybeTeleIn_(that, dir) {
  // if that is standing next to a Mini and is moving into it (dir)
  //   move that into the mini. (one tile before the actual entrance)
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

  const nextPos = that.pos.addDir(dir)
  const mini = findActor(Mini, nextPos)
  if (mini) {
    const op = mini.room().openings()[oppDir(dir)]
    if (op) {
      // if (hack_seen_teles.has(mini.id)) {
      //   console.warn('infinite mini recursion detected; killing', serialize(that))
      //   PlayAndRecordSound(sndInfinite)
      //   that.die()
      //   return true
      // }
      // hack_seen_teles.add(mini.id)

      // prepare to teleport
      const oldPos = that.pos
      const oldFrameStack = that.frameStack

      const newPos = op.addDir(oppDir(dir)) // right before entering the room; to try to push anything in the entryway thats in the way
      const newStack = new Frame(mini.id, that.frameStack)
      that.setPos(newPos)
      that.setFrameStack(newStack)

      // that has now teleported; try to move
      if (pushableUpdate(that, dir)) {
        that.playTeleInSound()
        return true
      } else {
        // undo
        that.setPos(oldPos)
        that.setFrameStack(oldFrameStack)
      }
    }
  }
  return false
}
const maybeTeleIn = tracer.tracify(maybeTeleIn_)

function maybeConsume_(that, food, dir) {
  // dir is the direction the _mini_ is moving
  assert(food.frameStack)
  if (that.constructor !== Mini) return false

  if (maybeTeleIn(food, oppDir(dir))) {
    that.playMoveSound()
    const newMiniPos = that.pos.addDir(dir)
    const surprise = findActor([Crate, Mini], newMiniPos)
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

      surprise.die()
    }
    that.setPos(newMiniPos)
    return true
  }
  return false
}
const maybeConsume = tracer.tracify(maybeConsume_)

function pushableUpdate_(that, dir) {
  // DRY without subclassing for pushable objects
  assert(that.frameStack)

  const nextPos = that.pos.addDir(dir)

  if (maybeTeleOut(that, dir)) { return true }
  if (!CanMoveToTile(nextPos)) { return false }

  if (maybeTeleIn(that, dir)) { return true }

  for (const cst of [Crate, Mini]) {
    const toPush = findActor(cst, nextPos)
    if (!toPush) continue

    // how can toPush be a mini if we already called maybeTeleIn?
    // well, if there was either no opening, or we failed to get into the opening
    if (lifted(that, toPush, ()=>maybeConsume(that, toPush, dir))) { return true }
    if (!lifted(that, toPush, ()=>pushableUpdate(toPush, dir))) { return false }
    const surprise = findActor([Crate, Mini], nextPos)
    if (surprise) {
      // weird recursion happened and we can't go where we wanted to go,
      // even though we just pushed toPush off of that position

      // For consistency with the other inf cases,
      // we should maybe surprise.die here... that feels bad imo
      // The other inf cases are like hilbert's hotel; this case
      // compresses the crates infinitely, which is no good
      // (any maybe good justification for why they expand back out?
      // so that it looks like nothing happened?)
      console.warn("surprise!", surprise.serialize())
      return false
    }
  }

  that.playMoveSound()
  that.setPos(nextPos)
  return true
}
const pushableUpdate = tracer.tracify(pushableUpdate_)

function lifted(lifter, target, cb) {
  // lifts target into lifter's frame, tries to update it in some way (with cb), and unlifts it
  // returns whatever cb returns
  assert(lifter.frameStack)

  // TODO: get player here and break the assert? is that possible
  assert(!target.frameStack)

  target.frameStack = lifter.frameStack
  const success = cb()
  delete target.frameStack

  return success
}