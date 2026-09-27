import { useCallback, useState } from "react";
import { request } from "../api";
import type { Page, User } from "../api";
import { useAuth } from "../auth-context";
import { useLoad } from "../hooks";
import { DeleteDialog } from "../components/EntityForm";
import type { DeleteTarget } from "../components/EntityForm";
import { Icon } from "../components/Icon";
import {
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  Pagination,
} from "../components/ui";

export function UsersPage() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [remove, setRemove] = useState<DeleteTarget>();
  const loader = useCallback(
    (signal: AbortSignal) =>
      request<Page<User>>(
        `/api/users?${new URLSearchParams({ search, page: String(page), pageSize: "10" })}`,
        { signal },
      ),
    [search, page],
  );
  const { data, loading, error, reload } = useLoad(loader);
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRAVIMAS"
        title="Naudotojai"
        description="Sistemos paskyros ir jų prieigos rolės."
      />
      <div className="context-note">
        <Icon name="shield" />
        <p>
          Pašalinus naudotoją, pašalinamos ir jo vietos, įrenginiai bei
          klientai.
        </p>
      </div>
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
              <span className="sr-only">Ieškoti naudotojų</span>
              <input
                type="search"
                name="search"
                maxLength={120}
                placeholder="Ieškoti pagal el. paštą…"
              />
            </label>
            <button className="button secondary">Ieškoti</button>
          </form>
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
                        <th>Naudotojas</th>
                        <th>Rolė</th>
                        <th className="align-right">Veiksmai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="table-name">
                              <span className="avatar">
                                {user.email.slice(0, 2).toUpperCase()}
                              </span>
                              <span>
                                {user.email}
                                {user.id === session!.user.id && (
                                  <small>Jūsų paskyra</small>
                                )}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`access-badge ${user.role === "Admin" ? "owned" : ""}`}
                            >
                              {user.role === "Admin"
                                ? "Administratorius"
                                : "Naudotojas"}
                            </span>
                          </td>
                          <td className="align-right">
                            <button
                              className="button secondary danger-text"
                              disabled={user.id === session!.user.id}
                              title={
                                user.id === session!.user.id
                                  ? "Savo paskyros pašalinti negalite"
                                  : undefined
                              }
                              onClick={() =>
                                setRemove({
                                  path: `/api/users/${user.id}`,
                                  name: user.email,
                                  consequence:
                                    "Bus pašalinta paskyra ir visa jai priklausanti tinklo infrastruktūra.",
                                })
                              }
                            >
                              <Icon name="trash" size={17} />
                              Pašalinti
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Naudotojų nerasta"
                  text="Patikslinkite el. pašto paiešką."
                  icon="users"
                />
              )}
              <Pagination
                page={page}
                pageSize={10}
                total={data.total}
                change={setPage}
              />
            </>
          )
        )}
      </section>
      {remove && (
        <DeleteDialog
          target={remove}
          onClose={() => setRemove(undefined)}
          onDeleted={() => {
            setPage(1);
            reload();
          }}
        />
      )}
    </>
  );
}
