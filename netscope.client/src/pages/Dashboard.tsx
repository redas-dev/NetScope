import { useCallback } from "react";
import { allPages, deviceTypes, locationPath, request } from "../api";
import type { Device, Location } from "../api";
import { useAuth } from "../auth-context";
import { useLoad } from "../hooks";
import { Icon } from "../components/Icon";
import type { IconName } from "../components/Icon";
import { Badge, Empty, ErrorBox, Loading, PageTitle } from "../components/ui";

interface Overview {
  locationCount: number;
  deviceCount: number;
  onlineDeviceCount: number;
  recentLocations: { location: Location; deviceCount: number }[];
}

export function Dashboard({ onCreate }: { onCreate: () => void }) {
  const { session } = useAuth();
  const loader = useCallback(async (signal: AbortSignal) => {
    const [overview, locations] = await Promise.all([
      request<Overview>("/api/overview", { signal }),
      allPages<Location>("/api/locations", signal),
    ]);
    const devices: Device[] = [];
    // Bound concurrent requests, and include every API page in aggregate counts.
    for (let index = 0; index < locations.length; index += 5) {
      const batch = await Promise.all(
        locations
          .slice(index, index + 5)
          .map((location) =>
            allPages<Device>(`${locationPath(location.id)}/devices`, signal),
          ),
      );
      devices.push(...batch.flat());
    }
    return { locations, devices, overview };
  }, []);
  const { data, loading, error, reload } = useLoad(loader);
  const online =
    data?.devices.filter((device) => device.status === "Online").length || 0;
  const offline =
    data?.devices.filter((device) => device.status === "Offline").length || 0;
  const maintenance =
    data?.devices.filter((device) => device.status === "Maintenance").length ||
    0;
  const total = data?.devices.length || 0;
  const metrics: {
    label: string;
    value?: number;
    description: string;
    icon: IconName;
  }[] = [
    {
      label: "Tinklo vietos",
      value: data?.overview.locationCount,
      description: "Fizinės ir loginės erdvės",
      icon: "pin",
    },
    {
      label: "Įrenginiai",
      value: data?.overview.deviceCount,
      description: "Visose registruotose vietose",
      icon: "server",
    },
    {
      label: "Aktyvūs įrenginiai",
      value: data?.overview.onlineDeviceCount,
      description: "Pagal įrašytą būseną",
      icon: "pulse",
    },
    {
      label: "Mano vietos",
      value: data?.locations.filter(
        (location) => location.ownerId === session!.user.id,
      ).length,
      description: "Jūsų sukurta infrastruktūra",
      icon: "shield",
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="DARBO ERDVĖ"
        title="Tinklo apžvalga"
        description="Visas jūsų infrastruktūros vaizdas vienoje vietoje."
        action={
          <>
            <button
              className="button secondary"
              onClick={reload}
              disabled={loading}
            >
              <Icon name="refresh" />
              Atnaujinti
            </button>
            <button className="button primary" onClick={onCreate}>
              <Icon name="plus" />
              Nauja vieta
            </button>
          </>
        }
      />
      <ErrorBox error={error} retry={reload} />
      <section className="overview-banner">
        <div>
          <span className="section-kicker">
            <span className="green-dot" />
            JŪSŲ TINKLO STRUKTŪRA
          </span>
          <h2>
            Mažiau chaoso.
            <br />
            Daugiau aiškumo.
          </h2>
          <p>
            Nuo pastato iki prijungto kompiuterio.
            <br />
            Kurkite, susiekite ir valdykite savo infrastruktūrą.
          </p>
          <a href="/locations" className="banner-link">
            Peržiūrėti vietas
            <Icon name="arrow" size={18} />
          </a>
        </div>
        <img
          src="/network-map.svg"
          width="440"
          height="250"
          alt="Vietų, tinklo įrenginių ir klientų ryšių iliustracija"
        />
      </section>
      <section className="metrics" aria-label="Infrastruktūros statistika">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <div>
              <span>{metric.label}</span>
              <Icon name={metric.icon} />
            </div>
            <strong>{metric.value ?? "—"}</strong>
            <small>{metric.description}</small>
          </article>
        ))}
      </section>
      {loading && <Loading />}
      {data && (
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Naujausios vietos</h2>
                <p>Jūsų tinklo infrastruktūros pradžia</p>
              </div>
              <a className="text-link" href="/locations">
                Visos vietos
                <Icon name="arrow" size={16} />
              </a>
            </div>
            {data.overview.recentLocations.length ? (
              <div className="location-preview-list">
                {data.overview.recentLocations
                  .slice(0, 4)
                  .map(({ location, deviceCount }) => (
                    <a
                      className="location-preview"
                      href={`/locations/${location.id}`}
                      key={location.id}
                    >
                      <span className="resource-icon">
                        <Icon name="pin" />
                      </span>
                      <div>
                        <strong>{location.name}</strong>
                        <small>{location.address}</small>
                      </div>
                      <span className="preview-count">
                        {deviceCount}{" "}
                        įr.
                      </span>
                      <Icon name="chevron" size={18} />
                    </a>
                  ))}
              </div>
            ) : (
              <Empty
                title="Pradėkite nuo pirmos vietos"
                text="Pridėkite pastatą, kabinetą ar kitą tinklo erdvę."
                action={
                  <button className="button primary" onClick={onCreate}>
                    Sukurti vietą
                  </button>
                }
              />
            )}
          </section>
          <section className="panel status-panel">
            <div className="panel-heading">
              <div>
                <h2>Įrenginių būsenos</h2>
                <p>Registruotos tinklo įrenginių būsenos</p>
              </div>
              <Icon name="pulse" />
            </div>
            <div className="status-chart">
              <div
                className="donut"
                style={{
                  background: total
                    ? `conic-gradient(var(--green) 0 ${(online / total) * 100}%, #e8b663 ${(online / total) * 100}% ${((online + maintenance) / total) * 100}%, #c4ced1 ${((online + maintenance) / total) * 100}% 100%)`
                    : "var(--line)",
                }}
                role="img"
                aria-label={`${online} aktyvūs, ${maintenance} priežiūros, ${offline} neaktyvūs`}
              >
                <div>
                  <strong>{total}</strong>
                  <span>įrenginiai</span>
                </div>
              </div>
              <ul className="chart-legend">
                <li>
                  <span>
                    <i className="legend-dot online" />
                    Aktyvūs
                  </span>
                  <strong>{online}</strong>
                </li>
                <li>
                  <span>
                    <i className="legend-dot maintenance" />
                    Priežiūra
                  </span>
                  <strong>{maintenance}</strong>
                </li>
                <li>
                  <span>
                    <i className="legend-dot offline" />
                    Neaktyvūs
                  </span>
                  <strong>{offline}</strong>
                </li>
              </ul>
            </div>
          </section>
          <section className="panel device-preview-panel">
            <div className="panel-heading">
              <div>
                <h2>Įrenginių registras</h2>
                <p>Greita prieiga prie tinklo įrenginių</p>
              </div>
              <span className="count-pill">{total} iš viso</span>
            </div>
            {total ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Įrenginys</th>
                      <th>Vieta</th>
                      <th>IP adresas</th>
                      <th>Būsena</th>
                      <th>
                        <span className="sr-only">Atidaryti</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.devices.slice(0, 5).map((device) => (
                      <tr key={device.id}>
                        <td>
                          <a
                            className="table-name"
                            href={`/locations/${device.locationId}/devices/${device.id}`}
                          >
                            <Icon name="server" />
                            <span>
                              {device.name}
                              <small>{deviceTypes[device.type]}</small>
                            </span>
                          </a>
                        </td>
                        <td>
                          {
                            data.locations.find(
                              (location) => location.id === device.locationId,
                            )?.name
                          }
                        </td>
                        <td className="mono">{device.ipAddress}</td>
                        <td>
                          <Badge status={device.status} />
                        </td>
                        <td>
                          <a
                            className="icon-button"
                            href={`/locations/${device.locationId}/devices/${device.id}`}
                            aria-label={`Atidaryti ${device.name}`}
                          >
                            <Icon name="arrow" size={18} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Įrenginių dar nėra"
                text="Atidarykite vietą ir pridėkite pirmą tinklo įrenginį."
                icon="server"
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
