import { tenantStore } from "../mock/tenants";

export function ClassificationBanner() {
  const tenant = tenantStore.active();
  const label = tenant.theme.bannerLabel || "NESECRET";
  const bg = tenant.theme.primaryColor || "#1f7a1f";
  return (
    <div className="classification-banner" style={{ background: bg }}>
      {label}
    </div>
  );
}
