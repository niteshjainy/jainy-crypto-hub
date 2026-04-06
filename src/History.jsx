export default function History({ state, setState }) {
  return (
    <div>
      <h3>History ({state.history.length})</h3>

      {state.history.map((t) => (
        <div key={t.id} className="bg-gray-800 p-2 my-2 relative">
          <button
            className="absolute top-1 right-1"
            onClick={() =>
              setState((prev) => ({
                ...prev,
                history: prev.history.filter((x) => x.id !== t.id),
              }))
            }
          >
            ❌
          </button>

          <p>
            {t.type} | {t.result}
          </p>
          <p>Entry: {t.entry}</p>
          <p>Exit: {t.exit}</p>
          <p>PnL: {t.pnl}</p>
        </div>
      ))}
    </div>
  );
}
