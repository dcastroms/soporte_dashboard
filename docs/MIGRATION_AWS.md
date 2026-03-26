# Plan de migración — soporte_dashboard a infraestructura AWS

> Estado: **pendiente de ejecución**
> Referencia principal: `mediastream-tools` (Next.js, mismo stack)
> Referencia secundaria: `runner/server` (Serverless Framework, API Gateway, SES)
> Fecha de planificación: 2026-03-19

## Contexto de BD (confirmado por Java, 2026-03-19)

- La BD de dev es un **MongoDB Atlas M10** compartido — mismo cluster que usan Java y Lucho para runner y otros proyectos
- El acceso a MongoDB **siempre pasa por una Lambda proxy** (nunca conexión directa desde la app)
- Para desarrollar en local se necesitan **credenciales AWS con permiso `lambda:InvokeFunction`** sobre las Lambdas proxy
- El proxy de dev (`soporte-mongodb-dev-proxy`) hay que crearlo apuntando a este Atlas M10
- Una vez creado el proxy, copiar el patrón de runner (conexión, GitHub Actions, CloudFront, deploy) es rápido

### Por qué existe el proxy Lambda

El proxy es un **proyecto Lambda separado** (no solo una función suelta) que mantiene **conexiones persistentes** a MongoDB. Sin él:
- Cada Lambda de la app abre su propia conexión al arrancar (cold start)
- En producción con muchas Lambdas en paralelo → saturación de conexiones → BD cae
- **Lo usa platform** (el producto principal de Mediastream) → está probado en producción

La API del proxy es similar a Mongoose/MongoDB nativo pero con algunas limitaciones menores (nada grave según Java).

### Stack — decisión pendiente (SST vs Serverless Framework)

Java prefiere **Serverless Framework** sobre SST ("SST no me gustó nada"). Sin embargo:
- `mediastream-tools` (proyecto de Lucho) usa **SST** y ya está deployado
- Si soporte_dashboard va en el mismo monorepo, podría tener que seguir SST por consistencia
- **Pendiente decidir** con el equipo si soporte_dashboard usa SST (como mediastream-tools) o Serverless Framework (como runner)

Preferencia técnica Java: **Serverless Framework**
Estado: ⚠️ por confirmar

### Stack confirmado para soporte_dashboard
- **Frontend:** Next.js 16 + React 19 + **Tailwind CSS** ✓ (ya tiene)
- **MongoDB:** asegurar que sea la **última versión** del driver
- **Deploy:** SST o Serverless Framework (pendiente)
- **Auth:** NextAuth
- **BD:** MongoDB Atlas M10 vía Lambda proxy

---

## Resumen de cambios

| # | Cambio | Esfuerzo | Prioridad |
|---|--------|----------|-----------|
| 0 | GitHub Actions con path filters | Bajo | Alta |
| 1 | Serverless Framework (`serverless.yml`) | Medio | Alta |
| 2 | API Gateway | Bajo (va con #1) | Alta |
| 3 | Route 53 + dominio personalizado | Bajo (va con #1) | Alta |
| 4 | AWS SES para emails | Medio | Media |
| 5 | Migrar Prisma → Lambda proxy MongoDB | **Alto** | Alta |
| 6 | VPC (confirmar con devops) | Bajo | Media |
| 7 | AWS Secrets Manager | Medio | Alta |
| 8 | Monorepo | Medio | Media |
| 9 | Eliminar `nixpacks.toml` | Trivial | Baja (último paso) |

---

## Cambio 0 — GitHub Actions con path filters

**Por qué:** Un cambio de CSS no debe redeplegar el Lambda. Los workflows deben disparar solo cuando cambia código relevante.

**Referencia:** `mediastream-tools/.github/workflows/`

**Archivos a crear:**

### `.github/workflows/ci.yml`
- Trigger: push a `main` + pull requests a `main`
- Steps: `npm ci` → `npm run lint` → `npm run build`
- Variables de entorno placeholder para que Next.js buildee sin secrets reales:
  ```yaml
  NEXTAUTH_URL: https://example.com
  NEXTAUTH_SECRET: ci-placeholder-secret
  SKIP_ENV_VALIDATION: 1
  ```

### `.github/workflows/deploy-aws-qa.yml`
- Trigger: push a rama `qa` **Y** cambios en alguno de estos paths:
  ```
  src/**
  public/**
  next.config.ts
  package.json
  serverless.yml   (cuando exista)
  ```
- **SIN** `prisma/**` — Prisma será eliminado (ver Cambio 5)
- Steps: configurar AWS credentials → setup Node 20 → `npm ci` → `sls deploy --stage qa`

### `.github/workflows/deploy-aws-prod.yml`
- Igual que QA pero trigger en `main`/`master` y `sls deploy --stage prod`

**Secrets requeridos en el repo:**
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
NEXTAUTH_URL            (prod)
NEXTAUTH_URL_QA
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID        (prod)
GOOGLE_CLIENT_SECRET    (prod)
GOOGLE_CLIENT_ID_DEV    (qa)
GOOGLE_CLIENT_SECRET_DEV (qa)
INTERCOM_TOKEN
INTERCOM_CLIENT_SECRET
CRON_SECRET
SLACK_WEBHOOK_URL
```
> Los mismos secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` que ya están en la org para runner y mediastream-tools.

---

## Cambio 1 — Serverless Framework

**Por qué:** El deploy actual via Nixpacks/Vercel no sigue el estándar AWS de los demás proyectos Mediastream. Serverless Framework + CloudFormation es el patrón confirmado.

**Referencia:** `runner/server/serverless.yml` + `runner/server/config.js`

**Archivos a crear:**

### `serverless.yml`
```yaml
service: soporte-dashboard

frameworkVersion: ^3.2.0

package:
  individually: true
  excludeDevDependencies: false

custom: ${file(./config.js):config}

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  role: arn:aws:iam::934583553888:role/vms-base-role
  memorySize: 1024
  timeout: 30
  versionFunctions: false
  environment: ${self:custom.env}
  apiGateway:
    shouldStartNameWithService: true

functions:
  app: ${self:custom.appHandler}

resources: ${self:custom.resources}

plugins:
  - serverless-esbuild
  - serverless-offline
  - serverless-domain-manager
  - serverless-latest-layer-version
```

### `config.js`
- Define dominios por entorno (ver Cambio 3)
- Define variables de entorno por stage
- Define recursos CloudFormation: secret en Secrets Manager (ver Cambio 7)
- Define VPC (ver Cambio 6)

**Layer AWS Parameters and Secrets (mismo que runner):**
```
arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension:latest
```

---

## Cambio 2 — API Gateway

**Por qué:** La app Next.js debe exponerse como función Lambda detrás de API Gateway, igual que runner.

**Referencia:** `runner/server/config.js` función `newRoute` (líneas 33–43) y `runner/server/src/index.js`

**Configuración CORS** (copiar de runner):
```javascript
cors: {
  allowCredentials: true,
  origins: ['*'],
  headers: ['Content-Type', 'Authorization', 'apikey', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
}
```

**Handler Lambda:**
- Crear `src/index.ts` con `module.exports.handler` que recibe el evento API Gateway y lo pasa a Next.js
- `context.callbackWaitsForEmptyEventLoop = false`

---

## Cambio 3 — Route 53 + dominio personalizado

**Por qué:** Unificar todos los proyectos bajo `*.mediastream.co` con el certificado wildcard ya existente.

**Referencia:** `runner/server/config.js` líneas 28–31 y 162–170 | `mediastream-tools/sst.config.ts` líneas 22–52

**Dominios por entorno:**
| Stage | Dominio |
|-------|---------|
| prod | `soporte.mediastream.co` *(confirmar nombre final con el equipo)* |
| qa | `qa-soporte.mediastream.co` |
| dev | `dev-soporte.mediastream.co` |

**Configuración en `config.js`:**
```javascript
customDomain: {
  domainName,                    // según stage
  certificateName: '*.mediastre.am',  // wildcard ya existe
  createRoute53Record: true,
  autoDomain: true,
  endpointType: 'regional',
  securityPolicy: 'tls_1_2',
  apiType: 'rest'
}
```

> El certificado `*.mediastre.am` ya está creado en AWS Certificate Manager. No hay que crear uno nuevo.

---

## Cambio 4 — AWS SES para emails

**Por qué:** Si soporte_dashboard envía emails (notificaciones, handovers, alertas), deben ir via AWS SES igual que runner, no via SMTP externo.

**Referencia:** `runner/server/src/helper/emailService/index.js`

**Archivos a crear:**

### `src/lib/emailService/index.ts`
- SDK: `@aws-sdk/client-sesv2` (v3)
- From address: `soporte@mediastre.am` *(confirmar con el equipo)*
- Región: `us-east-1`
- Soporte para emails **con y sin adjuntos** (Nodemailer + SES transport para adjuntos)
- Sistema de templates con variables `[[variableName]]`

### `src/lib/emailService/templates/base.ts`
- Template HTML responsive con branding Mediastream
- Bilingüe español/inglés
- Header con logo, footer con links

**Dependencias a agregar:**
```json
"@aws-sdk/client-sesv2": "^3.x",
"nodemailer": "^7.x"
```

---

## Cambio 5 — Migrar Prisma → Lambda proxy MongoDB ⚠️ Mayor esfuerzo

**Decisión confirmada por Dario (2026-03-19).** Prisma sale completamente. La conexión a MongoDB pasa por una Lambda proxy, igual que runner y mediastream-tools.

**Por qué:** Estandarizar el acceso a datos en todos los proyectos. El proxy Lambda centraliza la conexión a MongoDB (evita connection pooling en serverless, permite auditoría centralizada).

**Referencia:** `mediastream-tools/lib/db/mongo.js` + `mediastream-tools/lib/db/models/`

### Paso 1 — Crear Lambda proxy

Crear una Lambda separada por entorno:
- `soporte-mongodb-dev-proxy`
- `soporte-mongodb-qa-proxy`
- `soporte-mongodb-prod-proxy`

Estas Lambdas reciben un payload `{ collection, op, query, options }` y ejecutan la operación en MongoDB.

### Paso 2 — Crear `src/lib/mongo.ts`

```typescript
// Espejo de mediastream-tools/lib/db/mongo.js
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({ region: "us-east-1" });

function getProxyName() {
  const env = process.env.CUSTOM_ENV || "development";
  return `soporte-mongodb-${env}-proxy`;
}

export async function queryProxy(payload: object) {
  const cmd = new InvokeCommand({
    FunctionName: getProxyName(),
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(payload)),
  });
  const result = await lambda.send(cmd);
  const text = result.Payload ? Buffer.from(result.Payload).toString("utf8") : "{}";
  const response = JSON.parse(text || "{}");
  if (!response.success) throw new Error(response.reason || "Mongo proxy query failed");
  return response.result;
}
```

### Paso 3 — Reescribir modelos (22+)

Cada modelo Prisma se convierte en un archivo de funciones que llaman a `queryProxy`.

**Ejemplo — antes (Prisma):**
```typescript
const conversations = await prisma.intercomConversation.findMany({
  where: { status: "open" },
  orderBy: { createdAt: "desc" }
});
```

**Ejemplo — después (proxy):**
```typescript
const conversations = await queryProxy({
  collection: "intercom_conversations",
  op: "find",
  query: { status: "open" },
  options: { sort: { createdAt: -1 } }
});
```

**Modelos a migrar:**
- `User`, `Account`, `Session` — afecta autenticación NextAuth
- `IntercomConversation`, `IntercomMetric`, `IntercomCategoryMetric`, `IntercomHeatmap`, `IntercomAgent`, `IntercomSyncStatus`
- `KnowledgeDoc`, `KnowledgeChunk`, `AiConfig`, `AiSuggestionLog`
- `Goal`, `Initiative`, `WeeklyUpdate`, `BacklogItem`, `Automation`
- `TeamLog`, `SupportAssignment`, `ShiftHandover`, `Event`
- `ClientNote`, `ClientActionLog`, `Notification`, `ActivityLog`

### Paso 4 — Reemplazar NextAuth PrismaAdapter

`@next-auth/prisma-adapter` desaparece. Opciones:
- Implementar un adaptador custom MongoDB (siguiendo la interfaz de NextAuth)
- Usar `@auth/mongodb-adapter` directamente contra el proxy

### Paso 5 — Eliminar Prisma

```bash
# Desinstalar
npm uninstall prisma @prisma/client @next-auth/prisma-adapter

# Eliminar archivos
rm prisma/schema.prisma
rm prisma.config.ts
```

---

## Cambio 6 — VPC

**Por qué:** Las Lambdas deben estar en la misma VPC que runner para acceder a recursos internos de red (MongoDB proxy, etc).

**Pendiente:** Confirmar con devops si soporte_dashboard va en la misma VPC que runner.

**Si sí, reutilizar:**
| Entorno | Security Group | Subnets |
|---------|---------------|---------|
| prod | `sg-1ec7c863` | `subnet-07deece0057a21c44`, `subnet-01086eb727cd3bf83`, `subnet-0d78edafdd5297594`, `subnet-0025c2b6f470facfb` |
| dev/qa | `sg-013a8151c4458a375` | `subnet-0ed0866fde243c626`, `subnet-0f056a4abe5917705` |

---

## Cambio 7 — AWS Secrets Manager

**Por qué:** Las variables sensibles no deben vivir solo en `.env`. Secrets Manager permite rotación, auditoría y manejo por entorno, igual que runner.

**Referencia:** `runner/server/src/helper/secrets.js` + `runner/server/config.js` líneas 257–295

**Secrets a crear (via CloudFormation en `serverless.yml`):**
| Nombre | Contenido |
|--------|-----------|
| `production/soporte-dashboard` | Todas las vars de producción |
| `qa/soporte-dashboard` | Todas las vars de QA |
| `development/soporte-dashboard` | Todas las vars de dev |

**Variables a migrar al secret:**
- `DATABASE_URL` (o `MONGO_PROXY_NAME` cuando se migre Prisma)
- `INTERCOM_TOKEN`, `INTERCOM_CLIENT_SECRET`, `INTERCOM_APP_ID`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `CRON_SECRET`
- `AI_PROVIDER` + todas las API keys de AI (OPENROUTER, VOYAGE, JINA, etc.)
- `SLACK_WEBHOOK_URL`, `SLACK_SOPORTETEAM_ID`

**Archivo a crear: `src/lib/secrets.ts`**
- Espejo de `runner/server/src/helper/secrets.js`
- Usa `@aws-sdk/client-secrets-manager`
- En entorno local: lee de `.env` directamente
- En cloud: invoca Secrets Manager con el nombre del stage

---

## Cambio 8 — Monorepo

**Por qué:** El repo alojará múltiples proyectos (soporte_dashboard + otros futuros) deployables por separado.

**Estructura propuesta:**
```
mediastream-monorepo/
├── apps/
│   ├── soporte-dashboard/   ← este proyecto
│   └── (futuros proyectos)
├── packages/
│   └── shared/              ← código compartido entre apps
└── package.json             ← raíz con workspaces
```

**`package.json` raíz:**
```json
{
  "name": "mediastream-monorepo",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "lint": "npm run lint --workspaces --if-present"
  }
}
```

**Cada app se deploya de forma independiente** — sus GitHub Actions solo miran su propia carpeta.

---

## Cambio 9 — Eliminar `nixpacks.toml`

**Cuándo:** Último paso, una vez que el deploy via Serverless Framework esté verificado y funcionando en al menos QA.

```bash
rm nixpacks.toml
```

---

## Orden de ejecución recomendado

```
PRE — Permisos + proxy BD (hacer primero, es el desbloqueo)
  ↓
  11. Pedir permisos IAM a Java para invocar Lambdas desde local
  12. Crear soporte-mongodb-dev-proxy apuntando al Atlas M10 de dev
      (mismo cluster que runner y los proyectos de Java/Lucho)
  ↓
5 (Prisma → proxy)  ← ahora sí se puede empezar, con el proxy ya disponible
    ↓
1 + 2 + 3 + 7       ← serverless.yml + API Gateway + Route53 + Secrets (van juntos)
    ↓
6                   ← confirmar VPC con devops
    ↓
0 + 4               ← GitHub Actions + SES
    ↓
8                   ← estructura monorepo
    ↓
9                   ← eliminar nixpacks.toml
```

---

## Secrets que la dev debe ingresar manualmente una vez configurado el stack

| Secret | Dónde cargarlo |
|--------|---------------|
| `AWS_ACCESS_KEY_ID` | GitHub repo settings |
| `AWS_SECRET_ACCESS_KEY` | GitHub repo settings |
| `NEXTAUTH_URL` | GitHub + Secrets Manager prod |
| `NEXTAUTH_URL_QA` | GitHub + Secrets Manager qa |
| `NEXTAUTH_SECRET` | GitHub + Secrets Manager |
| `GOOGLE_CLIENT_ID` | GitHub + Secrets Manager |
| `GOOGLE_CLIENT_SECRET` | GitHub + Secrets Manager |
| `GOOGLE_CLIENT_ID_DEV` | GitHub (qa) |
| `GOOGLE_CLIENT_SECRET_DEV` | GitHub (qa) |
| `INTERCOM_TOKEN` | Secrets Manager |
| `INTERCOM_CLIENT_SECRET` | Secrets Manager |
| `CRON_SECRET` | Secrets Manager |
| `SLACK_WEBHOOK_URL` | Secrets Manager |
| AI keys (OPENROUTER, VOYAGE, etc.) | Secrets Manager |
