import { OutClassLogo } from "@/components/outclass-logo"
import { ProductPreviewCards } from "./product-preview-cards"

export function LoginBrandPanel({ signup = false }: { signup?: boolean }) {
  return (
    <aside className="oc-login-brand" aria-labelledby="login-brand-title">
      <OutClassLogo variant="dark" className="oc-login-logo" />
      <div className="oc-login-brand-content">
        <h1 id="login-brand-title">{signup ? "Create your OutClass profile." : <>One profile.<br />Every opportunity.</>}</h1>
        <p className="oc-login-brand-description">{signup ? "Create one student profile to use when applying to participating organizations." : "Sign in to check your applications, interviews, and club updates."}</p>
        <ProductPreviewCards />
      </div>
      <p className="oc-login-origin">Built at UVA.</p>
    </aside>
  )
}
