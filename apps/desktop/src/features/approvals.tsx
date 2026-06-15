import { Check, Shield, X } from "lucide-react";

import { useT } from "../i18n";
import { EmptyView } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export function ApprovalsView() {
  const { t } = useT();
  const { approvals, decideApproval, loading } = useRuntimeStore();
  if (approvals.length === 0) return <EmptyView title={t("approvals.title")} text={t("approvals.empty")} icon={<Shield size={22} />} />;
  return (
    <section className="content-stack">
      <h2>{t("approvals.title")}</h2>
      {approvals.map((approval) => (
        <article key={approval.id} className="approval-card">
          <Shield size={18} />
          <div>
            <strong>{approval.request}</strong>
            <span>{t("tasks.risk", { level: approval.riskLevel })}</span>
          </div>
          <button onClick={() => void decideApproval(approval.id, "approved")} disabled={loading}>
            <Check size={16} /> {t("approvals.approve")}
          </button>
          <button className="danger" onClick={() => void decideApproval(approval.id, "denied")} disabled={loading}>
            <X size={16} /> {t("approvals.deny")}
          </button>
        </article>
      ))}
    </section>
  );
}
