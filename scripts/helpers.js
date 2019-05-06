// misc list of various nice-to-have functions that i'll probably forget about:
// * showmode=1
// * debugIds=1
// * singleButtons()
// * randLevel()
// * Q to cycle template actors
// * swapColors()
// * screenshotMini (only works through localhost)
// * autoScreenshotMini (only works through localhost)
// * screenshot (only works through localhost)
// * tracer.toggle()
// * serFrame(player.frameStack)
// * getUniqueRoomFromNamePrefix()
// * reserializeLevel()
// * reserializeAllLevels() // broken?



//
// testing; used later in this file so it needs to be first
//

const allTests = []
function RegisterTest(name, test) {
  allTests.push({name, test})
}
function RunTests() {
  for (const {name, test} of allTests) {
    try {
      test()
    } catch (err) {
      console.log(`Test failed: '${name}'`);
      throw err
    }
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
  throw new Error(`expected an error (${msgMatch}); got none`)
}

function assertObjMatch(actual, expected, _path="") {
  for (const prop of Object.keys(expected)) {
    const pathToProp = `${_path}.${prop}`
    if (expected[prop] && expected[prop].constructor === Object) {
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

function randName(length) {
  const chars = []
  for (let i = 0; i < length; i += 1) {
    chars.push(String.fromCharCode(randInt(65, 91)))
  }
  return chars.join('')
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
  val = hex(str)
  ;([val, b] = divmod(val, 256))
  ;([val, g] = divmod(val, 256))
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

function invertObject(obj) {
  const res = {}
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (k == "null" || k == "undefined" || v === null || v === undefined) {
      assert(0, "can't invert when there are nullishes")
    }
    assert(res[v] === undefined, `object is not 1-1: multiple keys have value ${v}`)
    res[obj[k]] = k
  }
  return res
}
RegisterTest("invertObject", () => {
  assertObjEqual(invertObject({}), {})
  assertObjEqual(invertObject({a: 1}), {1: 'a'})
  assertObjEqual(invertObject({a: 1, b: 2}), {1: 'a', 2: 'b'})
  expectError(
    () => invertObject({a: 1, b: 1}),
    "multiple keys have value"
  )
  expectError(
    () => invertObject({a: null}),
    "nullishes"
  )
  expectError(
    () => invertObject({null: 3}),
    "nullishes"
  )
})

function sum(arr) {
  let res = 0
  for (const x of arr) {
    res += x
  }
  return res
}
RegisterTest("sum", ()=> {
  assertEqual(sum([5,2,3]), 10)
  assertEqual(sum([]), 0)
  assertEqual(sum([-9]), -9)
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

function serialize(x) {
  if (x && x.serialize && x.serialize.constructor === Function) {
    return x.serialize()
  } else {
    return `${x}`
  }
}

// instead of this:
//     while (true) {
//       do stuff, break eventually
//     }
// use this:
//     let s = getSafeSentinel()
//     while (s()) {
//       do stuff, break eventually
//     }
function getSafeSentinel(max=100) {
  let i = 0
  return () => {
    i += 1
    if (i < max) {
      return true
    } else {
      throw new Error("loop sentinel triggered!")
    }
  }
}

//
// functions for use in the chrome dev tools:
//

function singleEventListener(evName, cb) {
  const handler = (e) => {
    window.removeEventListener("keydown", handler)
    return cb(e)
  }
  window.addEventListener("keydown", handler)
}

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

let keyHist = null
function recordingCycle() {
  recordingStop()
  recordingStart()
}
function recordingStart() {
  console.log("Recording moves...")
  // recordingOutput.innerText = ""
  keyHist = []
}
function recordingStop() {
  assert(keyHist !== null)
  const str = keyHist.join('')
  recordingOutput.innerText = `Recorded Moves: ${str}`
  if (!devmode) return

  console.log("Recorded moves:");
  console.log(str)
  const reduced = reduceWinstr(str)
  if (str !== reduced) {
    console.log("(reduced):");
    console.log(reduced)
  }
}
function RecordKeyHist(dir) {
  if (!keyHist) return
  keyHist.push(dir)
}

function play(moves, dt=50) {
  reset()
  play_(moves, dt)
}

function play_(moves, dt=50) {
  let ix = 0
  const keyHistInterval = setInterval(() => {
    if (ix >= moves.length) {
      clearInterval(keyHistInterval)
      return
    }
    const dir = int(moves[ix])
    ProcessInput(dir)
    ix += 1
  }, dt)

  singleEventListener("keydown", e=>{
    if (ix < moves.length) {
      console.log("Aborted at", ix);
    }
    clearInterval(keyHistInterval)
  })
}
const solutions = {
  push: {
    win: "22122211023300111112212110011",
  },
  block: {
    win: "033000002222112111100032232111222100300300330112332211233233110033001103332333000000011003300000011100330011",
  },
  poke: {
    win: "211111100011211212233300221110030333333233003033323101112122110111111212233300003322233330000000000001",
  },
  passage: {
    win: "010000000000003322222200000011222222222222212111101112111111111331100111211100033033303323233332222222222222",
    bonus: "100000000000003322222200000003322211111121212111101112111111333333033323331101112111111111011121110030000003322211111012232132211000022211110111211111111133110111211100033033303323323333222222222222",
  },
  original: {
    win: "00103333000000302110323000033222211012222223211111211100332321130011223303333003300100000030001123032220332211012222223211111121110033232113033332233302110033311111111121221000111222",
  },
  spy: {
    win: "00100333001110101222000112122331101112233330003333300111011222232121111111232330211032301033333000000332101222212033212130012321113311133330000033333221100000022111032323222330011111222220001300333332211113300001132010323222233001111122222000003333133221111000000",
  },
  tunnels: {
    // win: "103330330000300011112222332221121111230022221033033000030001111101112211033311211003110033222332222222", // my old solution
    win: "103330030003000111122223322111211211033311121123221033030000300011112223223232222222", // ethan's no-push solution
    // even with ethan's solution, you still need to push black to get the bonus: 103330030003000111122223322211330001100003333222122221211222303300011000033332221222113303210003000111122223322211211033311121123221033003000300011112222332222223330003000111
    bonus: "1033300300030001111222332332221133000110000333322212222121122230330001100000333233332221223221113300030001111222200022233222112111123002222103300300300300011111011121103331121110032223322222233300030001111101112113000333230000222111222303323332333332221223211133000300011111101112110333112111032233233222222",
  },
  oldstomach: {
    win: "21221122233332330003330211003330033333323001033333311111222100033330001122221221101123002111000330033333330033330003332211",
  },
  butterfly: {
    win: "3333233233333333333322222322222333322230032321210000000001230100322332121003011111111103201112332230301121000000002222222230001001233232330010123203212103011111111111333123000000100003311100000011111111111210023322222222233333222000111110000000000301100010011210",
  },
  balloon: {
    win: "33301112222222330121000003012100000011030322222200333001000000112303232111133133210000223222223221112221100033221103333333333303320112333333333322",
    bonus: "33301112222222330012100000301210000001103032222220333033300100030001112303232111121110032123230303332100002232222232211122212230010333333333303320112333333333323000132221000010303222222",
  },
  bubbles: {
    win: "00333330332330122221233333233033333333023301111211111112113112211111211111103323331110000332233232210301122111112111111003333333333111121111101103333332111110111222233303001111211111111111003001000000000000011111003001000000000000301111100300100000000003",
    bonus: "0033333033233012222123333323303333333333011112111111121112211111211111103300033223100003333330300123211001111121111122223332110011111211111221122211233333333331111222221223221002111112222000033333230030010000012111111123300033223303222222000012230030011130011111211111221122211232303333221221000110000333333001100112221123333332212210001100112221112222333030011112111111111110010030000000000001000003011111001003000000000103",
    cheese: "003333303323301222212333330332333333333303001100000011111000000002222222233333220100000301111100000",
    wip: 1,
  },
  dolphin: {
    win: "222111100011211011233330333333333322111333001111111111211110332332112230000022230033222333300000000333333330000222211111111222222221111000112110112333303000222330121002212111101003311223333303333333333221111222000222200003333001111111111211111003332223303322233330000000033333333000000000333300111111111121111110",
    bonus: "22221111000112211103330000222211330000010333111222230322201122333331110001100032222211222300000022223011011233330333333333332211133303001111111110002223301210022121111101003332223303322233333000000003333333300000222112111111112222222211110001121100110111223333333033333333332211112220003333001111111111211111003332213001112233333033333333332211112222000033330011111110112112111103303332221333033222333330000000330333333330000000003333001111111111211111210",
  },

  wack: {
    win: "001033303000003021103230033001111233311103333222211020122222212111211100033223210333303321111121211000332333323233001033111121111321211023301210011111122212222222111112110111111222122222221111121101111112221222000303322110122222213211111211011111122110333333223000000033321",
    bonus: "001033303000003021103230033001111233311103333222211020122222212111211100332321033330332122330211001111212110003323333333311111112121102330121001113332330333330002221111101112111222322110332301030322032201100000010333303000000303300112222122300000222211111103133033222111023330011322112212222212111121101111112222122222221111121101111112222122222221201111211011111122221222222211111211011111120333333233303333000000030332211012222222111112110111111221103333332230000000333032321121",
  },
  door: {
    win: "013221111111111112111222222223332332222333333033332222203323000000000331122222222210112111003122333000000000111011000011111121111000033303303321111112212030033333333333333001322111111111111121122222222332333222233333303333222233230000000003211011233332233223301012222222221011211100312233300000000011101100001111112111100030033333333333211130011000100322222222200333303330013221111111111111211222222223332332222333333033332222332300000000032321111221122222",
    bonus: "013221111111111112111222222223332332222333333033332222203323000000000331122222222210112111003122333000000000111011000011111121111000033303303321111112212030033333333333333001322111111111111121122222222332333222233333303333222233230000000003211011233332233223301012222222221011211100312233300000000011101100001111112111100030033333333333211130011000100322222222000000100322222332211220033330333001322111111111111121122222222332333222233333303333222220332300000000032223322110002332233000100322221012222222221011211100312233300000000011110100001111112111100003011011233333333033233333333001322111111110112111122122222223233332222333333033332222332300000000032222222123303321111012222",
  },
  bellyache: {
    win: "12222330033033102110033300333333230010333333111112221000333300012122333300000211100033003333333003333000333221100001111122111112",
    bonus: "122223300033302110033323300000333300333333233011111110122033333330033330001122221220211001000112111012223210122003310033330332223223233011300000330322211112211111112211122333300000211100033003333333003333000333221100001111122111110003333033223333331111110011211112223333300333330000103222221111122111133330033333000001001121111222",
  },

  porpoise: {
    win: "12122114444444444442111122330332114444444403123303321113003333312233303332232110111121111121021111011000332332211121111011113121111011100332332112111100330332011230321111211103321101123323333023033033303320112111223333030011230321233122211",
  },
  sadclown: {
    win: "233322122223233011210000103230001111221112",
  },
  clownparty: {
    win: "0300002222322222203322110132321001030001121101122110332330332222233001322103012100000211000112233033230021112112111112",
    bonus: "233222121203033322121033001100011211011221100000010332330332222332330000112233030000222232222233212101123030000021100332300221211211011110010112221222221222110111122212222123100333230000300033330330030000300033232233311100101122212222212221100023300300003000332322333323303322232221000000030113221100301132211211133303300300003000332322",
    // ugh two different cheeses.... but they're... maybe fine, since sadclown doesn't have any? bleh (and neither cheese here gets the bonus)
    // _not_ very elegant.... but maybe okay
    // cheese is fixed b/c you cant leave brown until purple is full
    fixed2: "1222232210000002110033221121101313233033003323303322231000030022121121101111001011222212222122211011100",

    // ehhhh this is only sorta cheese... you still end up looping.
    // the issue is you might not notice; this might be the first solution you try and you'll learn nothing
    // could prevent it by blocking up near top of orange (so you can't push blocks back in place) but that ruins the really really good bonus...
    // cheese: "12121113330322321222032031100331121322100300122321000300121110132333032222332333032223322121033012100000030001121121203033232300211011212211111122",
  },
  roots: {
    win: "22223323323330333300010033001000111121100332333011113333333300010033001000111111111110010033001000333331113330121100111023332233000022221113001100001111122221112222",
  },

  //
  // rejected / testing / etc:
  //

  slightly: {
    win: "12221121111223333332333110111111100333303300011112220003321111133333033222333232232211111112212102103021010332300301210301210322322301211003221233333033210122200033332222300",
  },
  dollop: {
    win: "0333233011112100233311111030333332333333330000001000003330012100031301300122222202103323000100300112330332111103201112330332221030011230322222223211210301113440011223333230004110033222213300101233210112123003221231122223222222111111110111112223330103303321111121001100332222321100112233330110333122210430033211210003300121100112233333011322200201301223333033211111322211001033323000000102301033033211111121001100332222203333222222111223333323333333001100001000001033332",
    // is this even cheese? yes, b/c no unpacking in black... it's not a great level tho
    cheese: "0333333332333333330000001000000333012100043001322122103332300043001222224241233033113321111230000220221101233300003012100222322301114210000300122222210323103230000000112330332111103201112330332221030011230322222224444412223223012100010032222232200011332212101023301444441032230301210010032222123033221030110011223333231003321210011003322223014011203324444443221111003223023301001123122330001003222230111232223444444444111244122030323214411222304444444441222230041000332101212323302103011121000000103303321144444444440103303321111112100110033222220333233222122223333323333333001100000100001033332",
    wip: 1,
  },
  froot: {
    win: "211033330003330112333300333333001000001121113303330003330012223333322222212232222031000100300000011332222224444444444444444444444441222333332222221223222322211111002300322231333303311121113330000022100010030000001111333322222212220322232221112033330332303330",
  },
  nest: {
    win: "1111122300111122223201223222100333321222223000330332210033322222230000332100",
  },
  tree: {
    win: "12233333333332333330010011000031222233221111011122122211011211002002223330332203300033233330033000033033332232331101122211212222222222222222220000000000000000000330000300111122221111111121101133233011111223332",
  },
  riptest2: {
    win: "00000103330003000112222200000333332221101121111211",
    bonus: "23300003001222222444444422100030001222222222244444444444444010003000122222212232222222222222222222",
  },
}
function playSolution(name, dt=10) {
  const sols = solutions[currentLevelName]
  if (!sols) return
  const sol = sols[name]
  if (!sol) return
  play(sol, dt)
}
const win = (dt=0) => playSolution("win", dt)
const bonus = (dt=0) => playSolution("bonus", dt)
const cheese = (dt=0) => playSolution("cheese", dt)

const winTickTock = (dt=0) => {
  let redR = `011111000003322233300000`
  let redL = `222211100011222223333322`
  let brownU = `10${redR}${redR}${redR}${redR}112${redL}${redL}${redL}${redL}11111`
  let brownD = `33330${redR}${redR}${redR}${redR}332${redL}${redL}${redL}${redL}332`
  let sol = `1${brownU}${brownU}${brownU}${brownU}003${brownD}${brownD}${brownD}${brownD}001${brownU}${brownU}${brownU}${brownU}`
  console.log({length: sol.length});
  play(sol, dt)
}

function reduceWinstr(s) {
  const res = []
  const sent = getSafeSentinel()
  while (sent()) {
    const match = s.match(/^(.*)45(.*)$/)
    if (!match) break
    s = match[1] + match[2]
  }
  assert(s.indexOf('5') === -1, "invalid winstr (bad 5)")

  const sent2 = getSafeSentinel()
  while (sent2()) {
    const match = s.match(/^(.*)[0123]4(.*)$/)
    if (!match) break
    s = match[1] + match[2]
  }
  assert(s.indexOf('4') === -1, "invalid winstr (bad  4)")

  return s
}
RegisterTest("reduceWinstr", () => {
  assertEqual(reduceWinstr(""), "")
  assertEqual(reduceWinstr("012302"), "012302")
  assertEqual(reduceWinstr("14"), "")
  assertEqual(reduceWinstr("0142"), "02")
  assertEqual(reduceWinstr("0452"), "02")
  assertEqual(reduceWinstr("0444455552"), "02") // illegal winstr, but it's fine
  assertEqual(reduceWinstr("00000044445555240450"), "00000000") // illegal winstr, but it's fine
})

function levelIsWIP(name) {
  const sol = solutions[name]
  return sol && sol.wip
}

async function autoScreenshotMini(name) {
  loadLevel(name)
  setTimeout(async () => {
    await screenshotMini(innerRoom(player.frameStack).name)
  }, 25)
}

async function screenshotMini(name) {
  const room = getUniqueRoomFromNamePrefix(name)
  if (!room) return

  const src = new MapPos(0, room.begin * miniTileSize)
  const w = 8*miniTileSize
  const h = 8*miniTileSize

  const newCanvas = document.createElement('canvas')
  newCanvas.width = w
  newCanvas.height = h
  const newCtx = newCanvas.getContext('2d')
  newCtx.imageSmoothingEnabled = false

  newCtx.drawImage(canvasMini,
    src.x, src.y, w, h,
    0, 0, w, h)

  newCanvas.toBlob(b=>downloadBlob(currentLevelName, b))
}

async function screenshot() {
  const oldShowmode = showmode
  showmode = 1
  Raf()
  setTimeout(() => {
    canvasView.toBlob(b=>downloadBlob("screenshot", b))
    showmode = oldShowmode // idk why you would care but hooray i restored it for you
    Raf()
  }, 25)
}

let devmode = false
function devmodeOn() {
  devmode = true
  mapOn()
}
function devmodeOff() {
  devmode = false
  mapOff()
}

let debugIds = false

function mapOn() {
  canvasMap.style.display = null
  canvasMini.style.display = null
}
function mapOff() {
  canvasMap.style.display = "none"
  canvasMini.style.display = "none"
}

let gameMuted = false
function muteToggle() { setGameMuted(!gameMuted) }
function setGameMuted(x) { gameMuted = x }
const mute = () => setGameMuted(true)
const unmute = () => setGameMuted(false)

let enableHeldButtons = true
function singleButtons() {
  enableHeldButtons = false
}

function listLevels() {
  for (const { name } of levelData) {
    console.log('  ', name)
  }
}

function debugActorState() {
  for (const a of actors) {
    console.log(a.serialize(), !a.dead);
  }
}

function viewOffset() {
  // hacky
  if (gameState === GS_PLAYING) {
    return new MapPos(4, 4)
  } else if (gameState === GS_MENU) {
    return new MapPos(0, 0)
  } else {
    assert(0, "bad gameState")
  }
}

function reserializeAllLevels() {
  for (const { name } of levelData) {
    reserializeLevel(name)
  }
}

function reserializeLevel(name) {
  assert(Import(name))
  SaveLevel(name)
}

function randLevel() {
  const success = loadLevel("template")
  assert(success)

  //
  // tiles
  //
  for (const room of rooms) {
    for (let y = 1; y < 7; ++y) {
      for (let x = 1; x < 7; ++x) {
        if (Math.random() < 0.30) {
          setTile(new RoomPos(room, x, y), 1, false)
          continue
        }

      }
    }
  }

  //
  // actors
  //

  actors = []

  function randPos() {
    const room = choose(rooms)
    const x = randInt(1, 7)
    const y = randInt(1, 7)
    return new RoomPos(room, x, y)
  }

  function place(a) {
    actors.push(a)
    if (!CanMoveToTile(a.pos)) setTile(a.pos, 0, false)
  }

  player.pos = randPos()
  place(player)
  place(new Flag(randPos()))
  const cols = "White Pink Red Orange Yellow Green Blue Purple Brown Black".split(' ')
  for (const col of cols) {
    const r = Room.findName(col)
    assert(r)
    place(new Mini(randPos(), r))
    place(new Mini(randPos(), r))
  }

  player.frameStack = cons(player.pos.room(), null)

  //
  // redraw
  //

  viewFrameStack = player.frameStack
  ResetTileCache()
  Raf()
}

function getUniqueRoomFromNamePrefix(prefix) {
  prefix = prefix.toLowerCase()
  let res = null
  for (const r of rooms) {
    if (r.name.toLowerCase().startsWith(prefix)) {
      if (res) return null
      res = r
    }
  }
  return res
}

function swapColors(...cols) {
  assert(cols.length > 0)
  const rs = cols.map(c=>getUniqueRoomFromNamePrefix(c))
  if (rs.some(r=>r===null)) {
    console.log(`failed`)
    return
  }
  const temp = rs[0].name
  for (let i = 0; i < rs.length - 1; ++i) {
    rs[i].name = rs[i + 1].name
  }
  rs[rs.length-1].name = temp
  ResetTileCache()
}

//
// misc
//

function downloadFile(name, contents, mime_type) {
  const blob = new Blob([contents], {type: mime_type || "text/plain"})
  return downloadBlob(name, blob)
}

function downloadBlob(name, blob) {
  // const url = window.URL.createObjectURL(blob);
  // location.href = url

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
  if (gameMuted) { return }
  if (!audioElement) { return }
  // console.log(audioElement.id);
  audioElement.pause()
  audioElement.currentTime = 0
  try {
    await audioElement.play()
  } catch (err) {
    // console.warn(`playSound(${audioElement.id}) failed`)
  }
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
