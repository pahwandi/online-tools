import { createRouter } from '@solidjs/router';
import Home from './pages/Home';
import JsObjectToJson from './pages/JsObjectToJson';
import JsonFormatter from './pages/JsonFormatter';
import JsonToCsv from './pages/JsonToCsv';
import ImageCompressor from './pages/ImageCompressor';
import ImageConverter from './pages/ImageConverter';
import ImageCropper from './pages/ImageCropper';
import ImageResizer from './pages/ImageResizer';
import ImageToFavicon from './pages/ImageToFavicon';
import ImageWatermark from './pages/ImageWatermark';
import ImageToDataUri from './pages/ImageToDataUri';
import ExifStripper from './pages/ExifStripper';
import TimestampConverter from './pages/TimestampConverter';
import CronParser from './pages/CronParser';
import CronGenerator from './pages/CronGenerator';
import ColorConverter from './pages/ColorConverter';
import GradientGenerator from './pages/GradientGenerator';
import CodeMinifier from './pages/CodeMinifier';
import JwtDecoder from './pages/JwtDecoder';
import RegexTester from './pages/RegexTester';
import NotFound from './pages/NotFound';

export const Router = createRouter({
  routes: [
    { path: '/', component: Home },
    { path: '/js-object-to-json', component: JsObjectToJson },
    { path: '/json-formatter', component: JsonFormatter },
    { path: '/json-to-csv', component: JsonToCsv },
    { path: '/image-compressor', component: ImageCompressor },
    { path: '/image-converter', component: ImageConverter },
    { path: '/image-cropper', component: ImageCropper },
    { path: '/image-resizer', component: ImageResizer },
    { path: '/image-to-favicon', component: ImageToFavicon },
    { path: '/image-watermark', component: ImageWatermark },
    { path: '/image-to-data-uri', component: ImageToDataUri },
    { path: '/exif-stripper', component: ExifStripper },
    { path: '/timestamp-converter', component: TimestampConverter },
    { path: '/cron-parser', component: CronParser },
    { path: '/cron-generator', component: CronGenerator },
    { path: '/color-converter', component: ColorConverter },
    { path: '/gradient-generator', component: GradientGenerator },
    { path: '/code-minifier', component: CodeMinifier },
    { path: '/jwt-decoder', component: JwtDecoder },
    { path: '/regex-tester', component: RegexTester },
    { path: '*404', component: NotFound },
  ],
});
