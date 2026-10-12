const { Prisma, PrismaClient } = require('@prisma/client')

// Catalog reads only. Runtime roles intentionally cannot read migration history;
// inspect that separately with the approved migration/operator connection.
const catalogQuery = `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`

function missingColumns(columns) {
  const present = new Set(columns.map(row => `${row.table_name}.${row.column_name}`))
  return Prisma.dmmf.datamodel.models.flatMap(model => model.fields
    .filter(field => field.kind !== 'object')
    .map(field => `${model.dbName || model.name}.${field.dbName || field.name}`)
    .filter(column => !present.has(column)))
}

async function main() {
  // Require a deliberate target; never silently use a developer's default URL.
  const datasourceUrl = process.env.OUTCLASS_DATABASE_CHECK_URL
  if (!datasourceUrl) {
    console.error('Set OUTCLASS_DATABASE_CHECK_URL securely to the intended runtime database connection. This check is read-only.')
    process.exitCode = 1
    return
  }
  const prisma = new PrismaClient({ datasourceUrl, log: [] })
  try {
    const columns = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      return tx.$queryRawUnsafe(catalogQuery)
    })
    const missing = missingColumns(columns)
    if (missing.length) {
      console.error(`Release blocked: ${missing.length} required database columns are unavailable:\n${missing.join('\n')}`)
      console.error('Inspect Prisma migration status and the approved migration plan before publishing. No migration was executed.')
      process.exitCode = 1
      return
    }
    console.log('Required Prisma tables and columns are visible to this connection. Confirm migration status, runtime permissions and authenticated smoke tests before promotion.')
  } catch (error) {
    // Provider errors can contain connection details. Emit only a bounded code.
    const code = /^P\d{4}$/.test(error?.code || error?.errorCode || '') ? error.code || error.errorCode : 'DATABASE_CHECK_FAILED'
    console.error(`Release database check failed (${code}). Check the intended connection and its read permissions. No migration was executed.`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

module.exports = { catalogQuery, missingColumns }
if (require.main === module) void main()
