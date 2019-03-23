let isPlayerTurn;

function registerKeyListeners() {
  isPlayerTurn = true;
  let bufferedInput = null;

  async function movementKey(dir) {
    // This function gets all weird b/c it's running multiple copies
    // of itself at once. One main "thread" plays back any buffered inputs
    // while many other "threads" set the buffered input
    if (!isPlayerTurn) {
      bufferedInput = dir
      return
    }
    isPlayerTurn = false
    await update(dir)
    assert(isPlayerTurn === false)
    while (bufferedInput !== null) {
      const dir = bufferedInput
      bufferedInput = null
      await update(dir)
    }
    isPlayerTurn = true
  }

  const keyRepeatTimeout = 125

  function makeHandler(codes, cb) {
    let repeatInterval
    if (!Array.isArray(codes)) { codes = [codes] }
    return e => {
      if (!codes.includes(e.code)) { return }
      if (e.type === "keydown") {
        if (e.repeat) { return }
        cb()
        clearInterval(repeatInterval) // don't want multiple intervals running if we lose focus
        repeatInterval = setInterval(cb, keyRepeatTimeout)
      } else if (e.type === "keyup") {
        if (!repeatInterval) {
          console.warn(`released ${e.code} but there was no repeat interval (${repeat})`)
        }
        clearTimeout(repeatInterval)
      } else { assert(0, `unknown event with type ${e.type}: ${JSON.stringify(e)}`) }
    }
  }
  const repeatHandlers = [
    makeHandler("KeyZ", () => {
      if (!isPlayerTurn) { return }
      undo()
      raf()
    }),
    makeHandler("KeyY", () => {
      if (!isPlayerTurn) { return }
      redo()
      raf()
    }),
    makeHandler(["KeyD", "ArrowRight"], () => { movementKey(0) }),
    makeHandler(["KeyW", "ArrowUp"], () => { movementKey(1) }),
    makeHandler(["KeyA", "ArrowLeft"], () => { movementKey(2) }),
    makeHandler(["KeyS", "ArrowDown"], () => { movementKey(3) }),
  ]

  window.addEventListener("keydown", e=>repeatHandlers.forEach(f=>f(e)))
  window.addEventListener("keyup", e=>repeatHandlers.forEach(f=>f(e)))
}

function redraw() {
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  drawGame(ctx)
}

function raf() {
  requestAnimationFrame(redraw)
}

function init() {
  registerKeyListeners()
  initTiles()
  initActors()
  initGame()

  raf()
}

window.onload = init
