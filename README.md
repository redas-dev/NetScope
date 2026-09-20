# NetScope API

Ubuntu / Debian server deployment with host Nginx, Certbot HTTPS and automatic updates after a GitHub push: **[deployment guide](docs/deployment.md)**. Use `compose.production.yaml` for the API and PostgreSQL, and `scripts/setup-nginx.sh` to configure the host proxy; the default `compose.yaml` is for local demonstrations.

Tinklo infrastruktūros registravimo API pagal `IFF-3-2_Domkus_Redas.docx` ir 1–2 laboratorinių darbų reikalavimus. Realizuota vietų, tinklo įrenginių ir klientų hierarchija, 15 CRUD metodų, filtravimas, JWT autentifikacija, savininko teisių tikrinimas ir administratoriaus funkcijos.

Naudojama **ASP.NET Core 10 / C#**, **Entity Framework Core 10**, **PostgreSQL 17**. Šiame etape realizuota tik API. Ankstesnis `netscope.client` ruošinys paliktas kataloge, tačiau nepriklauso sprendimo paleidimui ar kompiliavimui.

## Paleidimas Windows be Docker

Reikia .NET 10 SDK, PowerShell ir Node.js 20+ demonstracijai. Pirmasis paleidimas atsisiunčia PostgreSQL vykdomuosius failus iš [EnterpriseDB](https://www.enterprisedb.com/download-postgresql-binaries), todėl reikia interneto. Duomenų bazė ir jos vykdomieji failai lieka projekto `.local/` kataloge; Windows tarnyba nekuriama.

Projekto šakniniame kataloge:

```powershell
.\scripts\start-local.ps1
```

Scenarijus sugeneruoja vietinį JWT raktą, paruošia PostgreSQL adresu `127.0.0.1:5434`, sukuria `netscope` bazę ir paleidžia API. Paleidimo metu pritaikomos EF migracijos; tuščia demonstracinė bazė užpildoma pradiniais duomenimis.

- API: http://localhost:5220
- Būklė: http://localhost:5220/health
- OpenAPI: http://localhost:5220/openapi/v1.json

API sustabdoma `Ctrl+C`. PostgreSQL sustabdymas, išsaugant duomenis:

```powershell
.\scripts\stop-postgres.ps1
```

Visual Studio: atidaryti `NetScope.slnx`, vieną kartą vykdyti `scripts/setup.ps1` ir `scripts/start-postgres.ps1`, tada paleisti `NetScope.Server` profilį `http`. Profilis `https` naudoja `https://localhost:7233` ir vietinį .NET kūrimo sertifikatą.

## Paleidimas su Docker Compose

Reikia veikiančio Docker Desktop su Linux konteineriais:

```powershell
.\scripts\setup.ps1
docker compose up --build -d
docker compose logs -f api
```

Naudojami tie patys API ir PostgreSQL prievadai, todėl vietinį variantą prieš tai reikia sustabdyti. Compose laukia, kol PostgreSQL taps pasiekiamas. Duomenys saugomi `postgres-data` tome.

```powershell
docker compose down
```

Ši komanda sustabdo konteinerius ir išsaugo duomenų tomą. Nenaudokite `-v`, jei norite išlaikyti įrašus.

## Demonstracija iki 15 sekundžių

Pirma paleisti API ir sulaukti, kol `/health` grąžins 200. Antrame terminale:

```powershell
node scripts/demo.mjs
```

Papildomų npm paketų šiam scenarijui nereikia. Jis vykdo 71 HTTP patikrą, įskaitant visus 15 CRUD metodų, ir patikrina OpenAPI. Kiekviena sėkminga eilutė pažymima `PASS`; klaidos atveju procesas baigiasi nenuliniu kodu. Trukmė matuojama scenarijaus pabaigoje; serverio, DB ir priklausomybių paleidimas į ją neįskaičiuojamas.

Scenarijus sukuria dvi laikinas paskyras bei jų resursus ir pabaigoje juos pašalina. Pradiniai demonstraciniai duomenys nekeičiami. Tikrinami JSON atsakymai, `Location` antraštės, 201 kūrimas, 204 šalinimas be turinio, 400 validacija, 401 autentifikacija, 403 teisės, 404 nerasti resursai, 409 konfliktai, savininkystė, JWT rolė ir atsijungus atšauktas žetonas.

Kitas serveris arba administratorius:

```powershell
$env:BASE_URL = 'http://localhost:5220'
$env:ADMIN_EMAIL = 'admin@netscope.local'
$env:ADMIN_PASSWORD = 'NetScopeDemo!2026'
node scripts/demo.mjs
```

### Postman

Importuoti [NetScope.postman_collection.json](docs/NetScope.postman_collection.json). Pasirinkti **Run collection**, vieną iteraciją ir **Delay = 0 ms**. Vykdyti visą kolekciją nurodyta tvarka: žetonai ir resursų ID perduodami automatiškai. Kolekcijos kintamieji: `baseUrl`, `adminEmail`, `adminPassword`.

Kolekcija taip pat patikrinta su Newman 6.2.2: 71 užklausa ir 211 patvirtinimų, be klaidų, per 6,5 s. Newman nėra projekto priklausomybė; terminalo demonstracijai pakanka `node scripts/demo.mjs`.

Abiejų demonstracijų užklausos aprašytos `scripts/scenarios.mjs`. Pakeitus scenarijus, kolekciją atnaujinti komanda `node scripts/generate-postman.mjs`.

## Demonstraciniai duomenys

Pirmą kartą paleidžiant tuščią bazę Development aplinkoje sukuriamos paskyros:

| El. paštas | Rolė | Slaptažodis |
| --- | --- | --- |
| `admin@netscope.local` | Admin | `NetScopeDemo!2026` |
| `redas@netscope.local` | User | `NetScopeDemo!2026` |
| `ieva@netscope.local` | User | `NetScopeDemo!2026` |

Redui priklauso KTU tinklų laboratorija su maršrutizatoriumi, komutatoriumi ir 3 klientais. Ievai priklauso bibliotekos skaitykla su prieigos tašku ir planšete. Iš viso: 3 naudotojai, 2 vietos, 3 įrenginiai, 4 klientai. Įrenginių būsena yra registruojama rankiniu būdu; aktyvus tinklo skenavimas šiame etape nenumatytas.

## API metodai

Visiems žemiau esantiems metodams reikia `Authorization: Bearer <accessToken>`. Kelio identifikatoriai yra UUID. Pilnos užklausų ir atsakymų schemos pateiktos [OpenAPI specifikacijoje](docs/openapi.json).

| Nr. | Metodas | Kelias | Sėkmės kodas |
| --- | --- | --- | --- |
| 1 | GET | `/api/locations` | 200 |
| 2 | GET | `/api/locations/{locationId}` | 200 |
| 3 | POST | `/api/locations` | 201 |
| 4 | PUT | `/api/locations/{locationId}` | 200 |
| 5 | DELETE | `/api/locations/{locationId}` | 204 |
| 6 | GET | `/api/locations/{locationId}/devices` | 200 |
| 7 | GET | `/api/locations/{locationId}/devices/{deviceId}` | 200 |
| 8 | POST | `/api/locations/{locationId}/devices` | 201 |
| 9 | PUT | `/api/locations/{locationId}/devices/{deviceId}` | 200 |
| 10 | DELETE | `/api/locations/{locationId}/devices/{deviceId}` | 204 |
| 11 | GET | `/api/locations/{locationId}/devices/{deviceId}/clients` | 200 |
| 12 | GET | `/api/locations/{locationId}/devices/{deviceId}/clients/{clientId}` | 200 |
| 13 | POST | `/api/locations/{locationId}/devices/{deviceId}/clients` | 201 |
| 14 | PUT | `/api/locations/{locationId}/devices/{deviceId}/clients/{clientId}` | 200 |
| 15 | DELETE | `/api/locations/{locationId}/devices/{deviceId}/clients/{clientId}` | 204 |

Papildomi metodai:

| Metodas | Kelias | Paskirtis | Kodas |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Registracija, suteikiama User rolė ir JWT | 201 |
| POST | `/api/auth/login` | Prisijungimas, JWT | 200 |
| GET | `/api/auth/me` | Dabartinė paskyra | 200 |
| POST | `/api/auth/logout` | Dabartinio JWT atšaukimas | 204 |
| GET | `/api/users` | Administratoriaus naudotojų sąrašas | 200 |
| DELETE | `/api/users/{userId}` | Administratoriaus atliekamas naudotojo šalinimas | 204 |
| GET | `/health` | API ir DB pasiekiamumas | 200 / 503 |

### Prieigos taisyklės

| Veiksmas | Neprisijungęs | User | Admin |
| --- | --- | --- | --- |
| Registracija ir prisijungimas | Taip | Taip | Taip |
| Vietų ir įrenginių peržiūra | Ne | Visų | Visų |
| Vietos kūrimas | Ne | Sau | Sau |
| Vietos ir įrenginių keitimas / šalinimas | Ne | Savo vietose | Visose |
| Klientų peržiūra / kūrimas / keitimas / šalinimas | Ne | Savo vietose | Visose |
| Naudotojų sąrašas ir šalinimas | Ne | Ne | Taip |

Savininkas nustatomas iš patikrinto JWT. Užklausoje jo nurodyti ar keisti negalima. Naujas naudotojas negali pasirinkti Admin rolės. Negalima pasiekti įrenginio per svetimos vietos ID ar kliento per kito įrenginio ID. Administratorius negali pašalinti savo paskyros (409).

Klientų POST ir PUT įgyvendinti pagal bendrą dokumento CRUD tikslą ir 15 metodų reikalavimą; detalus dokumento naudotojo veiksmų sąrašas juos palieka neišskleistus. Jiems taikoma ta pati vietos savininko / administratoriaus taisyklė.

### Užklausų pavyzdžiai

Prisijungimas ar registracija:

```json
{"email":"redas@netscope.local","password":"NetScopeDemo!2026"}
```

Vietos POST / PUT:

```json
{"name":"301 laboratorija","address":"Studentų g. 50, Kaunas","description":"Mokomasis tinklas"}
```

Įrenginio POST / PUT:

```json
{"name":"Pagrindinis maršrutizatorius","type":"Router","ipAddress":"192.168.10.1","macAddress":"02:00:00:10:00:01","status":"Online"}
```

Kliento POST / PUT:

```json
{"name":"Darbo vieta 01","type":"Computer","ipAddress":"192.168.10.10","macAddress":"02:00:00:10:01:01"}
```

Įrenginių tipai: `Router`, `Switch`, `AccessPoint`, `Firewall`, `Other`. Būsenos: `Online`, `Offline`, `Maintenance`. Klientų tipai: `Computer`, `Phone`, `Tablet`, `Printer`, `Other`.

MAC adresai normalizuojami į didžiąsias raides; įrenginio MAC unikalus vietoje, kliento MAC unikalus įrenginyje. IP gali būti IPv4 arba IPv6. PUT pakeičia visus redaguojamus laukus; ID, savininkystė ir hierarchija nekeičiami.

### Filtravimas ir puslapiavimas

Visi sąrašai priima `search`, `page` (nuo 1) ir `pageSize` (1–100, numatyta 20). Atsakymo forma:

```json
{"items":[],"total":0,"page":1,"pageSize":20}
```

Vietas papildomai galima filtruoti `ownerId`, įrenginius – `type` ir `status`, klientus – `type`. Pavyzdys: `/api/locations/{locationId}/devices?type=Router&status=Online&search=laboratorija&page=1&pageSize=10`. Naudotojų paieška vykdoma pagal el. paštą.

### Klaidos ir žetonai

Klaidos grąžinamos JSON `ProblemDetails` formatu. Trūkstami laukai, netaisyklingas JSON, netinkami IP / MAC / enum, nežinomi payload laukai ir netinkami filtrai grąžina **400**. Ši API validacijai nenaudoja 422. Neprisijungus, pasibaigus JWT galiojimui ar jį atšaukus – **401**; neturint teisių – **403**; neradus resurso – **404**; unikalumo ar konkurentinio keitimo konfliktas – **409**.

JWT galioja 30 minučių ir turi `sub`, `email`, `role`, `jti`, `nbf`, `exp`. Tikrinamas HS256 parašas, išdavėjas, auditorija ir galiojimas. Atsijungimas įrašo JWT `jti` į PostgreSQL atšauktų žetonų lentelę. Kiekviena autentifikuota užklausa taip pat patikrina, ar naudotojas dar egzistuoja ir jo rolė sutampa; pašalinus paskyrą jos žetonai nebeveikia. Slaptažodžiai saugomi naudojant ASP.NET Core `PasswordHasher` (PBKDF2), o ne kaip tekstas.

## Duomenys ir konfigūracija

Ryšiai: `User 1:N Location 1:N NetworkDevice 1:N NetworkClient`. Šalinimas kaskadinis: pašalinus vietą pašalinami jos įrenginiai ir klientai; pašalinus naudotoją pašalinamos jo vietos. Schema versijuojama `NetScope.Server/Migrations/`.

```powershell
dotnet tool restore
dotnet ef migrations add PakeitimoPavadinimas --project NetScope.Server
dotnet ef database update --project NetScope.Server
```

EF įrankiams naudokite Development aplinką (`$env:ASPNETCORE_ENVIRONMENT = 'Development'`) arba pateikite DB prisijungimą per `ConnectionStrings__DefaultConnection`. Migracijos jau įtrauktos; įprastam paleidimui jų kurti nereikia.

`scripts/setup.ps1` sugeneruoja atsitiktinį 48 baitų raktą ir išsaugo `.env` bei `NetScope.Server/appsettings.Local.json`. Abu failai ignoruojami Git, o vietinis konfigūracijos failas nepublikuojamas. Aplinkos kintamieji turi pirmenybę prieš JSON.

| Aplinkos kintamasis | Paskirtis |
| --- | --- |
| `ConnectionStrings__DefaultConnection` | PostgreSQL prisijungimas |
| `Jwt__Key` | Bent 32 baitų JWT pasirašymo paslaptis |
| `Jwt__Issuer` / `Jwt__Audience` | Numatyta `NetScope` / `NetScope.Api` |
| `Database__AutoMigrate` | Automatiškai pritaikyti migracijas |
| `Seed__DemoData` | Pradiniai duomenys; veikia tik Development aplinkoje |

Compose ir vietiniai paleidimo scenarijai skirti laboratorinio demonstracijai. Kitai aplinkai naudoti atskirus DB prisijungimo duomenis, JWT raktą ir HTTPS; demonstracinių paskyrų kūrimas Production aplinkoje išjungtas. `POSTGRES_PASSWORD` Compose `.env` faile leidžia pakeisti DB slaptažodį kuriant naują DB tomą.

## Patikra ir Git

2026-09-20 vietinėje Windows aplinkoje patikrinta: Release kompiliavimas be įspėjimų ir klaidų; 71/71 HTTP scenarijus su PostgreSQL 17.11 per 1,62 s; 211/211 Postman patvirtinimų per 6,5 s; PostgreSQL sustabdymas ir pakartotinis paleidimas išsaugant duomenis. Docker Compose šiame kompiuteryje nebuvo paleistas iki veikiančio konteinerio, nes Docker Desktop užlūžta inicijuodamas savo tarnybas; veikimo patikrai naudotas dokumentuotas vietinis PostgreSQL variantas.

```powershell
dotnet build NetScope.slnx --configuration Release
node scripts/demo.mjs
.\scripts\export-openapi.ps1
```

GitHub Actions konfigūracija `.github/workflows/api.yml` kompiliuoja API ir tikrina ją su tikra PostgreSQL tarnyba. OpenAPI failas gaunamas iš veikiančios API, todėl po metodų pakeitimo jį reikia atnaujinti eksportavimo scenarijumi.

Git saugykla susieta su `git@github.com:redas-dev/NetScope.git`. Norint išsaugoti pakeitimus ir juos įkelti:

```powershell
git add .
git commit -m "Update NetScope API"
git push -u origin main
```

Slaptažodžių failai, DB, atsarginės kopijos, priklausomybės ir kompiliavimo rezultatai neįtraukiami į Git.

Techninės nuorodos: [Npgsql EF Core 10](https://www.npgsql.org/efcore/release-notes/10.0.html), [ASP.NET Core JWT autentifikacija](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0).
