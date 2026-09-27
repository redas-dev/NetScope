# NetScope UI

React + TypeScript + Vite sąsaja NetScope REST API.

Paleiskite backend pagal [projekto README](../README.md), tada šiame kataloge:

```bash
npm ci
npm run dev
```

Atidarykite `http://localhost:5173`. API proxy nukreiptas į `http://localhost:5220`.

- `npm run lint` – ESLint.
- `npm run build` – TypeScript patikra ir produkcinis `dist/`.
- `npm run test:e2e` – Playwright su veikiančia API ir demonstracine DB.
- `public/wireframes.html` – spausdinamas sąsajos projektas.

[UI funkcijos, reikalavimų atitikimas ir testų instrukcija](../docs/frontend.md).
