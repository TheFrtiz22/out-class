import { ProductPreviewCards } from "./product-preview-cards"

/** Illustrative panel beside the sign-in and sign-up forms. Labelled "Sample"; never live data. */
export function LoginBrandPanel({ signup = false }: { signup?: boolean }) {
  return (
    <aside className="oc-login-brand" aria-labelledby="login-sample-title">
      <p className="oc-auth-sample-chip">Sample</p>
      <p id="login-sample-title" className="oc-login-brand-title">{signup ? "One profile for every club you apply to." : "Your applications, interviews and decisions in one place."}</p>
      <ProductPreviewCards />
    </aside>
  )
}
