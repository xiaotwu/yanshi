import { useRuntimeStore } from "../stores/runtimeStore";

export function DeveloperView() {
  const { status, events } = useRuntimeStore();
  return (
    <section className="developer-grid">
      <div>
        <h2>Runtime</h2>
        <pre>{JSON.stringify(status, null, 2)}</pre>
      </div>
      <div>
        <h2>Events</h2>
        <pre>{JSON.stringify(events.slice(-80), null, 2)}</pre>
      </div>
    </section>
  );
}
