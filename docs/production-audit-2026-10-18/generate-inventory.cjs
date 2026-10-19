// Local static inventory only; no environment, provider, database or network access.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), ts = require('typescript');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'evidence');
const files = [];
for (const dir of ['app', 'actions', 'utils', 'lib', 'components', 'contexts', 'hooks']) {
  const walk = directory => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full); else if (/\.[cm]?[jt]sx?$/.test(full)) files.push(full);
  }}; walk(path.join(root, dir));
}
const inventory = files.sort().map(file => {
  const source = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const exports = [], imports = [], operations = [], guards = [], calls = [];
  function visit(node) {
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if ((ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isFunctionDeclaration(node)) exports.push({ name: node.name?.text || 'default', line });
      else for (const d of node.declarationList.declarations) exports.push({ name: d.name.getText(ast), line });
    }
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(ast);
      if (/^(prisma|tx|db)\./.test(call)) operations.push({ call, line });
      if (/(requireAuth|requireClub|authorize|requirePlatformAdmin|interviewActor|assert.*Access|lockOperationalClub)/.test(call)) guards.push({ call, line });
      if (/^(get|save|set|update|delete|create|book|list|publish|respond|load)[A-Z]/.test(call)) calls.push({ call, line });
    }
    ts.forEachChild(node, visit);
  } visit(ast);
  return { file: path.relative(root, file), sha256: crypto.createHash('sha256').update(source).digest('hex'), lines: source.split('\n').length, client: /^['"]use client['"]/m.test(source), serverActions: /^['"]use server['"]/m.test(source), exports, imports, operations, guards, calls };
});
const summary = { sourceFiles: inventory.length, pages: inventory.filter(x => /\/page\.tsx$/.test(x.file)).length, routeHandlers: inventory.filter(x => /\/route\.ts$/.test(x.file)).length, actionFiles: inventory.filter(x => x.file.startsWith('actions/')).length, actionExports: inventory.filter(x => x.file.startsWith('actions/')).reduce((n,x) => n+x.exports.length,0), clientFiles: inventory.filter(x => x.client).length, serverActionModules: inventory.filter(x => x.serverActions).length, note: 'AST/file inventory, not proof of authorization or complete dynamic call resolution. Raw SQL, delegates through helper arguments, dynamic imports and destructured exports require manual review.' };
fs.writeFileSync(path.join(output, 'source-inventory.json'), JSON.stringify({ summary, files: inventory }, null, 2)+'\n');
console.log(JSON.stringify(summary, null, 2));
