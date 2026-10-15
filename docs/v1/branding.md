# GRD branding and assets

## Provenance

Observed and downloaded from the official [GRD website](https://www.globalresourcesdirect.com/)
on 2026-10-15. The browser asset inventory was used because a direct command-line
request received the site's automated-traffic security page.

| Local asset                                                                            | Source / transformation                                                                                                                                                      |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`public/brand/grd-logo.svg`](../../public/brand/grd-logo.svg)                         | Unmodified [official logo](https://www.globalresourcesdirect.com/assets/images/template/logo.svg).                                                                           |
| [`public/brand/grd-original-favicon.ico`](../../public/brand/grd-original-favicon.ico) | Unmodified [website favicon](https://www.globalresourcesdirect.com/favicon.ico), a single 16×16 image.                                                                       |
| [`public/favicon.svg`](../../public/favicon.svg)                                       | Official vector artwork with viewBox changed from `0 0 1580 470.17` to `-12 -36.915 544 544`, framing the globe-and-GRD mark. The off-canvas wordmark remains in the source. |
| [`public/favicon.ico`](../../public/favicon.ico)                                       | Rendered from that vector framing with ImageMagick; 16, 32, 48, 64, 128, and 256-pixel sizes.                                                                                |

No logo was redrawn or generated. Keep the original source files unchanged.
The source logo SHA-256 is
`a96e21d4619fa34dd579f6d3f4e5f08b8c6aa34be672464e06514ac6f6cc346f`;
the original favicon SHA-256 is
`adf3337c2c1d619e3be3a5ec8072dd7cbee4bb749a70cbe2c0453b782128fff2`.

## Theme direction

Values verified in the site's rendered styles and `css/styles_less.css?v=1`:

| Token reference | Website value | Dashboard use                               |
| --------------- | ------------- | ------------------------------------------- |
| Brand blue      | `#0152A0`     | Primary actions and selected navigation     |
| Gold            | `#F8D287`     | Accent surfaces and emphasis with dark text |
| Charcoal        | `#2B2B2B`     | Light-theme foreground reference            |
| Pale blue       | `#EFFBFF`     | Subtle tinted surfaces                      |
| Light gray      | `#F0F1F3`     | Neutral surface reference                   |

Translate these into semantic shadcn CSS tokens; do not assign brand colors to
every status. Failed, paused, delivered, and active need distinct accessible
labels/icons as well as color. Verify actual foreground/background contrast for
both themes; gold is not a default white-text button background.

The website uses Open Sans for body text and `freight-sans-pro` for headings.
The Adobe-hosted heading font is a reference, not a copied/licensed dashboard
asset. Use the system/Open Sans fallback described in decisions.md until font
delivery is explicitly selected. Retain Tom's compact application layout rather
than the marketing site's navigation, photography, or promotional sections.

In dark mode, display the official dark-lettered wordmark on a neutral light logo
surface so it remains legible. Keep the mark's aspect ratio. The browser favicon
uses the standalone globe/GRD framing. Scaffolding must wire SVG plus ICO fallback
and verify both at actual tab sizes; vector detail still has a physical limit at
16 pixels.

## Preferences and layout

Respect system light/dark preference until the user picks a mode; persist the
explicit choice and apply it before first paint. Use Tom's desktop sidebar,
mobile navigation drawer, clear page headings, and keyboard-friendly controls.
Handle reduced motion and responsive tables without making mobile users depend
on hover interactions.
