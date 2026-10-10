# OutClass email production publication

The application redesign is live at `www.out-class.net` on commit `50c85c1c0ec2eab8d45820fea3ee1f4c22585ae5`. All four active Supabase Auth email bodies are published and verified against the approved files.

Read the [complete production report](docs/email-deployment/REPORT.md) for deployment IDs, individual template status, six delivered test-message IDs, validation results, limits, and rollback instructions.

The separate Vercel preview built successfully but its Auth pages are blocked by missing Preview Supabase variables. It was not promoted; production variables and configuration were preserved.
