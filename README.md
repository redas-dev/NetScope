# NetScope

## 1. Sprendžiamo uždavinio aprašymas

### 1.1. Sistemos paskirtis

NetScope skirta tinklo infrastruktūrai registruoti, tvarkyti ir stebėti vienoje vietoje. Duomenys sudaro hierarchiją: **vieta → tinklo įrenginys →  klientas**. Vieta gali būti pastatas, patalpa ar kita fizinė arba loginė tinklo sritis; įrenginys – maršrutizatorius, komutatorius, prieigos taškas ir pan.; klientas – kompiuteris, telefonas, planšetė ar kitas įrenginys. Sistema leidžia šiuos objektus peržiūrėti, filtruoti, kurti, redaguoti ir šalinti pagal naudotojo teises.

### 1.2. Funkciniai reikalavimai

| Rolė | Funkcijos |
| --- | --- |
| **Svečias** | Užsiregistruoja ir prisijungia. |
| **Naudotojas** | Atsijungia; peržiūri ir filtruoja vietas bei vietų įrenginius; atidaro jų detales; kuria vietas; redaguoja ir šalina savo vietas bei jų įrenginius; savo vietose peržiūri ir šalina prie įrenginių prijungtus klientus. |
| **Administratorius** | Valdo vietas, įrenginius ir klientus nepriklausomai nuo vietos savininko; peržiūri ir šalina naudotojus. |

## 2. Sistemos architektūra

<img src="https://github.com/redas-dev/NetScope/blob/main/docs/images/deployment-diagram.jpg" />

## 3. Naudotojo sąsaja

### 3.1.	Prisijungimo langas
Įgyvendinimas:
 <img width="1041" height="521" alt="image" src="https://github.com/user-attachments/assets/c639f572-bb21-4e1b-82cc-51ee0fa15301" />
Wireframe:
 <img width="1041" height="487" alt="image" src="https://github.com/user-attachments/assets/b0107847-e516-4691-b954-2e5602e0a77d" />

### 3.2.	Pagrindinis langas
Įgyvendinimas:
 <img width="1041" height="521" alt="image" src="https://github.com/user-attachments/assets/0d82415a-0143-4d81-833b-478e244c8cbd" />
Wireframe:
 <img width="1041" height="489" alt="image" src="https://github.com/user-attachments/assets/23161b50-9f6d-4cc1-bfd2-18b8733c02d5" />
 
#### 3.3.	Vietų langas
Įgyvendinimas:
 <img width="1041" height="514" alt="image" src="https://github.com/user-attachments/assets/806fb1f1-fc40-420f-a2e7-099af69fa87f" />
Wireframe:
 <img width="1041" height="489" alt="image" src="https://github.com/user-attachments/assets/7363afb5-725c-4465-a124-6b7f5d12dacd" />
 
### 3.4.	Vietos informacijos langas
 <img width="1041" height="514" alt="image" src="https://github.com/user-attachments/assets/63b35b7e-6e13-40e1-aee0-03b860367e4a" />
 
### 3.5.	Įrenginio informacijos langas
 <img width="1041" height="533" alt="image" src="https://github.com/user-attachments/assets/2f4c3732-71e5-40f6-b800-3cacec0e0850" />

### 3.6.	Naujo įrenginio pridėjimo modalas
 <img width="1041" height="653" alt="image" src="https://github.com/user-attachments/assets/373a1d7e-11b5-49db-b257-ba040b60a187" />

### 3.7.	Šalinimo patvirtinimo modalas
 <img width="1041" height="508" alt="image" src="https://github.com/user-attachments/assets/1ee17faf-eb49-44e6-bdfb-e23e224c106f" />

### 3.8.	Pagalbos modalas
 <img width="1041" height="522" alt="image" src="https://github.com/user-attachments/assets/745f6b46-e3ff-4355-b19d-cef67b48f2d4" />

### 3.9.	Kliento informacijos
 <img width="1041" height="636" alt="image" src="https://github.com/user-attachments/assets/e879e22b-fa0b-41c1-9b25-ab6e868f4d46" />

### 3.10.	Naudotojų sąrašo langas
 <img width="1041" height="538" alt="image" src="https://github.com/user-attachments/assets/69643357-eadf-45db-9697-22d63d330526" />

## 4. API specifikacija

Pilnos užklausų ir atsakymų schemos su kiekvieno metodo pavyzdžiais pateiktos [OpenAPI specifikacijoje](api-spec.yaml).

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
| POST | `/api/auth/refresh` | Refresh žetono rotacija ir naujas JWT | 200 |
| POST | `/api/auth/logout` | JWT ir refresh žetono atšaukimas | 204 |
| GET | `/api/overview` | Vietų ir įrenginių sudėtinė suvestinė | 200 |
| GET | `/api/users` | Administratoriaus naudotojų sąrašas | 200 |
| DELETE | `/api/users/{userId}` | Administratoriaus atliekamas naudotojo šalinimas | 204 |
| GET | `/health` | API ir DB pasiekiamumas | 200 / 503 |

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

MAC adresai normalizuojami į didžiąsias raides; įrenginio MAC unikalus vietoje, kliento MAC unikalus įrenginyje. IP gali būti IPv4 arba IPv6.

### Filtravimas ir puslapiavimas

Visi sąrašai priima `search`, `page` (nuo 1) ir `pageSize` (1–100, numatyta 20). Atsakymo forma:

```json
{"items":[],"total":0,"page":1,"pageSize":20,"links":{"self":{"href":"/api/locations?page=1&pageSize=20","method":"GET"}}}
```

Vietas papildomai galima filtruoti `ownerId`, įrenginius – `type` ir `status`, klientus – `type`. Pavyzdys: `/api/locations/{locationId}/devices?type=Router&status=Online&search=laboratorija&page=1&pageSize=10`. Naudotojų paieška vykdoma pagal el. paštą.

## 5. Projekto išvados

1.	Sukurta tinklo infrastruktūros valdymo sistema „NetScope“, kurioje vietos, tinklo įrenginiai ir prie jų prijungti klientai susieti hierarchiniu duomenų modeliu, kad būtų aiški infrastruktūros struktūra. Tai leidžia vienoje sistemoje tvarkyti objektus ir nustatyti jų tarpusavio ryšius.
2.	Panaudojant REST API vietoms, įrenginiams ir klientams sukurtos peržiūros, kūrimo, redagavimo bei šalinimo operacijos. Taip užtikrintas nuoseklus duomenų valdymas ir sudaryta galimybė sistemos funkcijas naudoti skirtingose programose.
3.	Sukurta „React“ naudotojo sąsaja, susieta su „ASP.NET Core“ serveriu, leidžia naudotojui atlikti pagrindinius veiksmus ir peržiūrėti įrašytas įrenginių būsenas.
4.	Įgyvendinta JWT autentifikacija ir prieigos kontrolė pagal roles bei objektų nuosavybę. Naudotojai gali keisti savo vietų duomenis ir susijusius objektus, o administratorius turi galimybę valdyti viską.
5.	Duomenims saugoti panaudota „PostgreSQL“ duomenų bazė. Objektų ryšiai, MAC adresų unikalumo apribojimai ir įvesties tikrinimas padeda išvengti netinkamų bei pasikartojančių įrašų.
6.	Įgyvendinta paieška, filtravimas ir sąrašų puslapiavimas. Šios funkcijos leidžia atrinkti aktualius objektus ir riboti vienu metu grąžinamų įrašų kiekį.


## Demonstraciniai duomenys

| El. paštas | Rolė | Slaptažodis |
| --- | --- | --- |
| `redas@netscope.dev` | Admin | `Netscope123` |
| `asmuo@gmail.com` | User | `Netscope123` |
| `asmuo2@gmail.com` | User | `Netscope123` |
