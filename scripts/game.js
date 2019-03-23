let player
let levelStack

function InitGame() {
  // note: tiles/actors have already been loaded
  console.log("InitGame()")
  player = allActors(Player)[0]
  assert(player)
  initLevelStack()
}

function initLevelStack() {
  // this initial stack could change with different puzzle design
  const mini = findActor(Mini, {x:0, y:0})
  assert(mini)
  levelStack = [new Frame({dir: 3, miniId: mini.id, levelId: mini.levelId})]
}

function levelStackToString() {
  const chars = ['[']
  for (const frame of levelStack) {
    const mini = getActorId(frame.miniId)
    assert(mini)
    chars.push(`Mini#${mini.id}@${posStr(mini.pos)}{${frame.levelId}}, `)
  }
  return chars.join('')
}

class Frame {
  // a frame is an entry location (from the next level up) and a level id
  // the levelStack is made up of frames
  constructor({dir, miniId, levelId}) {
    this.dir = dir
    this.miniId = miniId
    this.levelId = levelId
  }
}

function Update(dir) {
  player.update(dir, levelStack)
  if (checkWin()) {
    console.log("you win!")
  }
  Raf()
}

function checkWin() {
  return levelStack.length === 0
}

function DrawGame(ctx) {
  DrawTiles(ctx)
  drawActors(ctx)
}

function drawActors(ctx) {
  allActors().forEach(e=>e.draw(ctx))
}

function InitActors() {
  ImportActors()
}

class Actor {
  static id = 1 // a counter of ids to assign to actors as they're created

  static img = null
  // override `static img = ...` on subclasses

  constructor(pos) {
    this.pos = pos
    this.img = this.constructor.img

    // get id
    this.id = Actor.id
    Actor.id += 1
  }

  draw(ctx){
    drawImg(ctx, this.img, this.pos)
  }

  update(dir) {
    // returns whether it moved in the given dir
    return false
  }

  initGame() {
    // code that runs on game init
  }

  serialize() {
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y}`
  }

  static deserialize(line) {
    const [type, x, y] = line.split(' ')
    assert(type === this.name, `expected ${this.name} got ${type}`)
    const p = {x: int(x), y: int(y)}
    return new (this)(p)
  }
}

class Player extends Actor {
  static img = imgPlayer

  update(dir) {
    return pushableUpdate(this, dir)
  }
}

class Mini extends Actor {
  static img = imgMini

  constructor(p, levelId) {
    super(p)
    assert(levelId.constructor === Number)
    this.levelId = levelId
  }

  update(dir) {
    return pushableUpdate(this, dir)
  }

  serialize() {
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y} ${this.levelId}`
  }

  static deserialize(line) {
    const [type, x, y, id] = line.split(' ')
    assert(type === this.name, `expected ${this.name} got ${type}`)
    const p = {x: int(x), y: int(y)}
    const levelId = int(id)
    return new (this)(p, levelId)
  }
}

class Crate extends Actor {
  static img = imgCrate

  update(dir) {
    return pushableUpdate(this, dir)
  }
}

const allActorTypes = [Player, Crate, Mini]

// function dirTo(p1, p2) {
//   // returns 0-3 if p2 is adjacent to p1
//   // otherwise null
//   const dy = p2.y - p1.y
//   const dx = p2.x - p1.x
//   if (dy === 0 && dx === 1) { return 0 }
//   if (dy === -1 && dx === 0) { return 1 }
//   if (dy === 0 && dx === -1) { return 2 }
//   if (dy === 1 && dx === 0) { return 3 }
//   return null
// }

function tryingToTeleOut(pos, d) {
  // returns whether standing at p and trying to move in dir d is escaping from the current level
  const { dir: frameDir, levelId} = back(levelStack)
  const level = getLevel(levelId)
  const ops = LevelOpenings(level)
  if (ops.find(op=>posEq(op, pos))) {
    return saneMod(frameDir + 2, 4) === d
  }
}

function getLevel(id) {
  const l = levels.find(l=>l.id===id)
  assert(l)
  return l
}

function levelPos(level, pos) {
  // takes a level pos and returns a global pos
  return {x: pos.x, y: pos.y + level.begin}
}

function pushableUpdate(that, dir) {
  // DRY without subclassing for pushable objects
  const otherDir = saneMod(dir + 2, 4)
  const oldPos = {...that.pos}
  const nextPos = posDir(that.pos, dir)

  if (tryingToTeleOut(that.pos, dir)) {
    const popped = levelStack.pop()
    const level = getLevel(popped.levelId)
    const mini = getActorId(popped.miniId)
    assert(mini)
    that.pos = mini.pos
    if (pushableUpdate(that, dir)) {
      return true
    } else {
      // undo
      that.pos = oldPos
      levelStack.push(popped)
    }
  }

  if (!CanMoveToTile(nextPos)) { return false }

  const crate = findActor(Crate, nextPos)
  if (crate && !crate.update(dir)) { return false }

  const mini = findActor(Mini, nextPos)
  if (mini) {
    const newLevel = getLevel(mini.levelId)
    const ops = LevelOpenings(newLevel)
    const op = ops[otherDir]
    if (op) {
      // teleport into the mini
      const oldLevel = getLevel(back(levelStack).levelId)
      levelStack.push(new Frame({dir, miniId: mini.id, levelId: newLevel.id}))

      that.pos = posDir(op, otherDir) // right before entering the room, to try to push
      if (pushableUpdate(that, dir)) {
        return true
      } else {
        // undo
        that.pos = oldPos
        levelStack.pop()
      }
    }
    // there was either no opening, or we failed to get into the opening
    if (!mini.update(dir)) { return false }
  }

  that.pos = nextPos
  return true
}

function allActors(csts) {
  // allActors() -> all actors
  // allActors(Foo) -> all actors with constructor Foo
  // allActors([Foo, Bar]) -> all actors with constructor Foo or constructor Bar
  if (!csts) { return actors }
  if (!Array.isArray(csts)) { csts = [csts] }
  return actors.filter(a=>csts.includes(a.constructor))
}

function getActorId(id) {
  return actors.find(a=>a.id===id)
}

function findActor(cst, p) {
  // finds an actor with the given constructor(s) at the given location
  // (or anywhere, if no pos is given)
  const as = allActors(cst)
  if (p) {
    return as.find(a=>posEq(a.pos, p))
  } else {
    return as[0]
  }
}
