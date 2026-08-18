import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

interface Membership {
  user_id: string;
  tenant_id: string;
  role: string;
}

interface MembersAdminProps {
  tenantId: string;
}

const ROLES = ["viewer", "operator", "admin", "auditor", "cross_tenant_auditor"] as const;

const TENANT_API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_TENANT_API ?? "http://localhost:8081/v1/tenants";
const ROLE_HEADER = "X-Will-Role";
const ADMIN_ROLE = "admin";

export function MembersAdmin({ tenantId }: MembersAdminProps) {
  const { t } = useI18n();
  const [members, setMembers] = useState<Membership[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<typeof ROLES[number]>("viewer");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch(`${TENANT_API}/${tenantId}/members`, {
        headers: { [ROLE_HEADER]: ADMIN_ROLE },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMembers(((await res.json()) as Membership[]) ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    refresh();
  }, [tenantId]);

  const grant = async () => {
    if (!userId.trim()) {
      setError(t("members.error.userRequired"));
      return;
    }
    try {
      const res = await fetch(`${TENANT_API}/${tenantId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json", [ROLE_HEADER]: ADMIN_ROLE },
        body: JSON.stringify({ user_id: userId.trim(), role }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setUserId("");
      setError(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const revoke = async (m: Membership) => {
    try {
      const res = await fetch(`${TENANT_API}/${tenantId}/members`, {
        method: "DELETE",
        headers: { "content-type": "application/json", [ROLE_HEADER]: ADMIN_ROLE },
        body: JSON.stringify({ user_id: m.user_id, role: m.role }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
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
          <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        </label>
        <label>
          {t("members.role")}
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
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
          <li key={`${m.user_id}-${m.role}-${i}`}>
            <span>
              <code>{m.user_id}</code> — {m.role}
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
