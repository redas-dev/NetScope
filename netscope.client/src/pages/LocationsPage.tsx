import { useCallback, useState } from "react";
import { formatDate, locationPath, request } from "../api";
import type { Location, Page } from "../api";
import { useAuth } from "../auth-context";
import { useLoad } from "../hooks";
import { Icon } from "../components/Icon";
import {
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  Pagination,
} from "../components/ui";
import { DeleteDialog, EntityForm } from "../components/EntityForm";
import type { DeleteTarget, EditTarget } from "../components/EntityForm";

export function LocationsPage() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [edit, setEdit] = useState<EditTarget>();
  const [remove, setRemove] = useState<DeleteTarget>();
  const loader = useCallback(
    (signal: AbortSignal) =>
      request<Page<Location>>(
        `/api/locations?${new URLSearchParams({ page: String(page), pageSize: "10", search, ...(mine ? { ownerId: session!.user.id } : {}) })}`,
        { signal },
      ),
    [page, search, mine, session],
  );
  const { data, loading, error, reload } = useLoad(loader);
  const refresh = () => {
    setPage(1);
    reload();
  };
  const create = () => setEdit({ kind: "location", path: "/api/locations" });
  return (
    <>
      <PageTitle
        eyebrow="INFRASTRUKTŪRA"
        title="Tinklo vietos"
        description="Pastatai, kabinetai ir loginės erdvės, kuriose veikia jūsų tinklas."
        action={
          <button className="button primary" onClick={create}>
            <Icon name="plus" />
            Nauja vieta
          </button>
        }
      />
      <section className="panel">
        <div className="toolbar">
          <form
            className="search-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(
                String(new FormData(event.currentTarget).get("search") || ""),
              );
              setPage(1);
            }}
          >
            <label className="search-input">
              <Icon name="search" />
              <span className="sr-only">Ieškoti vietų</span>
              <input
                name="search"
                type="search"
                placeholder="Ieškoti pagal pavadinimą ar adresą…"
                maxLength={120}
              />
            </label>
            <button className="button secondary">Ieškoti</button>
          </form>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={mine}
              onChange={(event) => {
                setMine(event.target.checked);
                setPage(1);
              }}
            />
            Tik mano vietos
          </label>
        </div>
        <ErrorBox error={error} retry={reload} />
        {loading ? (
          <Loading />
        ) : (
          data && (
            <>
              {data.items.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Vieta</th>
                        <th>Adresas</th>
                        <th>Sukurta</th>
                        <th>Prieiga</th>
                        <th className="align-right">Veiksmai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((location) => {
                        const owner = location.ownerId === session!.user.id;
                        const editable =
                          owner || session!.user.role === "Admin";
                        return (
                          <tr key={location.id}>
                            <td>
                              <a
                                href={`#/locations/${location.id}`}
                                className="table-name"
                              >
                                <span className="resource-icon">
                                  <Icon name="pin" />
                                </span>
                                <span>
                                  {location.name}
                                  <small>
                                    {location.description ||
                                      "Tinklo infrastruktūros vieta"}
                                  </small>
                                </span>
                              </a>
                            </td>
                            <td>{location.address}</td>
                            <td className="nowrap muted">
                              {formatDate(location.createdAt)}
                            </td>
                            <td>
                              <span
                                className={`access-badge ${editable ? "owned" : ""}`}
                              >
                                {owner
                                  ? "Mano vieta"
                                  : editable
                                    ? "Administratorius"
                                    : "Peržiūra"}
                              </span>
                            </td>
                            <td>
                              <div className="row-actions">
                                {editable && (
                                  <>
                                    <button
                                      className="icon-button"
                                      title="Redaguoti"
                                      aria-label={`Redaguoti ${location.name}`}
                                      onClick={() =>
                                        setEdit({
                                          kind: "location",
                                          path: locationPath(location.id),
                                          initial: { ...location },
                                        })
                                      }
                                    >
                                      <Icon name="edit" size={18} />
                                    </button>
                                    <button
                                      className="icon-button danger-text"
                                      title="Pašalinti"
                                      aria-label={`Pašalinti ${location.name}`}
                                      onClick={() =>
                                        setRemove({
                                          path: locationPath(location.id),
                                          name: location.name,
                                          consequence:
                                            "Bus pašalinta vieta, visi jos įrenginiai ir jų klientai.",
                                        })
                                      }
                                    >
                                      <Icon name="trash" size={18} />
                                    </button>
                                  </>
                                )}
                                <a
                                  href={`#/locations/${location.id}`}
                                  className="icon-button"
                                  aria-label={`Atidaryti ${location.name}`}
                                >
                                  <Icon name="arrow" size={18} />
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title={
                    search || mine
                      ? "Vietų nerasta"
                      : "Jūsų tinklas prasideda čia"
                  }
                  text={
                    search || mine
                      ? "Pakeiskite paieškos tekstą arba vietų filtrą."
                      : "Sukurkite vietą ir priskirkite jai tinklo įrenginius."
                  }
                  icon="pin"
                  action={
                    <button className="button primary" onClick={create}>
                      Sukurti vietą
                    </button>
                  }
                />
              )}
              <Pagination
                total={data.total}
                page={page}
                pageSize={10}
                change={setPage}
              />
            </>
          )
        )}
      </section>
      <div className="context-note">
        <Icon name="shield" size={18} />
        <p>
          Matote visas tinklo vietas. Redaguoti ir šalinti galite savo vietas
          {session!.user.role === "Admin"
            ? " bei kitų naudotojų vietas, nes esate administratorius."
            : "."}
        </p>
      </div>
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
    </>
  );
}
