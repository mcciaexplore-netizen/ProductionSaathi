import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarBlank,
  ChartBar,
  Check,
  Cube,
  DownloadSimple,
  FileArrowUp,
  GitBranch,
  HardDrives,
  MagnifyingGlass,
  Package,
  Plus,
  ShieldCheck,
  Truck,
  Warning,
} from "@phosphor-icons/react";
import { api, post, fmt, money, futureDate } from "./api";
import type { Data, Row, Run } from "./api";
import { Badge, Field, Modal, OrderFields, Panel } from "./ui";
type EditorProps = {
  data: Data;
  editable: boolean;
  run: Run;
  refresh: () => Promise<void>;
};
export function Orders({
  data,
  editable,
  run,
  refresh,
  inspect,
}: EditorProps & { inspect: (id: string) => void }) {
  const [search, setSearch] = useState(""),
    [priority, setPriority] = useState("All priorities"),
    [edit, setEdit] = useState<Row | null>(null);
  const rows = data.factory.orders.filter(
    (o: Row) =>
      JSON.stringify(o).toLowerCase().includes(search.toLowerCase()) &&
      (priority === "All priorities" || o.priority === priority),
  );
  const save = () =>
    run("Saving order", async () => {
      const f = structuredClone(data.factory),
        idx = f.orders.findIndex((o: Row) => o.id === edit?.id);
      if (idx >= 0) f.orders[idx] = edit;
      else f.orders.push(edit);
      await api("/factory", {
        method: "PUT",
        body: JSON.stringify({ factory: f, revision: data.revision }),
      });
      setEdit(null);
      await refresh();
    });
  return (
    <>
      <div className="toolbar">
        <div className="search-field">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search orders"
            placeholder="Search order, customer ID, product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Priority filter"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          {["All priorities", "Critical", "High", "Normal", "Low"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {editable && (
          <button
            className="primary"
            onClick={() =>
              setEdit({
                id: "PO-" + Date.now().toString().slice(-6),
                customer_id: data.factory.customers[0]?.id || "",
                product_id: data.factory.products[0]?.id || "",
                quantity: 100,
                order_date: (data.plan?.base || new Date().toISOString()).slice(
                  0,
                  16,
                ),
                requested_date: futureDate(data, 5),
                priority: "Normal",
                status: "NEW",
                notes: "",
                value: 0,
                penalty: 0,
              })
            }
          >
            <Plus size={18} />
            Add order
          </button>
        )}
      </div>
      <Panel
        title={`${rows.length} customer orders`}
        sub="Master-data changes require a new approved plan."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer / product</th>
                <th>Quantity</th>
                <th>Requested</th>
                <th>Priority</th>
                <th>Order status</th>
                <th>Delivery</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((o: Row) => (
                <tr key={o.id}>
                  <td>
                    <button
                      className="order-link"
                      onClick={() => inspect(o.id)}
                    >
                      {o.id}
                    </button>
                  </td>
                  <td>
                    {
                      data.factory.customers.find(
                        (c: Row) => c.id === o.customer_id,
                      )?.name
                    }
                    <span className="cell-sub">
                      {o.product_id} ·{" "}
                      {
                        data.factory.products.find(
                          (p: Row) => p.id === o.product_id,
                        )?.name
                      }
                    </span>
                  </td>
                  <td>{o.quantity.toLocaleString("en-IN")}</td>
                  <td>{fmt(o.requested_date)}</td>
                  <td>
                    <Badge value={o.priority} />
                  </td>
                  <td>
                    <Badge value={o.status} />
                  </td>
                  <td>
                    <Badge
                      value={
                        data.plan?.orders.find((p: Row) => p.id === o.id)
                          ?.status || "Unplanned"
                      }
                    />
                  </td>
                  <td>
                    {editable && (
                      <button
                        className="text-button"
                        onClick={() => setEdit(structuredClone(o))}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {edit && (
        <Modal title="Order details" close={() => setEdit(null)}>
          <form
            className="detail-body"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <OrderFields data={data} value={edit} onChange={setEdit} />
            <div className="form-grid">
              <Field label="Committed delivery (optional)">
                <input
                  type="datetime-local"
                  value={edit.committed_date?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setEdit({ ...edit, committed_date: e.target.value || null })
                  }
                />
              </Field>
              <Field label="Order value (₹)">
                <input
                  type="number"
                  min="0"
                  value={edit.value}
                  onChange={(e) =>
                    setEdit({ ...edit, value: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <Field label="Order status">
              <select
                value={edit.status}
                onChange={(e) => setEdit({ ...edit, status: e.target.value })}
              >
                {[
                  "NEW",
                  "PLANNED",
                  "RELEASED",
                  "IN PRODUCTION",
                  "ON HOLD",
                  "COMPLETED",
                  "DISPATCHED",
                  "CANCELLED",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <textarea
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </Field>
            <p className="fine-print">
              Released and in-production operations retain approved resource and
              time assignments during rescheduling.
            </p>
            <button className="primary">Save order</button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function MasterData({
  page,
  data,
  editable,
  run,
  refresh,
}: EditorProps & { page: string }) {
  const [search, setSearch] = useState(""),
    [edit, setEdit] = useState<Row | null>(null);
  const table = page.toLowerCase(),
    rows = data.factory[table] as Row[],
    filtered = rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
    );
  const save = (value: Row) =>
    run("Validating factory data", async () => {
      const f = structuredClone(data.factory),
        index = f[table].findIndex((r: Row) => r.id === edit?.id);
      if (index >= 0) f[table][index] = value;
      else f[table].push(value);
      await api("/factory", {
        method: "PUT",
        body: JSON.stringify({ factory: f, revision: data.revision }),
      });
      setEdit(null);
      await refresh();
    });
  const blank = () =>
    page === "Resources"
      ? {
          id: "RESOURCE-NEW",
          name: "New resource",
          calendar_id: data.factory.calendars[0]?.id || "DAY",
          capacity: 1,
          type: "Machine",
          cost_per_hour: 450,
        }
      : page === "Products"
        ? {
            id: "PRODUCT-NEW",
            name: "New product",
            routing_id: data.factory.routings[0]?.id || "",
            batch_size: 100,
            materials: [],
          }
        : page === "Materials"
          ? {
              id: "MATERIAL-NEW",
              description: "New material",
              stock: 0,
              reserved: 0,
              incoming: 0,
            }
          : {
              id: "ROUTING-NEW",
              name: "New routing",
              operations: [
                {
                  id: "OP10",
                  name: "Operation",
                  sequence: 10,
                  alternatives: [
                    {
                      resource_id: data.factory.resources[0]?.id || "",
                      cycle_minutes: 1,
                      setup_minutes: 20,
                    },
                  ],
                },
              ],
            };
  return (
    <>
      <div className="toolbar">
        <div className="search-field">
          <MagnifyingGlass size={18} />
          <input
            aria-label={"Search " + page.toLowerCase()}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={"Search " + page.toLowerCase() + "…"}
          />
        </div>
        <span className="muted">{rows.length} master records</span>
        {editable && (
          <button className="primary" onClick={() => setEdit(blank())}>
            <Plus size={18} />
            Add {page.slice(0, -1).toLowerCase()}
          </button>
        )}
      </div>
      {page === "Routings" ? (
        <div className="routing-list">
          {filtered.map((r) => (
            <Panel
              title={r.name}
              sub={r.id + " · " + r.operations.length + " operations"}
              key={r.id}
              action={
                editable && (
                  <button className="text-button" onClick={() => setEdit(r)}>
                    Edit routing <ArrowUpRight size={16} />
                  </button>
                )
              }
            >
              <div className="routing-flow">
                {[...r.operations]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((op: Row, i: number) => (
                    <div className="routing-step" key={op.id}>
                      <span className="step-sequence">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3>{op.name}</h3>
                      <span>{op.id}</span>
                      <div className="resource-tags">
                        {op.alternatives.map((a: Row) => (
                          <span key={a.resource_id}>{a.resource_id}</span>
                        ))}
                      </div>
                      <small>
                        {op.alternatives[0].setup_minutes} min setup ·{" "}
                        {op.alternatives[0].cycle_minutes} min / pc
                      </small>
                      {op.tool_id && <small>Fixture: {op.tool_id}</small>}
                      {op.required_skill && (
                        <small>Skill: {op.required_skill}</small>
                      )}
                    </div>
                  ))}
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel
          title={
            page === "Resources"
              ? "Your production capacity"
              : page === "Products"
                ? "Product master"
                : "Material availability"
          }
          sub={
            page === "Materials"
              ? "Available = stock − reservations − safety stock. Incoming stock is date-constrained."
              : "Changes are validated and included in the next schedule proposal."
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {(page === "Products"
                    ? [
                        "Product",
                        "Routing",
                        "Batch size",
                        "Material requirement",
                        "Lead time",
                        "",
                      ]
                    : page === "Resources"
                      ? [
                          "Resource",
                          "Type / department",
                          "Status",
                          "Calendar",
                          "Capacity",
                          "Efficiency / cost",
                          "",
                        ]
                      : [
                          "Material",
                          "Current stock",
                          "Reserved",
                          "Safety stock",
                          "Available",
                          "Incoming / arrival",
                          "",
                        ]
                  ).map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.id}</strong>
                      <span className="cell-sub">
                        {r.name || r.description}
                      </span>
                    </td>
                    {page === "Products" ? (
                      <>
                        <td>{r.routing_id}</td>
                        <td>{r.batch_size} pcs</td>
                        <td>
                          {r.materials
                            .map((m: Row) => `${m.material_id} × ${m.per_unit}`)
                            .join(", ") || "None"}
                        </td>
                        <td>{r.lead_time_days} days</td>
                      </>
                    ) : page === "Resources" ? (
                      <>
                        <td>
                          {r.type}
                          <span className="cell-sub">{r.department}</span>
                        </td>
                        <td>
                          <Badge value={r.status} />
                        </td>
                        <td>
                          {r.calendar_id}
                          <span className="cell-sub">
                            {r.unavailable.length} unavailable windows
                          </span>
                        </td>
                        <td>{r.capacity} simultaneous</td>
                        <td>
                          {Math.round(r.efficiency * 100)}%
                          <span className="cell-sub">
                            {money(r.cost_per_hour)}/h
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{r.stock.toLocaleString("en-IN")}</td>
                        <td>{r.reserved}</td>
                        <td>{r.safety_stock}</td>
                        <td
                          className={
                            r.stock - r.reserved - r.safety_stock <= 0
                              ? "red-text"
                              : "green-text"
                          }
                        >
                          <strong>
                            {Math.max(0, r.stock - r.reserved - r.safety_stock)}
                          </strong>
                        </td>
                        <td>
                          {r.incoming > 0
                            ? r.incoming.toLocaleString("en-IN") + " " + r.unit
                            : "—"}
                          <span className="cell-sub">
                            {r.arrival
                              ? fmt(r.arrival, true)
                              : "No arrival expected"}
                          </span>
                        </td>
                      </>
                    )}
                    <td>
                      {editable && (
                        <button
                          className="text-button"
                          onClick={() => setEdit(r)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {edit && (
        <Modal
          title={"Edit " + page.slice(0, -1).toLowerCase()}
          close={() => setEdit(null)}
        >
          <form
            className="detail-body"
            onSubmit={(e) => {
              e.preventDefault();
              save(edit);
            }}
          >
            <Field label="ID">
              <input
                value={edit.id}
                onChange={(e) => setEdit({ ...edit, id: e.target.value })}
                required
              />
            </Field>
            {page === "Resources" ? (
              <>
                <Field label="Resource name">
                  <input
                    value={edit.name || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, name: e.target.value })
                    }
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Type">
                    <select
                      value={edit.type}
                      onChange={(e) =>
                        setEdit({ ...edit, type: e.target.value })
                      }
                    >
                      {["Machine", "Line", "Station", "Worker", "Tool"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Department">
                    <input
                      value={edit.department || ""}
                      onChange={(e) =>
                        setEdit({ ...edit, department: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Simultaneous capacity">
                    <input
                      type="number"
                      min="1"
                      value={edit.capacity || 1}
                      onChange={(e) =>
                        setEdit({ ...edit, capacity: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Operating cost (₹/h)">
                    <input
                      type="number"
                      min="0"
                      value={edit.cost_per_hour || 0}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          cost_per_hour: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
              </>
            ) : page === "Materials" ? (
              <>
                <Field label="Description">
                  <input
                    value={edit.description || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, description: e.target.value })
                    }
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Current stock">
                    <input
                      type="number"
                      min="0"
                      value={edit.stock || 0}
                      onChange={(e) =>
                        setEdit({ ...edit, stock: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Safety stock">
                    <input
                      type="number"
                      min="0"
                      value={edit.safety_stock || 0}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          safety_stock: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Incoming supply">
                    <input
                      type="number"
                      min="0"
                      value={edit.incoming || 0}
                      onChange={(e) =>
                        setEdit({ ...edit, incoming: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Expected arrival">
                    <input
                      type="datetime-local"
                      value={edit.arrival?.slice(0, 16) || ""}
                      onChange={(e) =>
                        setEdit({ ...edit, arrival: e.target.value || null })
                      }
                    />
                  </Field>
                </div>
              </>
            ) : page === "Products" ? (
              <>
                <Field label="Product name">
                  <input
                    value={edit.name || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, name: e.target.value })
                    }
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Routing ID">
                    <select
                      value={edit.routing_id}
                      onChange={(e) =>
                        setEdit({ ...edit, routing_id: e.target.value })
                      }
                    >
                      {data.factory.routings.map((r: Row) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.id})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Batch size (pcs)">
                    <input
                      type="number"
                      min="1"
                      value={edit.batch_size || 100}
                      onChange={(e) =>
                        setEdit({ ...edit, batch_size: Number(e.target.value) })
                      }
                    />
                  </Field>
                </div>
                <Field label="Lead time (days)">
                  <input
                    type="number"
                    min="0"
                    value={edit.lead_time_days || 1}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        lead_time_days: Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </>
            ) : (
              <Field label="Routing name">
                <input
                  value={edit.name || ""}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  required
                />
              </Field>
            )}
            <p className="fine-print">
              For bulk changes, use Excel Imports in the Manage menu.
            </p>
            <button className="primary">Save {page.slice(0, -1).toLowerCase()}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Reports({ data }: { data: Data }) {
  return (
    <>
      <div className="report-grid">
        {[
          {
            title: "Daily Material Shortage Report",
            desc: "Identifies raw materials running low or creating risk for active orders in the next 3 days.",
            kind: "material-shortage",
            format: "CSV",
            url: "/api/reports/material-shortage",
            icon: Warning,
          },
          {
            title: "Shift-wise Machine Job-Cards",
            desc: "Supervisor dispatch sheet per machine with scheduled batch, operator and tooling.",
            kind: "job-cards",
            format: "CSV",
            url: "/api/reports/job-cards",
            icon: CalendarBlank,
          },
          {
            title: "Delivery Performance & Risk",
            desc: "Customer commitments, projected dispatch, delivery risk and tardiness status.",
            kind: "delivery",
            format: "CSV",
            url: "/api/reports/delivery",
            icon: Truck,
          },
          {
            title: "Capacity & Machine Bottlenecks",
            desc: "Resource load percentage, available hours, utilization and overloaded machines.",
            kind: "capacity",
            format: "CSV",
            url: "/api/reports/capacity",
            icon: ChartBar,
          },
          {
            title: "Export All Factory Data (Excel)",
            desc: "Complete multi-sheet backup of all orders, materials, resources, and products.",
            kind: "export-all",
            format: "Excel (.xlsx)",
            url: "/api/reports/export-all.xlsx",
            icon: FileArrowUp,
          },
        ].map((r) => (
          <section className="report-card" key={r.kind}>
            <span>
              <r.icon size={26} />
            </span>
            <h2>{r.title}</h2>
            <p>{r.desc}</p>
            <a className="secondary" href={r.url} download>
              <DownloadSimple size={17} />
              Download {r.format}
            </a>
          </section>
        ))}
      </div>
      <div className="section-callout">
        <ShieldCheck size={24} />
        <div>
          <strong>
            Reports follow the approved plan
            {data.active_version ? " · v" + data.active_version : ""}.
          </strong>
          <p>
            Simulations stay separate until activated. CSV exports open directly
            in Excel.
          </p>
        </div>
      </div>
      <Panel
        title="Measurement notes"
        sub="Projected and actual performance are different measures."
      >
        <div className="detail-body">
          <p>
            Delivery and utilization figures are projected from the approved
            schedule. Schedule adherence and actual on-time delivery require
            shop-floor completion and dispatch events; those metrics are not
            fabricated in this MVP.
          </p>
          <p>
            Resource load covers the first seven calendar days. Cost estimates
            use configured resource and routing rates, not invoices.
          </p>
        </div>
      </Panel>
    </>
  );
}
export function Imports({
  editable,
  run,
  busy,
  refresh,
  notice,
}: {
  editable: boolean;
  run: Run;
  busy: boolean;
  refresh: () => Promise<void>;
  notice: (s: string) => void;
}) {
  const [kind, setKind] = useState("Orders"),
    mapping = "{}",
    [lastImport, setLastImport] = useState<string | null>(null),
    [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<Row | null>(null);
  return (
    <>
      <div className="import-steps">
        <span className="active">
          <b>1</b>Download a template
        </span>
        <ArrowRight size={18} />
        <span>
          <b>2</b>Upload & validate
        </span>
        <ArrowRight size={18} />
        <span>
          <b>3</b>Preview & apply
        </span>
      </div>
      <div className="template-grid">
        {[
          ["Orders", "Customer commitments", Package],
          ["Resources", "Resources & capacities", HardDrives],
          ["Routing", "Operations & alternatives", GitBranch],
          ["Materials", "Stock & incoming supply", Cube],
          ["Shifts", "Calendars & working hours", CalendarBlank],
          ["Products", "Products & material requirements", Cube],
          ["Suppliers", "Supplier master", Truck],
          ["Customers", "Customer master", Package],
          ["Operators", "Skills & availability", ShieldCheck],
          ["Tools", "Fixtures & shared tools", HardDrives],
          ["Maintenance", "Unavailable resource windows", CalendarBlank],
        ].map(([name, sub, Icon]) => {
          const I = Icon as typeof Package;
          return (
            <a
              key={String(name)}
              href={"/api/templates/" + name}
              download
              className="template-card"
            >
              <I size={25} />
              <strong>{String(name)}.xlsx</strong>
              <span>{String(sub)}</span>
              <DownloadSimple size={17} />
            </a>
          );
        })}
      </div>
      <Panel
        title="Bring your factory data into ProductionSaathi"
        sub="Excel (.xlsx) and UTF-8 CSV · Up to 5 MB or 2,000 rows"
      >
        <div className="import-body">
          <Field label="Import type">
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setResult(null);
              }}
            >
              {[
                "Orders",
                "Resources",
                "Machines",
                "Routing",
                "Materials",
                "Shifts",
                "Products",
                "Suppliers",
                "Customers",
                "Operators",
                "Tools",
                "Maintenance",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <p className="fine-print">
            Spreadsheet headers matching template column names will be automatically mapped. Use the downloadable templates above for zero-error imports.
          </p>
          {lastImport && (
            <button
              className="secondary"
              disabled={busy || !editable}
              onClick={() =>
                run("Rolling back import", async () => {
                  await post(`/imports/${lastImport}/rollback`);
                  setLastImport(null);
                  await refresh();
                  notice(
                    "Import rolled back. The approved plan was preserved.",
                  );
                })
              }
            >
              Undo last import
            </button>
          )}
          <label className="upload-zone">
            <FileArrowUp size={34} />
            <strong>{file ? file.name : "Choose your spreadsheet"}</strong>
            <span>
              Column names and linked master records will be validated.
            </span>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setResult(null);
              }}
              aria-label="Upload factory spreadsheet"
            />
          </label>
          <button
            className="primary"
            disabled={!file || busy || !editable}
            onClick={() =>
              run("Validating your spreadsheet", async () => {
                const body = new FormData();
                body.append("file", file!);
                body.append("mapping", mapping);
                setResult(
                  await api(`/imports/${kind}/preview`, {
                    method: "POST",
                    body,
                  }),
                );
              })
            }
          >
            <MagnifyingGlass size={18} />
            Validate & preview
          </button>
        </div>
      </Panel>
      {result && (
        <Panel
          title={
            result.valid
              ? "Your import is ready to review"
              : "Fix these rows before importing"
          }
          sub={`${result.rows.length} rows · ${result.added} new records · ${result.updated} matching records to update`}
          action={
            result.valid ? (
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run("Applying validated import", async () => {
                    await post(`/imports/${result.id}/apply`);
                    setLastImport(result.id);
                    setResult(null);
                    setFile(null);
                    await refresh();
                    notice(
                      "Import applied. Build and approve a new plan to use the updated data.",
                    );
                  })
                }
              >
                <Check size={18} />
                Apply import
              </button>
            ) : (
              <Badge value="NOT FEASIBLE" />
            )
          }
        >
          {result.errors.length > 0 && (
            <div className="import-errors">
              {result.errors.map((e: Row, i: number) => (
                <p key={i}>
                  <Warning size={16} />
                  <strong>
                    {e.row ? "Row " + e.row : "File"} · {e.column}
                  </strong>{" "}
                  {e.message}
                </p>
              ))}
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  {Object.keys(result.rows[0]?.values || {}).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 50).map((r: Row) => (
                  <tr
                    key={r.row}
                    className={
                      result.errors.some((e: Row) => e.row === r.row)
                        ? "invalid-row"
                        : ""
                    }
                  >
                    <td>{r.row}</td>
                    {Object.keys(result.rows[0]?.values || {}).map((k) => (
                      <td key={k}>{r.values[k] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > 50 && (
            <p className="table-note">
              First 50 rows shown. All rows were validated.
            </p>
          )}
        </Panel>
      )}
    </>
  );
}
export function Settings({
  data,
  editable,
  run,
  refresh,
  notice,
  session,
}: EditorProps & { notice: (s: string) => void; session: Row }) {
  const [settings, setSettings] = useState(
      structuredClone(data.factory.settings),
    ),
    [tab, setTab] = useState("Planning"),
    [editor, setEditor] = useState<{ table: string; value: Row } | null>(null),
    [audit, setAudit] = useState<Row[]>([]);
  useEffect(() => {
    if (tab === "Audit trail")
      api("/audit")
        .then(setAudit)
        .catch(() => {});
  }, [tab]);
  const save = () =>
    run("Saving planning settings", async () => {
      await api("/factory", {
        method: "PUT",
        body: JSON.stringify({
          factory: { ...data.factory, settings },
          revision: data.revision,
        }),
      });
      await refresh();
      notice("Settings saved. Rebuild the plan to apply new objectives.");
    });
  return (
    <>
      <div className="tabs">
        {[
          "Planning",
          "Calendars",
          "Tools & operators",
          "Customers & suppliers",
          ...(["manager", "admin", "management"].includes(session.role)
            ? ["Audit trail"]
            : []),
        ].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Planning" ? (
        <Panel
          title="Planning objectives"
          sub="Delivery performance has the strongest default weight. Customer-defined weights also affect priority."
        >
          <div className="settings-form">
            <div className="form-grid">
              <Field label="Plant name">
                <input
                  value={settings.plant_name}
                  onChange={(e) =>
                    setSettings({ ...settings, plant_name: e.target.value })
                  }
                />
              </Field>
              <Field label="Planning data source">
                <input
                  value={settings.data_source || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, data_source: e.target.value })
                  }
                  placeholder="Planner review / source workbook"
                />
              </Field>
              <Field label="Operational data confirmed at (plant time)">
                <input
                  type="datetime-local"
                  value={settings.data_confirmed_at?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      data_confirmed_at: e.target.value || null,
                    })
                  }
                />
              </Field>
              <Field label="Planning start date">
                <input
                  type="date"
                  value={
                    settings.planning_start?.slice(0, 10) ||
                    data.plan?.base?.slice(0, 10) ||
                    ""
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      planning_start: e.target.value
                        ? e.target.value + "T00:00:00"
                        : null,
                    })
                  }
                />
              </Field>
              <Field label="Industry configuration">
                <select
                  value={settings.industry_pack}
                  onChange={(e) =>
                    setSettings({ ...settings, industry_pack: e.target.value })
                  }
                >
                  {[
                    "Automotive",
                    "Fabrication",
                    "Food",
                    "Pharma",
                    "Electronics",
                    "Custom",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              {[
                ["horizon_days", "Planning horizon (days)"],
                ["risk_buffer_hours", "Delivery risk buffer (hours)"],
                ["overtime_cost_per_hour", "Overtime premium (₹/h)"],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    min="0"
                    value={settings[key]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [key]: Number(e.target.value),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <p className="fine-print">
              Industry selection labels the configuration; resources and
              routings define its behavior. Switching industries does not
              replace data. Dates use {settings.timezone} plant-local time.
            </p>
            <button className="primary" disabled={!editable} onClick={save}>
              Save settings
            </button>
          </div>
        </Panel>
      ) : tab === "Audit trail" ? (
        <Panel
          title="Audit trail"
          sub="Sign-ins, master-data changes, proposals and approvals."
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{fmt(a.at, true)}</td>
                    <td>{a.actor}</td>
                    <td>{a.action}</td>
                    <td>{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <>
          {(tab === "Calendars"
            ? ["calendars"]
            : tab === "Tools & operators"
              ? ["auxiliaries"]
              : ["customers", "suppliers"]
          ).map((table) => (
            <Panel
              key={table}
              title={
                table === "auxiliaries"
                  ? "Tools, fixtures & operator crews"
                  : table.charAt(0).toUpperCase() + table.slice(1)
              }
              action={
                editable && (
                  <button
                    className="text-button"
                    onClick={() =>
                      setEditor({
                        table,
                        value:
                          table === "calendars"
                            ? {
                                id: "CAL-NEW",
                                name: "New calendar",
                                weekdays: [0, 1, 2, 3, 4, 5],
                                shifts: [[480, 960]],
                                holidays: [],
                              }
                            : table === "auxiliaries"
                              ? {
                                  id: "AUX-NEW",
                                  name: "New operator",
                                  kind: "Operator",
                                  skill: "Turning",
                                  calendar_id:
                                    data.factory.calendars[0]?.id || "DAY",
                                  capacity: 1,
                                }
                              : table === "customers"
                                ? {
                                    id: "C-NEW",
                                    name: "New customer",
                                    category: "Regular",
                                    priority_weight: 1,
                                  }
                                : {
                                    id: "SUP-NEW",
                                    name: "New supplier",
                                    lead_time_days: 1,
                                    reliability: 0.95,
                                  },
                      })
                    }
                  >
                    <Plus size={17} />
                    Add record
                  </button>
                )
              }
            >
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Configuration</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.factory[table].map((r: Row) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>{r.name}</td>
                        <td className="wrap-cell">
                          {table === "calendars"
                            ? `${r.weekdays.map((d: number) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]).join(", ")} · ${r.shifts.map(([a, b]: number[]) => `${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}–${String(Math.floor(b / 60)).padStart(2, "0")}:${String(b % 60).padStart(2, "0")}`).join(", ")}`
                            : table === "auxiliaries"
                              ? `${r.kind} · ${r.skill || "Shared tooling"} · ${r.capacity} available`
                              : table === "customers"
                                ? `${r.category} · weight ${r.priority_weight}`
                                : `${r.lead_time_days} days · ${Math.round(r.reliability * 100)}% reliability`}
                        </td>
                        <td>
                          {editable && (
                            <button
                              className="text-button"
                              onClick={() => setEditor({ table, value: r })}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </>
      )}
      {editor && (
        <Modal title={"Edit " + editor.table} close={() => setEditor(null)}>
          <form
            className="detail-body"
            onSubmit={(e) => {
              e.preventDefault();
              run("Saving configuration", async () => {
                const f = structuredClone(data.factory),
                  idx = f[editor.table].findIndex(
                    (r: Row) => r.id === editor.value.id,
                  );
                if (idx >= 0) f[editor.table][idx] = editor.value;
                else f[editor.table].push(editor.value);
                await api("/factory", {
                  method: "PUT",
                  body: JSON.stringify({ factory: f, revision: data.revision }),
                });
                setEditor(null);
                await refresh();
                notice("Configuration updated.");
              });
            }}
          >
            <Field label="ID">
              <input
                value={editor.value.id}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    value: { ...editor.value, id: e.target.value },
                  })
                }
                required
              />
            </Field>
            <Field label="Name / Description">
              <input
                value={editor.value.name || ""}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    value: { ...editor.value, name: e.target.value },
                  })
                }
                required
              />
            </Field>
            {editor.table === "customers" ? (
              <div className="form-grid">
                <Field label="Category">
                  <select
                    value={editor.value.category || "Regular"}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: { ...editor.value, category: e.target.value },
                      })
                    }
                  >
                    {["VIP", "Key", "Regular", "Standard"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority weight">
                  <input
                    type="number"
                    min="1"
                    value={editor.value.priority_weight || 1}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: {
                          ...editor.value,
                          priority_weight: Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
              </div>
            ) : editor.table === "suppliers" ? (
              <div className="form-grid">
                <Field label="Lead time (days)">
                  <input
                    type="number"
                    min="1"
                    value={editor.value.lead_time_days || 1}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: {
                          ...editor.value,
                          lead_time_days: Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Reliability (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round((editor.value.reliability || 0.95) * 100)}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: {
                          ...editor.value,
                          reliability: Number(e.target.value) / 100,
                        },
                      })
                    }
                  />
                </Field>
              </div>
            ) : editor.table === "auxiliaries" ? (
              <div className="form-grid">
                <Field label="Kind">
                  <select
                    value={editor.value.kind || "Operator"}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: { ...editor.value, kind: e.target.value },
                      })
                    }
                  >
                    {["Operator", "Tool", "Fixture", "Team"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity available">
                  <input
                    type="number"
                    min="1"
                    value={editor.value.capacity || 1}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: {
                          ...editor.value,
                          capacity: Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
              </div>
            ) : editor.table === "calendars" ? (
              <div className="form-grid">
                <Field label="Working Days (0=Mon to 6=Sun, comma-separated)">
                  <input
                    value={(editor.value.weekdays || [0, 1, 2, 3, 4, 5]).join(", ")}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: {
                          ...editor.value,
                          weekdays: e.target.value
                            .split(",")
                            .map((v) => Number(v.trim()))
                            .filter((v) => !isNaN(v) && v >= 0 && v <= 6),
                        },
                      })
                    }
                    placeholder="0, 1, 2, 3, 4, 5"
                  />
                </Field>
                <Field label="Shift Window (Minutes from midnight, e.g. 480 to 960 is 8 AM to 4 PM)">
                  <input
                    value={(editor.value.shifts || [[480, 960]])
                      .map(([a, b]: number[]) => `${a}-${b}`)
                      .join(", ")}
                    onChange={(e) => {
                      const parsed = e.target.value
                        .split(",")
                        .map((s) => s.trim().split("-").map(Number))
                        .filter((pair) => pair.length === 2 && !isNaN(pair[0]) && !isNaN(pair[1]));
                      setEditor({
                        ...editor,
                        value: {
                          ...editor.value,
                          shifts: parsed.length ? parsed : [[480, 960]],
                        },
                      });
                    }}
                    placeholder="480-960 (08:00 - 16:00)"
                  />
                </Field>
              </div>
            ) : null}
            <button className="primary">Save record</button>
          </form>
        </Modal>
      )}
    </>
  );
}
