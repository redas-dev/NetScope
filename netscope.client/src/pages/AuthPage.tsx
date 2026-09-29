import { useState } from "react";
import type { FormEvent } from "react";
import { write } from "../api";
import type { Session } from "../api";
import { useAuth } from "../auth-context";
import { navigate } from "../hooks";
import { Icon } from "../components/Icon";
import { ErrorBox } from "../components/ui";

export function AuthPage({ register = false }: { register?: boolean }) {
  const { signIn } = useAuth();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password"));
    if (register && password !== fields.get("confirm")) {
      setError(new Error("Slaptažodžiai nesutampa."));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const session = await write<Session>(
        `/api/auth/${register ? "register" : "login"}`,
        "POST",
        { email: String(fields.get("email")).trim(), password },
      );
      signIn(session);
      navigate("/");
    } catch (failure) {
      setError(failure as Error);
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <span className="eyebrow">NETSCOPE</span>
        <h1>Tinklo infrastruktūros valdymas</h1>
        <p>Valdykite vietas, įrenginius ir jų klientus.</p>
        <img
          src="/network-map.svg"
          width="440"
          height="250"
          alt="Tinklo hierarchija: vienas tinklo įrenginys jungia tris klientus"
        />
        <div className="story-points">
          <span>
            <Icon name="pin" />
            Struktūruotos vietos
          </span>
          <span>
            <Icon name="shield" />
            Valdoma prieiga
          </span>
        </div>
      </section>
      <section className="auth-card">
        <span className="auth-icon">
          <Icon name={register ? "users" : "lock"} size={24} />
        </span>
        <h2>{register ? "Registracija" : "Prisijungimas"}</h2>
        <p>
          {register
            ? "Užpildykite registracijos formą."
            : "Įveskite savo paskyros duomenis."}
        </p>
        <form onSubmit={submit}>
          <ErrorBox error={error} />
          <fieldset disabled={busy}>
            <label>
              El. paštas
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="vardas@organizacija.lt"
              />
            </label>
            <label>
              Slaptažodis
              <input
                name="password"
                type={visible ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 10 : 1}
                maxLength={128}
                placeholder={register ? "Bent 10 simbolių" : "Jūsų slaptažodis"}
              />
            </label>
            {register && (
              <label>
                Pakartokite slaptažodį
                <input
                  name="confirm"
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={128}
                />
              </label>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={visible}
                onChange={(event) => setVisible(event.target.checked)}
              />
              Rodyti slaptažodį
            </label>
            <button className="button primary auth-submit" disabled={busy}>
              {busy
                ? "Palaukite…"
                : register
                  ? "Sukurti paskyrą"
                  : "Prisijungti"}
              <Icon name="arrow" />
            </button>
          </fieldset>
        </form>
        <div className="auth-switch">
          {register ? "Jau turite paskyrą?" : "Dar neturite paskyros?"}{" "}
          <a href={register ? "/login" : "/register"}>
            {register ? "Prisijungti" : "Registruotis"}
          </a>
        </div>
        <div className="auth-security">
          <Icon name="shield" size={15} />
          Duomenys prieinami pagal naudotojo teises.
        </div>
      </section>
    </div>
  );
}
