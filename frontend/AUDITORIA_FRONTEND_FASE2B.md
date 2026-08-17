# Auditoría de Frontend — Fase 2.B

**Rama:** dev · **Commit auditado:** `ac3c0df` — *[Chore] Add backend audit findings for Fase 2.A* (2026-08-17 13:45:31 -0600, `ac3c0dfe6bebf4b96f743d28ab9dd9e0f50a8c20`)
**Fecha:** 2026-08-17
**Alcance:** frontend/ únicamente (src completo + configuración de raíz)

> Diagnóstico puro. No se modificó ningún archivo de código. Metodología
> idéntica a `backend/AUDITORIA_BACKEND_FASE2A.md`.

`git status` limpio al inicio, `git pull origin dev` → *Already up to date*.
Verificaciones mecánicas ejecutadas como contexto: `npx tsc --noEmit -p
tsconfig.app.json` → **limpio (exit 0)**; `npx eslint .` → **10 errores, 13
warnings** (ver §2.7.5); build existente en `dist/` inspeccionado para medir el
peso real de cada chunk.

## Resumen

| | Cantidad |
|---|---:|
| **Categoría 1** — cambios para desarrollador | **34** |
| 1.1 Comentarios y ruido | 6 |
| 1.2 TODOs y marcadores sueltos | 2 |
| 1.3 Código muerto | 6 |
| 1.4 Logging de debug olvidado | 0 |
| 1.5 Nombres e imports inconsistentes | 6 |
| 1.6 Duplicación menor | 6 |
| 1.7 Archivos que no deberían llegar a producción | 8 |
| **Categoría 2** — cambios que afectan el funcionamiento | **35** |
| › Severidad **Alta** | 2 |
| › Severidad **Media** | 22 |
| › Severidad **Baja** | 11 |

Desglose de Categoría 2 por sección:

| Sección | Alta | Media | Baja | Total |
|---|---:|---:|---:|---:|
| 2.1 Hardcodeos peligrosos | 1 | 0 | 2 | 3 |
| 2.2 Manejo de errores incompleto | 0 | 3 | 4 | 7 |
| 2.3 Validaciones inconsistentes entre formularios | 0 | 5 | 2 | 7 |
| 2.4 Controles de escritura sin gate de permisos | 1 | 2 | 0 | 3 |
| 2.5 Estados de carrera en el cliente | 0 | 5 | 1 | 6 |
| 2.6 Configuración de entorno inconsistente | 0 | 1 | 1 | 2 |
| 2.7 Diferencias local vs. producción | 0 | 4 | 1 | 5 |
| 2.8 Dependencias riesgosas | 0 | 2 | 0 | 2 |
| 2.9 Fugas de información hacia roles sin acceso | 0 | 0 | 0 | 0 |

---

## Categoría 1 — Cambios para desarrollador (no afectan funcionamiento)

### 1.1 Comentarios y ruido

**1.1.1 — `frontend/src/context/ToastContext.tsx:48-53`**
El docblock de `systemError` afirma *"Nothing calls this yet — the frontend has no real API calls (see TODO at the call sites)"*; hay **59 llamadas a `systemError` en 23 archivos**, y `services/api.config.ts:159` describe ese mismo conjunto como *"all 50+ of them"*.
El comentario describe la fase anterior del proyecto (frontend sobre fixtures) y hoy dice exactamente lo contrario de lo que el código hace, en la función que decide cómo se le habla al usuario ante un fallo.

**1.1.2 — `frontend/src/services/strategyService.ts:6-7`**
`// NOTE: getStrategyEntries used to return StrategyEntry[] synchronously. It is now a real request and therefore async — callers must await it.`
Es una nota de migración dirigida a llamadores que ya no existen: hay un único consumidor (`StrategyPage.tsx:388`) y ya la espera dentro de un `Promise.all`.

**1.1.3 — `frontend/src/pages/tracker/read-only-tabs.tsx:263-265`**
El comentario explica que los helpers de Intelex *"are also used by the editable Intelex tabs in TrackerSupplierDetail.tsx, which imports them back from here rather than duplicating the derivation"* — cierto, pero omite que el flujo inverso también ocurre: `TabCompletedOverview`, `TabROAttendees`, `TabROAgenda` y `TabRONextStep` viven en `TrackerSupplierDetail.tsx` y son importados desde aquí hacia allá (ver §1.5.1).
Presenta como unidireccional una dependencia que es circular a nivel de módulo, que es justo lo que hace que el chunk se colapse (§2.7.2).

**1.1.4 — `frontend/index.html:7`**
`<title>SSD Pipeline — Nexteer Automotive</title>` — el módulo se llama *Tracker* desde hace tiempo; `/pipeline/*` sobrevive solo como redirección legacy (`App.tsx:92-93`).
Es el texto que el usuario ve en la pestaña del navegador y en cualquier marcador que guarde.

**1.1.5 — `frontend/src/hooks/useTableSort.ts:41`**
`// eslint-disable-next-line react-hooks/exhaustive-deps` sin ninguna línea que explique por qué se excluye `getValue` del `useMemo`.
Es la única de las tres supresiones del frontend sin justificación: `TrackerSupplierDetail.tsx:2231-2233` y `TabProspects.tsx:205-207` sí explican la suya, así que quien la lea no puede saber si es deliberada o un descuido. *(Se verificó que hoy es inocua: los tres `getValue` sólo cierran sobre `row`/`field`, y en `Reports.tsx:230-237` el array `rows` cambia de identidad junto con el estado que el closure lee.)*

**1.1.6 — `frontend/src/pages/tracker/MoveStageModal.tsx:99-102`**
*"Confirm stays clickable: a dead button can't tell the user what is missing, so the rule is checked here and reported as a validation toast instead."*
El comentario enuncia una regla de diseño que el modal hermano del mismo flujo (`StageTransitionModal`, `TrackerSupplierDetail.tsx:2963-2966`) contradice con un `disabled={!canConfirm}`. *(Consecuencia funcional en §2.3.4.)*

### 1.2 TODOs y marcadores sueltos

El frontend está **limpio de marcadores**: `grep -rn "TODO\|FIXME\|HACK\|XXX"` sobre
`src/` devuelve una única línea, y es una referencia a TODOs que ya no existen.

**1.2.1 — `frontend/src/context/ToastContext.tsx:51`**
`(see TODO at the call sites)` — no queda ni un solo `TODO` en `src/`.
Manda al lector a buscar marcadores inexistentes; es el residuo del hallazgo §1.1.1.

**1.2.2 — `frontend/src/constants/catalogs-pending-gsm.ts:1-22`**
El archivo entero es un marcador de trabajo pendiente: *"⚠ PLACEHOLDER CATALOGS — NOT CONFIRMED BY GSM"*, con la instrucción *"Once GSM confirms a list, move it to `catalogs.ts` and delete it here"*. No está en `backend/DEBT.md` ni en `SSD_Pendientes_v2_0.md` §3.1.
Son 8 catálogos inventados que alimentan los dos formularios de alta reales (`ExternalRegistrationForm.tsx:10-14`, `InternalRecommendationForm.tsx:6`), y el pendiente sólo consta dentro del propio archivo. *(Cara de producción en §1.7.5.)*

### 1.3 Código muerto

Todo lo de abajo está verificado con `grep` sobre `src/` completo (incluyendo el
propio archivo, para distinguir "muerto" de "exportado de más"), nunca por
nombre.

**1.3.1 — Exportaciones de servicio con cero consumidores (7 funciones)**
`services/eventsService.ts:23` (`deleteEvent`), `:36` (`linkSupplierToEvent`); `services/strategyService.ts:12` (`updateStrategyEntry`), `:31` (`getStrategyOverview`), `:35` (`getCommodityDrilldown`); `services/trackerService.ts:22` (`getTrackerSupplier`), `:49` (`setSupplierSubStatus`). Ninguna aparece fuera de su propia declaración.
Dos de ellas tienen consecuencias que conviene anotar: **`setSupplierSubStatus`** significa que el endpoint de sub-status de Parking Lot — y con él la regla de negocio *"No Go auto-blacklists"* que el backend implementa en `trackerService.setParkingSubStatus` — **no tiene ningún punto de entrada en la UI**; y **`getCommodityDrilldown`** declara devolver `{ row, suppliers }` cuando el backend devuelve `{ ...row, suppliers }` (los campos de la fila esparcidos en la raíz), así que quien la conecte partirá de un tipo que miente.

**1.3.2 — `frontend/src/pages/tracker/MRLList.tsx:360`, `:442-451`, `:612-617`**
El miembro `'confirmDelete'` de `ModalMode`, la función `handleDelete` y la rama que renderiza `<ConfirmDeleteModal>` están muertos: `setModalMode` sólo se llama con `'edit'` (`:420`) y `'none'` (`:422`).
El borrado real vive en `MRLRequirementDetail.tsx:223`, que importa `ConfirmDeleteModal` desde este archivo (`:11`); la maquinaria local quedó huérfana tras esa mudanza.

**1.3.3 — Exportaciones usadas sólo dentro de su propio archivo (12 símbolos)**
`services/suppliersService.ts:55` (`createSupplier`), `hooks/useModalTransition.ts:6` (`prefersReducedMotion`), `utils/parseProspectWorkbook.ts` (`mapProspectRows`), `utils/prospectTemplate.ts` (`TEMPLATE_MARKER`), `utils/tracker-helpers.ts:91,106,118,142,157` (los cinco `*_FIELDS`, consumidos sólo por `STAGE_FIELDS` en `:173-179`), y `pages/tracker/TrackerSupplierDetail.tsx:1820,1834,1851` (`TabROAttendees`, `TabROAgenda`, `TabRONextStep`, renderizados sólo en `:2700-2702`).
No es código muerto —todos se ejecutan— pero el `export` anuncia una API pública que nadie consume y, en el caso de los tres `TabRO*`, oculta que ninguna pantalla read-only los usa (§2.3 nota, §1.5.1).

**1.3.4 — `frontend/src/pages/tracker/ParkingLotPrefillModal.tsx:60`**
`const [isRecommendation] = useState(false);` — estado sin setter, siempre `false`, escrito tal cual en `parkingIsRecommendation` (`:127`).
Un `useState` sin actualizador es una constante disfrazada; aquí además escribe un valor de negocio en cada movimiento *(efecto en §2.3.7)*.

**1.3.5 — `frontend/index.html:5`**
`<link rel="icon" type="image/svg+xml" href="/vite.svg" />` — `public/vite.svg` no existe (el directorio `public/` sólo contiene `assets/`).
Referencia rota al favicon: cada carga de página pide un recurso inexistente y el navegador cae al icono por defecto.

**1.3.6 — `frontend/src/pages/tracker/MoveStageModal.tsx:36-64` (`checklistRequirements`)**
Las 4 listas (28 requisitos de negocio) sólo se leen cuando se abre `MoveStageModal`, y ese modal sólo es alcanzable por la rama `else` de la barra de acciones (`TrackerSupplierDetail.tsx:2599-2602`) — es decir, para un proveedor que no está en ninguna de las 5 etapas activas. Las cinco etapas activas usan sus propios modales, ninguno de los cuales muestra checklist.
El checklist de requisitos, que es la única parte de la UI que enumera las condiciones de avance, en la práctica no se le muestra nunca a un proveedor en curso. *(Consecuencia funcional completa en §2.3.4.)*

### 1.4 Logging de debug olvidado

**Ningún hallazgo.** `grep -rn "console\.(log|error|warn|debug|info|table|trace)" src`
devuelve **cero resultados** en los 81 archivos de `src/`. El frontend no arrastra
ninguna traza de depuración; los errores viajan por `ToastContext` y por
`ApiError`, no por consola.

### 1.5 Nombres e imports inconsistentes

**1.5.1 — Los `TabRO*` viven en dos archivos**
13 en `pages/tracker/read-only-tabs.tsx:54,69,86,104,117,131,165,183,213,241,326,340,390`; 3 más (`TabROAttendees`, `TabROAgenda`, `TabRONextStep`) **y** `TabCompletedOverview` en `pages/tracker/TrackerSupplierDetail.tsx:1755,1820,1834,1851`.
`frontend/README.md:360-382` afirma que los `TabRO*` *"live in read-only-tabs.tsx, not in TrackerSupplierDetail.tsx"* y que hay *"exactly one implementation of each stage's read-only card"*: la afirmación es falsa para 4 de los 17 componentes, y esa dispersión es la causa directa de §2.7.2.

**1.5.2 — Idioma mezclado en la UI**
`pages/Login.tsx:27` devuelve `'Correo o contraseña incorrectos.'` en español; `pages/HomeGuestView.tsx:19` define `MONTHS_SHORT = ['ENE','FEB',…,'DIC']` en español mientras `utils/date-helpers.ts:8` define el mismo array en inglés (`['Jan','Feb',…,'Dec']`); `index.html:2` declara `lang="es"`. Todo el resto de la interfaz está en inglés.
El único texto que ve un usuario que no logra entrar está en un idioma distinto al del resto de la aplicación, y las dos tablas de meses discrepan entre la Home de Guest y la de todos los demás roles.

**1.5.3 — `frontend/package.json:2-4`**
`"name": "vite-react-typescript-starter"`, `"version": "0.0.0"`.
Sobrevive el nombre del andamiaje de Vite; el `package.json` de la raíz sí se llama `ssd-tracker-management` y versiona `1.0.0`, así que el workspace se identifica a sí mismo con dos nombres distintos.

**1.5.4 — `frontend/src/pages/suppliers/SuppliersList.tsx:249`**
Las props de `ListView` se tipan `sorted: any[]; paginated: any[]` cuando el tipo correcto, `ListedSupplier`, está declarado 223 líneas antes en el mismo archivo (`:26`).
Tirar el tipo obliga a seis `as any` río abajo (`:295`, `:299`, `:311`) y produce 6 de los 10 errores de `npm run lint` (§2.7.5). *(Verificado que `isCompleted` sí existe en runtime — se etiqueta en `:44` — así que es pérdida de tipado, no un bug.)*

**1.5.5 — `frontend/src/pages/tracker/TrackerSupplierDetail.tsx:2982-2996`**
`PrelimToSupplierEvalModal` pasa `blacklistLabel="Send to Blacklisted"` junto con `advanceOnly`, y en ese modo `StageTransitionModal` (`:2919-2941`) nunca renderiza la opción de blacklist.
Prop obligatoria que el modo elegido ignora: sugiere una capacidad que ese modal no ofrece.

**1.5.6 — `frontend/src/pages/tracker/MoveStageModal.tsx:14` vs `MRLList.tsx:11` vs `EventDetail.tsx:147`**
Tres convenciones para consultar permisos conviven: `usePermissions().canWrite` (`MRLList`, `SuppliersList`, `EventsList`, `StrategyPage`, `TrackerSupplierDetail`, `TabProspects`), `usePermissions().role === 'SSD'` (`EventDetail:260`) y ninguna comprobación (`MRLRequirementDetail`).
El hook existe precisamente para ser el punto único (`hooks/usePermissions.ts:12-14`), y ya tiene dos formas de invocarse más una tercera pantalla que lo ignora. *(Consecuencia en §2.4.)*

### 1.6 Duplicación menor

**1.6.1 — El predicado de búsqueda, reimplementado en 7 páginas**
`pages/events/EventsList.tsx:314-320`, `pages/suppliers/SuppliersList.tsx:92-100`, `pages/tracker/MRLList.tsx:397-403`, `pages/tracker/TrackerBlacklisted.tsx:49-52`, `pages/tracker/TrackerCompleted.tsx:50-53`, `pages/tracker/TrackerStage.tsx:65-72` y `pages/UserManagement.tsx:270-275` — el mismo `const q = search.toLowerCase()` seguido de una cadena de `.includes(q)` sobre distintos campos.
`components/SearchBar.tsx` centraliza sólo el input y `hooks/useTableSort.ts` sólo el orden; el filtrado en sí se copió siete veces con variaciones menores.

**1.6.2 — La expresión regular de email, en 4 sitios**
`pages/tracker/supplier-forms/payload.ts:67` (`isValidEmail`), `pages/UserManagement.tsx:44` (`EMAIL_RE`), `pages/events/EventFormModal.tsx:124` (en línea) y `pages/tracker/TrackerSupplierDetail.tsx:1061` (en línea) — `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` idéntica en las cuatro.
Dos son helpers con nombre y dos están incrustadas en un `if`, así que la mitad de los formularios no puede reutilizar la regla aunque quiera. *(Ver §2.3.3 para el sitio donde falta del todo.)*

**1.6.3 — Las claves de `localStorage`, definidas dos veces**
`services/api.config.ts:13-15` y `context/AuthContext.tsx:23-25` declaran cada uno `TOKEN_KEY`/`REFRESH_KEY`/`USER_KEY` con los mismos tres literales.
Los dos módulos escriben y borran las mismas entradas (`api.config.ts:95-101` y `AuthContext.tsx:50-58`); si una copia cambia, la sesión queda medio limpiada.

**1.6.4 — El mismo flujo "mover + parchear", una vez con nombre y otra en línea**
`pages/tracker/TrackerSupplierDetail.tsx:2296-2312` (`handleParkingPrefillConfirm`) y `:2789-2801` (el `onConfirm` en línea de `PreliminaryPrefillModal`) ejecutan la misma secuencia de cinco pasos —cerrar modal, `moveSupplierToStage`, `saveSupplier`, `applyFresh`, `toast.success` + `navigate`— con el mismo `catch`.
Uno se puede leer y probar por su nombre, el otro está enterrado en el JSX; ambos comparten el defecto de §2.5.1.

**1.6.5 — Los primitivos de formulario de los dos modales de prefill**
`pages/tracker/ParkingLotPrefillModal.tsx:23-39` y `pages/tracker/PreliminaryPrefillModal.tsx:23-39` — `inputStyle`, `groupLabelStyle` y el componente `FieldLabel` copiados carácter por carácter.

**1.6.6 — `SubTabBar`, `InfoRow` y `CardTitle` por pantalla**
`SubTabBar` en `pages/tracker/BlacklistedSupplierDetail.tsx:62` y `pages/tracker/CompletedSupplierDetail.tsx:37` (idénticos salvo que uno acepta `accentColor`); `InfoRow` en `pages/tracker/BlacklistedSupplierDetail.tsx:27` y `pages/tracker/TrackerSupplierDetail.tsx:163`.
Las tres pantallas de detalle ya comparten `DisplayCard`/`DisplayField` desde `read-only-tabs.tsx`, pero estos tres primitivos se quedaron fuera del módulo común.

### 1.7 Archivos/carpetas que no deberían llegar a producción

**1.7.1 — `frontend/public/assets/images/login-background.jpg` (8.9 MB) — el más importante de esta sección**
- **(a) Por qué existe hoy:** fue el fondo de la pantalla de login en una versión anterior del diseño.
- **(b) Por qué sobra en producción:** **no lo referencia nadie.** `grep -rn "login-background" src index.html` devuelve cero resultados — `Login.tsx:40` usa `AdobeStock_238352480.jpeg`. Vite copia `public/` **entero y verbatim** a `dist/`, referenciado o no, así que esos 8.9 MB viajan al servidor en cada despliegue. Está además versionado en git.
- **(c) Recomendación:** **borrar** del repo y del directorio. No hay ninguna ruta de código que lo pueda pedir.

**1.7.2 — `frontend/public/assets/images/AdobeStock_238352480.jpeg` (2.5 MB)**
- **(a)** Es el fondo real de la pantalla de login (`Login.tsx:40`), a resolución de banco de imágenes.
- **(b)** Es lo primero que descarga **todo** usuario, antes de autenticarse, y sobre él se pinta un tinte rojo al 80 % de opacidad (`Login.tsx:52-59`) que oculta casi todo el detalle que justifica ese peso.
- **(c)** **No borrar** — la pantalla lo usa. Optimizar/reescalar antes del despliegue; hoy 11.4 MB de los 11.5 MB de `public/` son estas dos imágenes.

**1.7.3 — `frontend/index.html:12-14`**
- **(a)** `<meta property="og:image" content="https://bolt.new/static/og_default.png">` y su equivalente `twitter:image`, heredados del andamiaje con el que se generó el proyecto.
- **(b)** Cualquier enlace a la aplicación compartido en Teams/Slack/correo renderiza la imagen por defecto de **bolt.new**, un servicio de terceros, como vista previa de una herramienta interna de Nexteer; y la página declara una dependencia de un dominio externo.
- **(c)** **Borrar** las tres líneas o sustituirlas por un recurso propio.

**1.7.4 — `frontend/index.html:5` → `/vite.svg`**
- **(a)** Favicon por defecto del andamiaje de Vite.
- **(b)** El archivo no existe en `public/`, así que en producción es un 404 por carga de página; y aunque existiera, sería el logo de Vite en la pestaña de una aplicación de Nexteer, teniendo ya `app-icon.png` en `public/assets/images/`.
- **(c)** **Borrar** o repuntar al icono de la aplicación. *(También listado como referencia rota en §1.3.5.)*

**1.7.5 — `frontend/src/constants/catalogs-pending-gsm.ts` (131 líneas)**
- **(a)** 8 catálogos inventados para las preguntas marcadas "Falta" en `Propuesta_Formularios_Proveedores_v2.pdf`, escritos *"only so the supplier forms can be built and demoed end to end"* (`:1-6`).
- **(b)** En producción dejan de ser andamiaje de demo: alimentan los desplegables de los dos formularios de alta reales (`ExternalRegistrationForm.tsx:10-14` → certificaciones, materiales, procesos, operaciones complementarias, índices de materia prima, tecnologías, aplicaciones, monedas; `InternalRecommendationForm.tsx:6` → departamentos), así que los proveedores reales quedan clasificados contra vocabularios que GSM nunca aprobó.
- **(c)** **No borrar ni mover** — quitarlo rompe los dos formularios. Es un bloqueante de producto: requiere que GSM confirme las listas antes del despliegue. Lo que sí procede es escalarlo fuera del archivo, porque hoy el pendiente sólo consta en su propia cabecera (§1.2.2).

**1.7.6 — `frontend/src/pages/Settings.tsx` (20 líneas)**
- **(a)** Página de ajustes en el menú de usuario (`Sidebar.tsx:208-215`) y en el router (`App.tsx:79`).
- **(b)** Su contenido completo es *"There are no configurable preferences yet"*. Es alcanzable por **todos** los roles, Guest incluido (está fuera de `<Gate>`), así que el primer ajuste que encuentra un usuario nuevo es una pantalla que anuncia que no hay ajustes.
- **(c)** **Mover** fuera de la navegación hasta que tenga contenido; el archivo puede quedarse.

**1.7.7 — `frontend/dist/` (1.4 MB en `assets/`)**
- **(a)** Build local del 17-ago.
- **(b)** Correctamente ignorado por git (`.gitignore:10`) y no versionado, pero es exactamente lo que se cuela en un `scp -r frontend/`, con la agravante de que sus nombres de chunk llevan hash: desplegar un `dist/` viejo junto a un `index.html` nuevo produce 404 de chunk sin `ErrorBoundary` que lo capture (§2.2.3).
- **(c)** **Borrar** la copia local; regenerar en el servidor.

**1.7.8 — `frontend/package-lock.json` (167 KB, 14-ago) frente a `package-lock.json` de la raíz (150 KB, 17-ago)**
- **(a)** Lockfile anidado, previo a que la raíz declarara `workspaces: ["frontend","backend"]`.
- **(b)** El lock de la raíz ya resuelve el workspace `frontend` (línea 2005) y es tres días más nuevo; según desde qué carpeta se ejecute `npm ci`, el servidor instala un árbol distinto.
- **(c)** **Borrar** el anidado. Es la mitad frontend del hallazgo **`backend/AUDITORIA_BACKEND_FASE2A.md` §2.8.1**, que reportó el mismo patrón en `backend/package-lock.json`; conviene resolver los dos a la vez.

---

## Categoría 2 — Cambios que afectan el funcionamiento

### 2.1 Valores hardcodeados peligrosos

**2.1.1 — `frontend/src/services/api.config.ts:3`**
`export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';` — es el único uso de `import.meta.env` en todo el frontend, y su fallback es un literal.
Vite resuelve `import.meta.env` **en tiempo de build**: si `VITE_API_URL` falta en el build de producción, el bundle sale con `http://localhost:3000/api` incrustado y **cada navegador llama a su propio localhost**. No falla el build, no hay aviso, y el síntoma que ve el usuario es el mensaje de `:125` (*"Could not reach the server…"*) en cada pantalla, apuntando a una dirección que nada tiene que ver con el servidor. Además `??` sólo cubre `null`/`undefined`: un `VITE_API_URL=` vacío produce una URL base vacía y todas las peticiones salen relativas al origen.
**Severidad: Alta**

**2.1.2 — `frontend/src/pages/tracker/supplier-forms/FormShell.tsx:320`**
`contacto.proveedores@nexteer.com` escrito como literal en el componente `IndirectExit`.
Es la única vía de contacto que se le da a un proveedor Indirect rechazado por el filtro; cambiar ese buzón exige un cambio de código y un redespliegue.
**Severidad: Baja**

**2.1.3 — `frontend/src/pages/tracker/MoveStageModal.tsx:36-64`**
`checklistRequirements` incrusta 28 criterios de aceptación de negocio (*"NDA signed by both parties"*, *"Pre-evaluation completed within 60 days"*, *"PM approval obtained"*…) como literales en un componente de UI.
Son reglas que GSM ajusta, no texto de interfaz; y hoy además casi nadie las ve (§1.3.6), así que su desactualización pasaría inadvertida.
**Severidad: Baja**

### 2.2 Manejo de errores incompleto

**2.2.1 — `frontend/src/services/api.config.ts:45-47`**
`isUserFixable` devuelve `true` sólo para 400/409/422; **el 403 queda fuera**. Los 13 sitios que ramifican con ese getter mandan por tanto todo rechazo de permisos a `toast.systemError`: `pages/events/EventFormModal.tsx:161,192`, `pages/events/ProspectImportModal.tsx:69`, `pages/strategy/StrategyPage.tsx:116`, `pages/tracker/MRLList.tsx:434`, `pages/tracker/MRLRequirementDetail.tsx:165`, `pages/tracker/supplier-forms/ExternalRegistrationForm.tsx:360`, `pages/tracker/supplier-forms/InternalRecommendationForm.tsx:183`, `pages/tracker/TrackerSupplierDetail.tsx:572,2244,2266,2280,2292,2312,2799`, `pages/UserManagement.tsx:198`. El único sitio del frontend que trata un 403 explícitamente es `pages/events/TabProspects.tsx:247`.
A un PM/Buyer/SQD que toca cualquier control de escritura no gateado (§2.4) el sistema le responde *"Technical problem — not your data. … Nothing was changed. Please try again in a moment."* (`context/ToastContext.tsx:83-87`): se le dice que el fallo es del sistema, que no es culpa suya, y se le invita a reintentar algo que va a fallar siempre igual.
**Severidad: Media**

**2.2.2 — `frontend/src/pages/Login.tsx:25-30`**
El `catch` es ciego: cualquier fallo de `login()` se reporta como `'Correo o contraseña incorrectos.'`, sin mirar el `status` del `ApiError`.
Cuando el backend está caído o `VITE_API_URL` apunta mal, `api.config.ts:124-127` produce un `ApiError` con `status: 0` y el mensaje *"Could not reach the server…"* — y el usuario lee que su contraseña está mal. El comentario de `:26` justifica no filtrar detalle del servicio LDAP, que es razonable, pero confundir "servidor inalcanzable" con "credenciales incorrectas" manda al usuario (y a soporte) a perseguir el problema equivocado en el único punto de entrada de la aplicación.
**Severidad: Media**

**2.2.3 — `frontend/src/App.tsx:13-32` y `frontend/src/main.tsx` (ausencia de `ErrorBoundary`)**
`grep -rn "ErrorBoundary\|componentDidCatch\|getDerivedStateFromError" src` → cero resultados; y las 20 llamadas `lazy(() => import(...).then(...))` no llevan `.catch`.
Un error de render en cualquier página, o un chunk que no se descarga (caso realista: el usuario tiene la pestaña abierta cuando se redespliega y los nombres con hash cambian), deja **la pantalla en blanco**, sin mensaje, sin toast y sin manera de recuperarse salvo recargar a ciegas.
**Severidad: Media**

**2.2.4 — `frontend/src/App.tsx:73-105`**
No existe ninguna ruta `path="*"` dentro de `AppRoutes`.
Cualquier URL no reconocida —un enlace viejo, un `link` de notificación apuntando a una ruta retirada— renderiza el header, el sidebar y un `<main>` **vacío**: ni 404, ni redirección, ni indicio de qué pasó.
**Severidad: Baja**

**2.2.5 — `frontend/src/pages/tracker/MRLList.tsx:442-451` frente a `:432-437`**
`handleDelete` manda cualquier error directo a `toast.systemError`, mientras `handleSave`, veinte líneas antes en el mismo archivo, sí distingue `isUserFixable` para mostrar el mensaje de negocio.
Dos manejadores hermanos con criterios distintos. Hoy el impacto está contenido porque esta función está muerta (§1.3.2), pero `MRLRequirementDetail.tsx:390-395` reutiliza el mismo `ConfirmDeleteModal` con su propio handler, así que la asimetría es lo que se copiará al conectarlo.
**Severidad: Baja**

**2.2.6 — `frontend/src/components/Sidebar.tsx:227-233`**
El botón "Help" del menú de usuario no tiene `onClick`.
Es un control visible, con puntero de mano y estado hover, que al pulsarse no hace absolutamente nada ni informa de nada.
**Severidad: Baja**

**2.2.7 — `frontend/src/components/GlobalHeader.tsx:97-114`**
Las dos cargas de notificaciones tragan el error con un comentario (`.catch(() => { /* header badge stays empty… */ })`), y `markAllRead` (`:154-157`) y `handleNotificationClick` (`:165-168`) hacen lo mismo tras una escritura optimista.
El usuario no distingue "no tengo notificaciones" de "no se pudieron cargar"; y si el marcado falla, la campana queda en 0 hasta que recargue. *(La cara de carrera está en §2.5.3.)*
**Severidad: Baja**

### 2.3 Validaciones inconsistentes entre formularios

**2.3.1 — `pages/tracker/supplier-forms/InternalRecommendationForm.tsx:75-79` frente a `ExternalRegistrationForm.tsx:160-167`**
El formulario A exige `Country` para avanzar; el formulario B **no exige ni país ni ciudad** (su sección 3 sólo requiere `companyName`, más el formato del DUNS si se escribió), y su DUNS es opcional (`:255`, sin `required`).
Es el formulario cuyo proveedor entra **directamente a Parking Lot** (`:125`, `entrySource: 'Recommendation'`), es decir, a un paso del portón que el backend aplica en `moveSupplierToStage` → `hasExternalFormData`, que exige DUNS + país de manufactura + dirección de manufactura. El formulario que menos valida es el que deja al proveedor más cerca de la regla: se crea un registro que nace bloqueado, y nadie lo descubre hasta que alguien intenta moverlo semanas después.
**Severidad: Media**

**2.3.2 — `frontend/src/pages/tracker/PreliminaryPrefillModal.tsx:81`**
Exige que el DUNS no esté vacío pero **nunca aplica `isValidDuns`**, la regla de 9 dígitos que ambos formularios de alta sí imponen (`ExternalRegistrationForm.tsx:180`, `InternalRecommendationForm.tsx:77`) y que vive exportada en `supplier-forms/payload.ts:62`.
Es el último punto de captura antes de Preliminary Evaluation: un `123` escrito ahí satisface tanto al modal como al portón del backend (que sólo comprueba no-vacío), y queda como DUNS oficial del proveedor.
**Severidad: Media**

**2.3.3 — `frontend/src/pages/tracker/ParkingLotPrefillModal.tsx:218` y `:222`**
Los campos *Website* y *Email 1* no tienen ninguna validación de formato, aunque escriben en `parkingWebsite`/`parkingEmail1` (`:132-133`).
Los **mismos dos campos** sí se validan en la pestaña Contact de Parking Lot (`TrackerSupplierDetail.tsx:1061`, regex de email en línea) y en los formularios de alta (`isValidEmail`/`isValidUrl`): el resultado es que el dato pasa o no según por qué puerta se capture, y la puerta que no valida es la primera de las dos.
**Severidad: Media**

**2.3.4 — Los cuatro modales de transición aplican tres contratos distintos**
`MoveStageModal.tsx:103-141` — botón siempre pulsable, validación por toast, **con checklist obligatorio** de hasta 6 requisitos (`:36-64`) más nota.
`StageTransitionModal` (`TrackerSupplierDetail.tsx:2890,2963-2966`) — botón `disabled` hasta que la nota sea válida, **sin checklist**.
`ParkingLotPrefillModal.tsx:79-114` y `PreliminaryPrefillModal.tsx:69-100` — botón siempre pulsable, validación por toast, **sin checklist**, con listas de campos obligatorios distintas entre sí.
El mismo avance de etapa exige cosas distintas según el botón pulsado: para llegar a Supplier Evaluation, `PrelimToSupplierEvalModal` (`:2982-2996`, `advanceOnly`) pide **sólo una nota**, mientras el checklist de 6 puntos que `MoveStageModal` define para ese destino no llega a mostrarse nunca (§1.3.6). El comentario de `MoveStageModal.tsx:99-102` argumenta explícitamente contra el `disabled` que su hermano usa (§1.1.6).
**Severidad: Media**

**2.3.5 — `frontend/src/pages/events/EventFormModal.tsx:149` y `:174-183`**
La creación fija `type: 'Direct'` como literal, y el `patch` de edición (`handleSaveEdit`) **omite `type` por completo**.
No existe ninguna forma en la interfaz de crear un evento Indirect ni de corregir el tipo de uno existente, aunque el backend acepta ambos (`eventsController.eventSchema`, `type: z.enum(['Direct','Indirect'])`), el tipo forma parte del contrato (`types/index.ts:474`) y la cabecera del detalle lo muestra como si fuera un dato real (`EventDetail.tsx:256`). Lo mismo ocurre con `status: 'Upcoming'` (`:150`), aunque ése sí se puede cambiar después — por un control que además no debería estar visible para todos (§2.4.1).
**Severidad: Media**

**2.3.6 — `frontend/src/pages/tracker/ParkingLotPrefillModal.tsx:178-180` y `:124`**
El modal ofrece un campo numérico libre *"Days elapsed"* y escribe lo que el usuario teclee en `parkingDaysElapsed`.
Es un contador que el servidor deriva: `frontend/README.md:526` (*"SLA colours — and the day count — come from the backend"*) y `backend/src/services/slaService.ts` lo recalculan en cada lectura. Se le pide al usuario un número que el sistema ya sabe y que no le va a hacer caso. Conecta además con **`backend/AUDITORIA_BACKEND_FASE2A.md` §1.2.4**, que declaró `T_Supplier_ParkingData.DaysElapsed` columna muerta porque *"nada en `src/` la escribe"*: no la escribe el backend por su cuenta, pero **sí llega desde este modal** vía el `PATCH`, así que la columna no está tan muerta como se dio por sentado.
**Severidad: Baja**

**2.3.7 — `frontend/src/pages/tracker/ParkingLotPrefillModal.tsx:60` y `:127`**
`parkingIsRecommendation: isRecommendation` escribe siempre `false` (§1.3.4).
Es una bandera de negocio —distingue al proveedor recomendado internamente del captado en evento— sobreescrita con un literal en cada paso por este modal. Hoy la ruta es inalcanzable (un proveedor recomendado nace ya en Parking Lot y no pasa por Scouting), pero es una escritura ciega esperando a que esa premisa cambie.
**Severidad: Baja**

### 2.4 Controles de escritura visibles sin gate de permisos

**2.4.1 — `frontend/src/pages/events/EventDetail.tsx:305-317`**
El `<select>` de **estado del evento** (Upcoming/Ongoing/Completed/Canceled) se renderiza sin ninguna comprobación de rol y dispara `changeStatus` → `updateEvent` (`:186-192`), mientras el botón **Edit** situado 45 líneas antes (`:260`) sí está gateado con `role === 'SSD'`.
Es una escritura **no listada** entre las que `frontend/README.md:183-186` declara diferidas a propósito (esa lista nombra los Save por pestaña de `TrackerSupplierDetail`, el delete/edición inline de MRL y las notas del detalle de evento — no el estado). Un PM/Buyer/SQD ve un desplegable plenamente interactivo en la cabecera del evento; al usarlo, `changeStatus` aplica el cambio de forma optimista, el servidor responde 403, el estado revierte y aparece *"Technical problem — not your data"* (§2.2.1). El propio archivo demuestra que sabe gatear: lo hace con el botón de al lado.
**Severidad: Alta**

**2.4.2 — `frontend/src/pages/tracker/MRLRequirementDetail.tsx:212` y `:223`**
Los botones **"Save changes"** y **"Delete"** de la cabecera se renderizan siempre; el archivo **no importa `usePermissions`** en absoluto (`:1-16`).
Coincide con lo que el README marca como diferido, pero la consecuencia concreta no estaba hilada: es una pantalla de detalle completa y editable —todos los campos del requerimiento MRL responden a la escritura— en la que un usuario de sólo lectura puede teclear un formulario entero y pulsar Guardar, para recibir un aviso de "problema técnico" (§2.2.1). El borrado, además, muestra primero un `ConfirmDeleteModal` que le pregunta si está seguro de una acción que no puede realizar.
**Severidad: Media**

**2.4.3 — `frontend/src/pages/tracker/TrackerSupplierDetail.tsx:532-601` (`FormSaveBar`)**
El botón **Save** por pestaña no consulta `canWrite`, mientras la barra de acciones de escritura del mismo componente sí lo hace (`:2501`, `!isBlacklisted && !isReadOnly && canWrite`).
También está en la lista de diferidos del README, que argumenta que *"the backend still 403s these, so they fail safely if reached"*. La realidad del código matiza ese "fail safely": `FormSaveBar.handleConfirm` (`:566-579`) clasifica el 403 como fallo de sistema, así que el usuario de sólo lectura llena la pestaña, confirma en el diálogo, y recibe *"Technical problem — not your data … please try again"* — un mensaje que le dice que insista. Falla de forma segura para los datos, no para la persona.
**Severidad: Media**

### 2.5 Estados de carrera en el cliente

**2.5.1 — `frontend/src/pages/tracker/TrackerSupplierDetail.tsx:2299-2301` y `:2790-2793`**
Los dos avances con prefill hacen dos peticiones seguidas sin atomicidad:
`await moveSupplierToStage(...)` y después `await saveSupplier(supplier, s => Object.assign(s, updatedFields))`.
Dos problemas encadenados. Si el `PATCH` falla, el proveedor **ya cambió de etapa** y ninguno de los datos que el usuario acaba de revisar en el modal se guardó, pero el toast sólo habla de que "no se pudo mover". Y `saveSupplier` recibe `supplier`, el snapshot **anterior al movimiento**, así que `buildSupplierPatch` (`:72-84`) diffea contra un registro obsoleto en lugar de contra el que devolvió el move. Es el equivalente cliente de **`backend/AUDITORIA_BACKEND_FASE2A.md` §2.5.4** (crear proveedor y vincularlo al evento en dos transacciones).
**Severidad: Media**

**2.5.2 — `frontend/src/pages/tracker/MoveStageModal.tsx:132-140`**
`handleConfirm` llama a `onConfirm(...)`, luego `onClose()` y a continuación `navigate(...)` de forma **síncrona**, sin esperar a que la petición resuelva (`onConfirm` es `handleStageMove`, que a su vez lanza `void moveToStage(...)`).
El usuario aterriza en el tablero de la etapa destino antes de que el servidor haya aceptado nada; si el movimiento se rechaza, se queda mirando una columna a la que el proveedor nunca llegó, con un toast de error encima.
**Severidad: Media**

**2.5.3 — `frontend/src/components/GlobalHeader.tsx:154-157` y `:165-168`**
`markAllRead` y `handleNotificationClick` aplican el cambio en local y disparan la petición con `.catch(() => {})` — **sin capturar el estado previo y sin rollback**.
Es el mismo patrón optimista que `pages/events/TabProspects.tsx:215-255` implementa correctamente (guarda `previous`, restaura con `updateOne(previous)` y refresca ante 409/403), y que `frontend/README.md` documenta como la referencia. Aquí, si el servidor rechaza, la campana muestra 0 no leídas y las notificaciones aparecen leídas hasta la siguiente recarga: el usuario cree haber procesado avisos que siguen pendientes. En el mismo archivo, `runDelete` (`:176-195`) sí hace lo correcto (servidor primero, y re-sincroniza ante error), así que las tres convenciones conviven en 40 líneas.
**Severidad: Media**

**2.5.4 — `frontend/src/pages/tracker/MRLRequirementDetail.tsx:157-160`**
`handleSave` envía `draft` **completo** —los ~18 campos del requerimiento— construido a partir de lo que se leyó al montar (`:126-127`).
Es una escritura de sobreescritura total: si otra persona editó cualquier campo mientras esta pantalla estaba abierta, ese cambio se pierde sin aviso. El módulo hermano resuelve exactamente esto con `buildSupplierPatch` (`TrackerSupplierDetail.tsx:71-84`), que diffea y manda sólo lo que cambió.
**Severidad: Media**

**2.5.5 — Botones de confirmación que no se deshabilitan mientras la petición vuela**
`pages/tracker/ParkingLotPrefillModal.tsx:275-280`, `pages/tracker/PreliminaryPrefillModal.tsx:214-219`, `pages/tracker/MoveStageModal.tsx:251-256`, `pages/tracker/MRLRequirementDetail.tsx:212`, y toda la barra de acciones de `pages/tracker/TrackerSupplierDetail.tsx:2504-2600` (Delete / Move to / Send to Blacklisted).
Ninguno tiene estado `saving`/`disabled`: un doble clic en "Confirm move" dispara dos `POST /move`, y en "Send to Blacklisted" dos `POST /blacklist`. El proyecto ya tiene el patrón correcto en el mismo árbol — `FormSaveBar` (`:585-590`, `disabled={saving}` + *"Saving…"*), `FormFooter` (`supplier-forms/FormShell.tsx:296`) y `Login.tsx:18` (`if (loading) return`) — así que la protección existe en unos flujos y falta en los de mayor impacto.
**Severidad: Media**

**2.5.6 — `frontend/src/pages/events/EventDetail.tsx:163` y `frontend/src/pages/tracker/MRLRequirementDetail.tsx:123`**
`EventDetail` llama a `getSuppliers()` —la lista completa de proveedores, activos y blacklisted— sólo para construir un índice nombre/commodity de los inscritos al evento; `MRLRequirementDetail` llama a `getMRLRequirements()` y hace `.find()` para mostrar **un** requerimiento.
Cada apertura de un evento o de un requerimiento arrastra una colección entera; sobre los 533 proveedores reales es la petición más cara de esas pantallas y crece linealmente. Misma familia que **`backend/AUDITORIA_BACKEND_FASE2A.md` §2.5.7**, ahora desde el lado que la provoca.
**Severidad: Baja**

### 2.6 Configuración de entorno inconsistente

**2.6.1 — `frontend/.env.example` (1 línea) frente a `frontend/.env`**
El ejemplo contiene únicamente `VITE_API_URL=http://localhost:3000/api`; el `.env` real (no versionado, correctamente ignorado por `.gitignore:23`) apunta a `http://10.222.68.106:3000/api`, la IP de una máquina de desarrollo.
Ni el ejemplo ni ningún README advierten de lo único que de verdad importa de esta variable: que se resuelve **en build**, que su ausencia no falla y que el valor por defecto es localhost (§2.1.1). Quien prepare el despliegue partiendo del ejemplo no tiene forma de saber que un build sin esa variable produce un bundle inservible en lugar de un error.
**Severidad: Media**

**2.6.2 — `frontend/vite.config.ts:6-8`**
`server: { host: true }` publica el servidor de desarrollo en todas las interfaces de red.
Es lo que permite que el `.env` de arriba apunte a `10.222.68.106`, o sea que es deliberado para las pruebas del equipo; conviene dejar constancia de que expone el frontend en desarrollo (con su `VITE_API_URL` apuntando a la base TEST real) a cualquiera en la red corporativa.
**Severidad: Baja**

### 2.7 Diferencias local vs. producción no documentadas

Se excluye lo ya cubierto por `backend/sql/prod/RUNBOOK_PROMOCION.md`.
*(El fallback de `VITE_API_URL` es la diferencia local-vs-producción más grave del frontend; está contabilizada una sola vez, en §2.1.1.)*

**2.7.1 — `frontend/src/utils/parseProspectWorkbook.ts:10` y `frontend/src/utils/prospectTemplate.ts:13`**
Ambos hacen `import * as XLSX from 'xlsx'` de forma **estática**, y la cadena que los arrastra también es estática: `EventDetail` → `TabProspects.tsx:18` → `ProspectImportModal.tsx:7-8` → `xlsx`.
Medido sobre el build actual: `dist/assets/EventDetail-CjlEUrwR.js` pesa **461 KB**, más del doble que el segundo chunk más grande (`Dashboard`, 205 KB, que incluye Chart.js entero). Todo el que abre **cualquier** evento descarga la librería completa de Excel, use o no la importación de prospectos — que además sólo ve el rol SSD (`TabProspects.tsx:280`).
**Severidad: Media**

**2.7.2 — `frontend/src/pages/tracker/BlacklistedSupplierDetail.tsx:16` y `frontend/src/pages/tracker/CompletedSupplierDetail.tsx:16`**
`import { TabCompletedOverview } from './TrackerSupplierDetail';` — ambas pantallas de sólo lectura importan de la página editable de 3 061 líneas.
Verificado en el build: el chunk `BlacklistedSupplierDetail-DuqmfgCN.js` (9 KB) abre con `import{…14 símbolos…}from"./TrackerSupplierDetail-CkTcyF8_.js"`, y **no existe ningún chunk `read-only-tabs-*.js`** en `dist/assets/` — Rollup lo absorbió dentro del chunk de `TrackerSupplierDetail` porque las tres pantallas sólo lo alcanzan a través de él. Resultado: abrir un proveedor blacklisted o completado descarga **127 KB** del detalle editable que ese usuario no va a usar, y la división por rutas de `App.tsx:16-20` queda anulada para dos de sus rutas. `frontend/README.md:376-379` documenta la decisión de dejar `TabCompletedOverview` ahí, pero no esta consecuencia.
**Severidad: Media**

**2.7.3 — `frontend/index.html:8-10`**
`preconnect` a `fonts.googleapis.com`/`fonts.gstatic.com` y hoja de estilos de la fuente Inter servida desde Google.
La aplicación es interna de Nexteer: si la red corporativa bloquea o ralentiza esos dominios —escenario habitual en planta— toda la tipografía cae al fallback en producción mientras en la máquina del desarrollador se ve perfecta. Es una dependencia de runtime hacia un tercero que ninguna configuración documenta.
**Severidad: Media**

**2.7.4 — `npm run lint` falla: 10 errores**
`npx eslint .` → 10 errores y 13 warnings. Los errores son 8 × `@typescript-eslint/no-explicit-any` (`pages/strategy/StrategyPage.tsx:224,245`; `pages/suppliers/SuppliersList.tsx:249×2,294,295,299,311`) y 2 × `no-unused-vars` sobre el idioma `const { id: _id, ...rest }` (`pages/tracker/MRLList.tsx:158`, `pages/tracker/MRLRequirementDetail.tsx:103`), que la configuración no exime porque `eslint.config.js:19-26` no declara `varsIgnorePattern: '^_'`.
El proyecto declara el script `lint` en `package.json:9` y no pasa: cualquier pipeline que lo ejecute como puerta de calidad falla el build. `tsc --noEmit` sí pasa limpio, así que el fallo es exclusivo del linter y hoy nadie lo ve. Los 8 `any` son la cara mecánica de §1.5.4 (se verificó que `isCompleted` existe en runtime — `SuppliersList.tsx:44`, `StrategyPage.tsx:490` — así que no ocultan un bug, sólo tipado).
**Severidad: Media**

**2.7.5 — `frontend/index.html:5` y `:12-14`**
Favicon apuntando a un `/vite.svg` inexistente (404 en cada carga) y metadatos Open Graph/Twitter sirviendo la imagen por defecto de `bolt.new`.
En local nadie los mira; en producción son un 404 permanente en la consola del navegador y la marca de un servicio de terceros en cada vista previa de enlace de la herramienta. *(Detalle y recomendación en §1.7.3 y §1.7.4.)*
**Severidad: Baja**

### 2.8 Dependencias riesgosas

**2.8.1 — `frontend/package-lock.json` frente a `package-lock.json` de la raíz**
Dos lockfiles para el mismo workspace, el anidado tres días más viejo (14-ago vs 17-ago), mientras la raíz ya declara `workspaces: ["frontend","backend"]` y resuelve `frontend` en su propio lock (línea 2005).
Instalar desde la raíz y instalar desde `frontend/` producen árboles distintos, así que "instalar dependencias" deja de ser determinista en el servidor. Es la mitad frontend del hallazgo **`backend/AUDITORIA_BACKEND_FASE2A.md` §2.8.1**; conviene resolverlos juntos porque son el mismo problema de workspace.
**Severidad: Media**

**2.8.2 — `frontend/package.json:13-23`**
Las 10 dependencias de runtime usan rangos caret, incluidas `react-router-dom ^7.15.1`, `@fortawesome/* ^7.2.0` / `^3.3.1`, `chart.js ^4.5.1` y `xlsx ^0.18.5`.
Un `npm install` (no `ci`) puede traer minors distintos de los validados. Dos casos merecen atención propia: `react-router-dom` en major 7 gobierna todo el enrutado y la sesión, y `xlsx` es la dependencia que pesa 430 KB en el bundle (§2.7.1) — su versión concreta ya está reportada en `SSD_Pendientes_v2_0.md` §3.1 y no se repite aquí, pero el rango abierto sí es un riesgo distinto del número de versión.
**Severidad: Media**

### 2.9 Fugas de información hacia roles sin acceso

**Ningún hallazgo.** Se verificó la cadena completa que el enunciado señala y está
correcta en las cuatro capas:

- **`pages/Inicio.tsx:108-112`** — el reparto por rol ocurre **antes** de cualquier petición: `if (user?.role === 'Guest') return <HomeGuestView />`. `HomeFullView` (con sus cuatro llamadas a servicios de proveedores, `:114-120`) ni siquiera se monta para un Guest.
- **`pages/HomeGuestView.tsx:33-43`** — su único efecto llama a `getHomeSummary()` y a nada más; ninguna de las 158 líneas referencia un servicio que devuelva proveedores. Lo que renderiza son conteos por etapa, tres totales, un top de commodities y hasta 3 eventos próximos (nombre, fecha, ubicación) — exactamente la forma agregada que `backend/src/services/homeService.ts:4-8` declara como frontera de seguridad, sin nombre, folio ni id de proveedor.
- **`components/Sidebar.tsx:54`** — la navegación se filtra a `/home` para Guest, y User Management se gatea con `role === 'SSD'` (`:218`).
- **`App.tsx:83-104`** — las 16 rutas operativas pasan por `<Gate allow={OPERATIONAL}>` y `/users` por `<Gate allow={['SSD']}>`.

Dos observaciones que **no** son fugas, anotadas para que consten como
verificadas: `/settings` y `/profile` (`App.tsx:79-80`) quedan fuera de `<Gate>`
y son alcanzables por Guest, pero `Settings.tsx` no muestra dato alguno (§1.7.6)
y `Profile.tsx:14-19` sólo lee `user` del propio contexto de sesión. Y el reparto
de `Inicio` depende de `user?.role`: si `user` fuera `null` caería en
`HomeFullView`, aunque `ProtectedRoute` (`components/ProtectedRoute.tsx:35-37`)
ya garantiza que eso no ocurra.

---

## Lo que NO se tocó y por qué

- **Token en `localStorage`** — `frontend/README.md:196-197` lo registra como hardening deliberadamente diferido (*"Moving to httpOnly cookies is the right hardening but is deferred"*). Excluido por instrucción; sólo se menciona de pasada en §1.6.3, donde el hallazgo real es la duplicación de las claves, no el mecanismo.
- **PM/Buyer/SQD operativamente idénticos y `canWrite` como booleano global** — `frontend/README.md:198-201` lo declara *"a deliberate, permanent decision"*, y `hooks/usePermissions.ts:12-14` lo repite. No se reporta como carencia; lo que sí se reporta (§2.4) son los controles que ni siquiera pasan por ese booleano.
- **`intelexLevelEfficiency` duplicando la fórmula del backend** — `pages/tracker/read-only-tabs.tsx:283-289` declara la duplicación intencional y explica su único cometido (la vista previa en vivo del formulario Timeline, verificado en uso en `TrackerSupplierDetail.tsx:2047`); `backend/src/domain/intelexEfficiency.ts:26-30` la reconoce desde el otro lado. Ambos extremos se apuntan mutuamente, así que la copia no puede derivar en silencio.
- **`relativeLabel` duplicado entre frontend y backend** — `utils/date-helpers.ts:3-6` explica que es deliberado (redacción distinta, en inglés y afinada para el feed de actividad) y que **no** debe importarse del backend.
- **`utils/tracker-helpers.ts:21` (`stageIndex`) replicando el orden de etapas del backend** — el docblock (`:14-20`) explica que el frontend no puede importar código de dominio del backend. Misma justificación aceptada en `backend/AUDITORIA_BACKEND_FASE2A.md` §1.6.4.
- **Los campos de Visit bajo nombres `prelim_*`** — `utils/tracker-helpers.ts:139-151` y `pages/tracker/read-only-tabs.tsx:241-259` los usan con ese prefijo porque las columnas conservan ese contrato de wire. Cubierto por **`backend/DEBT.md` §1** (*"Visit-tab columns still live under T_Supplier_PreliminaryData"*), Parte B diferida a la promoción a producción, que incluye explícitamente renombrar estas claves en `frontend/src/utils/tracker-helpers.ts`.
- **Que un proveedor blacklisted no pueda reingresar al pipeline** — `frontend/README.md:404-406` remite a **`backend/DEBT.md` §2**.
- **Los 6 hallazgos de `SSD_Pendientes_v2_0.md` §3.1** (conteo de tablas, conteo de tests, versión de Node, `xlsx@0.18.5`, `sql/README.md` desincronizado, `README.md` raíz desactualizado) — excluidos por instrucción. En §2.7.1 y §2.8.2 se reporta el **peso en el bundle** y el **rango de versión** de `xlsx`, que son problemas distintos del número de versión ya registrado.
- **Todo lo reportado en `backend/AUDITORIA_BACKEND_FASE2A.md`** — donde el frontend toca el mismo problema se cita en vez de duplicarse: §1.7.8 y §2.8.1 (lockfile duplicado ↔ 2.A §2.8.1), §2.3.6 (`DaysElapsed` ↔ 2.A §1.2.4), §2.5.1 (escrituras en dos pasos ↔ 2.A §2.5.4), §2.5.6 (colecciones enteras por petición ↔ 2.A §2.5.7).
- **Confirmación explícita pedida por el enunciado:** `frontend/src/constants/stage-config.ts:23` **sigue siendo sólo un comentario**, no un import. `grep -rn "pipeline-demo\|events-demo\|strategy-demo" frontend/src` devuelve esa única línea en todo el frontend. La nota al margen de `backend/AUDITORIA_BACKEND_FASE2A.md` se mantiene vigente: los fixtures del backend pueden salir del path de despliegue sin tocar el frontend.

### Nota al margen (backend — fuera del cuerpo del reporte)

Dos cosas que aparecieron al auditar cómo el frontend consume la API y que no
corresponde tocar aquí:

1. **`GET /api/strategy/commodity/:commodity` devuelve una forma que ningún cliente puede consumir tal como está tipada.** El backend (`backend/src/services/strategyService.ts:240`) devuelve `{ ...row, suppliers }` —los campos de `CommodityStrategyRow` esparcidos en la raíz— mientras el cliente declara `{ row: CommodityStrategyRow; suppliers: TrackerSupplier[] }` (`frontend/src/services/strategyService.ts:37`). Hoy no rompe nada porque la función está muerta en el frontend (§1.3.1) y el endpoint no tiene ningún consumidor, pero es una discrepancia real de contrato esperando a quien conecte esa pantalla. Conviene decidir cuál de las dos formas es la buena antes de que alguien la use.

2. **`GET /api/auth/me` no devuelve `email`,** y el frontend lo suple conservando el valor cacheado del login (`frontend/src/context/AuthContext.tsx:33-36` y `:98`). Funciona, pero significa que tras una rehidratación en la que el `localStorage` del usuario se haya limpiado parcialmente, `Profile.tsx:18` muestra `—` en el correo hasta el siguiente login completo. Incluir `email` en la respuesta de `/me` cerraría el hueco desde el lado correcto.
