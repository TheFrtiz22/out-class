// Measures the persistent header and the first visible text in the workspace content.
// `gap` is from the header's bottom edge to the top of the first visible line of text in <main>
// (the line box of the element that holds it), which is what a reader sees as "where the page starts".
function measureHeaderGap() {
  // Two rows when the visible pill and the utilities sit at different heights.
  function headerRows(header) {
    const pill = header.querySelector('.oc-product-workspaces'), tools = header.querySelector('.oc-product-utilities')
    if (!pill || !tools || !pill.getClientRects().length || getComputedStyle(pill).display === 'none') return 1
    const a = pill.getBoundingClientRect(), b = tools.getBoundingClientRect()
    return Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) > 12 ? 2 : 1
  }
  const header = document.querySelector('.oc-product-header'), main = document.querySelector('main#workspace-content')
  if (!header || !main) return null
  const box = header.getBoundingClientRect()
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, { acceptNode: node => node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT })
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement
    if (element.closest('[aria-hidden="true"], .sr-only, [hidden], [role="status"]')) continue
    const style = getComputedStyle(element)
    if (style.visibility === 'hidden' || style.display === 'none' || +style.opacity === 0) continue
    const range = document.createRange(); range.selectNodeContents(node)
    const rect = [...range.getClientRects()].find(r => r.width > 0 && r.height > 0)
    if (!rect) continue
    // The line box: the glyph box centred in the element's line height.
    const lineHeight = parseFloat(style.lineHeight) || rect.height
    // Content that opens with a pill switch (phone Explore / Events) starts at the switch's edge.
    const surface = element.closest('.oc-explore-switch')
    const lineTop = surface ? surface.getBoundingClientRect().top : rect.top + rect.height / 2 - lineHeight / 2
    return { headerHeight: Math.round(box.height * 10) / 10, gap: Math.round((lineTop - box.bottom) * 10) / 10, glyphGap: Math.round((rect.top - box.bottom) * 10) / 10, text: node.textContent.trim().slice(0, 48), rows: headerRows(header) }
  }
  return null
}
module.exports = { measureHeaderGap }
