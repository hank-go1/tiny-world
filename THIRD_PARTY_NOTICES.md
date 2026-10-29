# Third-party notices

The project MIT license does not replace third-party licenses.

| Material | Origin and notice |
| --- | --- |
| `build/sites-vite-plugin.ts` | Vendored OpenAI Sites Vite plugin, identified in its source as version 0.2.0. Locally modified to allow builds without optional hosting metadata. MIT license and OpenAI copyright retained in `build/sites-vite-plugin.LICENSE`. |
| `components/ui/` | shadcn-derived UI components from the application starter. Preserve the shadcn MIT notice in `vendor/shadcn-tailwind-4.13.0.LICENSE.md`; modified files remain subject to the notice. |
| `vendor/shadcn-tailwind-4.13.0.css` | Vendored shadcn stylesheet; accompanying MIT notice is retained. |
| npm dependencies | Exact versions, registries, and declared licenses are recorded in `package-lock.json`. Their source distributions contain their respective notices. Dependencies are installed separately; `node_modules` is excluded from the source export. |
| Images and SVG assets | Provenance and unresolved redistribution checks are documented in `docs/asset-provenance.md`. They are not automatically covered by the project code license. |

The dependency lock includes packages with MIT, Apache, BSD, ISC, MPL, LGPL and other licenses. A source publication is different from redistributing compiled binaries or dependency bundles. Preserve all notices and review applicable obligations when distributing a built application. The lockfile license fields are an inventory, not a legal clearance.

OpenAI, ChatGPT, TypeSafe, Jev, Cloudflare and other third-party names identify their products. No trademark license or endorsement is claimed.
