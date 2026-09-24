import { useEffect, useState } from "react";
import {
  Wrench,
  Clock,
  CheckCircle,
  Warning,
  Gear,
  CalendarBlank,
  MagnifyingGlass,
  ArrowClockwise,
  SlidersHorizontal,
  Check,
} from "@phosphor-icons/react";
import { api } from "./api";
import type { Data, Row, Run } from "./api";
import { Badge, Field, Modal, Panel } from "./ui";

type Props = {
  data: Data;
  editable: boolean;
  run: Run;
  refresh: () => Promise<void>;
  notice: (s: string) => void;
};

export function MaintenanceReminders({ data, editable, run, refresh, notice }: Props) {
  const [remindersData, setRemindersData] = useState<{
    reminders: Row[];
    counts: Record<string, number>;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  
  // Modals
  const [configModal, setConfigModal] = useState<Row | null>(null);
  const [logModal, setLogModal] = useState<Row | null>(null);
  const [downtimeModal, setDowntimeModal] = useState<Row | null>(null);

  // Form states
  const [logNotes, setLogNotes] = useState("");
  const [downtimeForm, setDowntimeForm] = useState({
    start: "",
    end: "",
    reason: "Preventive Maintenance Service",
  });
  const [configForm, setConfigForm] = useState({
    max_working_hours: 200,
    max_production_count: 5000,
    service_interval_days: 30,
    maintenance_workflow_mode: "HYBRID",
    custom_workflow_rule: "",
    maintenance_notes: "",
  });

  const loadReminders = async () => {
    try {
      const res = await api("/maintenance/reminders");
      setRemindersData(res);
    } catch (e) {
      console.error("Failed to load maintenance reminders", e);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [data]);

  const handleLogService = (res: Row) => {
    setLogModal(res);
    setLogNotes(`Completed routine preventive maintenance service for ${res.resource_name}.`);
  };

  const submitLogService = () => {
    if (!logModal) return;
    run("Logging maintenance service", async () => {
      await api("/maintenance/log-service", {
        method: "POST",
        body: JSON.stringify({
          resource_id: logModal.resource_id,
          notes: logNotes,
        }),
      });
      setLogModal(null);
      await refresh();
      await loadReminders();
      notice(`Maintenance logged for ${logModal.resource_name}. Counter reset to 0.`);
    });
  };

  const handleConfigure = (res: Row) => {
    setConfigModal(res);
    setConfigForm({
      max_working_hours: res.max_working_hours || 200,
      max_production_count: res.max_production_count || 5000,
      service_interval_days: res.service_interval_days || 30,
      maintenance_workflow_mode: res.maintenance_workflow_mode || "HYBRID",
      custom_workflow_rule: res.custom_workflow_rule || "",
      maintenance_notes: res.maintenance_notes || "",
    });
  };

  const submitConfig = () => {
    if (!configModal) return;
    run("Saving maintenance workflow configuration", async () => {
      await api("/maintenance/config", {
        method: "POST",
        body: JSON.stringify({
          resource_id: configModal.resource_id,
          ...configForm,
        }),
      });
      setConfigModal(null);
      await refresh();
      await loadReminders();
      notice(`Maintenance workflow rules updated for ${configModal.resource_name}.`);
    });
  };

  const handleScheduleDowntime = (res: Row) => {
    setDowntimeModal(res);
    const startStr = new Date().toISOString().slice(0, 16);
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 8);
    const endStr = endDate.toISOString().slice(0, 16);
    setDowntimeForm({
      start: startStr,
      end: endStr,
      reason: `Scheduled Maintenance for ${res.resource_name}`,
    });
  };

  const submitScheduleDowntime = () => {
    if (!downtimeModal) return;
    run("Scheduling maintenance downtime window", async () => {
      await api("/maintenance/schedule-downtime", {
        method: "POST",
        body: JSON.stringify({
          resource_id: downtimeModal.resource_id,
          start: downtimeForm.start,
          end: downtimeForm.end,
          reason: downtimeForm.reason,
        }),
      });
      setDowntimeModal(null);
      await refresh();
      await loadReminders();
      notice(`Scheduled maintenance downtime for ${downtimeModal.resource_name}.`);
    });
  };

  const reminders = remindersData?.reminders || [];
  const counts = remindersData?.counts || { OVERDUE: 0, DUE_SOON: 0, MAINTENANCE: 0, HEALTHY: 0 };

  const filteredReminders = reminders.filter((r) => {
    const matchSearch =
      r.resource_id.toLowerCase().includes(search.toLowerCase()) ||
      r.resource_name.toLowerCase().includes(search.toLowerCase()) ||
      r.department.toLowerCase().includes(search.toLowerCase()) ||
      r.custom_workflow_rule.toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      statusFilter === "All" ||
      (statusFilter === "OVERDUE" && r.health_status === "OVERDUE") ||
      (statusFilter === "DUE_SOON" && r.health_status === "DUE_SOON") ||
      (statusFilter === "MAINTENANCE" && r.health_status === "MAINTENANCE") ||
      (statusFilter === "HEALTHY" && r.health_status === "HEALTHY");

    const matchMode =
      modeFilter === "All" || r.maintenance_workflow_mode === modeFilter;

    return matchSearch && matchStatus && matchMode;
  });

  return (
    <div className="maintenance-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Metric Summary Cards */}
      <div
        className="kpi-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div className="kpi-card" style={{ padding: "16px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>Monitored Machines</span>
            <Gear size={20} style={{ color: "var(--primary)" }} />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, marginTop: "8px" }}>{reminders.length}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>Total machines in plant</div>
        </div>

        <div className="kpi-card" style={{ padding: "16px", borderRadius: "8px", background: counts.OVERDUE > 0 ? "#fef2f2" : "var(--surface)", border: counts.OVERDUE > 0 ? "1px solid #fecaca" : "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.85rem", color: counts.OVERDUE > 0 ? "#dc2626" : "var(--text-muted)", fontWeight: 600 }}>Overdue Maintenance</span>
            <Warning size={20} style={{ color: "#dc2626" }} />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, marginTop: "8px", color: counts.OVERDUE > 0 ? "#dc2626" : "inherit" }}>
            {counts.OVERDUE}
          </div>
          <div style={{ fontSize: "0.8rem", color: counts.OVERDUE > 0 ? "#991b1b" : "var(--text-muted)", marginTop: "4px" }}>Requires immediate service</div>
        </div>

        <div className="kpi-card" style={{ padding: "16px", borderRadius: "8px", background: counts.DUE_SOON > 0 ? "#fffbe6" : "var(--surface)", border: counts.DUE_SOON > 0 ? "1px solid #ffe58f" : "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.85rem", color: counts.DUE_SOON > 0 ? "#d97706" : "var(--text-muted)", fontWeight: 600 }}>Service Due Soon</span>
            <Clock size={20} style={{ color: "#d97706" }} />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, marginTop: "8px", color: counts.DUE_SOON > 0 ? "#d97706" : "inherit" }}>
            {counts.DUE_SOON}
          </div>
          <div style={{ fontSize: "0.8rem", color: counts.DUE_SOON > 0 ? "#b45309" : "var(--text-muted)", marginTop: "4px" }}>&gt;85% threshold reached</div>
        </div>

        <div className="kpi-card" style={{ padding: "16px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>In Maintenance</span>
            <Wrench size={20} style={{ color: "#2563eb" }} />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, marginTop: "8px", color: "#2563eb" }}>
            {counts.MAINTENANCE}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>Currently undergoing service</div>
        </div>

        <div className="kpi-card" style={{ padding: "16px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>Healthy Machines</span>
            <CheckCircle size={20} style={{ color: "#16a34a" }} />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, marginTop: "8px", color: "#16a34a" }}>
            {counts.HEALTHY}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>Operating normally</div>
        </div>
      </div>

      {/* Main Panel */}
      <Panel
        title="Machine Maintenance Reminders & Workflows"
        sub="Track machine working hours, production cycle counts, calendar intervals, and custom user-defined maintenance workflows."
        action={
          <button className="text-button" onClick={loadReminders} title="Refresh maintenance data">
            <ArrowClockwise size={16} />
            Refresh
          </button>
        }
      >
        {/* Search and Filters Toolbar */}
        <div className="toolbar" style={{ marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div className="search-field" style={{ flex: 1, minWidth: "220px" }}>
            <MagnifyingGlass size={18} />
            <input
              aria-label="Search machine maintenance"
              placeholder="Search by Machine ID, Name, Department, or Workflow Rule..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Health Status:</span>
            <select
              aria-label="Filter by health status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="OVERDUE">⚠️ Overdue Only</option>
              <option value="DUE_SOON">⏱️ Service Due Soon</option>
              <option value="MAINTENANCE">🔧 In Maintenance</option>
              <option value="HEALTHY">✅ Healthy</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Trigger Mode:</span>
            <select
              aria-label="Filter by workflow mode"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
            >
              <option value="All">All Modes</option>
              <option value="HYBRID">Hybrid (All Rules)</option>
              <option value="HOURS">Working Hours</option>
              <option value="PRODUCTION_COUNT">Production Count</option>
              <option value="CALENDAR">Calendar Interval</option>
              <option value="CUSTOM">Custom Rule Only</option>
            </select>
          </div>
        </div>

        {/* Machine Maintenance Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredReminders.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              No machines match the selected filter criteria.
            </div>
          ) : (
            filteredReminders.map((item) => {
              const hoursColor =
                item.hours_ratio >= 100 ? "#dc2626" : item.hours_ratio >= 85 ? "#d97706" : "#16a34a";
              const prodColor =
                item.prod_ratio >= 100 ? "#dc2626" : item.prod_ratio >= 85 ? "#d97706" : "#16a34a";
              const calColor =
                item.calendar_ratio >= 100 ? "#dc2626" : item.calendar_ratio >= 85 ? "#d97706" : "#16a34a";

              return (
                <div
                  key={item.resource_id}
                  style={{
                    padding: "18px",
                    borderRadius: "10px",
                    background: "var(--surface)",
                    border:
                      item.health_status === "OVERDUE"
                        ? "1px solid #fecaca"
                        : item.health_status === "DUE_SOON"
                        ? "1px solid #ffe58f"
                        : item.health_status === "MAINTENANCE"
                        ? "1px solid #bfdbfe"
                        : "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  {/* Header Row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>{item.resource_name}</h3>
                        <span style={{ fontSize: "0.85rem", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: "4px", color: "var(--text-muted)" }}>
                          {item.resource_id}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          {item.department} · {item.resource_type}
                        </span>
                      </div>
                      {item.last_service_date && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                          Last serviced: <strong>{item.last_service_date}</strong> ({item.days_since_service} days ago)
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {item.health_status === "OVERDUE" && (
                        <Badge value="OVERDUE" />
                      )}
                      {item.health_status === "DUE_SOON" && (
                        <Badge value="AT RISK" />
                      )}
                      {item.health_status === "MAINTENANCE" && (
                        <Badge value="MAINTENANCE" />
                      )}
                      {item.health_status === "HEALTHY" && (
                        <Badge value="AVAILABLE" />
                      )}
                    </div>
                  </div>

                  {/* Operational Metrics Progress Bars */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "16px",
                      background: "var(--bg-subtle)",
                      padding: "14px",
                      borderRadius: "8px",
                    }}
                  >
                    {/* Working Hours Meter */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                          <Clock size={15} /> Operating Hours
                        </span>
                        <span>
                          <strong>{item.working_hours_since_service}</strong> / {item.max_working_hours} h
                        </span>
                      </div>
                      <div style={{ height: "8px", width: "100%", background: "#e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, item.hours_ratio)}%`,
                            background: hoursColor,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", textAlign: "right" }}>
                        {item.hours_ratio}% threshold used (Lifetime: {item.total_working_hours}h)
                      </div>
                    </div>

                    {/* Production Count Meter */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                          <Gear size={15} /> Production Units
                        </span>
                        <span>
                          <strong>{item.production_count_since_service.toLocaleString()}</strong> / {item.max_production_count.toLocaleString()} pcs
                        </span>
                      </div>
                      <div style={{ height: "8px", width: "100%", background: "#e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, item.prod_ratio)}%`,
                            background: prodColor,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", textAlign: "right" }}>
                        {item.prod_ratio}% limit reached (Lifetime: {item.total_production_count.toLocaleString()} pcs)
                      </div>
                    </div>

                    {/* Calendar Days Meter */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                          <CalendarBlank size={15} /> Service Interval
                        </span>
                        <span>
                          <strong>{item.days_since_service}</strong> / {item.service_interval_days} days
                        </span>
                      </div>
                      <div style={{ height: "8px", width: "100%", background: "#e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, item.calendar_ratio)}%`,
                            background: calColor,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", textAlign: "right" }}>
                        {item.calendar_ratio}% of cycle elapsed
                      </div>
                    </div>
                  </div>

                  {/* User Decided Custom Workflow Rule */}
                  {item.custom_workflow_rule && (
                    <div style={{ fontSize: "0.85rem", background: "#f8fafc", padding: "10px 14px", borderRadius: "6px", borderLeft: "3px solid var(--primary)", color: "var(--text)" }}>
                      <strong>Custom Maintenance Workflow Rule:</strong> {item.custom_workflow_rule}
                    </div>
                  )}

                  {/* Action Buttons */}
                  {editable && (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button className="secondary" onClick={() => handleConfigure(item)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <SlidersHorizontal size={16} /> Configure Rules
                      </button>

                      <button className="secondary" onClick={() => handleScheduleDowntime(item)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <CalendarBlank size={16} /> Schedule Downtime
                      </button>

                      <button className="primary" onClick={() => handleLogService(item)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <CheckCircle size={16} /> Log Service Completed
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Panel>

      {/* Modal 1: Log Maintenance Service */}
      {logModal && (
        <Modal title={`Log Service Completed · ${logModal.resource_name}`} close={() => setLogModal(null)}>
          <div className="detail-body">
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
              Logging maintenance completion will reset working hours and production counts since service back to zero, and record today’s date as the last service date.
            </p>

            <Field label="Maintenance Work Notes & Checklist Summary">
              <textarea
                rows={3}
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="Details of oil change, alignment check, filter replacement..."
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button className="secondary" onClick={() => setLogModal(null)}>Cancel</button>
              <button className="primary" onClick={submitLogService}>
                <Check size={16} /> Save & Reset Counters
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 2: Configure Maintenance Rules & Workflow */}
      {configModal && (
        <Modal title={`Configure Maintenance Rules · ${configModal.resource_name}`} close={() => setConfigModal(null)}>
          <form
            className="detail-body"
            onSubmit={(e) => {
              e.preventDefault();
              submitConfig();
            }}
          >
            <div className="form-grid">
              <Field label="Workflow Trigger Mode">
                <select
                  value={configForm.maintenance_workflow_mode}
                  onChange={(e) => setConfigForm({ ...configForm, maintenance_workflow_mode: e.target.value })}
                >
                  <option value="HYBRID">Hybrid (Trigger on Hours, Output or Days)</option>
                  <option value="HOURS">Working Operating Hours</option>
                  <option value="PRODUCTION_COUNT">Production Output Count</option>
                  <option value="CALENDAR">Calendar Interval Days</option>
                  <option value="CUSTOM">Custom Workflow Rule Only</option>
                </select>
              </Field>

              <Field label="Max Operating Hours Limit (Hours)">
                <input
                  type="number"
                  min="1"
                  value={configForm.max_working_hours}
                  onChange={(e) => setConfigForm({ ...configForm, max_working_hours: Number(e.target.value) })}
                />
              </Field>
            </div>

            <div className="form-grid">
              <Field label="Max Production Units (Cycle Count)">
                <input
                  type="number"
                  min="1"
                  value={configForm.max_production_count}
                  onChange={(e) => setConfigForm({ ...configForm, max_production_count: Number(e.target.value) })}
                />
              </Field>

              <Field label="Calendar Service Interval (Days)">
                <input
                  type="number"
                  min="1"
                  value={configForm.service_interval_days}
                  onChange={(e) => setConfigForm({ ...configForm, service_interval_days: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="Custom User-Decided Maintenance Workflow & Operating Rule">
              <textarea
                rows={3}
                value={configForm.custom_workflow_rule}
                onChange={(e) => setConfigForm({ ...configForm, custom_workflow_rule: e.target.value })}
                placeholder="e.g. Inspect chuck pressure & coolant concentration weekly. Clean spindle taper every 100 hrs."
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </Field>

            <Field label="Machine Maintenance Notes / Standard Procedure">
              <input
                value={configForm.maintenance_notes}
                onChange={(e) => setConfigForm({ ...configForm, maintenance_notes: e.target.value })}
                placeholder="General maintenance notes or lubricant grade specification..."
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button type="button" className="secondary" onClick={() => setConfigModal(null)}>Cancel</button>
              <button type="submit" className="primary">Save Workflow Rules</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal 3: Schedule Maintenance Downtime */}
      {downtimeModal && (
        <Modal title={`Schedule Downtime · ${downtimeModal.resource_name}`} close={() => setDowntimeModal(null)}>
          <form
            className="detail-body"
            onSubmit={(e) => {
              e.preventDefault();
              submitScheduleDowntime();
            }}
          >
            <div className="form-grid">
              <Field label="Downtime Start Time">
                <input
                  type="datetime-local"
                  required
                  value={downtimeForm.start}
                  onChange={(e) => setDowntimeForm({ ...downtimeForm, start: e.target.value })}
                />
              </Field>

              <Field label="Downtime End Time">
                <input
                  type="datetime-local"
                  required
                  value={downtimeForm.end}
                  onChange={(e) => setDowntimeForm({ ...downtimeForm, end: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Reason / Work Order">
              <input
                required
                value={downtimeForm.reason}
                onChange={(e) => setDowntimeForm({ ...downtimeForm, reason: e.target.value })}
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button type="button" className="secondary" onClick={() => setDowntimeModal(null)}>Cancel</button>
              <button type="submit" className="primary">Schedule Maintenance</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
