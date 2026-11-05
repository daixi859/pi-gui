(() => {
  const out = []
  document.querySelectorAll('button').forEach((b) => {
    const t = b.textContent.trim()
    if (!t) return
    const rb = b.getBoundingClientRect()
    const kids = [...b.children].map((k) => {
      const r = k.getBoundingClientRect()
      return { tag: k.tagName, top: Math.round(r.top), h: Math.round(r.height), txt: (k.textContent || '').trim().slice(0, 14) }
    })
    const tops = [...new Set(kids.map((k) => k.top))]
    out.push({ t: t.slice(0, 20), bh: Math.round(rb.height), bw: Math.round(rb.width), tops, kids })
  })
  return JSON.stringify(out)
})()
