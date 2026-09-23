import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  Bell,
  CalendarBlank,
  ChartBar,
  ChartLineUp,
  CheckCircle,
  Factory,
  FileArrowUp,
  GearSix,
  GitBranch,
  List,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  SquaresFour,
  Target,
  Warning,
  X,
  CaretDown,
  Cube,
} from "@phosphor-icons/react";
import { api, post, fmt } from "./api";
import type { Data, Row, Run } from "./api";
import { Badge, Empty, Field, Modal } from "./ui";
import { Dashboard, Bottlenecks, ProductionPlanView } from "./planning";
import { PromiseChecker, Simulator, Versions } from "./decisions";
import { FactoryMasters, Reports, Imports, Settings } from "./masters";
import { ShopFloor } from "./execution";
import { McciaLogo } from "./McciaLogo";
import "./App.css";

const navigation = [
  {
    group: "OPERATIONS",
    items: [
      ["Dashboard", SquaresFour],
      ["Promise Checker", Target],
      ["Production Plan", CalendarBlank],
      ["Shop Floor", CheckCircle],
    ],
  },
  {
    group: "DECISIONS & RECOVERY",
    items: [
      ["Bottlenecks", ChartBar],
      ["Simulations & Crises", SlidersHorizontal],
      ["Rescheduling", ArrowsClockwise],
    ],
  },
  {
    group: "FACTORY DATA & REPORTS",
    items: [
      ["Factory Masters", Cube],
      ["Reports", ChartLineUp],
      ["Imports", FileArrowUp],
      ["Settings", GearSix],
    ],
  },
] as const;

const descriptions: Record<string, string> = {
  Dashboard: "A clear view of your factory’s delivery commitments.",
  "Production Plan": "Customer orders, shift timeline (Gantt), and operation sequences.",
  "Shop Floor": "Record actual progress and reconcile completed production.",
  "Promise Checker": "A confident answer before you commit.",
  Bottlenecks: "Overloaded machines and delivery risk summary.",
  "Simulations & Crises": "Test what-if improvements and respond to live shop-floor disruptions with 1-click.",
  Rescheduling: "Compare, approve and activate the next production plan.",
  "Factory Masters": "Products, Machines, Materials, and Routings in one clean place.",
  Reports: "Share the numbers behind your delivery performance.",
  Imports: "Start with the spreadsheets you already use.",
  Settings: "Your factory, calendars and planning priorities.",
};

export default function App() {
  const [session, setSession] = useState<Row | null>(null),
    [data, setData] = useState<Data | null>(null),
    [page, setPage] = useState("Promise Checker"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [mobile, setMobile] = useState(false),
    [proposal, setProposal] = useState<Row | null>(null),
    [inspect, setInspect] = useState<Row | null>(null);

  const refresh = async () => setData(await api("/factory"));

  useEffect(() => {
    api("/me")
      .then(async (s) => {
        setSession(s);
        if (!["sales", "planner", "manager", "admin"].includes(s.role))
          setPage("Dashboard");
        await refresh();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  const run: Run = async (label, fn) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const go = (p: string) => {
    setPage(p);
    setMobile(false);
    setError("");
  };

  if (loading)
    return (
      <div className="boot">
        <div className="brand-logo-wrap" style={{ padding: "10px 18px", marginBottom: "18px" }}>
          <McciaLogo height={36} />
        </div>
        <h2>Opening your planning workspace</h2>
        <p>Loading the approved production plan…</p>
      </div>
    );

  if (!session)
    return (
      <Login
        busy={busy}
        error={error}
        onLogin={(username, password) =>
          run("Signing in", async () => {
            const signedIn = await post("/login", { username, password });
            setSession(signedIn);
            setPage(
              ["sales", "planner", "manager", "admin"].includes(signedIn.role)
                ? "Promise Checker"
                : "Dashboard",
            );
            await refresh();
          })
        }
      />
    );

  const f = data?.factory,
    plan = data?.plan,
    canWrite = ["planner", "manager", "admin"].includes(session.role),
    canApprove = ["manager", "admin"].includes(session.role),
    canPromise = canWrite || session.role === "sales",
    canSimulate =
      canWrite || ["sales", "purchase", "maintenance"].includes(session.role);

  const showProposal = (v: Row) => {
    setProposal(v);
    go("Rescheduling");
  };

  const newPlan = () =>
    run("Optimizing the production plan", async () =>
      showProposal(await post("/plan")),
    );

  const inspectOrder = (id: string) =>
    run("Reading schedule evidence", async () => {
      const reasons = await api(
        "/orders/" + encodeURIComponent(id) + "/explain",
      );
      setInspect({
        title: id + " · delivery evidence",
        reasons: reasons.items,
        order: plan?.orders.find((o: Row) => o.id === id),
      });
    });

  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Dashboard");
          }}
        >
          <div className="brand-logo-wrap">
            <McciaLogo height={20} />
          </div>
          <div className="brand-text">
            <span className="brand-title">ProductionSaathi</span>
            <span className="brand-subtitle">MCCIA AI Studio</span>
          </div>
        </a>
        <div className="workspace">
          <div className="workspace-icon">
            <Factory size={18} />
          </div>
          <div>
            <strong>{f?.settings.plant_name || "Factory workspace"}</strong>
            <span>
              Pune · Plant 01 <CaretDown size={10} />
            </span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((g) => (
            <div className="nav-group" key={g.group}>
              <span className="nav-label">{g.group}</span>
              {g.items
                .filter(([p]) => p !== "Promise Checker" || canPromise)
                .map(([label, Icon]) => (
                  <button
                    key={label}
                    className={"nav-item " + (page === label ? "selected" : "")}
                    onClick={() => go(label)}
                    aria-current={page === label ? "page" : undefined}
                  >
                    <Icon
                      size={18}
                      weight={page === label ? "fill" : "regular"}
                    />
                    <span>{label}</span>
                    {label === "Promise Checker" && (
                      <span className="mini-new">AI</span>
                    )}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="studio-mark">
            <ShieldCheck size={18} />
            <div>
              MCCIA <strong>AI Applied Studio</strong>
            </div>
          </div>
          <div className="user-block">
            <span className="avatar">
              {session.role.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>
                {session.role === "manager"
                  ? "Production manager"
                  : session.role}
              </strong>
              <span>
                {session.demo ? "Demo workspace" : "Factory workspace"}
              </span>
            </div>
            <button
              aria-label="Sign out"
              onClick={() =>
                run("Signing out", async () => {
                  await post("/logout");
                  setSession(null);
                  setData(null);
                })
              }
            >
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="crumb">
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label="Toggle navigation"
            >
              <List size={22} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className="plant-state">
              <i /> Planning workspace
            </span>
            <span className="top-divider" />
            <button
              className="icon-button notification"
              aria-label="View delivery alerts"
              onClick={() => go("Bottlenecks")}
            >
              <Bell size={20} />
              {plan?.orders.some((o: Row) => o.status !== "ON TIME") && <i />}
            </button>
            <span className="avatar small">
              {session.role.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>

        {session.demo && (
          <div className="demo-strip">
            <span>
              <span className="demo-dot" /> SYNTHETIC DEMO
            </span>{" "}
            Real optimization. Sample factory data.
            <button onClick={() => go("Imports")}>
              Bring your own data <ArrowRight size={13} />
            </button>
          </div>
        )}

        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Dashboard"
                  ? "PRODUCTION WORKSPACE"
                  : page === "Promise Checker"
                    ? "DELIVERY CONFIDENCE"
                    : "PRODUCTIONSAATHI"}
              </div>
              <h1>
                {page === "Dashboard"
                  ? "Production overview"
                  : page === "Promise Checker"
                    ? "Can we promise this?"
                    : page}
              </h1>
              <p>{descriptions[page]}</p>
            </div>
            <div className="heading-actions">
              {page === "Dashboard" ? (
                <>
                  {plan && (
                    <span className="date-chip">
                      <CalendarBlank size={16} />
                      {fmt(plan.base)} · Planning week
                    </span>
                  )}
                  {canPromise && (
                    <button
                      className="primary"
                      onClick={() => go("Promise Checker")}
                    >
                      <Target size={17} />
                      Check a promise <ArrowRight size={16} />
                    </button>
                  )}
                </>
              ) : page === "Production Plan" && canWrite ? (
                <button className="primary" disabled={!!busy} onClick={newPlan}>
                  <ArrowsClockwise size={17} />
                  Build proposed plan
                </button>
              ) : null}
            </div>
          </div>

          {error && (
            <div role="alert" className="message error">
              <Warning size={20} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}

          {notice && (
            <div role="status" className="message success">
              <CheckCircle size={20} />
              {notice}
            </div>
          )}

          {busy && (
            <div role="status" className="message working">
              <span className="spinner" />
              <span>
                {busy}… <small>Please keep this workspace open.</small>
              </span>
            </div>
          )}

          {data?.pending_master_changes && (
            <div className="message working">
              <GitBranch size={19} />
              <span>
                Factory data has changed since approval. The current schedule
                still uses its saved inputs. Rebuild and approve a plan to apply
                these changes.
              </span>
            </div>
          )}

          {!data ? (
            <Empty
              title="Workspace unavailable"
              body="Refresh the page to reconnect to the planning service."
            />
          ) : (
            <>
              {!!data.execution_pending_orders?.length && (
                <div className="plan-status" role="status">
                  <Warning size={20} />
                  <span>
                    Production actuals need reconciliation for{" "}
                    {data.execution_pending_orders.join(", ")}. Planning and
                    publication are paused. Approved delivery dates below have
                    not been recalculated from actuals.
                  </span>
                  <button
                    className="btn secondary"
                    onClick={() => go("Shop Floor")}
                  >
                    Review progress
                  </button>
                </div>
              )}
              {page === "Shop Floor" && (
                <ShopFloor
                  role={session.role}
                  run={run}
                  refresh={refresh}
                  busy={!!busy}
                />
              )}
              {page === "Dashboard" && (
                <Dashboard
                  data={data}
                  go={go}
                  inspect={inspectOrder}
                  canPromise={canPromise}
                />
              )}
              {page === "Promise Checker" && canPromise && (
                <PromiseChecker
                  data={data}
                  busy={!!busy}
                  run={run}
                  onProposal={showProposal}
                />
              )}
              {page === "Production Plan" && (
                <ProductionPlanView
                  data={data}
                  inspect={inspectOrder}
                  editable={canWrite}
                  run={run}
                  refresh={refresh}
                />
              )}
              {page === "Bottlenecks" && (
                <Bottlenecks data={data} go={go} inspect={inspectOrder} />
              )}
              {page === "Simulations & Crises" && (
                <Simulator
                  data={data}
                  disruption={false}
                  allowed={canSimulate}
                  busy={!!busy}
                  run={run}
                  onProposal={showProposal}
                />
              )}
              {page === "Rescheduling" && (
                <Versions
                  data={data}
                  proposal={proposal}
                  setProposal={setProposal}
                  canApprove={canApprove}
                  canWrite={canWrite}
                  busy={!!busy}
                  run={run}
                  refresh={refresh}
                  newPlan={newPlan}
                  notice={setNotice}
                />
              )}
              {(page === "Factory Masters" || ["Products", "Routings", "Resources", "Materials"].includes(page)) && (
                <FactoryMasters
                  data={data}
                  editable={canWrite}
                  run={run}
                  refresh={refresh}
                />
              )}
              {page === "Reports" && <Reports data={data} />}
              {page === "Imports" && (
                <Imports
                  editable={canWrite}
                  run={run}
                  busy={!!busy}
                  refresh={refresh}
                  notice={setNotice}
                />
              )}
              {page === "Settings" && (
                <Settings
                  data={data}
                  editable={canWrite}
                  run={run}
                  refresh={refresh}
                  notice={setNotice}
                  session={session}
                />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              Plan production. Deliver with confidence.
            </span>
            <span>
              <ShieldCheck size={13} />
              Deterministic planning · Explainable decisions · MCCIA
            </span>
          </footer>
        </main>
      </div>

      {inspect && (
        <Modal
          title={inspect.title || inspect.operation || "Operation details"}
          close={() => setInspect(null)}
        >
          {inspect.reasons ? (
            <div className="detail-body">
              {inspect.order && (
                <div className="detail-summary">
                  <Badge value={inspect.order.status} />
                  <strong>
                    Projected dispatch · {fmt(inspect.order.completion, true)}
                  </strong>
                </div>
              )}
              {inspect.reasons.map((r: Row, i: number) => (
                <div className="reason" key={i}>
                  <span className="reason-number">{i + 1}</span>
                  <div>
                    <strong>{r.kind}</strong>
                    <p>{r.cause}</p>
                    <span>{r.action}</span>
                  </div>
                </div>
              ))}
              <p className="fine-print">
                Observed constraints and loads; not a proven causal
                decomposition of delay.
              </p>
            </div>
          ) : (
            <div className="detail-body">
              <dl className="detail-grid">
                {Object.entries(inspect)
                  .filter(([k]) => !["title", "locked"].includes(k))
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k.replaceAll("_", " ")}</dt>
                      <dd>{String(v ?? "—")}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Login({
  onLogin,
  busy,
  error,
}: {
  onLogin: (u: string, p: string) => void;
  busy: string;
  error: string;
}) {
  const [username, setUsername] = useState("manager"),
    [password, setPassword] = useState(""),
    [demo, setDemo] = useState(false);

  useEffect(() => {
    api("/health")
      .then((r) => {
        setDemo(r.demo);
        if (r.demo) setPassword("promise-demo");
      })
      .catch(() => {});
  }, []);

  return (
    <div className="login-page">
      <div className="login-story">
        <div className="brand">
          <div className="brand-logo-wrap" style={{ padding: "7px 14px" }}>
            <McciaLogo height={26} />
          </div>
          <div className="brand-text">
            <span className="brand-title" style={{ fontSize: "16px" }}>ProductionSaathi</span>
            <span className="brand-subtitle">MCCIA Manufacturing Intelligence</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">MCCIA AI APPLIED STUDIO</span>
          <h1>
            Plan production.
            <br />
            <em>Deliver with confidence.</em>
          </h1>
          <p>Production planning grounded in the realities of your factory.</p>
          <div className="login-proof">
            <ShieldCheck size={22} />
            <span>
              Finite capacity.
              <br />
              <strong>Confident commitments.</strong>
            </span>
          </div>
        </div>
        <span className="fine-print">
          MCCIA Manufacturing Intelligence · Pune, India
        </span>
      </div>
      <div className="login-form">
        <div className="brand-logo-wrap" style={{ display: "inline-flex", marginBottom: "20px", padding: "8px 16px", border: "1px solid #e2e8f0" }}>
          <McciaLogo height={32} />
        </div>
        <h2>Your planning workspace</h2>
        <p>Sign in to see what your factory can deliver.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(username, password);
          }}
        >
          <Field label={demo ? "Demo role" : "Username"}>
            {demo ? (
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              >
                {[
                  "manager",
                  "planner",
                  "sales",
                ].map((r) => (
                  <option key={r} value={r}>
                    {r === "manager"
                      ? "Admin / Plant Head (Owner)"
                      : r === "planner"
                        ? "Planner / Floor Supervisor"
                        : "Sales Representative (Promise Check)"}
                  </option>
                ))}
              </select>
            ) : (
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            )}
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && (
            <p role="alert" className="red-text">
              {error}
            </p>
          )}
          <button className="primary full" disabled={!!busy}>
            {busy || "Open workspace"}
            <ArrowRight size={18} />
          </button>
        </form>
        {demo && (
          <div className="demo-note">
            <span className="badge green">Demo access</span>
            <p>
              Explore a synthetic Pune manufacturing plant.
              <br />
              Demo password: <code>promise-demo</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
