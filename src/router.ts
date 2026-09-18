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
    { path: '*404', component: NotFound },
  ],
});
