import { OutClassLogo } from "@/components/outclass-logo"
import { ProductPreviewCards } from "./product-preview-cards"

export function LoginBrandPanel({ signup = false }: { signup?: boolean }) {
  return (
    <aside className="oc-login-brand" aria-labelledby="login-brand-title">
      <OutClassLogo variant="dark" className="oc-login-logo" />
      <div className="oc-login-brand-content">
        <h1 id="login-brand-title">{signup ? "Your campus opportunities start here." : <>One profile.<br />Every opportunity.</>}</h1>
        <p className="oc-login-brand-description">{signup ? "One profile. Every opportunity. Join OutClass to discover organizations, apply, and get involved." : "Discover clubs, apply, interview, and keep your UVA involvement in one place."}</p>
        <ProductPreviewCards />
      </div>
      <p className="oc-login-origin">Built at UVA.</p>
    </aside>
  )
}
