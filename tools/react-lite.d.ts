// OFFLINE-ONLY typing shim.
//
// The sandbox this project was first built in cannot reach the npm registry, so
// @types/react is unavailable. This file declares the small subset of the React
// API that ForgeTools uses so `npm run offline:typecheck` can still type-check
// application code. It is NOT used by the normal `tsc`/`vite build` path, where
// the real @types/react applies. Delete it once dependencies install normally.

declare module 'react' {
  export type ReactNode = any;
  export type ReactElement = any;
  export type Key = string | number;
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type FC<P = {}> = (props: P) => ReactNode;
  export type PropsWithChildren<P = {}> = P & { children?: ReactNode };
  export type RefObject<T> = { current: T | null };
  export type ChangeEvent<T = any> = { target: T; currentTarget: T; preventDefault(): void };
  export type FormEvent<T = any> = { target: T; currentTarget: T; preventDefault(): void };
  export type MouseEvent<T = any> = { target: any; currentTarget: T; preventDefault(): void; stopPropagation(): void; metaKey: boolean; ctrlKey: boolean };
  export type KeyboardEvent<T = any> = { key: string; target: any; currentTarget: T; preventDefault(): void; stopPropagation(): void; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean };
  export type CSSProperties = Record<string, string | number>;

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): { current: T };
  export function useRef<T>(initial: T | null): RefObject<T>;
  export function useId(): string;
  export function useReducer<S, A>(reducer: (s: S, a: A) => S, initial: S): [S, Dispatch<A>];
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => T): T;
  export function createContext<T>(def: T): { Provider: FC<{ value: T; children?: ReactNode }> };
  export function useContext<T>(ctx: { Provider: FC<{ value: T; children?: ReactNode }> }): T;
  export function memo<T>(c: T): T;
  export const Fragment: FC<{ children?: ReactNode }>;
  export const StrictMode: FC<{ children?: ReactNode }>;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'react-dom/client' {
  export function createRoot(el: Element | DocumentFragment): { render(node: any): void; unmount(): void };
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface IntrinsicAttributes {
    key?: string | number;
  }
  type Element = any;
}
