import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

    // Check if request exists
    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete the request
    await prisma.request.delete({
      where: { id: requestId },
    });

    return new Response(
      JSON.stringify({ success: true, id: requestId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting request:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}