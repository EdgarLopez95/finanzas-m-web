# Finanzas M Web

Aplicacion web de Finanzas M para finanzas personales y de pareja/hogar.

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Zustand
- react-hook-form + zod
- Lucide
- Recharts
- Firebase SDK (Auth/Firestore para integracion futura)

## Sistema de diseno web

- La base visual vive en `src/app/globals.css` y `src/lib/design/tokens.ts`.
- Guia tecnica para agentes: `docs/WEB_DESIGN_SYSTEM.md`.
- Componentes base en `src/components/finance`.
- Ruta temporal de validacion visual: `/design-system`.
- Futuras tareas UI deben respetar estos tokens/componentes y la guia tecnica.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Variables de entorno

Crea `.env.local` a partir de `.env.local.example` cuando se conecte Firebase real.

Variables esperadas:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Notas importantes

- No usar `PROGRESS.md`.