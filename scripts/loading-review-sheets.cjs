const sharp = require('sharp'), path = require('node:path')
async function main() {
  const root = 'docs/loading-experience/evidence'
  for (const width of [1440, 1280, 768, 390, 320]) {
    for (const [group, names] of [['workspace', ['club', 'recruiting', 'members', 'tasks', 'announcements', 'pipeline', 'scheduling', 'application-settings']], ['layouts', ['interview', 'voting', 'presentation', 'form', 'document', 'calendar', 'schedule', 'feed', 'table']]]) {
      const tileWidth = Math.min(width, 560), buffers = []
      let height = 0
      for (const name of names) {
        const filename = group === 'workspace' ? `${name}-${width}-loading.png` : `layout-${name}-${width}.png`
        const buffer = await sharp(path.join(root, filename)).resize({ width: tileWidth }).toBuffer()
        const metadata = await sharp(buffer).metadata()
        buffers.push({ name, buffer }); height = Math.max(height, metadata.height)
      }
      const tileHeight = height + 34, items = []
      buffers.forEach(({ name, buffer }, index) => {
        const left = index % 3 * (tileWidth + 12), top = Math.floor(index / 3) * (tileHeight + 12)
        items.push({ input: Buffer.from(`<svg width="${tileWidth}" height="28"><rect width="100%" height="100%" fill="#faf8f4"/><text x="8" y="20" font-size="16" fill="#142d4e">${name} · ${width}px</text></svg>`), left, top }, { input: buffer, left, top: top + 28 })
      })
      await sharp({ create: { width: (tileWidth + 12) * 3 - 12, height: (tileHeight + 12) * Math.ceil(names.length / 3), channels: 3, background: '#e9e4da' } }).composite(items).png().toFile(path.join(root, `review-${group}-${width}.png`))
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
