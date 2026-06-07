import { AdminSourceTargets } from "@/components/admin-source-targets";

export default function AdminSourcesPage() {
  // Mirror the server-side dev-static gate: the fixture parser is only offered
  // outside production (Vercel previews run with NODE_ENV=production, so gate on
  // VERCEL_ENV instead).
  const allowDevParser = process.env.VERCEL_ENV !== "production";

  return <AdminSourceTargets allowDevParser={allowDevParser} />;
}
