import { useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { statuses } from "../api";

export function Brand() {
  return (
    <a className="brand" href="/" aria-label="NetScope pradžia">
      <span className="brand-mark">
        <Icon name="network" size={24} />
      </span>
      Net<span>Scope</span>
      <span className="brand-dot">.</span>
    </a>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      <i />
      {statuses[status] || status}
    </span>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      <span>Kraunami duomenys…</span>
    </div>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error?: Error | string;
  retry?: () => void;
}) {
  return error ? (
    <div className="error-box" role="alert">
      <Icon name="info" />
      <div>{typeof error === "string" ? error : error.message}</div>
      {retry && (
        <button className="text-button" onClick={retry}>
          Bandyti dar kartą
        </button>
      )}
    </div>
  ) : null;
}
export function Empty({
  title,
  text,
  action,
  icon = "search",
}: {
  title: string;
  text: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={30} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}
export function Pagination({
  total,
  page,
  pageSize,
  change,
}: {
  total: number;
  page: number;
  pageSize: number;
  change: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} iš ${total} įrašų`
          : "0 įrašų"}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Ankstesnis puslapis"
          disabled={page <= 1}
          onClick={() => change(page - 1)}
        >
          <Icon name="chevron" style={{ transform: "rotate(180deg)" }} />
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          className="icon-button"
          aria-label="Kitas puslapis"
          disabled={page >= pages}
          onClick={() => change(page + 1)}
        >
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const element = ref.current!;
    const active = document.activeElement as HTMLElement | null;
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previous;
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) {
          const rect = ref.current!.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Uždaryti langą"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
