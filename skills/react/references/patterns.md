# React patterns

Rewritten for this plugin from react.dev (You Might Not Need an Effect, the hook references, the React 19 and 19.2 posts), the react-patterns, react-testing and frontend-a11y skills in affaan-m/ECC (MIT), the react-dev and react-useeffect skills in davila7/claude-code-templates (MIT), the react-state-management skill in wshobson/agents (MIT), and the TanStack Query docs. Examples are short on purpose; copy the project's own style over these.

## Derive, don't sync

```tsx
// wrong: a second copy of the data that lags one render behind
const [visible, setVisible] = useState<Todo[]>([]);
useEffect(() => setVisible(todos.filter((t) => t.tab === tab)), [todos, tab]);

// right: compute it; add useMemo only after measuring a slow filter
const visible = todos.filter((t) => t.tab === tab);
```

## Reset with a key, store ids not objects

```tsx
// every piece of state inside Profile resets when userId changes
<Profile key={userId} userId={userId} />

// keep the id and derive the object: the selection survives a list refresh
const [selectedId, setSelectedId] = useState<string | null>(null);
const selected = items.find((i) => i.id === selectedId) ?? null;
```

## An effect that is worth writing: cleanup and a race

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(setResults)
    .catch((e) => { if (e.name !== 'AbortError') setError(e); });
  return () => controller.abort(); // a newer query aborts the older request
}, [query]);
```

It still has no cache, dedupe or retry; a query library or loader replaces all of it. Keep this shape for subscriptions and imperative APIs, and for the rare unshared read.

## useEffectEvent: read the latest value without re-subscribing (19.2+)

```tsx
function ChatRoom({ roomId, theme }: { roomId: string; theme: Theme }) {
  const onConnected = useEffectEvent(() => showToast('Connected', theme));

  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('connected', () => onConnected());
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]); // theme changes do not reconnect; the Effect Event is not a dependency
}
```

Use it only for logic that is an event fired from an effect. If the value should re-run the effect, it belongs in the dependencies.

## Synchronizing with a DOM API is a legitimate effect

```tsx
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal(); // focus handling, Esc and an inert background come with it
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="modal-title">{children}</dialog>;
}
```

## Subscribing to a store

```tsx
function useOnlineStatus() {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener('online', notify);
      window.addEventListener('offline', notify);
      return () => {
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
      };
    },
    () => navigator.onLine, // snapshot: same value until it really changes
    () => true,             // server snapshot
  );
}
```

## Context with a guard hook

```tsx
const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const value = useMemo(() => ({ theme, setTheme }), [theme]); // plain object is fine with the Compiler on
  return <ThemeContext value={value}>{children}</ThemeContext>; // 19: no .Provider
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
```

Split a context when its parts change at different rates, or the slow consumers re-render for nothing.

## Form with actions (client-side)

```tsx
type State = { error: string | null; values: { name: string } };

async function renameAction(_prev: State, formData: FormData): Promise<State> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Enter a name', values: { name } }; // expected failure: return it, do not throw
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.ok ? { error: null, values: { name } } : { error: 'Could not save, try again', values: { name } };
}

function SubmitButton() {
  const { pending } = useFormStatus(); // child of the form, so it can read the form
  return <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>;
}

export function RenameForm() {
  const [state, formAction] = useActionState(renameAction, { error: null, values: { name: '' } });
  return (
    <form action={formAction}>
      <label htmlFor="name">Name</label>
      <input
        id="name" name="name" required
        defaultValue={state.values.name} // React resets uncontrolled fields after the action, so re-supply the value
        aria-invalid={!!state.error}
        aria-describedby={state.error ? 'name-error' : undefined}
      />
      {state.error && <p id="name-error" role="alert">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

A Server Function replaces `renameAction` the same way in a framework that has them; authenticate and authorize inside it.

## useOptimistic

```tsx
type Todo = { id: string; title: string; pending?: boolean };

function Todos({ todos, addTodo }: { todos: Todo[]; addTodo: (title: string) => Promise<void> }) {
  const [shown, addOptimistic] = useOptimistic(todos, (current, title: string) => [
    ...current,
    { id: `pending-${title}`, title, pending: true },
  ]);

  async function action(formData: FormData) {
    const title = String(formData.get('title'));
    addOptimistic(title); // inside the Action, so it holds until the Action settles
    await addTodo(title); // the parent updates `todos`; if this throws, the item disappears
  }

  return (
    <>
      <ul>{shown.map((t) => <li key={t.id} aria-busy={t.pending}>{t.title}</li>)}</ul>
      <form action={action}>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required />
        <button type="submit">Add</button>
      </form>
    </>
  );
}
```

## use with a stable promise

```tsx
// the loader (or a Server Component) creates the promise once and does not await it
export function loader() {
  return { user: fetchUser() };
}

function Profile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // suspends; a rejection goes to the nearest error boundary
  return <h1>{user.name}</h1>;
}

// <ErrorBoundary FallbackComponent={RouteError}><Suspense fallback={<Skeleton />}>
//   <Profile userPromise={user} />
// </Suspense></ErrorBoundary>
```

## TanStack Query: query, mutation, optimistic row from variables

```tsx
const todosQuery = queryOptions({ queryKey: ['todos'], queryFn: fetchTodos }); // fetchTodos throws on non-2xx

function Todos() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(todosQuery);
  const add = useMutation({
    mutationFn: addTodo,
    onSettled: () => queryClient.invalidateQueries({ queryKey: todosQuery.queryKey }),
  });

  if (isPending) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  return (
    <ul>
      {data.map((t) => <li key={t.id}>{t.title}</li>)}
      {add.isPending && <li aria-busy="true">{add.variables}</li>}
    </ul>
  );
}
```

When several components show the list, write the cache instead: `cancelQueries`, `setQueryData` and return the snapshot from `onMutate`, restore it in `onError`, `invalidateQueries` in `onSettled`.

## Error boundary around Suspense

```tsx
<ErrorBoundary FallbackComponent={RouteError} resetKeys={[routeKey]}>
  <Suspense fallback={<PageSkeleton />}>
    <Page />
  </Suspense>
</ErrorBoundary>
```

Errors in event handlers and timers never reach it: catch them where they happen and set state.

## Composition over boolean props

```tsx
// avoid: <Card isCompact hasFooter isClickable noBorder />
<Card>
  <Card.Header>Invoice 42</Card.Header>
  <Card.Body>...</Card.Body>
  <Card.Footer><Button>Pay</Button></Card.Footer>
</Card>
```

Share internal state between the parts with a context that only the parent exports a hook for. Prefer `children` and slots over render props; a hook usually returns the same data more simply.

## Typing: unions, generics, ref as a prop

```tsx
type ActionProps =
  | { kind: 'link'; href: string }
  | { kind: 'button'; onClick: () => void };

function Action(props: ActionProps & { children: React.ReactNode }) {
  return props.kind === 'link'
    ? <a href={props.href}>{props.children}</a>
    : <button type="button" onClick={props.onClick}>{props.children}</button>;
}

type TextFieldProps = React.ComponentPropsWithoutRef<'input'> & {
  label: string;
  ref?: React.Ref<HTMLInputElement>; // React 19: no forwardRef
};

function TextField({ label, ref, id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} ref={ref} {...rest} />
    </>
  );
}

function List<T extends { id: string }>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) {
  return <ul>{items.map((item) => <li key={item.id}>{render(item)}</li>)}</ul>;
}
```

## Accessible status message

```tsx
// the live region is always in the DOM; only its text changes
<div role="status" aria-live="polite">{saving ? 'Saving...' : savedAt ? `Saved at ${savedAt}` : ''}</div>
```

## Tests

```tsx
// test-utils.tsx: providers once, a fresh QueryClient per call (swap MemoryRouter for the project's router)
export function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
```

```ts
// test/server.ts (MSW 3; on MSW 2 import http and HttpResponse from 'msw' and use onUnhandledRequest)
import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';

export const server = setupServer(
  http.get('/api/todos', () => HttpResponse.json([{ id: '1', title: 'Write tests' }])),
);

// test/setup.ts
beforeAll(() => server.listen({ onUnhandledFrame: 'error' })); // an unmocked request fails the test
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```tsx
test('adds a todo', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Todos />);

  expect(await screen.findByText('Write tests')).toBeInTheDocument(); // jest-dom matcher, if the project has it
  await user.type(screen.getByLabelText('Title'), 'Ship it');
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByText('Ship it')).toBeInTheDocument();
});

test('shows the error state on a 500', async () => {
  server.use(http.get('/api/todos', () => new HttpResponse(null, { status: 500 })));
  renderWithProviders(<Todos />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

test('hook updates through act', () => {
  const { result } = renderHook(() => useCounter(0));
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});
```

An error boundary test needs `console.error` silenced for the expected throw; restore the spy in a `finally` so it cannot hide real errors in later tests.
