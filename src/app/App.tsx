import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { bindRealtimeToQueries } from '@/lib/realtime';
import { router } from './router';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
  });
}

export function App() {
  const [queryClient] = useState(makeQueryClient);
  useEffect(() => bindRealtimeToQueries(queryClient), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position='top-center'
        toastOptions={{
          classNames: {
            toast: '!rounded-2xl !border-line !bg-surface !text-ink !shadow-float !font-sans',
            description: '!text-ink-muted',
          },
        }}
      />
    </QueryClientProvider>
  );
}
