import { Compass, TriangleAlert } from 'lucide-react';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { Button, buttonClasses } from '@/ui/Button';
import { EmptyState } from '@/ui/Display';

export function NotFoundPage({ message = 'That page doesn’t exist, or it may have moved.' }: { message?: string }) {
  return (
    <div className='grid min-h-dvh place-items-center bg-canvas'>
      <EmptyState
        icon={<Compass className='size-6' />}
        title='Not found'
        action={
          <Link to='/' className={buttonClasses({ variant: 'secondary' })}>
            Go home
          </Link>
        }
      >
        {message} If you’re at a table, try scanning its QR code again.
      </EmptyState>
    </div>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  console.error(error);
  return (
    <div className='grid min-h-dvh place-items-center bg-canvas'>
      <EmptyState
        icon={<TriangleAlert className='size-6' />}
        title='Something went wrong'
        action={<Button onClick={() => window.location.reload()}>Reload</Button>}
      >
        An unexpected error occurred. Reloading usually fixes it.
      </EmptyState>
    </div>
  );
}
