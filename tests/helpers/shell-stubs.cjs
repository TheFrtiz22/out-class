// Stubs for the persistent-shell modules, for unit harnesses that replace every other `@/` import.
// Outside app/(workspace) there is no shell, so pages render their own (as on `/` and `/preview`).
module.exports = {
  '@/components/ui/confirm-dialog': require('./confirm-stub.cjs'),
  '@/components/shell/workspace-shell-context': { useShellBindings() {}, useInWorkspaceShell: () => false, WorkspaceShellContext: null },
  '@/lib/shell-metrics': { countShellStart() {} },
}
