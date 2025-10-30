declare module '*.svelte' {
  import { SvelteComponent } from 'svelte';
  export default class extends SvelteComponent<any, any, any> {}
}

declare global {
  interface Window {
    gameInstance?: any;
  }
}
