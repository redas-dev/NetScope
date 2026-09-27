import { useCallback, useState } from "react";
import {
  clientPath,
  clientTypes,
  devicePath,
  deviceTypes,
  formatDate,
  locationPath,
  request,
  statuses,
} from "../api";
import type { Client, Device, Location, Page } from "../api";
import { useAuth } from "../auth-context";
import { navigate, useLoad } from "../hooks";
import { Icon } from "../components/Icon";
import {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  Pagination,
} from "../components/ui";
import { DeleteDialog, EntityForm } from "../components/EntityForm";
import type { DeleteTarget, EditTarget } from "../components/EntityForm";

export function DetailPage({
  locationId,
  deviceId,
}: {
  locationId: string;
  deviceId?: string;
}) {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [edit, setEdit] = useState<EditTarget>();
  const [remove, setRemove] = useState<DeleteTarget>();
  const [selected, setSelected] = useState<Client>();
  const [selectionError, setSelectionError] = useState<Error>();
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const location = await request<Location>(locationPath(locationId), {
        signal,
      });
      const canManage =
        location.ownerId === session!.user.id || session!.user.role === "Admin";
      const device = deviceId
        ? await request<Device>(devicePath(locationId, deviceId), { signal })
        : undefined;
      const query = new URLSearchParams({
        page: String(page),
        pageSize: "10",
        search,
        ...(type ? { type } : {}),
        ...(!deviceId && status ? { status } : {}),
      });
      const rows =
        canManage || !deviceId
          ? await request<Page<Device | Client>>(
              `${deviceId ? `${devicePath(locationId, deviceId)}/clients` : `${locationPath(locationId)}/devices`}?${query}`,
              { signal },
            )
          : undefined;
      return { location, device, canManage, rows };
    },
    [locationId, deviceId, session, page, search, type, status],
  );
  const { data, loading, error, reload } = useLoad(loader);
  const refresh = () => {
    setPage(1);
    setSelected(undefined);
    reload();
  };
  const create = () =>
    setEdit({
      kind: deviceId ? "client" : "device",
      path: deviceId
        ? `${devicePath(locationId, deviceId)}/clients`
        : `${locationPath(locationId)}/devices`,
    });
  async function showClient(row: Client) {
    setSelectionError(undefined);
    try {
      setSelected(
        await request<Client>(clientPath(locationId, deviceId!, row.id)),
      );
    } catch (failure) {
      setSelectionError(failure as Error);
    }
  }
  if (loading) return <Loading />;
  if (error || !data)
    return (
      <ErrorBox error={error || "Duomenys nepasiekiami."} retry={reload} />
    );
  const { location, device, canManage, rows } = data;
  const resource = device || location;
  return (
    <>
      <nav className="breadcrumbs" aria-label="Kelias">
        <a href="#/locations">Vietos</a>
        <Icon name="chevron" size={14} />
        {device ? (
          <>
            <a href={`#/locations/${locationId}`}>{location.name}</a>
            <Icon name="chevron" size={14} />
            <span>{device.name}</span>
          </>
        ) : (
          <span>{location.name}</span>
        )}
      </nav>
      <PageTitle
        eyebrow={device ? "TINKLO ĮRENGINYS" : "TINKLO VIETA"}
        title={resource.name}
        description={device ? deviceTypes[device.type] : location.address}
        action={
          canManage ? (
            <>
              <button
                className="button secondary"
                onClick={() =>
                  setEdit({
                    kind: device ? "device" : "location",
                    path: device
                      ? devicePath(locationId, device.id)
                      : locationPath(locationId),
                    initial: { ...resource },
                  })
                }
              >
                <Icon name="edit" size={18} />
                Redaguoti
              </button>
              <button
                className="button secondary danger-text"
                onClick={() =>
                  setRemove({
                    path: device
                      ? devicePath(locationId, device.id)
                      : locationPath(locationId),
                    name: resource.name,
                    consequence: device
                      ? "Bus pašalintas įrenginys ir visi jo klientai."
                      : "Bus pašalinta vieta su visais jos įrenginiais ir klientais.",
                    after: () =>
                      navigate(
                        device ? `/locations/${locationId}` : "/locations",
                      ),
                  })
                }
              >
                <Icon name="trash" size={18} />
                Pašalinti
              </button>
            </>
          ) : (
            <span className="access-badge">Tik peržiūra</span>
          )
        }
      />
      <section className="detail-summary panel">
        {device ? (
          <>
            <div>
              <span>IP adresas</span>
              <strong className="mono">{device.ipAddress}</strong>
            </div>
            <div>
              <span>MAC adresas</span>
              <strong className="mono">{device.macAddress}</strong>
            </div>
            <div>
              <span>Būsena</span>
              <Badge status={device.status} />
            </div>
            <div>
              <span>Priklauso vietai</span>
              <a href={`#/locations/${locationId}`}>
                {location.name}
                <Icon name="arrow" size={15} />
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="summary-description">
              <span>Apie vietą</span>
              <strong>
                {location.description || "Papildomas aprašymas nepateiktas."}
              </strong>
            </div>
            <div>
              <span>Sukurta</span>
              <strong>{formatDate(location.createdAt)}</strong>
            </div>
            <div>
              <span>Jūsų prieiga</span>
              <strong>{canManage ? "Valdymas ir peržiūra" : "Peržiūra"}</strong>
            </div>
          </>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {device ? "Prijungti klientai" : "Tinklo įrenginiai"}{" "}
              {rows && <span className="count-pill">{rows.total}</span>}
            </h2>
            <p>
              {device
                ? "Šiam įrenginiui priskirti kompiuteriai, telefonai ir kiti klientai."
                : "Šioje vietoje užregistruota tinklo įranga."}
            </p>
          </div>
          {canManage && (
            <button className="button primary" onClick={create}>
              <Icon name="plus" />
              {device ? "Naujas klientas" : "Naujas įrenginys"}
            </button>
          )}
        </div>
        {rows ? (
          <>
            <div className="toolbar">
              <form
                className="search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearch(
                    String(
                      new FormData(event.currentTarget).get("search") || "",
                    ),
                  );
                  setPage(1);
                }}
              >
                <label className="search-input">
                  <Icon name="search" />
                  <span className="sr-only">
                    Ieškoti {device ? "klientų" : "įrenginių"}
                  </span>
                  <input
                    name="search"
                    type="search"
                    defaultValue={search}
                    maxLength={120}
                    placeholder="Pavadinimas arba IP adresas…"
                  />
                </label>
                <button className="button secondary">Ieškoti</button>
              </form>
              <div className="filter-group">
                <label className="filter-label">
                  <span className="sr-only">Tipas</span>
                  <select
                    value={type}
                    onChange={(event) => {
                      setType(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Visi tipai</option>
                    {Object.entries(device ? clientTypes : deviceTypes).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {!device && (
                  <label className="filter-label">
                    <span className="sr-only">Būsena</span>
                    <select
                      value={status}
                      onChange={(event) => {
                        setStatus(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">Visos būsenos</option>
                      {Object.entries(statuses).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
            <ErrorBox error={selectionError} />
            {rows.items.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{device ? "Klientas" : "Įrenginys"}</th>
                      <th>IP adresas</th>
                      <th>MAC adresas</th>
                      {!device && <th>Būsena</th>}
                      <th className="align-right">Veiksmai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.items.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {device ? (
                            <button
                              className="table-name link-button"
                              onClick={() => showClient(row as Client)}
                            >
                              <Icon name="laptop" />
                              <span>
                                {row.name}
                                <small>{clientTypes[row.type]}</small>
                              </span>
                            </button>
                          ) : (
                            <a
                              className="table-name"
                              href={`#/locations/${locationId}/devices/${row.id}`}
                            >
                              <Icon name="server" />
                              <span>
                                {row.name}
                                <small>{deviceTypes[row.type]}</small>
                              </span>
                            </a>
                          )}
                        </td>
                        <td className="mono">{row.ipAddress}</td>
                        <td className="mono">{row.macAddress}</td>
                        {!device && (
                          <td>
                            <Badge status={(row as Device).status} />
                          </td>
                        )}
                        <td>
                          <div className="row-actions">
                            {canManage && (
                              <>
                                <button
                                  className="icon-button"
                                  aria-label={`Redaguoti ${row.name}`}
                                  title="Redaguoti"
                                  onClick={() =>
                                    setEdit({
                                      kind: device ? "client" : "device",
                                      path: device
                                        ? clientPath(
                                            locationId,
                                            device.id,
                                            row.id,
                                          )
                                        : devicePath(locationId, row.id),
                                      initial: { ...row },
                                    })
                                  }
                                >
                                  <Icon name="edit" size={18} />
                                </button>
                                <button
                                  className="icon-button danger-text"
                                  aria-label={`Pašalinti ${row.name}`}
                                  title="Pašalinti"
                                  onClick={() =>
                                    setRemove({
                                      path: device
                                        ? clientPath(
                                            locationId,
                                            device.id,
                                            row.id,
                                          )
                                        : devicePath(locationId, row.id),
                                      name: row.name,
                                      consequence: device
                                        ? "Bus pašalintas šis kliento įrašas."
                                        : "Bus pašalintas įrenginys ir jo klientai.",
                                    })
                                  }
                                >
                                  <Icon name="trash" size={18} />
                                </button>
                              </>
                            )}
                            {!device && (
                              <a
                                className="icon-button"
                                href={`#/locations/${locationId}/devices/${row.id}`}
                                aria-label={`Atidaryti ${row.name}`}
                              >
                                <Icon name="arrow" size={18} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title={
                  search || type || status
                    ? "Įrašų nerasta"
                    : device
                      ? "Klientų dar nėra"
                      : "Įrenginių dar nėra"
                }
                text={
                  search || type || status
                    ? "Pabandykite kitus filtrus arba paieškos tekstą."
                    : "Pridėkite pirmą įrašą ir papildykite tinklo struktūrą."
                }
                icon={device ? "laptop" : "server"}
              />
            )}
            <Pagination
              total={rows.total}
              page={page}
              pageSize={10}
              change={setPage}
            />
          </>
        ) : (
          <Empty
            title="Klientų informacija privati"
            text="Klientus gali peržiūrėti vietos savininkas ir administratorius."
            icon="lock"
          />
        )}
      </section>
      {edit && (
        <EntityForm
          target={edit}
          onClose={() => setEdit(undefined)}
          onSaved={refresh}
        />
      )}{" "}
      {remove && (
        <DeleteDialog
          target={remove}
          onClose={() => setRemove(undefined)}
          onDeleted={refresh}
        />
      )}
      {selected && (
        <ClientInfo client={selected} close={() => setSelected(undefined)} />
      )}
    </>
  );
}

import { Modal } from "../components/ui";
function ClientInfo({ client, close }: { client: Client; close: () => void }) {
  return (
    <Modal title="Kliento informacija" onClose={close}>
      <div className="client-info">
        <span className="resource-icon large">
          <Icon name="laptop" size={28} />
        </span>
        <h3>{client.name}</h3>
        <p>{clientTypes[client.type]}</p>
      </div>
      <dl className="detail-list">
        <div>
          <dt>IP adresas</dt>
          <dd className="mono">{client.ipAddress}</dd>
        </div>
        <div>
          <dt>MAC adresas</dt>
          <dd className="mono">{client.macAddress}</dd>
        </div>
        <div>
          <dt>Identifikatorius</dt>
          <dd className="mono">{client.id}</dd>
        </div>
      </dl>
      <div className="modal-actions">
        <button className="button primary" onClick={close}>
          Uždaryti
        </button>
      </div>
    </Modal>
  );
}
