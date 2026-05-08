// SockJS-client expects Node's `global` symbol. Angular doesn't polyfill it
// in the browser. Map it to `window` here so this file runs first via the
// `polyfills` entry in angular.json — before any module that imports SockJS.
(window as any).global = window;
