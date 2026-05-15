import { useState } from "react";
import { useI18n } from "../i18n";
import { tenantStore } from "../mock/tenants";
import type { Membership, Role } from "../types";

const ROLES: Role[] = ["viewer", "operator", "admin", "auditor", "cross_tenant_auditor"];

export function MembersAdmin({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const [members, setMembers] = useState<Membership[]>(tenantStore.members(tenantId));
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => setMembers([...tenantStore.members(tenantId)]);

  const grant = () => {
    if (!userId.trim()) {
      setError(t("members.userId"));
      return;
    }
    tenantStore.grant(tenantId, { userId: userId.trim(), role });
    setUserId("");
    setError(null);
    refresh();
  };

  const revoke = (m: Membership) => {
    tenantStore.revoke(tenantId, m);
    refresh();
  };

  return (
    <section className="members-admin">
      <h3>{t("members.heading")}</h3>
      <p className="admin-hint">{t("members.hint")}</p>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="members-grant">
        <label>
          {t("members.userId")}
          <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-0000-0000-..." />
        </label>
        <label>
          {t("members.role")}
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={grant}>
          {t("members.grant")}
        </button>
      </div>
      <ul className="members-list">
        {members.map((m, i) => (
          <li key={`${m.userId}-${m.role}-${i}`}>
            <span>
              <code>{m.userId}</code> — {m.role}
            </span>
            <button type="button" onClick={() => revoke(m)}>
              {t("members.revoke")}
            </button>
          </li>
        ))}
        {members.length === 0 && <li>{t("members.empty")}</li>}
      </ul>
    </section>
  );
}
