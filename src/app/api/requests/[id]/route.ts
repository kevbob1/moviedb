import { prisma } from '@/lib/prisma';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(
  request: Request,
  { params }: { params: Promise<{ id: string }> } = { params: Promise.resolve({ id: '' }) }
) {
  try {
    const { id } = await params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await prisma.request.delete({
      where: { id: requestId },
    });

    return new Response(
      JSON.stringify({ success: true, id: requestId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error deleting request');
    return new Response(
      JSON.stringify({ error: 'Failed to delete request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const DELETE = withLogging(handler);
