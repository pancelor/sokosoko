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
assert(clamp(0, 3, 10) === 3)
assert(clamp(3, 3, 10) === 3)
assert(clamp(5, 3, 10) === 5)
assert(clamp(10, 3, 10) === 10)
assert(clamp(11, 3, 10) === 10)
assert(clamp(-5, 3, 10) === 3)

function saneMod(x, y) {
  // mod(x, y) returns a number in [0, y), like % should do (but doesn't)
  x = x % y
  if (x < 0) { x += y}
  return x
}
assert(saneMod(3, 10) === 3)
assert(saneMod(0, 10) === 0)
assert(saneMod(10, 10) === 0)
assert(saneMod(-6, 10) === 4)

function divmod(x, y) {
  return [Math.floor(x / y), saneMod(x, y)]
}
assertEqual(divmod(10, 3)[0], 3)
assertEqual(divmod(10, 3)[1], 1)

function hex(str) {
  const match = str.match(/^[#]?(?<code>[a-fA-F\d]+)$/)
  if (!match) {
    throw new Error(`bad hex parse on "${str}"`)
  }
  return parseInt(match.groups.code, 16)
}
assertEqual(hex("FFA300"), 16753408)
assertEqual(hex("#FFA300"), 16753408)

function hexColor(str) {
  let val, r, g, b
  val = hex(str); // these semicolons are very important b/c of the ['s coming up
  [val, b] = divmod(val, 256);
  [val, g] = divmod(val, 256);
  r = val
  return {r, g, b}
}
assertObjMatch(hexColor("#FFA300"), {r:255, g:163, b:0})


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
assert(xor(0, 0) === false)
assert(xor(0, 1) === true)
assert(xor(1, 0) === true)
assert(xor(1, 1) === false)

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

//
// testing
//

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
      assert(actual[prop] === expected[prop], `${pathToProp}: expected ${expected[prop]}; got ${actual[prop]}`)
    }
  }
}
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
