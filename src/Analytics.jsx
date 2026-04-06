export default function Analytics({ state }) {
  const total = state.history.length;
  const win = state.history.filter((t) => t.result === "win").length;
  const loss = state.history.filter((t) => t.result === "loss").length;

  const winRate = total ? ((win / total) * 100).toFixed(1) : 0;

  return (
    <div>
      <h3>Analytics</h3>
      <p>Total: {total}</p>
      <p>Win: {win}</p>
      <p>Loss: {loss}</p>
      <p>WinRate: {winRate}%</p>
    </div>
  );
}
