function chromeTest() {
  try {
    eval(`
      class Foo {
        static member = 1
      }

      const re = /abc(?<name>\d+)def/
    `)
  } catch (err) {
    const apology = document.createElement('p')
    apology.innerText = "\n\nThis game only works in chrome right now; I'm sorry :("
    canvasMap.style.display = "none"
    canvasView.style.display = "none"
    explanation.appendChild(apology)
  }
}

chromeTest()
