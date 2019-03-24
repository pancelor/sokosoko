//
// testing; used later in this file so it needs to be first
//

const allTests = []
function RegisterTest(name, test) {
  allTests.push({name, test})
}
function RunTests() {
  for (const {name, test} of allTests) {
    console.log(`Testing '${name}'`);
    test()
  }
}

function assert(b, msg=null) {
  if (!b) {
    msg = (msg === null) ? "assert error" : msg
    throw new Error(msg)
  }
}

function assertEqual(actual, expected, msg=null) {
  if (actual !== expected) {
    const expl = `expected ${expected}; got ${actual}`
    msg = (msg === null) ? expl : `${msg}: ${expl}`
    throw new Error(msg)
  }
}

function expectError(cb, msgMatch='') {
  try {
    cb()
  } catch (err) {
    if (err.message.match(msgMatch)) {
      return
    } else {
      throw err
    }
  }
  throw new Error("expected an error; got none")
}

function assertObjMatch(actual, expected, _path="") {
  for (const prop of Object.keys(expected)) {
    const pathToProp = `${_path}.${prop}`
    if (expected[prop].constructor === Object) {
      assert(actual[prop].constructor === Object, `${pathToProp}: expected ${expected[prop]}; got ${actual[prop]}`)
      assertObjMatch(actual[prop], expected[prop], _path=pathToProp)
    } else {
      assertEqual(actual[prop], expected[prop], `${pathToProp}: expected ${expected[prop]}; got ${actual[prop]}`)
    }
  }
}
RegisterTest("assertObjMatch", () => {
  assertObjMatch({id: 1}, {id: 1})
  assertObjMatch({a: 1, b: 2}, {a: 1, b: 2})
  assertObjMatch({id: 1, extras: "are allowed"}, {id: 1})
  expectError(() => {
    assertObjMatch({id: 1}, {id: 2})
  }, /expected.*got/)
  expectError(() => {
    assertObjMatch({}, {id: 2})
  }, /expected.*got/)
  expectError(() => {
    assertObjMatch({a: 1, b: 3}, {a: 1, b: 2})
  }, /expected.*got/)
  assertObjMatch({foo: {bar: 1}}, {foo: {bar: 1}})
  expectError(() => {
    assertObjMatch({foo: {bar: 1}}, {foo: {bar: 2}})
  }, /expected.*got/)
})

function assertObjEqual(a, b) {
  return assertObjMatch(a, b) && assertObjMatch(b, a)
}
RegisterTest("assertObjEqual", () => {
  assertObjEqual({a: 1, b: 2}, {b:2, a: 1})
  assertObjMatch({foo: {bar: 1}}, {foo: {bar: 1}})
  expectError(() => {
    assertObjEqual({a: 1}, {a: 2})
  }, /expected.*got/)
  expectError(() => {
    assertObjEqual({a: 1}, {b:2, a: 1})
  }, /expected.*got/)
  expectError(() => {
    assertObjMatch({foo: {bar: 1}}, {foo: {bar: 2}})
  }, /expected.*got/)
})

//
// math
//

function randInt(min, max) {
  // returns an int
  //   randInt(a, b) -> [a, b)
  //   randInt(b) -> [0, b)
  if (max === undefined) {
    [min, max] = [0, min];
  }
  return Math.floor(Math.random() * (max-min)) + min;
}

function choose(arr) {
  return arr[randInt(0, arr.length)]
}

function clamp(x, a, b) {
  if (x < a) { return a }
  if (x > b) { return b }
  return x
}
RegisterTest("clamp", () => {
  assertEqual(clamp(0, 3, 10), 3)
  assertEqual(clamp(3, 3, 10), 3)
  assertEqual(clamp(5, 3, 10), 5)
  assertEqual(clamp(10, 3, 10), 10)
  assertEqual(clamp(11, 3, 10), 10)
  assertEqual(clamp(-5, 3, 10), 3)
})

function saneMod(x, y) {
  // mod(x, y) returns a number in [0, y), like % should do (but doesn't)
  x = x % y
  if (x < 0) { x += y}
  return x
}
RegisterTest("saneMod", () => {
  assertEqual(saneMod(3, 10), 3)
  assertEqual(saneMod(0, 10), 0)
  assertEqual(saneMod(10, 10), 0)
  assertEqual(saneMod(-6, 10), 4)
})

function divmod(x, y) {
  return [Math.floor(x / y), saneMod(x, y)]
}
RegisterTest("divmod", () => {
  assertEqual(divmod(10, 3)[0], 3)
  assertEqual(divmod(10, 3)[1], 1)
})

function hex(str) {
  const match = str.match(/^[#]?(?<code>[a-fA-F\d]+)$/)
  if (!match) {
    throw new Error(`bad hex parse on "${str}"`)
  }
  return parseInt(match.groups.code, 16)
}
RegisterTest("hex", () => {
  assertEqual(hex("FFA300"), 16753408)
  assertEqual(hex("#FFA300"), 16753408)
})

function hexColor(str) {
  let val, r, g, b
  val = hex(str); // these semicolons are very important b/c of the ['s coming up
  [val, b] = divmod(val, 256);
  [val, g] = divmod(val, 256);
  r = val
  return {r, g, b}
}
RegisterTest("hexColor", () => {
  assertObjMatch(hexColor("#FFA300"), {r:255, g:163, b:0})
})

function int(str) {
  if (!str.match(/^\d+$/)) {
    throw new Error(`bad int parse on "${str}"`)
  }
  return parseInt(str)
}

function xor(a, b) {
  // returns the logical xor of the booleans a and b
  // returns a bool no matter how bool-y the arguments are
  return !!a != !!b
}
RegisterTest("xor", () => {
  assertEqual(xor(0, 0), false)
  assertEqual(xor(0, 1), true)
  assertEqual(xor(1, 0), true)
  assertEqual(xor(1, 1), false)
})

async function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

function back(arr, i=1) {
  return arr[arr.length-i]
}

function pcoord(x, y) {
  return new Pos({x, y})
}

function posDir(p, dir, len=1) {
  const dx = [1,0,-1,0][dir]
  const dy = [0,-1,0,1][dir]
  const delta = pcoord(len*dx, len*dy)
  return p.add(delta)
}

function oppDir(dir) {
  // returns the opposite direction
  return saneMod(dir + 2, 4)
}

function objFilter(obj, pred) {
  const res = {}
  for (const prop of Object.keys(obj)) {
    if (pred(prop, obj[prop])) {
      res[prop] = obj[prop]
    }
  }
  return res
}
RegisterTest("objFilter", () => {
  assertObjEqual(
    objFilter({a: 1, b: 2}, (k, v) => v === 2),
    {b: 2},
  )
  assertObjEqual(
    objFilter({a: 1, b: 2}, (k, v) => k === 'a'),
    {a: 1},
  )
})

function argmin(arr) {
  assert(arr.length > 0, "argmin([]) is not defined")
  let arg = 0
  let min = arr[0]
  for (let i = 0; i < arr.length; i++) {
    const elem = arr[i]
    if (elem < min) {
      arg = i
      min = elem
    }
  }
  return {arg, min}
}
RegisterTest("argmin 1", () => {
  const {arg, min} = argmin([30,60,25,100])
  assertEqual(arg, 2)
  assertEqual(min, 25)
})
RegisterTest("argmin 2", () => {
  const {arg, min} = argmin([1])
  assertEqual(arg, 0)
  assertEqual(min, 1)
})

//
// functions for use in the chrome dev tools:
//

function addDiffListener(evName, ignore=[]) {
  // e.g. addDiffListener("mousewheel", ["timestamp"])
  let last = null;
  window.addEventListener(evName, (e) => {
    if (last) {
      diffSummary(last, e, ignore)
    }
    last = e
  })
}

function diffSummary(a, b, ignore=[]) {
  const d = diff(a, b)
  console.log("old:")
  for (const prop of Object.keys(d.old)) {
    if (ignore.includes(prop)) { continue }
    console.log(`  ${prop}: ${d.old[prop]}`);
  }
  console.log("new:")
  for (const prop of Object.keys(d.new)) {
    if (ignore.includes(prop)) { continue }
    console.log(`  ${prop}: ${d.new[prop]}`);
  }
}

function diff(a, b) {
  const res = { old: {}, new: {}}
  for (const prop in a) {
    if (a[prop] !== b[prop]) {
      res.old[prop] = a[prop]
      res.new[prop] = b[prop]
    }
  }
  for (const prop in b) {
    if (a[prop] !== b[prop]) {
      res.old[prop] = a[prop]
      res.new[prop] = b[prop]
    }
  }
  return res
}

function listen(evName) {
  window.addEventListener(evName, console.log)
}

function autowin(dt=5) {
  reset()
  const winStr = "01033330000000302110323003300111123331103332222110220122222221211111210333333033212233001111111130011203322333333033011112111112210002330011111122232211032301033333303301000000031222220000030330011222212230000022221111110330332221110233300111111133333033211322221112222222111111110111111222203322101012222222121111110111111222221222222121111110111111222221222222121111110111111211221100333033323022330013221010000000333032321"
  play(winStr, dt)
}

function showMap() {
  canvas.style.display=null
}

//
// misc
//

function downloadFile(name, contents, mime_type) {
  mime_type = mime_type || "text/plain";

  let blob = new Blob([contents], {type: mime_type});

  let dlink = document.createElement('a');
  dlink.download = name;
  dlink.href = window.URL.createObjectURL(blob);
  dlink.onclick = function(e) {
    // revokeObjectURL needs a delay to work properly
    let that = this;
    setTimeout(function() {
      window.URL.revokeObjectURL(that.href);
    }, 1500);
  };

  dlink.click();
  dlink.remove();
}

async function playSound(audioElement) {
  if (!audioElement) { return }
  audioElement.pause()
  audioElement.currentTime = 0
  await audioElement.play()
}

function globalExists(cb) {
  // e.g. globalExists(() => tileData)
  try {
    cb()
    return true
  } catch (e) {
    if (e.name === "ReferenceError") {
      return false
    } else {
      throw e
    }
  }
}
