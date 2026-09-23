import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChartBar,
  CheckCircle,
  Clock,
  MagnifyingGlass,
  Package,
  ShieldCheck,
  Target,
  TrendUp,
  Warning,
} from "@phosphor-icons/react";
import { fmt } from "./api";
import type { Data, Row, Run } from "./api";
import { Badge, Empty, OrderTable, Panel } from "./ui";
import { Orders } from "./masters";
export function Dashboard({
  data,
  go,
  inspect,
  canPromise,
}: {
  data: Data;
  go: (p: string) => void;
  inspect: (id: string) => void;
  canPromise: boolean;
}) {
  const p = data.plan,
    orders: Row[] = p?.orders || [],
    f = data.factory,
    onTime = orders.filter((o) => o.status === "ON TIME"),
    risk = orders.filter((o) => o.status === "AT RISK"),
    late = orders.filter(
      (o) => o.status === "LATE" || o.status === "UNSCHEDULED",
    );
  const utilization: Row[] =
      p?.bottlenecks?.filter(
        (r: Row) =>
          f.resources.find((x: Row) => x.id === r.resource_id)?.type !==
          "External vendor",
      ) || [],
    avg = utilization.length
      ? Math.round(
          utilization.reduce((s, r) => s + r.utilization, 0) /
            utilization.length,
        )
      : 0;
  const attention = [...late, ...risk].slice(0, 3),
    today = (p?.base || "").slice(0, 10),
    dueToday = f.orders.filter(
      (o: Row) => o.requested_date.slice(0, 10) === today,
    ).length;
  return (
    <>
      <div className="metric-grid">
        {[
          {
            label: "Active customer orders",
            value: orders.length,
            icon: Package,
            sub: dueToday + " due on planning start",
            color: "green",
          },
          {
            label: "On-time commitments",
            value: onTime.length,
            icon: CheckCircle,
            sub: orders.length
              ? Math.round((onTime.length / orders.length) * 100) +
                "% with delivery buffer"
              : "No plan approved",
            color: "green",
          },
          {
            label: "Deliveries need attention",
            value: risk.length + late.length,
            icon: Warning,
            sub: `${risk.length} at risk · ${late.length} projected late / blocked`,
            color: "amber",
          },
          {
            label: "Resource utilization",
            value: avg + "%",
            icon: ChartBar,
            sub: "First 7 days · available capacity",
            color: "green",
          },
        ].map((m, i) => (
          <div
            className={"metric " + (i === 0 ? "featured" : "")}
            key={m.label}
          >
            <div className="metric-top">
              <span>{m.label}</span>
              <m.icon size={21} />
            </div>
            <strong>{m.value}</strong>
            <span className={"metric-foot " + m.color}>
              {i === 1 ? (
                <ShieldCheck size={14} />
              ) : i === 2 ? (
                <Warning size={14} />
              ) : (
                <TrendUp size={14} />
              )}{" "}
              {m.sub}
            </span>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <Panel
          title="Capacity at a glance"
          sub="Scheduled load across your key resources"
          action={
            <button
              className="text-button"
              onClick={() => go("Production Plan")}
            >
              View production plan <ArrowUpRight size={16} />
            </button>
          }
        >
          <div className="capacity-legend">
            <span>
              <i className="legend-dot green-bg" />
              Planned load
            </span>
            <span>
              <i className="legend-dot amber-bg" />
              Above 85%
            </span>
            <span className="muted">Next 7 days</span>
          </div>
          <div className="capacity-chart">
            {utilization.map((r) => (
              <button
                key={r.resource_id}
                className="chart-column"
                onClick={() => go("Bottlenecks")}
                aria-label={`${r.name}: ${r.utilization}% utilized`}
              >
                <span className={r.utilization >= 85 ? "amber-text" : ""}>
                  {Math.round(r.utilization)}
                  <small>%</small>
                </span>
                <div className="bar-track">
                  <div
                    className={
                      "bar-fill " + (r.utilization >= 85 ? "amber-bg" : "")
                    }
                    style={{ height: r.utilization + "%" }}
                  />
                </div>
                <strong>{r.resource_id}</strong>
              </button>
            ))}
          </div>
          <div className="chart-caption">
            <span>
              <Clock size={15} />
              Load respects shifts, maintenance and capacity.
            </span>
            <button className="text-button" onClick={() => go("Resources")}>
              Availability <ArrowRight size={14} />
            </button>
          </div>
        </Panel>
        <Panel
          title="Needs your attention"
          sub="Resolve risks before they become delays"
          action={
            <span className="count-badge">{risk.length + late.length}</span>
          }
          className="attention-panel"
        >
          {attention.length ? (
            attention.map((o) => {
              const source = f.orders.find((x: Row) => x.id === o.id),
                customer = f.customers.find(
                  (c: Row) => c.id === source?.customer_id,
                );
              return (
                <button
                  className="attention-item"
                  key={o.id}
                  onClick={() => inspect(o.id)}
                >
                  <span
                    className={
                      "attention-icon " +
                      (o.status === "AT RISK" ? "amber" : "red")
                    }
                  >
                    <Warning size={19} />
                  </span>
                  <div>
                    <div>
                      <strong>{o.id}</strong>
                      <Badge value={o.status} />
                    </div>
                    <p>{customer?.name}</p>
                    <span>
                      {o.tardiness_minutes
                        ? `${(o.tardiness_minutes / 1440).toFixed(1)} days after commitment`
                        : "Less than the configured delivery buffer"}
                    </span>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              );
            })
          ) : (
            <div className="all-clear">
              <CheckCircle size={30} />
              <h3>Your commitments have room to breathe.</h3>
              <p>No current delivery alerts.</p>
            </div>
          )}
          <button className="attention-all" onClick={() => go("Bottlenecks")}>
            Review all constraints <ArrowRight size={17} />
          </button>
        </Panel>
      </div>
      <Panel
        title="Upcoming customer commitments"
        sub="Projected dispatch against the dates you promised"
        action={
          <button className="text-button" onClick={() => go("Orders")}>
            All orders <ArrowRight size={16} />
          </button>
        }
      >
        <OrderTable
          data={data}
          rows={[...orders]
            .sort((a, b) => a.due.localeCompare(b.due))
            .slice(0, 6)}
          inspect={inspect}
        />
      </Panel>
      {canPromise && (
        <div className="insight-strip">
          <span className="insight-icon">
            <Target size={24} />
          </span>
          <div>
            <strong>
              A new order shouldn’t put an existing promise at risk.
            </strong>
            <p>
              Check capacity and compare recovery options before accepting the
              next commitment.
            </p>
          </div>
          <button className="secondary" onClick={() => go("Promise Checker")}>
            Check a delivery date <ArrowRight size={17} />
          </button>
        </div>
      )}
    </>
  );
}
export function ShiftDispatchBoard({
  plan,
  factory,
  onSelect,
}: {
  plan: Row;
  factory: Row;
  onSelect: (r: Row) => void;
}) {
  const [selectedMachine, setSelectedMachine] = useState("All");
  const resources = factory.resources || [];
  const operations = plan.operations || [];

  const machinesToDisplay = selectedMachine === "All"
    ? resources
    : resources.filter((r: Row) => r.id === selectedMachine);

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, fontSize: "13px", color: "#475569" }}>Filter by Machine:</span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            className={selectedMachine === "All" ? "primary" : "secondary"}
            style={{ padding: "4px 12px", fontSize: "12px" }}
            onClick={() => setSelectedMachine("All")}
          >
            All Machines ({resources.length})
          </button>
          {resources.map((r: Row) => (
            <button
              key={r.id}
              className={selectedMachine === r.id ? "primary" : "secondary"}
              style={{ padding: "4px 12px", fontSize: "12px" }}
              onClick={() => setSelectedMachine(r.id)}
            >
              {r.id}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {machinesToDisplay.map((r: Row) => {
          const machineOps = operations.filter((o: Row) => o.resource_id === r.id);
          return (
            <div
              key={r.id}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <strong style={{ fontSize: "15px", color: "#0a2540" }}>{r.name || r.id}</strong>
                  <span style={{ display: "block", fontSize: "11px", color: "#64748b" }}>{r.id} · {r.department || "Machine Line"}</span>
                </div>
                <span
                  style={{
                    background: machineOps.length > 0 ? "#e0f2fe" : "#f1f5f9",
                    color: machineOps.length > 0 ? "#0369a1" : "#64748b",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {machineOps.length} Jobs Scheduled
                </span>
              </div>

              {machineOps.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", background: "#f8fafc", borderRadius: "6px", color: "#94a3b8", fontSize: "12px" }}>
                  No jobs queued for this machine
                </div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {machineOps.map((op: Row) => {
                    const isLate = plan.orders.find((x: Row) => x.id === op.order_id)?.status === "LATE";
                    return (
                      <div
                        key={op.id}
                        onClick={() => onSelect(op)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "6px",
                          background: isLate ? "#fef2f2" : "#f8fafc",
                          border: "1px solid " + (isLate ? "#fecaca" : "#e2e8f0"),
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ fontSize: "13px", color: isLate ? "#991b1b" : "#0f172a" }}>
                              {op.order_id}
                            </strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>· {op.operation}</span>
                          </div>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            Batch: <strong>{op.quantity} pcs</strong> · Start: {fmt(op.start, true)}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: isLate ? "#dc2626" : "#229e45",
                            color: "#ffffff",
                            fontWeight: 600,
                          }}
                        >
                          {isLate ? "LATE" : "ON TIME"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProductionPlanView({
  data,
  inspect,
  editable,
  run,
  refresh,
}: {
  data: Data;
  inspect: (id: string) => void;
  editable: boolean;
  run: Run;
  refresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState("Orders");
  const plan = data.plan;
  const f = data.approved_factory || data.factory;

  return (
    <>
      <div className="tabs" style={{ marginBottom: "20px" }}>
        {[
          ["Orders", "📋 Customer Orders"],
          ["Dispatch", "🏭 Machine Dispatch Board"],
          ["Operations", "⚙️ All Operations List"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "Orders" && (
        <Orders
          data={data}
          editable={editable}
          run={run}
          refresh={refresh}
          inspect={inspect}
        />
      )}

      {tab === "Dispatch" && (
        plan ? (
          <ShiftDispatchBoard
            plan={plan}
            factory={f}
            onSelect={(r: Row) => inspect(r.order_id || r.id)}
          />
        ) : (
          <Empty
            title="No approved schedule yet"
            body="Build a proposed plan and activate it to view machine assignments."
          />
        )
      )}

      {tab === "Operations" && (
        plan ? (
          <OperationsTable plan={plan} />
        ) : (
          <Empty
            title="No approved operations"
            body="Approve a plan to view operation sequences."
          />
        )
      )}
    </>
  );
}

export function Gantt({
  plan,
  factory,
  onSelect,
}: {
  plan: Row;
  factory: Row;
  onSelect: (r: Row) => void;
}) {
  const [days, setDays] = useState(7),
    [resource, setResource] = useState("All resources"),
    [filter, setFilter] = useState(""),
    [highlight, setHighlight] = useState("All operations"),
    [start, setStart] = useState(plan.base.slice(0, 10));
  const origin = new Date(start + "T00:00:00").getTime(),
    span = days * 86400000,
    visible = plan.operations.filter(
      (o: Row) =>
        JSON.stringify(o).toLowerCase().includes(filter.toLowerCase()) &&
        (highlight === "All operations" ||
          plan.orders.find((x: Row) => x.id === o.order_id)?.status ===
            highlight),
    ),
    resources = factory.resources.filter(
      (r: Row) => resource === "All resources" || r.id === resource,
    );
  return (
    <Panel
      title="Production timeline"
      sub="Select an operation to inspect its assignment. Each lane is one unit of capacity."
      action={<span className="subtle-tag">Validated assignments</span>}
    >
      <div className="gantt-tools">
        <div className="search-field">
          <MagnifyingGlass size={17} />
          <input
            aria-label="Filter timeline"
            placeholder="Order, customer ID or product…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <select
          aria-label="Resource filter"
          value={resource}
          onChange={(e) => setResource(e.target.value)}
        >
          <option>All resources</option>
          {factory.resources.map((r: Row) => (
            <option key={r.id}>{r.id}</option>
          ))}
        </select>
        <select
          aria-label="Highlight delivery status"
          value={highlight}
          onChange={(e) => setHighlight(e.target.value)}
        >
          {["All operations", "LATE", "AT RISK"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Timeline start date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <div className="segmented">
          {[3, 7, 14].map((d) => (
            <button
              className={days === d ? "active" : ""}
              key={d}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div className="gantt-scroll">
        <div className="gantt" style={{ minWidth: days === 14 ? 1500 : 1000 }}>
          <div className="gantt-header">
            <div>RESOURCE / CAPACITY</div>
            <div className="gantt-dates">
              {Array.from({ length: days }, (_, i) => (
                <span key={i}>
                  {new Date(origin + i * 86400000).toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: days <= 7 ? "short" : undefined,
                  })}
                </span>
              ))}
            </div>
          </div>
          {resources.map((r: Row) => {
            const ops = visible.filter(
                (o: Row) =>
                  o.resource_id === r.id &&
                  new Date(o.end).getTime() > origin &&
                  new Date(o.start).getTime() < origin + span,
              ),
              laneEnds: number[] = Array(r.capacity).fill(0),
              positioned = ops
                .sort((a: Row, b: Row) => a.start.localeCompare(b.start))
                .map((o: Row) => {
                  const s = new Date(o.start).getTime();
                  let lane = laneEnds.findIndex((e) => e <= s);
                  if (lane < 0) lane = 0;
                  laneEnds[lane] = new Date(o.end).getTime();
                  return { o, lane };
                });
            return (
              <div
                className="gantt-row"
                key={r.id}
                style={{ minHeight: Math.max(82, r.capacity * 36 + 18) }}
              >
                <div className="gantt-label">
                  <strong>{r.id}</strong>
                  <span>{r.name}</span>
                  <small>{r.capacity} × capacity</small>
                </div>
                <div
                  className="gantt-track"
                  style={{ backgroundSize: `${100 / days}% 100%` }}
                >
                  {r.unavailable.map((w: Row, i: number) => {
                    const a = Math.max(
                        0,
                        ((new Date(w.start).getTime() - origin) / span) * 100,
                      ),
                      b = Math.min(
                        100,
                        ((new Date(w.end).getTime() - origin) / span) * 100,
                      );
                    return b > a ? (
                      <button
                        aria-label={w.reason}
                        className="maintenance-bar"
                        key={i}
                        style={{ left: a + "%", width: b - a + "%" }}
                        onClick={() =>
                          onSelect({ title: r.id + " · maintenance", ...w })
                        }
                      />
                    ) : null;
                  })}
                  {positioned.map(({ o, lane }: { o: Row; lane: number }) => {
                    const a = Math.max(
                        0,
                        ((new Date(o.start).getTime() - origin) / span) * 100,
                      ),
                      b = Math.min(
                        100,
                        ((new Date(o.end).getTime() - origin) / span) * 100,
                      );
                    return (
                      <button
                        key={o.id}
                        title={`${o.order_id} · ${o.operation} · ${fmt(o.start, true)} → ${fmt(o.end, true)}`}
                        className={
                          "gantt-bar " +
                          (plan.orders.find((x: Row) => x.id === o.order_id)
                            ?.status === "LATE"
                            ? "late"
                            : o.product_id === factory.products[1]?.id
                              ? "blue"
                              : o.product_id === factory.products[2]?.id
                                ? "ochre"
                                : "")
                        }
                        style={{
                          left: a + "%",
                          width: `max(${b - a}%, 3px)`,
                          top: 10 + lane * 36,
                        }}
                        onClick={() => onSelect(o)}
                      >
                        <strong>{o.order_id}</strong>
                        <span>{o.operation}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="gantt-legend">
        <span>
          <i className="legend-dot green-bg" />
          Default product
        </span>
        <span>
          <i className="legend-dot blue-bg" />
          Product 2
        </span>
        <span>
          <i className="legend-dot amber-bg" />
          Product 3
        </span>
        <span>
          <i className="legend-dot red-bg" />
          Projected late
        </span>
        <span className="muted">Hatched areas: downtime</span>
      </div>
    </Panel>
  );
}
export function OperationsTable({ plan }: { plan: Row }) {
  const [search, setSearch] = useState("");
  const ops = plan.operations.filter((o: Row) =>
    JSON.stringify(o).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Panel
      title="Operation dispatch list"
      sub="Use job and batch IDs to coordinate the shop floor"
      action={
        <div className="search-field">
          <MagnifyingGlass size={17} />
          <input
            aria-label="Search operation list"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter operations…"
          />
        </div>
      }
    >
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Job / operation</th>
              <th>Resource</th>
              <th>Qty</th>
              <th>Start</th>
              <th>Finish</th>
              <th>Tool / operator</th>
            </tr>
          </thead>
          <tbody>
            {ops.slice(0, 100).map((o: Row) => (
              <tr key={o.id}>
                <td>
                  <strong>{o.job_id}</strong>
                  <span className="cell-sub">{o.operation}</span>
                </td>
                <td>
                  {o.resource_id}
                  {o.locked && <span className="cell-sub">Locked work</span>}
                </td>
                <td>{o.quantity}</td>
                <td>{fmt(o.start, true)}</td>
                <td>{fmt(o.end, true)}</td>
                <td>
                  {o.tool_id || "—"}
                  <span className="cell-sub">
                    {o.operator_id || "No skill constraint"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ops.length > 100 && (
        <p className="table-note">
          Showing the first 100 matching operations. Filter or export the full
          dispatch list.
        </p>
      )}
    </Panel>
  );
}
export function Bottlenecks({
  data,
  go,
  inspect,
}: {
  data: Data;
  go: (p: string) => void;
  inspect: (id: string) => void;
}) {
  const p = data.plan;
  const critical = p?.bottlenecks?.filter((r: Row) => r.utilization >= 85) || [];
  const normal = p?.bottlenecks?.filter((r: Row) => r.utilization < 85) || [];

  return (
    <>
      <div className="metric-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "22px" }}>
        <div className="metric" style={{ borderLeft: "4px solid " + (critical.length > 0 ? "#dc2626" : "#229e45") }}>
          <div className="metric-top">
            <span>Overloaded Machines</span>
            <Warning size={18} color={critical.length > 0 ? "#dc2626" : "#229e45"} />
          </div>
          <strong style={{ color: critical.length > 0 ? "#dc2626" : "#229e45" }}>
            {critical.length}
          </strong>
          <div className="metric-foot">
            {critical.length > 0 ? "Running above 85% capacity" : "All machines running smoothly"}
          </div>
        </div>

        <div className="metric" style={{ borderLeft: "4px solid #229e45" }}>
          <div className="metric-top">
            <span>Normal Running Machines</span>
            <CheckCircle size={18} color="#229e45" />
          </div>
          <strong style={{ color: "#229e45" }}>{normal.length}</strong>
          <div className="metric-foot">Healthy capacity available</div>
        </div>

        <div className="metric" style={{ borderLeft: "4px solid " + (p?.orders?.filter((o: Row) => o.status !== "ON TIME")?.length ? "#ea580c" : "#229e45") }}>
          <div className="metric-top">
            <span>Orders at Risk</span>
            <TrendUp size={18} color={p?.orders?.filter((o: Row) => o.status !== "ON TIME")?.length ? "#ea580c" : "#229e45"} />
          </div>
          <strong style={{ color: p?.orders?.filter((o: Row) => o.status !== "ON TIME")?.length ? "#ea580c" : "#229e45" }}>
            {p?.orders?.filter((o: Row) => o.status !== "ON TIME")?.length || 0}
          </strong>
          <div className="metric-foot">Delivery dates needing review</div>
        </div>
      </div>

      {critical.length > 0 && (
        <Panel
          title="⚠️ Machines with Work Overload"
          sub="These machines are creating production delays. Click 'Solve with What-If' to test overtime or shifts."
        >
          <div style={{ display: "grid", gap: "12px" }}>
            {critical.map((r: Row) => (
              <div
                key={r.resource_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px",
                  background: "#fff7ed",
                  borderRadius: "8px",
                  border: "1px solid #fed7aa",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <strong style={{ fontSize: "16px" }}>{r.name || r.resource_id} ({r.resource_id})</strong>
                    <span
                      style={{
                        background: "#ea580c",
                        color: "#fff",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {r.utilization}% Busy
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", color: "#7c2d12", fontSize: "13px" }}>
                    <strong>Load:</strong> {r.load_hours} hrs of work scheduled (Capacity: {r.capacity_hours} hrs)
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#9a3412", fontSize: "13px" }}>
                    👉 <strong>Suggested Fix:</strong> {r.action || "Add 2 hours overtime or shift unstarted batch to backup machine"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="primary"
                    style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={() => go("What-If Simulator")}
                  >
                    Simulate Overtime / Shift
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title="All Machine Workloads"
        sub="Current load status for every machine across the factory."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Machine / Station</th>
                <th>Status</th>
                <th>Work Load</th>
                <th>Available Capacity</th>
                <th>Orders Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {p?.bottlenecks?.map((r: Row) => (
                <tr key={r.resource_id}>
                  <td>
                    <strong>{r.name || r.resource_id}</strong>
                    <span className="cell-sub">{r.resource_id}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: r.utilization >= 85 ? "#fee2e2" : "#dcfce7",
                        color: r.utilization >= 85 ? "#991b1b" : "#166534",
                      }}
                    >
                      {r.utilization >= 85 ? `⚠️ Overloaded (${r.utilization}%)` : `✓ Normal (${r.utilization}%)`}
                    </span>
                  </td>
                  <td><strong>{r.load_hours} hrs</strong></td>
                  <td>{r.capacity_hours} hrs</td>
                  <td>
                    <div className="order-chips">
                      {r.affected_orders.slice(0, 3).map((o: string) => (
                        <button key={o} onClick={() => inspect(o)}>
                          {o}
                        </button>
                      ))}
                      {r.affected_orders.length > 3 && (
                        <span>+{r.affected_orders.length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Customer Delivery Status"
        sub="Orders projected to be late or at risk based on machine availability."
      >
        <div className="alerts-grid">
          {p?.orders
            .filter((o: Row) => o.status !== "ON TIME")
            .map((o: Row) => (
              <button
                className="alert-card"
                key={o.id}
                onClick={() => inspect(o.id)}
              >
                <div>
                  <Badge value={o.status} />
                  <ArrowUpRight size={17} />
                </div>
                <h3>{o.id}</h3>
                <p>
                  {o.reason ||
                    `Projected dispatch ${fmt(o.completion, true)} against commitment ${fmt(o.due, true)}.`}
                </p>
                <span>
                  Inspect order details <ArrowRight size={14} />
                </span>
              </button>
            ))}
        </div>
      </Panel>
    </>
  );
}
