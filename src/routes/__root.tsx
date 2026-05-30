import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, useRouterState, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { NetworkStatus } from "@/components/NetworkStatus";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">That link doesn't exist on StudentsPlug.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something broke</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Try again</button>
      </div>
    </div>
  );
}

function RouteLoadingIndicator() {
  const isLoading = useRouterState({ select: (state) => state.isLoading });
  if (!isLoading) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 pointer-events-none">
      <div className="h-1 w-full overflow-hidden bg-primary/10">
        <div className="route-loader-bar h-full w-1/2 rounded-r-full bg-hero shadow-glow" />
      </div>
      <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-bold text-primary shadow-card backdrop-blur-md">
        <span className="route-loader-dot" /> Loading StudentsPlug…
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "StudentsPlug — EBSU's student knowledge hub" },
      { name: "description", content: "Past questions, assignments, notes, quizzes and games for Ebonyi State University students. Post, level up, and pass with flying colours." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: ({ children }: { children: React.ReactNode }) => (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  ),
  component: () => {
    const { queryClient } = Route.useRouteContext();
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouteLoadingIndicator />
          <NetworkStatus />
          <Outlet />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </QueryClientProvider>
    );
  },
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
