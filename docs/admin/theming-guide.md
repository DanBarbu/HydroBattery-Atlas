# WILL Theming Guide

> Bilingual document. English first; Romanian below.

---

## English

### Audience

Tenant administrators (defence integrators, MoD branches, partner primes) who need to rebrand the WILL platform for their operators.

### What you can rebrand from the Admin UI

- **Primary colour** — drives the classification banner background, accent buttons, and the active state for selectors.
- **Banner label** — the text rendered on the classification banner across the operator view.
- **Affiliation colours** — override the default APP-6D affiliation palette (friendly, hostile, neutral, unknown). Useful for partners who maintain their own colour-blind-friendly palettes.
- **Logo URL** — referenced by the platform-wide header and the print-out templates (Sprint 6+).
- **Terminology** — JSON map of platform terms to your terms (e.g., `{"sensor": "asset"}`).

### How to do it

1. Sign in to the WILL dashboard.
2. Click **Admin** in the top navigation.
3. Pick your tenant from the left list.
4. Edit the JSON in the editor:

   ```json
   {
     "primaryColor": "#0b6e4f",
     "bannerLabel": "BR2VM — TRAINING",
     "affiliationColors": {
       "F": "#3273dc",
       "H": "#e63946",
       "N": "#3ddc97",
       "U": "#f4d35e"
     },
     "logoUrl": "https://assets.example.ro/br2vm-logo.svg"
   }
   ```

5. Press **Save**. The change is live; the operator view picks it up at the next 60-second poll, or immediately on a page reload.

### Terminology overrides

Terminology is a separate JSON map under `terminology`:

```json
{
  "sensor": "asset",
  "track": "contact",
  "operator": "user"
}
```

These overrides are applied client-side at render time. All occurrences of the keys in the operator view are replaced with their values.

### Feature toggles

Feature toggles arrive in Sprint 4 with role-based access control (RBAC). The JSON shape is reserved on the tenant record from Sprint 2:

```json
{
  "ai_prediction": false,
  "link22": false
}
```

### What you cannot rebrand

- The platform's name in the documentation site (use a fork or the integrator-published distribution for that).
- The classification banner's structural visibility — STANAG 4774 metadata drives whether a banner appears, not theming.
- The audit trail content — the audit subsystem is sealed against tenant configuration.

### Validation tips

- Always run a pre-prod tenant through one round of saving and a full page reload before applying the same theme to production.
- Validate the JSON in the editor; the **Save** button rejects invalid JSON with an inline error.
- Check that your `primaryColor` has sufficient contrast with white text — the banner uses white text by default.

---

## Română

### Audiență

Administratori de chiriaș (integratori de apărare, structuri MApN, parteneri industriali) care trebuie să personalizeze platforma WILL pentru operatorii proprii.

### Ce puteți personaliza din UI-ul de Administrare

- **Culoarea primară** — determină fundalul banner-ului de clasificare, butoanele de accent și starea activă a selectoarelor.
- **Etichetă banner** — textul afișat pe banner-ul de clasificare în vizualizarea operațională.
- **Culori afiliere** — suprascrie paleta APP-6D implicită (prietenos, ostil, neutru, necunoscut). Util pentru partenerii care folosesc palete proprii adaptate pentru daltonism.
- **URL logo** — referențiat de header-ul platformei și de șabloanele de raport (Sprint 6+).
- **Terminologie** — hartă JSON care înlocuiește termenii platformei cu cei dumneavoastră (ex.: `{"sensor": "asset"}`).

### Cum se face

1. Autentificați-vă în tabloul de bord WILL.
2. Apăsați **Administrare** în navigarea de sus.
3. Selectați chiriașul din lista din stânga.
4. Editați JSON-ul în editor:

   ```json
   {
     "primaryColor": "#0b6e4f",
     "bannerLabel": "BR2VM — INSTRUIRE",
     "affiliationColors": {
       "F": "#3273dc",
       "H": "#e63946",
       "N": "#3ddc97",
       "U": "#f4d35e"
     },
     "logoUrl": "https://assets.example.ro/br2vm-logo.svg"
   }
   ```

5. Apăsați **Salvare**. Modificarea este aplicată imediat; vizualizarea operațională o preia la următorul poll de 60 de secunde sau imediat la o reîncărcare a paginii.

### Suprascrieri terminologice

Terminologia este o hartă JSON separată sub `terminology`:

```json
{
  "sensor": "activ",
  "track": "contact",
  "operator": "utilizator"
}
```

Suprascrierile se aplică pe partea de client la randare. Toate aparițiile cheilor în vizualizarea operațională sunt înlocuite cu valorile asociate.

### Comutatoare de funcționalități

Comutatoarele de funcționalități sosesc în Sprint 4 împreună cu controlul accesului bazat pe roluri (RBAC). Forma JSON este rezervată pe înregistrarea de chiriaș din Sprint 2:

```json
{
  "ai_prediction": false,
  "link22": false
}
```

### Ce NU puteți personaliza

- Numele platformei în site-ul de documentație (folosiți un fork sau distribuția publicată de integrator).
- Vizibilitatea structurală a banner-ului de clasificare — metadatele STANAG 4774 decid dacă banner-ul apare, nu tema.
- Conținutul jurnalului de audit — subsistemul de audit este sigilat față de configurația chiriașului.

### Sfaturi de validare

- Aplicați întotdeauna tema pe un chiriaș de pre-producție și executați o reîncărcare completă a paginii înainte de a aplica aceeași temă în producție.
- Validați JSON-ul în editor; butonul **Salvare** respinge JSON invalid cu o eroare inline.
- Verificați că `primaryColor` are contrast suficient cu textul alb — banner-ul folosește text alb implicit.
