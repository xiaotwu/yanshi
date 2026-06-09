import { Check, Shield, X } from "lucide-react";

import { EmptyView } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export function ApprovalsView() {
  const { approvals, decideApproval, loading } = useRuntimeStore();
  if (approvals.length === 0) return <EmptyView title="Approvals" text="No approvals pending." />;
  return (
    <section className="content-stack">
      <h2>Approvals</h2>
      {approvals.map((approval) => (
        <article key={approval.id} className="approval-card">
          <Shield size={18} />
          <div>
            <strong>{approval.request}</strong>
            <span>{approval.riskLevel} risk</span>
          </div>
          <button onClick={() => void decideApproval(approval.id, "approved")} disabled={loading}>
            <Check size={16} /> Approve
          </button>
          <button className="danger" onClick={() => void decideApproval(approval.id, "denied")} disabled={loading}>
            <X size={16} /> Deny
          </button>
        </article>
      ))}
    </section>
  );
}
