import { useCallback, useEffect, useState } from "react";
import { Key, Trash, UserPlus } from "@phosphor-icons/react";
import { api } from "./api";
import type { Row, Run } from "./api";
import { Field, Modal, Panel } from "./ui";

const ROLES = [
  "admin",
  "manager",
  "planner",
  "sales",
  "supervisor",
  "purchase",
  "maintenance",
  "management",
];
const MIN_PASSWORD = 16;

const send = (path: string, method: string, body?: Row) =>
  api(path, { method, body: body && JSON.stringify(body) });

/** Administrator view: create, re-role, reset and remove sign-in accounts. */
export function UserAdmin({
  session,
  run,
  notice,
}: {
  session: Row;
  run: Run;
  notice: (s: string) => void;
}) {
  const [users, setUsers] = useState<Row[]>([]),
    [draft, setDraft] = useState({ username: "", role: "planner", password: "" }),
    [reset, setReset] = useState<string | null>(null),
    [resetPassword, setResetPassword] = useState("");
  const load = useCallback(
    () => api("/users").then(setUsers).catch(() => setUsers([])),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const create = () =>
    run("Creating account", async () => {
      await send("/users", "POST", draft);
      setDraft({ username: "", role: "planner", password: "" });
      await load();
      notice(`Account ${draft.username} created. Share the password privately.`);
    });
  const changeRole = (username: string, role: string) =>
    run("Updating role", async () => {
      await send("/users/" + encodeURIComponent(username), "PUT", { role });
      await load();
      notice(`${username} is now ${role}. They will sign in again.`);
    });
  const remove = (username: string) => {
    if (!window.confirm(`Remove ${username}? They will be signed out.`)) return;
    run("Removing account", async () => {
      await send("/users/" + encodeURIComponent(username), "DELETE");
      await load();
      notice(`${username} removed.`);
    });
  };
  const savePassword = () =>
    run("Resetting password", async () => {
      await send("/users/" + encodeURIComponent(reset!), "PUT", {
        password: resetPassword,
      });
      notice(`Password reset for ${reset}. Share it privately.`);
      setReset(null);
      setResetPassword("");
    });

  return (
    <>
      <Panel
        title="Add a user"
        sub={`Accounts are created by an administrator. Passwords need at least ${MIN_PASSWORD} characters.`}
      >
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <div className="form-grid">
            <Field label="Username">
              <input
                required
                minLength={3}
                pattern="[A-Za-z0-9._@\-]+"
                title="Letters, numbers, dot, underscore, @ or hyphen"
                autoComplete="off"
                value={draft.username}
                onChange={(e) =>
                  setDraft({ ...draft, username: e.target.value.trim() })
                }
              />
            </Field>
            <Field label="Role">
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Initial password">
              <input
                type="password"
                required
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              />
            </Field>
          </div>
          <button className="primary">
            <UserPlus size={17} /> Create account
          </button>
        </form>
      </Panel>
      <Panel title="Users" sub="Everyone who can sign in to this workspace.">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>
                    <strong>{u.username}</strong>
                    {u.username === session.username && (
                      <span className="cell-sub">You</span>
                    )}
                  </td>
                  <td>
                    <select
                      aria-label={"Role for " + u.username}
                      value={u.role}
                      onChange={(e) => changeRole(u.username, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="button-row">
                      <button
                        className="btn secondary"
                        onClick={() => setReset(u.username)}
                      >
                        <Key size={15} /> Reset password
                      </button>
                      {u.username !== session.username && (
                        <button
                          className="btn danger"
                          onClick={() => remove(u.username)}
                        >
                          <Trash size={15} /> Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {reset && (
        <Modal title={"Reset password · " + reset} close={() => setReset(null)}>
          <form
            className="detail-body"
            onSubmit={(e) => {
              e.preventDefault();
              savePassword();
            }}
          >
            <Field label="New password">
              <input
                type="password"
                required
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </Field>
            <p className="fine-print">
              {reset} will be signed out of every device.
            </p>
            <button className="primary">Save password</button>
          </form>
        </Modal>
      )}
    </>
  );
}

/** Any signed-in user: change their own password. */
export function MyAccount({
  session,
  run,
  notice,
}: {
  session: Row;
  run: Run;
  notice: (s: string) => void;
}) {
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    mismatch = confirm.length > 0 && confirm !== next;
  return (
    <Panel
      title="My account"
      sub={`Signed in as ${session.username} · ${session.role}`}
    >
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (mismatch) return;
          run("Changing password", async () => {
            await api("/me/password", {
              method: "POST",
              body: JSON.stringify({
                current_password: current,
                new_password: next,
              }),
            });
            setCurrent("");
            setNext("");
            setConfirm("");
            notice("Password changed. Other devices were signed out.");
          });
        }}
      >
        <Field label="Current password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label={`New password (${MIN_PASSWORD}+ characters)`}>
            <input
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        </div>
        {mismatch && <p className="red-text">Passwords do not match.</p>}
        <button className="primary" disabled={mismatch}>
          <Key size={17} /> Change password
        </button>
      </form>
    </Panel>
  );
}
