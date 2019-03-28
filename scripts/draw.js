function cls(ctx) {
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

function drawBkg(ctx) {
  assert(0, 'imgBackground doesnt exist')
  drawImg(ctx, imgBackground, pcoord(0, 0))
}

function ctxWith(ctx, map, cb) {
  // Used to temporarily set ctx attributes, e.g.:
  //   ctxWith(ctx, {globalAlpha: 0.75, fillStyle: "green"}, () => {
  //     drawLine(ctx, pos1, pos2)
  //   })
  const old = {}
  Object.keys(map).forEach((k) => {
    old[k] = ctx[k]
  })
  Object.assign(ctx, map)
  cb(ctx)
  Object.assign(ctx, old)
}

function drawImgMap(ctx, img, tilePos) {
  if (img == null) {
    assert(0, "null image")
    return
  }
  let { x, y } = tilePos
  x *= tileSize
  y *= tileSize
  ctx.drawImage(img, x, y)
}

function drawImgMini(ctx, img, tilePos) {
  if (img == null) {
    assert(0, "null image")
    return
  }
  let { x, y } = tilePos
  x *= miniTileSize
  y *= miniTileSize
  ctx.drawImage(img, x, y)
}

function drawLine(ctx, p1, p2) {
  ctx.beginPath()
  ctx.moveTo(p1.x*tileSize, p1.y*tileSize)
  ctx.lineTo(p2.x*tileSize, p2.y*tileSize)
  ctx.stroke()
}

function drawCircle(ctx, p, r) {
  ctx.beginPath()
  ctx.arc(p.x*tileSize, p.y*tileSize, r, 0, 2 * Math.PI)
  ctx.fill()
}

function drawMessage(ctx, lines, mainColor="white") {
  if (!Array.isArray(lines)) { lines = [lines] }
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const lineHeight = 30
  const msgHeight = lineHeight*lines.length
  ctxWith(ctx, {globalAlpha: 0.66, fillStyle: "black"}, () => {
    fillRectCentered(ctx, W/2, H/2, W*0.9 + 10, msgHeight + lineHeight + 10)
  })
  ctxWith(ctx, {globalAlpha: 0.75, fillStyle: mainColor}, () => {
    fillRectCentered(ctx, W/2, H/2, W*0.9, msgHeight + lineHeight)
  })
  ctxWith(ctx, {
    font: `${lineHeight}px Consolas`,
    fillStyle: "black",
    textAlign: "center",
  }, () => {
    let i = 0
    for (const line of lines) {
      const yCenter = H/2 - msgHeight/2 + (i+0.5)*lineHeight
      ctx.fillText(line, W/2, yCenter+lineHeight*0.25)
      i += 1
    }
  });
  // // draw crosshairs
  // ctxWith(ctx, {fillStyle: "red"}, () => {
  //   fillRectCentered(ctx, W/2, H/2, W, H*0.005)
  //   fillRectCentered(ctx, W/2, H/2, W*0.005, H)
  // })
}

function fillRectCentered(ctx, cx, cy, w, h) {
  const x = cx - w/2;
  const y = cy - h/2;
  ctx.fillRect(x,y,w,h);
}
