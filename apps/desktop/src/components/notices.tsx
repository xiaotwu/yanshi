import { Check, Info } from "lucide-react";

import { useNotices } from "../lib/notices";

/** Bottom-center transient success/info notices. Polite live region (non-disruptive). */
export function Notices() {
  const notices = useNotices((state) => state.notices);
  const dismiss = useNotices((state) => state.dismiss);
  if (notices.length === 0) return null;
  return (
    <div className="notices" aria-live="polite">
      {notices.map((notice) => (
        <button key={notice.id} className={`notice notice-${notice.tone}`} onClick={() => dismiss(notice.id)}>
          {notice.tone === "success" ? <Check size={14} /> : <Info size={14} />}
          <span>{notice.message}</span>
        </button>
      ))}
    </div>
  );
}
