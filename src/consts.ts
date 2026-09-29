export const SITE_TITLE = 'Hari Pahwandi';
export const SITE_DESCRIPTION =
  'Free, privacy-friendly online tools by Hari Pahwandi. Every tool runs entirely in your browser.';
export const SITE_AUTHOR = 'Hari Pahwandi';

export const GOOGLE_ANALYTICS_ID = 'G-V249GRDSTD';

export interface Tool {
  name: string;
  description: string;
  href: string;
}

export interface ToolCategory {
  name: string;
  tools: Tool[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: 'JSON',
    tools: [
      {
        name: 'JS Object to JSON',
        description:
          'Convert a JavaScript object literal to valid, formatted JSON. Handles unquoted keys, single quotes, and trailing commas.',
        href: '/js-object-to-json',
      },
      {
        name: 'JSON Formatter',
        description:
          'Prettify, minify, and validate JSON with syntax highlighting.',
        href: '/json-formatter',
      },
      {
        name: 'JSON to CSV',
        description:
          'Convert an array of JSON objects to CSV with nested flattening and delimiter selection.',
        href: '/json-to-csv',
      },
    ],
  },
  {
    name: 'Image',
    tools: [
      {
        name: 'EXIF Stripper',
        description:
          'View and remove hidden metadata — EXIF, GPS location, XMP — from photos. Lossless for JPEG and PNG.',
        href: '/exif-stripper',
      },
      {
        name: 'Image Compressor',
        description:
          'Compress PNG, JPEG, WebP, and AVIF images — quality presets or target size in KB.',
        href: '/image-compressor',
      },
      {
        name: 'Image Cropper',
        description:
          'Crop a region — rectangle or circle, drag the box, lock an aspect ratio.',
        href: '/image-cropper',
      },
      {
        name: 'Image Format Converter',
        description:
          'Convert images between PNG, JPEG, WebP, and AVIF with a quality slider and before/after diff.',
        href: '/image-converter',
      },
      {
        name: 'Image Resizer',
        description:
          'Batch-resize images by percentage, exact size, or max dimensions — social-card presets.',
        href: '/image-resizer',
      },
      {
        name: 'Image to Data URI',
        description:
          'Convert an image to a base64 data URI — CSS and HTML snippets, URL-encoded SVG output, size stats.',
        href: '/image-to-data-uri',
      },
      {
        name: 'Image to Favicon',
        description:
          'Generate a full favicon set from an image — PNG sizes, .ico, maskable icons, and a web manifest.',
        href: '/image-to-favicon',
      },
      {
        name: 'Image Watermark',
        description:
          'Stamp a text or image watermark onto photos — position, opacity, rotation, tiling.',
        href: '/image-watermark',
      },
    ],
  },
  {
    name: 'Dev Misc',
    tools: [
      {
        name: 'Code Minifier & Formatter',
        description:
          'Minify or beautify HTML, CSS, and JavaScript right in the browser — with size stats, copy, and download.',
        href: '/code-minifier',
      },
      {
        name: 'Color Converter',
        description:
          'Convert between HEX, RGB, HSL, and named colors — with a WCAG contrast checker for accessible color pairs.',
        href: '/color-converter',
      },
      {
        name: 'Cron Generator',
        description:
          'Build a cron expression from a form — frequency, time, weekdays, month days, or intervals — with a live preview.',
        href: '/cron-generator',
      },
      {
        name: 'Cron Parser',
        description:
          'Explain a cron expression in plain English, validate each field, and preview the next run times.',
        href: '/cron-parser',
      },
      {
        name: 'CSS Gradient Generator',
        description:
          'Design linear and radial CSS gradients — angle, shape, color stops, live preview, ready-to-paste CSS.',
        href: '/gradient-generator',
      },
      {
        name: 'JWT Decoder',
        description:
          'Inspect a JSON Web Token — decode header and payload, read claims, check expiry, and verify HMAC signatures locally.',
        href: '/jwt-decoder',
      },
      {
        name: 'Regex Tester',
        description:
          'Test a regular expression against text — live match highlighting, capture groups, replace preview, and a cheatsheet.',
        href: '/regex-tester',
      },
      {
        name: 'Unix Timestamp Converter',
        description:
          'Convert Unix timestamps to human-readable dates and back — seconds or milliseconds, live clock, relative time.',
        href: '/timestamp-converter',
      },
    ],
  },
];
