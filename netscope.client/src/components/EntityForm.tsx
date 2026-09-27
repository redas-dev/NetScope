import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, clientTypes, deviceTypes, statuses, write } from "../api";
import { useAuth } from "../auth-context";
import { ErrorBox, Modal } from "./ui";
import { Icon } from "./Icon";

export type EntityKind = "location" | "device" | "client";
export interface EditTarget {
  kind: EntityKind;
  path: string;
  initial?: Record<string, unknown>;
}
const names = {
  location: ["Nauja vieta", "Redaguoti vietą"],
  device: ["Naujas įrenginys", "Redaguoti įrenginį"],
  client: ["Naujas klientas", "Redaguoti klientą"],
};

export function EntityForm({
  target,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const initial = target.initial || {};
  const field = (key: string) => String(initial[key] ?? "");
  const [kind, setKind] = useState(
    field("type") || (target.kind === "device" ? "Router" : "Computer"),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) || "").trim();
    const body =
      target.kind === "location"
        ? {
            name: text("name"),
            address: text("address"),
            description: text("description") || null,
          }
        : {
            name: text("name"),
            type: text("type"),
            ipAddress: text("ipAddress"),
            macAddress: text("macAddress"),
            ...(target.kind === "device" ? { status: text("status") } : {}),
          };
    setBusy(true);
    setError(undefined);
    try {
      await write(target.path, target.initial ? "PUT" : "POST", body);
      notify(
        target.initial ? "Pakeitimai išsaugoti." : "Įrašas sėkmingai sukurtas.",
      );
      onSaved();
      onClose();
    } catch (failure) {
      setError(failure as Error);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={names[target.kind][target.initial ? 1 : 0]}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="entity-form">
        <p className="form-intro">
          {target.kind === "location"
            ? "Aprašykite fizinę arba loginę savo tinklo vietą."
            : target.kind === "device"
              ? "Pridėkite įrenginį ir nurodykite jo tinklo informaciją."
              : "Užregistruokite prie šio įrenginio prijungtą klientą."}{" "}
          Laukai su * privalomi.
        </p>
        <ErrorBox error={error} />
        {error instanceof ApiError && Object.keys(error.fields).length > 0 && (
          <ul className="validation-list">
            {Object.entries(error.fields).map(([key, values]) => (
              <li key={key}>
                {key}: {values.join(" ")}
              </li>
            ))}
          </ul>
        )}
        <fieldset disabled={busy}>
          <label>
            Pavadinimas *
            <input
              autoFocus
              name="name"
              defaultValue={field("name")}
              required
              minLength={2}
              maxLength={120}
              placeholder={
                target.kind === "location"
                  ? "Pvz., KTU tinklų laboratorija"
                  : "Pvz., Pagrindinis maršrutizatorius"
              }
            />
          </label>
          {target.kind === "location" ? (
            <>
              <label>
                Adresas / vietos aprašas *
                <input
                  name="address"
                  defaultValue={field("address")}
                  required
                  maxLength={250}
                  placeholder="Gatvė, pastatas, kabinetas"
                />
              </label>
              <label>
                Papildoma informacija
                <textarea
                  name="description"
                  defaultValue={field("description")}
                  rows={4}
                  maxLength={1000}
                  placeholder="Kam skirta ši vieta?"
                />
              </label>
            </>
          ) : (
            <>
              <div className="form-row">
                <label>
                  Tipas *
                  <select
                    name="type"
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                  >
                    {Object.entries(
                      target.kind === "device" ? deviceTypes : clientTypes,
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {target.kind === "device" && (
                  <label>
                    Būsena *
                    <select
                      name="status"
                      defaultValue={field("status") || "Online"}
                    >
                      {Object.entries(statuses).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <label>
                IP adresas *
                <input
                  name="ipAddress"
                  defaultValue={field("ipAddress")}
                  required
                  maxLength={45}
                  placeholder="192.168.1.1"
                  spellCheck={false}
                />
                <small>Galimas IPv4 arba IPv6 adresas.</small>
              </label>
              <label>
                MAC adresas *
                <input
                  name="macAddress"
                  defaultValue={field("macAddress")}
                  required
                  pattern="([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  title="Šešios šešioliktainių skaitmenų poros, atskirtos dvitaškiais"
                  spellCheck={false}
                />
              </label>
            </>
          )}
        </fieldset>
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Atšaukti
          </button>
          <button className="button primary" disabled={busy}>
            <Icon name="check" />
            {busy ? "Saugoma…" : "Išsaugoti"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export interface DeleteTarget {
  path: string;
  name: string;
  consequence: string;
  after?: () => void;
}
export function DeleteDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: DeleteTarget;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  async function confirm() {
    setBusy(true);
    try {
      await write(target.path, "DELETE");
      notify("Įrašas pašalintas.");
      onDeleted();
      target.after?.();
      onClose();
    } catch (failure) {
      setError(failure as Error);
      setBusy(false);
    }
  }
  return (
    <Modal title="Pašalinti įrašą?" onClose={onClose} busy={busy}>
      <div className="delete-symbol">
        <Icon name="trash" size={28} />
      </div>
      <p className="delete-name">{target.name}</p>
      <p className="muted">
        {target.consequence} Šio veiksmo atšaukti negalima.
      </p>
      <ErrorBox error={error} />
      <div className="modal-actions">
        <button
          className="button secondary"
          autoFocus
          disabled={busy}
          onClick={onClose}
        >
          Atšaukti
        </button>
        <button className="button danger" disabled={busy} onClick={confirm}>
          {busy ? "Šalinama…" : "Taip, pašalinti"}
        </button>
      </div>
    </Modal>
  );
}
