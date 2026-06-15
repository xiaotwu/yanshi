import { useState } from "react";

import { Composer } from "../components/composer";
import { useT } from "../i18n";

export function NewTaskView({
  onRuns,
  onOpenProviderSettings,
}: {
  onRuns: () => void;
  onOpenProviderSettings?: () => void;
}) {
  const { t } = useT();
  const [seed, setSeed] = useState<string | undefined>(undefined);
  const examples = [t("home.example1"), t("home.example2"), t("home.example3")];
  return (
    <section className="center-stage">
      <div className="composer-wrap">
        <h1>{t("composer.title")}</h1>
        <Composer onSubmitted={onRuns} initialText={seed} onOpenProviderSettings={onOpenProviderSettings} />
        <div className="home-examples">
          {examples.map((example) => (
            <button key={example} className="example-chip" onClick={() => setSeed(example)}>
              {example}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
