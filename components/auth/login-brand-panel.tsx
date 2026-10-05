import { OutClassLogo } from "@/components/outclass-logo"
import { ProductPreviewCards } from "./product-preview-cards"

export function LoginBrandPanel() {
  return (
    <aside className="oc-login-brand" aria-labelledby="login-brand-title">
      <OutClassLogo variant="dark" className="oc-login-logo" />
      <div className="oc-login-brand-content">
        <h1 id="login-brand-title">One profile.<br />Every opportunity.</h1>
        <p className="oc-login-brand-description">Discover clubs, apply, interview, and keep your UVA involvement in one place.</p>
        <ProductPreviewCards />
      </div>
      <p className="oc-login-origin">Built at UVA.</p>
    </aside>
  )
}
