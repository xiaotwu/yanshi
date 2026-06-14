import { Composer } from "../components/composer";
import { useT } from "../i18n";

export function NewTaskView({ onRuns }: { onRuns: () => void }) {
  const { t } = useT();
  return (
    <section className="center-stage">
      <div className="composer-wrap">
        <h1>{t("composer.title")}</h1>
        <Composer onSubmitted={onRuns} />
      </div>
    </section>
  );
}
