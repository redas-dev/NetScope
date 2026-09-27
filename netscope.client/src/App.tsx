import { useEffect, useState } from "react";
import { AuthProvider } from "./context";
import { useAuth } from "./auth-context";
import { navigate, useRoute } from "./hooks";
import { Icon } from "./components/Icon";
import { Brand, Empty, Loading, Modal } from "./components/ui";
import { EntityForm } from "./components/EntityForm";
import { Dashboard } from "./pages/Dashboard";
import { LocationsPage } from "./pages/LocationsPage";
import { DetailPage } from "./pages/DetailPage";
import { UsersPage } from "./pages/UsersPage";
import { AuthPage } from "./pages/AuthPage";
import "./App.css";

function Shell() {
  const route = useRoute();
  const { session, checking, signOut, notify } = useAuth();
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [create, setCreate] = useState(false);
  const [version, setVersion] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    document.title = `NetScope · ${route === "/users" ? "Naudotojai" : route.startsWith("/locations") ? "Tinklo vietos" : route === "/register" ? "Registracija" : session ? "Tinklo apžvalga" : "Prisijungimas"}`;
  }, [route, session]);
  async function logout() {
    setLoggingOut(true);
    try {
      await signOut();
      setMenu(false);
      navigate("/login");
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setLoggingOut(false);
    }
  }
  const parts = route.split("/").filter(Boolean);
  let content;
  if (checking) content = <Loading />;
  else if (!session)
    content = (
      <AuthPage
        key={route === "/register" ? "register" : "login"}
        register={route === "/register"}
      />
    );
  else if (route === "/" || route === "/login" || route === "/register")
    content = <Dashboard key={version} onCreate={() => setCreate(true)} />;
  else if (route === "/locations") content = <LocationsPage />;
  else if (
    parts[0] === "locations" &&
    (parts.length === 2 || (parts.length === 4 && parts[2] === "devices"))
  )
    content = (
      <DetailPage key={route} locationId={parts[1]} deviceId={parts[3]} />
    );
  else if (route === "/users" && session.user.role === "Admin")
    content = <UsersPage />;
  else
    content = (
      <Empty
        title="Puslapis nepasiekiamas"
        text="Toks puslapis neegzistuoja arba neturite teisės jo peržiūrėti."
        action={
          <a className="button primary" href="/">
            Grįžti į apžvalgą
          </a>
        }
      />
    );
  const active = route.startsWith("/locations")
    ? "locations"
    : route === "/users"
      ? "users"
      : "dashboard";
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Pereiti prie turinio
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          {session ? (
            <>
              <button
                className="menu-toggle icon-button"
                aria-label={menu ? "Uždaryti meniu" : "Atidaryti meniu"}
                aria-expanded={menu}
                aria-controls="primary-navigation"
                onClick={() => setMenu((v) => !v)}
              >
                <Icon name={menu ? "close" : "menu"} />
              </button>
              <nav
                id="primary-navigation"
                className={`main-nav ${menu ? "is-open" : ""}`}
                aria-label="Pagrindinis meniu"
              >
                <a
                  href="/"
                  aria-current={active === "dashboard" ? "page" : undefined}
                  onClick={() => setMenu(false)}
                >
                  <Icon name="grid" size={18} />
                  Apžvalga
                </a>
                <a
                  href="/locations"
                  aria-current={active === "locations" ? "page" : undefined}
                  onClick={() => setMenu(false)}
                >
                  <Icon name="pin" size={18} />
                  Vietos
                </a>
                {session.user.role === "Admin" && (
                  <a
                    href="/users"
                    aria-current={active === "users" ? "page" : undefined}
                    onClick={() => setMenu(false)}
                  >
                    <Icon name="users" size={18} />
                    Naudotojai
                  </a>
                )}
                <button
                  className="mobile-logout"
                  onClick={logout}
                  disabled={loggingOut}
                >
                  <Icon name="logout" size={18} />
                  Atsijungti
                </button>
              </nav>
              <div className="account">
                <span className="avatar">
                  {session.user.email.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong title={session.user.email}>
                    {session.user.email}
                  </strong>
                  <small>
                    {session.user.role === "Admin"
                      ? "Administratorius"
                      : "Naudotojas"}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label="Atsijungti"
                  title="Atsijungti"
                  disabled={loggingOut}
                  onClick={logout}
                >
                  <Icon name="logout" size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="header-caption">
              <Icon name="shield" size={17} />
              <span>Tinklo infrastruktūros valdymas</span>
            </div>
          )}
        </div>
      </header>
      {session && (
        <div className="workspace-bar">
          <div>
            <span>
              <i className="green-dot" />
              NETSCOPE DARBO ERDVĖ
            </span>
            <span className="workspace-date">
              {new Intl.DateTimeFormat("lt-LT", { dateStyle: "long" }).format(
                new Date(),
              )}
            </span>
          </div>
        </div>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={`main-content ${session ? "" : "auth-main"}`}
      >
        {content}
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <Brand />
            <p>Aiškus tinklas. Paprastas valdymas.</p>
          </div>
          <div className="footer-links">
            <button onClick={() => setHelp(true)}>Kaip naudotis</button>
            <a href="/wireframes.html" target="_blank" rel="noreferrer">
              Sąsajos projektas <span className="sr-only">(naujame lange)</span>
            </a>
            <span>© {new Date().getFullYear()} NetScope</span>
          </div>
        </div>
      </footer>
      {create && (
        <EntityForm
          target={{ kind: "location", path: "/api/locations" }}
          onClose={() => setCreate(false)}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}{" "}
      {help && (
        <Modal
          title="Jūsų tinklas – trys paprasti žingsniai"
          onClose={() => setHelp(false)}
          wide
        >
          <div className="help-grid">
            <article>
              <span>01</span>
              <Icon name="pin" />
              <h3>Sukurkite vietą</h3>
              <p>Registruokite pastatą, kabinetą ar loginę tinklo erdvę.</p>
            </article>
            <article>
              <span>02</span>
              <Icon name="server" />
              <h3>Pridėkite įrenginius</h3>
              <p>
                Vietoje pridėkite maršrutizatorius, komutatorius ir prieigos
                taškus.
              </p>
            </article>
            <article>
              <span>03</span>
              <Icon name="laptop" />
              <h3>Susiekite klientus</h3>
              <p>
                Įrenginiui priskirkite kompiuterius, telefonus ir kitus
                klientus.
              </p>
            </article>
          </div>
          <div className="context-note">
            <Icon name="shield" />
            <p>
              Keisti galite savo vietas ir joms priklausančius duomenis.
              Administratorius gali valdyti visas vietas. Įrenginių būsenos
              atnaujinamos rankiniu būdu.
            </p>
          </div>
          <div className="modal-actions">
            <button className="button primary" onClick={() => setHelp(false)}>
              Supratau
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
