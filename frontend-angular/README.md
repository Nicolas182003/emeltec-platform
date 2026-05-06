# Frontend Angular

Frontend oficial de Emeltec Platform.

Esta aplicacion entrega la interfaz web para monitoreo industrial, navegacion por empresas e instalaciones, dashboards operativos y modulos administrativos. El frontend se comunica con las APIs mediante rutas relativas (`/api/...`) para que el mismo codigo pueda funcionar en local y en produccion.

## Tecnologia

- Angular 21.
- TypeScript.
- Tailwind CSS.
- Chart.js.
- Lucide Angular.

## Requisitos

- Node.js compatible con Angular 21.
- npm.
- APIs locales levantadas si se quiere probar integracion completa.

## Instalacion

Desde esta carpeta:

```bash
npm install
```

## Desarrollo local

Levanta el servidor de desarrollo:

```bash
npm start
```

Abre:

```text
http://localhost:4200
```

Durante desarrollo local, Angular usa `proxy.conf.json` para redirigir las llamadas `/api/...` hacia los servicios locales. Por eso, para probar login, empresas, usuarios o datos reales del sistema, las APIs locales deben estar ejecutandose.

## Build

Build de produccion:

```bash
npm run build -- --configuration=production
```

La salida se genera en:

```text
dist/frontend-angular
```

En el despliegue real, este build se ejecuta dentro de Docker mediante el `Dockerfile` del frontend y luego se sirve con Nginx.

## Estructura principal

| Ruta | Proposito |
|---|---|
| `src/app/components/` | Componentes reutilizables de layout, UI y visualizacion. |
| `src/app/pages/` | Paginas principales de la aplicacion. |
| `src/app/services/` | Servicios Angular para comunicacion con APIs. |
| `src/app/guards/` | Protecciones de rutas. |
| `src/app/interceptors/` | Interceptores HTTP. |
| `src/styles.css` | Estilos globales. |

## Integracion con APIs

El frontend no deberia tener URLs absolutas de produccion en el codigo. Las llamadas deben usar rutas relativas como:

```text
/api/auth/login
/api/companies
/api/users
```

Esto permite que:

- En local, Angular use `proxy.conf.json`.
- En produccion, Nginx y Docker resuelvan el trafico hacia los servicios correctos.

## Validacion antes de subir cambios

Antes de abrir un PR o hacer merge, ejecuta:

```bash
npm run build -- --configuration=production
```

Si el cambio toca integracion con APIs, valida tambien el flujo completo levantando el proyecto desde la raiz con Docker Compose.
