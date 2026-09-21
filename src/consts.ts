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
];
